import { createServiceClient } from "@/lib/supabase/server";
import { getOrCreateSourceId, readRawSignalCache, writeRawSignalCache } from "./cache";
import type { CollectorResult, NormalizedSignal } from "./state";

const SOURCE_NAME = "Ticketmaster Discovery API";
const SOURCE_BASE_URL = "https://app.ticketmaster.com";
const CACHE_TTL_SECONDS = 3600;
const FETCH_TIMEOUT_MS = 5000;

type TicketmasterEvent = {
  name: string;
  url: string;
  dates?: { start?: { localDate?: string; dateTime?: string } };
  _embedded?: { venues?: Array<{ name: string }> };
};

export async function runEventsAgent(destination: {
  id: string;
  name: string;
}): Promise<CollectorResult> {
  const apiKey = process.env.TICKETMASTER_API_KEY;
  if (!apiKey) {
    return { category: "events", sourceName: SOURCE_NAME, status: "skipped", items: [] };
  }

  const supabase = createServiceClient();
  const sourceId = await getOrCreateSourceId(supabase, "events", SOURCE_NAME, SOURCE_BASE_URL);
  const cached = await readRawSignalCache(supabase, destination.id, sourceId);
  if (cached) return cached;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const url =
      `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${apiKey}` +
      `&city=${encodeURIComponent(destination.name)}&size=5&sort=date,asc`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) throw new Error(`Ticketmaster responded ${res.status}`);
    const data = await res.json();
    const events: TicketmasterEvent[] = data._embedded?.events ?? [];

    const items: NormalizedSignal[] = events.map((e) => ({
      title: e.name,
      description: e.dates?.start?.localDate
        ? `On ${e.dates.start.localDate}${
            e._embedded?.venues?.[0]?.name ? ` at ${e._embedded.venues[0].name}` : ""
          }.`
        : "Upcoming event.",
      severity: "info",
      timestamp: e.dates?.start?.dateTime ?? new Date().toISOString(),
      url: e.url,
      sourceName: SOURCE_NAME,
    }));

    const result: CollectorResult = { category: "events", sourceName: SOURCE_NAME, status: "ok", items };
    await writeRawSignalCache(supabase, destination.id, sourceId, result, CACHE_TTL_SECONDS);
    return result;
  } catch (err) {
    return {
      category: "events",
      sourceName: SOURCE_NAME,
      status: err instanceof Error && err.name === "AbortError" ? "timeout" : "error",
      items: [],
    };
  }
}
