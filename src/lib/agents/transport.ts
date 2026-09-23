import { createServiceClient } from "@/lib/supabase/server";
import { getOrCreateSourceId, readRawSignalCache, writeRawSignalCache } from "./cache";
import { DESTINATION_AIRPORTS } from "./countries";
import type { CollectorResult, NormalizedSignal, SignalSeverity } from "./state";

const SOURCE_NAME = "AirLabs Flight Delays";
const SOURCE_BASE_URL = "https://airlabs.co";
const CACHE_TTL_SECONDS = 1800;
const FETCH_TIMEOUT_MS = 5000;

type AirLabsDelay = {
  flight_iata: string;
  dep_iata: string;
  arr_iata: string;
  delayed: number | null;
};

// AirLabs' /delays endpoint only lists currently-delayed flights, with no
// total-scheduled-flights denominator — 30-40 delayed departures averaging
// 60-90 min turns out to be routine background noise at a major hub, not a
// notable event. Thresholds are set high so only clearly abnormal
// congestion (not everyday hub traffic) nudges the overall risk label.
function severityFor(delayedCount: number, avgDelayMinutes: number): SignalSeverity {
  if (avgDelayMinutes >= 120 || delayedCount >= 50) return "warning";
  if (avgDelayMinutes >= 45 || delayedCount >= 20) return "advisory";
  return "info";
}

async function fetchAirportDelays(
  apiKey: string,
  airportCode: string,
): Promise<NormalizedSignal | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(
      `https://airlabs.co/api/v9/delays?dep_iata=${airportCode}&type=departures&api_key=${apiKey}`,
      { signal: controller.signal },
    );
  } finally {
    clearTimeout(timeout);
  }
  if (!res.ok) throw new Error(`AirLabs responded ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(`AirLabs error: ${data.error.message}`);

  const flights: AirLabsDelay[] = data.response ?? [];
  if (flights.length === 0) return null;

  const delays = flights.map((f) => f.delayed ?? 0);
  const avgDelay = Math.round(delays.reduce((sum, d) => sum + d, 0) / delays.length);
  const maxDelay = Math.max(...delays);

  return {
    title: `${airportCode}: ${flights.length} departures delayed`,
    description: `Average delay ~${avgDelay} min (max ${maxDelay} min) among ${flights.length} currently delayed departures.`,
    severity: severityFor(flights.length, avgDelay),
    timestamp: new Date().toISOString(),
    sourceName: SOURCE_NAME,
  };
}

export async function runTransportAgent(destination: {
  id: string;
  name: string;
  countryCode: string;
}): Promise<CollectorResult> {
  const apiKey = process.env.AIRLABS_API_KEY;
  const airportCodes = DESTINATION_AIRPORTS[destination.name];
  if (!apiKey || !airportCodes) {
    return { category: "transport", sourceName: SOURCE_NAME, status: "skipped", items: [] };
  }

  const supabase = createServiceClient();
  const sourceId = await getOrCreateSourceId(supabase, "transport", SOURCE_NAME, SOURCE_BASE_URL);
  const cached = await readRawSignalCache(supabase, destination.id, sourceId);
  if (cached) return cached;

  try {
    const results = await Promise.all(
      airportCodes.map((code) => fetchAirportDelays(apiKey, code)),
    );
    const items = results.filter((r): r is NormalizedSignal => r !== null);

    const result: CollectorResult = { category: "transport", sourceName: SOURCE_NAME, status: "ok", items };
    await writeRawSignalCache(supabase, destination.id, sourceId, result, CACHE_TTL_SECONDS);
    return result;
  } catch (err) {
    return {
      category: "transport",
      sourceName: SOURCE_NAME,
      status: err instanceof Error && err.name === "AbortError" ? "timeout" : "error",
      items: [],
    };
  }
}
