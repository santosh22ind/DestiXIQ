import { createServiceClient } from "@/lib/supabase/server";
import { getOrCreateSourceId, readRawSignalCache, writeRawSignalCache } from "./cache";
import type { CollectorResult, NormalizedSignal } from "./state";

const SOURCE_NAME = "NewsData.io";
const SOURCE_BASE_URL = "https://newsdata.io";
const CACHE_TTL_SECONDS = 1800;
const FETCH_TIMEOUT_MS = 5000;

type NewsDataArticle = {
  title: string;
  description?: string;
  link: string;
  pubDate?: string;
};

export async function runNewsAgent(destination: {
  id: string;
  countryCode: string;
}): Promise<CollectorResult> {
  const apiKey = process.env.NEWSDATA_API_KEY;
  if (!apiKey) {
    return { category: "news", sourceName: SOURCE_NAME, status: "skipped", items: [] };
  }

  const supabase = createServiceClient();
  const sourceId = await getOrCreateSourceId(supabase, "news", SOURCE_NAME, SOURCE_BASE_URL);
  const cached = await readRawSignalCache(supabase, destination.id, sourceId);
  if (cached) return cached;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const url =
      `https://newsdata.io/api/1/news?apikey=${apiKey}` +
      `&country=${destination.countryCode.toLowerCase()}&language=en`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) throw new Error(`NewsData.io responded ${res.status}`);
    const data = await res.json();
    const results: NewsDataArticle[] = data.results ?? [];

    const items: NormalizedSignal[] = results.slice(0, 8).map((article) => ({
      title: article.title,
      description: (article.description ?? "").slice(0, 400),
      severity: "info",
      timestamp: article.pubDate ? new Date(article.pubDate).toISOString() : new Date().toISOString(),
      url: article.link,
      sourceName: SOURCE_NAME,
    }));

    const result: CollectorResult = { category: "news", sourceName: SOURCE_NAME, status: "ok", items };
    await writeRawSignalCache(supabase, destination.id, sourceId, result, CACHE_TTL_SECONDS);
    return result;
  } catch (err) {
    return {
      category: "news",
      sourceName: SOURCE_NAME,
      status: err instanceof Error && err.name === "AbortError" ? "timeout" : "error",
      items: [],
    };
  }
}
