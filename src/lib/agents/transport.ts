import { createServiceClient } from "@/lib/supabase/server";
import { getOrCreateSourceId, readRawSignalCache, writeRawSignalCache } from "./cache";
import { extractBlocks, extractTag } from "./xml";
import { DESTINATION_AIRPORTS } from "./countries";
import type { CollectorResult, NormalizedSignal } from "./state";

const SOURCE_NAME = "FAA NAS Status";
const SOURCE_BASE_URL = "https://nasstatus.faa.gov";
const CACHE_TTL_SECONDS = 900;
const FETCH_TIMEOUT_MS = 6000;

// AviationStack (global coverage) is deferred — no API key configured yet
// and its free tier is too low-volume (100 req/month) to rely on; see
// docs/sources.md §5. FAA-only means non-US destinations always skip.

async function fetchFaaStatus(airportCodes: string[]): Promise<NormalizedSignal[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch("https://nasstatus.faa.gov/api/airport-status-information", {
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
  if (!res.ok) throw new Error(`FAA responded ${res.status}`);
  const xml = await res.text();

  const items: NormalizedSignal[] = [];
  for (const delayBlock of extractBlocks(xml, "Delay_type")) {
    const name = extractTag(delayBlock, "Name");
    for (const airportBlock of extractBlocks(delayBlock, "Airport")) {
      const arpt = extractTag(airportBlock, "ARPT");
      if (!airportCodes.includes(arpt)) continue;
      items.push({
        title: `${arpt}: ${name}`,
        description: extractTag(airportBlock, "Reason") || name,
        severity: "advisory",
        timestamp: new Date().toISOString(),
        sourceName: SOURCE_NAME,
      });
    }
  }
  return items;
}

export async function runTransportAgent(destination: {
  id: string;
  name: string;
  countryCode: string;
}): Promise<CollectorResult> {
  const airportCodes = DESTINATION_AIRPORTS[destination.name];
  if (!airportCodes || destination.countryCode !== "US") {
    return { category: "transport", sourceName: SOURCE_NAME, status: "skipped", items: [] };
  }

  const supabase = createServiceClient();
  const sourceId = await getOrCreateSourceId(supabase, "transport", SOURCE_NAME, SOURCE_BASE_URL);
  const cached = await readRawSignalCache(supabase, destination.id, sourceId);
  if (cached) return cached;

  try {
    const items = await fetchFaaStatus(airportCodes);
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
