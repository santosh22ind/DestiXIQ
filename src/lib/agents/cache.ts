import type { SupabaseClient } from "@supabase/supabase-js";
import type { CollectorResult, SourceCategory } from "./state";

export async function getOrCreateSourceId(
  supabase: SupabaseClient,
  category: SourceCategory,
  name: string,
  baseUrl: string,
): Promise<string> {
  const { data: existing } = await supabase
    .from("sources")
    .select("id")
    .eq("category", category)
    .eq("name", name)
    .maybeSingle();

  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from("sources")
    .insert({ category, name, base_url: baseUrl })
    .select("id")
    .single();

  if (error) throw error;
  return created.id;
}

export async function readRawSignalCache(
  supabase: SupabaseClient,
  destinationId: string,
  sourceId: string,
): Promise<CollectorResult | null> {
  const { data } = await supabase
    .from("raw_signal_cache")
    .select("payload, status, expires_at")
    .eq("destination_id", destinationId)
    .eq("source_id", sourceId)
    .maybeSingle();

  if (!data) return null;
  if (new Date(data.expires_at).getTime() < Date.now()) return null;
  if (data.status !== "ok") return null;

  return data.payload as CollectorResult;
}

export async function writeRawSignalCache(
  supabase: SupabaseClient,
  destinationId: string,
  sourceId: string,
  result: CollectorResult,
  ttlSeconds: number,
) {
  await supabase.from("raw_signal_cache").upsert(
    {
      destination_id: destinationId,
      source_id: sourceId,
      payload: result,
      status: result.status,
      expires_at: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
    },
    { onConflict: "destination_id,source_id" },
  );
}
