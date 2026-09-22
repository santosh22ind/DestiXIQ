import type { SupabaseClient } from "@supabase/supabase-js";

export async function logAgentStep(
  supabase: SupabaseClient,
  agentRunId: string,
  nodeName: string,
  status: string,
  startedAt: Date,
  completedAt: Date,
  errorDetail?: string,
): Promise<string> {
  const { data, error } = await supabase
    .from("agent_run_steps")
    .insert({
      agent_run_id: agentRunId,
      node_name: nodeName,
      status,
      started_at: startedAt.toISOString(),
      completed_at: completedAt.toISOString(),
      latency_ms: completedAt.getTime() - startedAt.getTime(),
      error_detail: errorDetail ?? null,
    })
    .select("id")
    .single();

  if (error) throw error;
  return data.id;
}
