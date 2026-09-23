import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/server";
import { getOrCreateSourceId, readRawSignalCache, writeRawSignalCache } from "./cache";
import type { CollectorResult, NormalizedSignal, SignalSeverity } from "./state";

const SOURCE_NAME = "Open-Meteo";
const SOURCE_BASE_URL = "https://open-meteo.com";
const CACHE_TTL_SECONDS = 1800;
const FETCH_TIMEOUT_MS = 4000;

const NWS_SOURCE_NAME = "NWS Alerts";
const NWS_SOURCE_BASE_URL = "https://api.weather.gov";
// Alerts change faster than a 5-day forecast, so this gets a shorter TTL
// than the Open-Meteo cache below.
const NWS_CACHE_TTL_SECONDS = 600;

// NWS's own severity scale, mapped to ours. "Extreme" (e.g. tornado
// emergency) is the one case where weather alone should be able to push
// the overall risk label, hence "critical" rather than capping at "warning"
// like the transport collector does.
const NWS_SEVERITY_MAP: Record<string, SignalSeverity> = {
  Extreme: "critical",
  Severe: "warning",
  Moderate: "advisory",
  Minor: "info",
  Unknown: "info",
};

type NwsAlertProperties = {
  event: string;
  headline: string;
  description: string;
  severity: string;
  effective: string;
  expires: string;
};

async function fetchNwsAlerts(lat: number, lng: number): Promise<NormalizedSignal[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`https://api.weather.gov/alerts/active?point=${lat},${lng}`, {
      signal: controller.signal,
      headers: {
        "User-Agent": "(DestiXIQ, a travel briefing app)",
        Accept: "application/geo+json",
      },
    });
  } finally {
    clearTimeout(timeout);
  }
  if (!res.ok) throw new Error(`NWS responded ${res.status}`);
  const data = await res.json();

  const features: { properties: NwsAlertProperties }[] = data.features ?? [];
  return features.map(({ properties: p }) => ({
    title: p.event,
    description: p.headline || p.description.slice(0, 400),
    severity: NWS_SEVERITY_MAP[p.severity] ?? "info",
    timestamp: p.effective ?? new Date().toISOString(),
    sourceName: NWS_SOURCE_NAME,
  }));
}

async function getNwsAlertItems(
  supabase: SupabaseClient,
  destinationId: string,
  lat: number,
  lng: number,
): Promise<NormalizedSignal[]> {
  const sourceId = await getOrCreateSourceId(supabase, "weather", NWS_SOURCE_NAME, NWS_SOURCE_BASE_URL);
  const cached = await readRawSignalCache(supabase, destinationId, sourceId);
  if (cached) return cached.items;

  const items = await fetchNwsAlerts(lat, lng);
  const result: CollectorResult = { category: "weather", sourceName: NWS_SOURCE_NAME, status: "ok", items };
  await writeRawSignalCache(supabase, destinationId, sourceId, result, NWS_CACHE_TTL_SECONDS);
  return items;
}

const WEATHER_CODE_DESCRIPTIONS: Record<number, string> = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Freezing fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Dense drizzle",
  61: "Slight rain",
  63: "Moderate rain",
  65: "Heavy rain",
  71: "Slight snow",
  73: "Moderate snow",
  75: "Heavy snow",
  80: "Slight rain showers",
  81: "Moderate rain showers",
  82: "Violent rain showers",
  95: "Thunderstorm",
  96: "Thunderstorm with slight hail",
  99: "Thunderstorm with heavy hail",
};

function severityForCode(code: number): SignalSeverity {
  if ([95, 96, 99].includes(code)) return "warning";
  if ([65, 75, 82].includes(code)) return "advisory";
  return "info";
}

async function fetchOpenMeteoForecast(lat: number, lng: number): Promise<NormalizedSignal[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
    `&timezone=auto&forecast_days=5`;

  let res: Response;
  try {
    res = await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
  if (!res.ok) throw new Error(`Open-Meteo responded ${res.status}`);
  const data = await res.json();

  return data.daily.time.map((date: string, i: number) => {
    const code = data.daily.weather_code[i];
    const max = data.daily.temperature_2m_max[i];
    const min = data.daily.temperature_2m_min[i];
    const precipProb = data.daily.precipitation_probability_max?.[i];
    const description = WEATHER_CODE_DESCRIPTIONS[code] ?? `Weather code ${code}`;

    return {
      title: `${description} — ${date}`,
      description: `High ${max}°C / Low ${min}°C.${
        precipProb != null ? ` ${precipProb}% chance of precipitation.` : ""
      }`,
      severity: severityForCode(code),
      timestamp: new Date(date).toISOString(),
      sourceName: SOURCE_NAME,
    };
  });
}

async function getForecastItems(
  supabase: SupabaseClient,
  destinationId: string,
  lat: number,
  lng: number,
): Promise<NormalizedSignal[]> {
  const sourceId = await getOrCreateSourceId(supabase, "weather", SOURCE_NAME, SOURCE_BASE_URL);
  const cached = await readRawSignalCache(supabase, destinationId, sourceId);
  if (cached) return cached.items;

  const items = await fetchOpenMeteoForecast(lat, lng);
  const result: CollectorResult = { category: "weather", sourceName: SOURCE_NAME, status: "ok", items };
  await writeRawSignalCache(supabase, destinationId, sourceId, result, CACHE_TTL_SECONDS);
  return items;
}

export async function runWeatherAgent(destination: {
  id: string;
  lat: number | null;
  lng: number | null;
  countryCode: string;
}): Promise<CollectorResult> {
  if (destination.lat == null || destination.lng == null) {
    return { category: "weather", sourceName: SOURCE_NAME, status: "skipped", items: [] };
  }

  const supabase = createServiceClient();

  let forecastItems: NormalizedSignal[];
  try {
    forecastItems = await getForecastItems(supabase, destination.id, destination.lat, destination.lng);
  } catch (err) {
    return {
      category: "weather",
      sourceName: SOURCE_NAME,
      status: err instanceof Error && err.name === "AbortError" ? "timeout" : "error",
      items: [],
    };
  }

  // NWS alerts are a best-effort addition (US-only) — the forecast above
  // is the core signal, so a failure here shouldn't fail the whole
  // collector, just fall back to forecast-only.
  let alertItems: NormalizedSignal[] = [];
  if (destination.countryCode === "US") {
    try {
      alertItems = await getNwsAlertItems(supabase, destination.id, destination.lat, destination.lng);
    } catch {
      // swallow — forecast-only is an acceptable degraded result
    }
  }

  return {
    category: "weather",
    sourceName: SOURCE_NAME,
    status: "ok",
    items: [...forecastItems, ...alertItems],
  };
}
