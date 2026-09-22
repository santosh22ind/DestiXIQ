import { createServiceClient } from "@/lib/supabase/server";
import { getOrCreateSourceId, readRawSignalCache, writeRawSignalCache } from "./cache";
import type { CollectorResult, NormalizedSignal, SignalSeverity } from "./state";

const SOURCE_NAME = "Open-Meteo";
const SOURCE_BASE_URL = "https://open-meteo.com";
const CACHE_TTL_SECONDS = 1800;
const FETCH_TIMEOUT_MS = 4000;

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

export async function runWeatherAgent(destination: {
  id: string;
  lat: number | null;
  lng: number | null;
}): Promise<CollectorResult> {
  if (destination.lat == null || destination.lng == null) {
    return { category: "weather", sourceName: SOURCE_NAME, status: "skipped", items: [] };
  }

  const supabase = createServiceClient();
  const sourceId = await getOrCreateSourceId(supabase, "weather", SOURCE_NAME, SOURCE_BASE_URL);

  const cached = await readRawSignalCache(supabase, destination.id, sourceId);
  if (cached) return cached;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${destination.lat}&longitude=${destination.lng}` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
      `&timezone=auto&forecast_days=5`;

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) throw new Error(`Open-Meteo responded ${res.status}`);
    const data = await res.json();

    const items: NormalizedSignal[] = data.daily.time.map((date: string, i: number) => {
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

    const result: CollectorResult = { category: "weather", sourceName: SOURCE_NAME, status: "ok", items };
    await writeRawSignalCache(supabase, destination.id, sourceId, result, CACHE_TTL_SECONDS);
    return result;
  } catch (err) {
    return {
      category: "weather",
      sourceName: SOURCE_NAME,
      status: err instanceof Error && err.name === "AbortError" ? "timeout" : "error",
      items: [],
    };
  }
}
