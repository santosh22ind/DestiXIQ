import { createServiceClient } from "@/lib/supabase/server";
import { getOrCreateSourceId, readRawSignalCache, writeRawSignalCache } from "./cache";
import { extractBlocks, extractTag } from "./xml";
import { COUNTRY_INFO } from "./countries";
import type { CollectorResult, NormalizedSignal } from "./state";

const CACHE_TTL_SECONDS = 3600;
const FETCH_TIMEOUT_MS = 5000;

async function fetchWithTimeout(url: string, options?: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchWhoOutbreaks(countryName: string): Promise<NormalizedSignal[]> {
  const url =
    "https://www.who.int/api/news/diseaseoutbreaknews?%24orderby=PublicationDate%20desc&%24top=20";
  const res = await fetchWithTimeout(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`WHO responded ${res.status}`);
  const data = await res.json();
  const items = (data.value ?? []) as Array<{
    Title: string;
    PublicationDate: string;
    UrlName: string;
  }>;

  return items
    .filter((item) => item.Title.toLowerCase().includes(countryName.toLowerCase()))
    .slice(0, 5)
    .map((item) => ({
      title: item.Title,
      description: "WHO Disease Outbreak News.",
      severity: "advisory" as const,
      timestamp: new Date(item.PublicationDate).toISOString(),
      url: `https://www.who.int/emergencies/disease-outbreak-news/item/${item.UrlName}`,
      sourceName: "WHO Disease Outbreak News",
    }));
}

async function fetchCdcNotices(countryName: string): Promise<NormalizedSignal[]> {
  const res = await fetchWithTimeout("https://wwwnc.cdc.gov/travel/rss/notices.xml");
  if (!res.ok) throw new Error(`CDC responded ${res.status}`);
  const xml = await res.text();

  return extractBlocks(xml, "item")
    .map((block) => ({
      title: extractTag(block, "title"),
      description: extractTag(block, "description").replace(/<[^>]+>/g, "").slice(0, 400),
      link: extractTag(block, "link"),
      pubDate: extractTag(block, "pubDate"),
    }))
    .filter((item) => item.title.toLowerCase().includes(countryName.toLowerCase()))
    .slice(0, 5)
    .map((item) => ({
      title: item.title,
      description: item.description,
      severity: "advisory" as const,
      timestamp: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
      url: item.link,
      sourceName: "CDC Travel Health Notices",
    }));
}

export async function runHealthAgent(destination: {
  id: string;
  countryCode: string;
}): Promise<CollectorResult> {
  const countryInfo = COUNTRY_INFO[destination.countryCode];
  if (!countryInfo) {
    return { category: "health", sourceName: "WHO + CDC", status: "skipped", items: [] };
  }

  const supabase = createServiceClient();
  const whoSourceId = await getOrCreateSourceId(
    supabase,
    "health",
    "WHO Disease Outbreak News",
    "https://www.who.int",
  );
  const cdcSourceId = await getOrCreateSourceId(
    supabase,
    "health",
    "CDC Travel Health Notices",
    "https://wwwnc.cdc.gov",
  );

  const [whoResult, cdcResult] = await Promise.allSettled([
    (async () => {
      const cached = await readRawSignalCache(supabase, destination.id, whoSourceId);
      if (cached) return cached.items;
      const items = await fetchWhoOutbreaks(countryInfo.name);
      await writeRawSignalCache(
        supabase,
        destination.id,
        whoSourceId,
        { category: "health", sourceName: "WHO Disease Outbreak News", status: "ok", items },
        CACHE_TTL_SECONDS,
      );
      return items;
    })(),
    (async () => {
      const cached = await readRawSignalCache(supabase, destination.id, cdcSourceId);
      if (cached) return cached.items;
      const items = await fetchCdcNotices(countryInfo.name);
      await writeRawSignalCache(
        supabase,
        destination.id,
        cdcSourceId,
        { category: "health", sourceName: "CDC Travel Health Notices", status: "ok", items },
        CACHE_TTL_SECONDS,
      );
      return items;
    })(),
  ]);

  const items: NormalizedSignal[] = [];
  if (whoResult.status === "fulfilled") items.push(...whoResult.value);
  if (cdcResult.status === "fulfilled") items.push(...cdcResult.value);

  if (whoResult.status === "rejected" && cdcResult.status === "rejected") {
    return { category: "health", sourceName: "WHO + CDC", status: "error", items: [] };
  }

  return { category: "health", sourceName: "WHO + CDC", status: "ok", items };
}
