import { createServiceClient } from "@/lib/supabase/server";
import { getOrCreateSourceId, readRawSignalCache, writeRawSignalCache } from "./cache";
import { COUNTRY_INFO } from "./countries";
import type { CollectorResult, NormalizedSignal } from "./state";

const CACHE_TTL_SECONDS = 3600;
const FETCH_TIMEOUT_MS = 6000;

async function fetchWithTimeout(url: string, options?: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function severityFromLevel(title: string): NormalizedSignal["severity"] {
  if (title.includes("Level 4")) return "critical";
  if (title.includes("Level 3")) return "warning";
  if (title.includes("Level 2")) return "advisory";
  return "info";
}

async function fetchUsStateDept(countryName: string): Promise<NormalizedSignal[]> {
  const res = await fetchWithTimeout("https://cadataapi.state.gov/api/TravelAdvisories");
  if (!res.ok) throw new Error(`US State Dept responded ${res.status}`);
  const data = (await res.json()) as Array<{
    Title: string;
    Summary: string;
    Link: string;
    Updated: string;
  }>;
  const match = data.find((d) => d.Title.startsWith(countryName));
  if (!match) return [];

  return [
    {
      title: match.Title,
      description: match.Summary.replace(/<[^>]+>/g, "").slice(0, 400),
      severity: severityFromLevel(match.Title),
      timestamp: new Date(match.Updated).toISOString(),
      url: match.Link,
      sourceName: "US State Department",
    },
  ];
}

async function fetchUkFcdo(slug: string): Promise<NormalizedSignal[]> {
  const res = await fetchWithTimeout(`https://www.gov.uk/api/content/foreign-travel-advice/${slug}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`UK FCDO responded ${res.status}`);
  const data = await res.json();
  const alertStatus: string[] = data.details?.alert_status ?? [];

  return [
    {
      title: `UK FCDO travel advice: ${data.title}`,
      description:
        (data.description ?? "").slice(0, 400) +
        (alertStatus.length ? ` Alert: ${alertStatus.join(", ")}.` : ""),
      severity: alertStatus.length ? "warning" : "info",
      timestamp: new Date(data.updated_at ?? Date.now()).toISOString(),
      url: `https://www.gov.uk${data.base_path}`,
      sourceName: "UK FCDO",
    },
  ];
}

export async function runAdvisoriesAgent(destination: {
  id: string;
  countryCode: string;
}): Promise<CollectorResult> {
  const countryInfo = COUNTRY_INFO[destination.countryCode];
  if (!countryInfo) {
    return { category: "advisories", sourceName: "US State Dept + UK FCDO", status: "skipped", items: [] };
  }

  const supabase = createServiceClient();
  const usSourceId = await getOrCreateSourceId(
    supabase,
    "advisories",
    "US State Department",
    "https://cadataapi.state.gov",
  );
  const ukSourceId = countryInfo.ukFcdoSlug
    ? await getOrCreateSourceId(supabase, "advisories", "UK FCDO", "https://www.gov.uk")
    : null;

  const tasks: Promise<NormalizedSignal[]>[] = [
    (async () => {
      const cached = await readRawSignalCache(supabase, destination.id, usSourceId);
      if (cached) return cached.items;
      const items = await fetchUsStateDept(countryInfo.name);
      await writeRawSignalCache(
        supabase,
        destination.id,
        usSourceId,
        { category: "advisories", sourceName: "US State Department", status: "ok", items },
        CACHE_TTL_SECONDS,
      );
      return items;
    })(),
  ];

  if (ukSourceId) {
    const slug = countryInfo.ukFcdoSlug!;
    tasks.push(
      (async () => {
        const cached = await readRawSignalCache(supabase, destination.id, ukSourceId);
        if (cached) return cached.items;
        const items = await fetchUkFcdo(slug);
        await writeRawSignalCache(
          supabase,
          destination.id,
          ukSourceId,
          { category: "advisories", sourceName: "UK FCDO", status: "ok", items },
          CACHE_TTL_SECONDS,
        );
        return items;
      })(),
    );
  }

  const results = await Promise.allSettled(tasks);
  const items: NormalizedSignal[] = [];
  let anySucceeded = false;
  for (const r of results) {
    if (r.status === "fulfilled") {
      anySucceeded = true;
      items.push(...r.value);
    }
  }

  if (!anySucceeded) {
    return { category: "advisories", sourceName: "US State Dept + UK FCDO", status: "error", items: [] };
  }

  return { category: "advisories", sourceName: "US State Dept + UK FCDO", status: "ok", items };
}
