import { NextResponse } from "next/server";
import { z } from "zod";
import { createAuthClient } from "@/lib/supabase/server-client";
import { createServiceClient } from "@/lib/supabase/server";
import { runBriefingGraph } from "@/lib/agents/graph";
import { checkAndIncrementRateLimit } from "@/lib/agents/rate-limit";

const requestSchema = z.object({
  destinationId: z.string().uuid(),
  dateRangeStart: z.string(),
  dateRangeEnd: z.string(),
  forceRegenerate: z.boolean().default(false),
});

export async function POST(request: Request) {
  const authClient = await createAuthClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { destinationId, dateRangeStart, dateRangeEnd, forceRegenerate } = parsed.data;

  const supabase = createServiceClient();

  const { data: destination, error: destinationError } = await supabase
    .from("destinations")
    .select("id, name, lat, lng, country_code")
    .eq("id", destinationId)
    .single();

  if (destinationError || !destination) {
    return NextResponse.json({ error: "destination_not_found" }, { status: 404 });
  }

  if (!forceRegenerate) {
    const { data: cachedBriefing } = await supabase
      .from("briefings")
      .select("id, risk_label, content, generated_at, expires_at")
      .eq("destination_id", destination.id)
      .eq("date_range_start", dateRangeStart)
      .eq("date_range_end", dateRangeEnd)
      .gt("expires_at", new Date().toISOString())
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cachedBriefing) {
      return NextResponse.json({
        briefingId: cachedBriefing.id,
        riskLabel: cachedBriefing.risk_label,
        content: cachedBriefing.content,
        generatedAt: cachedBriefing.generated_at,
        cached: true,
      });
    }
  }

  // Cache misses (and forced regenerations) count against the daily quota;
  // cache hits above don't, since they cost no LLM/API calls.
  const rateLimit = await checkAndIncrementRateLimit(user.id);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: "rate_limit_exceeded",
        message: `You've reached today's limit of ${rateLimit.limit} briefing generations. Try again tomorrow.`,
      },
      { status: 429 },
    );
  }

  const { data: agentRun, error: agentRunError } = await supabase
    .from("agent_runs")
    .insert({
      destination_id: destination.id,
      triggered_by: user.id,
      trigger_type: forceRegenerate ? "manual_regenerate" : "cache_miss",
      status: "running",
    })
    .select("id")
    .single();

  if (agentRunError || !agentRun) {
    return NextResponse.json({ error: "failed_to_start_run" }, { status: 500 });
  }

  try {
    const result = await runBriefingGraph({
      agentRunId: agentRun.id,
      destinationId: destination.id,
      destinationName: destination.name,
      countryCode: destination.country_code,
      lat: destination.lat,
      lng: destination.lng,
    });

    if (!result.draftBriefing) {
      throw new Error("Graph completed without producing a briefing");
    }

    await supabase
      .from("agent_runs")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", agentRun.id);

    const generatedAt = new Date();
    const expiresAt = new Date(generatedAt.getTime() + 30 * 60 * 1000);

    const { data: briefing, error: briefingError } = await supabase
      .from("briefings")
      .insert({
        destination_id: destination.id,
        date_range_start: dateRangeStart,
        date_range_end: dateRangeEnd,
        risk_label: result.draftBriefing.riskLabel,
        content: result.draftBriefing,
        requested_by: user.id,
        generated_at: generatedAt.toISOString(),
        expires_at: expiresAt.toISOString(),
        source_run_id: agentRun.id,
      })
      .select("id")
      .single();

    if (briefingError || !briefing) {
      throw briefingError ?? new Error("Failed to store briefing");
    }

    return NextResponse.json({
      briefingId: briefing.id,
      riskLabel: result.draftBriefing.riskLabel,
      content: result.draftBriefing,
      generatedAt: generatedAt.toISOString(),
      cached: false,
    });
  } catch (err) {
    await supabase
      .from("agent_runs")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error_detail: err instanceof Error ? err.message : String(err),
      })
      .eq("id", agentRun.id);

    return NextResponse.json({ error: "generation_failed" }, { status: 500 });
  }
}
