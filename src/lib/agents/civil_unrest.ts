import { createServiceClient } from "@/lib/supabase/server";
import { getOrCreateSourceId, readRawSignalCache, writeRawSignalCache } from "./cache";
import { COUNTRY_INFO } from "./countries";
import type { CollectorResult, NormalizedSignal } from "./state";

const SOURCE_NAME = "GDELT";
const SOURCE_BASE_URL = "https://api.gdeltproject.org";
const CACHE_TTL_SECONDS = 3600;
const FETCH_TIMEOUT_MS = 10000;

function parseGdeltDate(seendate: string): string {
  const match = seendate.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  if (!match) return new Date().toISOString();
  const [, y, m, d, h, mi, s] = match;
  return `${y}-${m}-${d}T${h}:${mi}:${s}Z`;
}

export async function runCivilUnrestAgent(destination: {
  id: string;
  countryCode: string;
}): Promise<CollectorResult> {
  const countryInfo = COUNTRY_INFO[destination.countryCode];
  if (!countryInfo) {
    return { category: "civil_unrest", sourceName: SOURCE_NAME, status: "skipped", items: [] };
  }

  const supabase = createServiceClient();
  const sourceId = await getOrCreateSourceId(supabase, "civil_unrest", SOURCE_NAME, SOURCE_BASE_URL);

  const cached = await readRawSignalCache(supabase, destination.id, sourceId);
  if (cached) return cached;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const query = encodeURIComponent(
      `(protest OR strike OR riot OR unrest) sourcecountry:${countryInfo.fips}`,
    );
    const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${query}&mode=artlist&maxrecords=8&format=json&timespan=7d`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) throw new Error(`GDELT responded ${res.status}`);
    const text = await res.text();
    const data = text ? JSON.parse(text) : { articles: [] };
    const articles = (data.articles ?? []) as Array<{
      title: string;
      url: string;
      seendate: string;
      domain: string;
    }>;

    const items: NormalizedSignal[] = articles.map((a) => ({
      title: a.title,
      description: `Reported by ${a.domain}.`,
      severity: "advisory",
      timestamp: parseGdeltDate(a.seendate),
      url: a.url,
      sourceName: SOURCE_NAME,
    }));

    const result: CollectorResult = { category: "civil_unrest", sourceName: SOURCE_NAME, status: "ok", items };
    await writeRawSignalCache(supabase, destination.id, sourceId, result, CACHE_TTL_SECONDS);
    return result;
  } catch (err) {
    return {
      category: "civil_unrest",
      sourceName: SOURCE_NAME,
      status: err instanceof Error && err.name === "AbortError" ? "timeout" : "error",
      items: [],
    };
  }
}
