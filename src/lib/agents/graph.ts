import { Annotation, StateGraph, START, END } from "@langchain/langgraph";
import { createServiceClient } from "@/lib/supabase/server";
import { runWeatherAgent } from "./weather";
import { computeRiskLabel } from "./risk";
import { runSynthesizer, type LlmUsage } from "./synthesizer";
import { logAgentStep } from "./logging";
import type { BriefingContent, CollectorResult, RiskLabel } from "./state";

const BriefingGraphState = Annotation.Root({
  agentRunId: Annotation<string>,
  destinationId: Annotation<string>,
  destinationName: Annotation<string>,
  lat: Annotation<number | null>,
  lng: Annotation<number | null>,
  rawSignals: Annotation<CollectorResult[]>({
    reducer: (left, right) => left.concat(right),
    default: () => [],
  }),
  riskLabel: Annotation<RiskLabel | undefined>,
  draftBriefing: Annotation<BriefingContent | undefined>,
  llmUsage: Annotation<LlmUsage | undefined>,
});

const graph = new StateGraph(BriefingGraphState)
  .addNode("weather", async (state) => {
    const supabase = createServiceClient();
    const startedAt = new Date();
    const result = await runWeatherAgent({
      id: state.destinationId,
      lat: state.lat,
      lng: state.lng,
    });
    await logAgentStep(supabase, state.agentRunId, "weather_agent", result.status, startedAt, new Date());
    return { rawSignals: [result] };
  })
  .addNode("risk", async (state) => {
    const supabase = createServiceClient();
    const startedAt = new Date();
    const riskLabel = computeRiskLabel(state.rawSignals);
    await logAgentStep(supabase, state.agentRunId, "risk_scoring", "ok", startedAt, new Date());
    return { riskLabel };
  })
  .addNode("synthesizer", async (state) => {
    const supabase = createServiceClient();
    const startedAt = new Date();
    const { content, usage } = await runSynthesizer(
      state.destinationName,
      state.rawSignals,
      state.riskLabel ?? "Low",
    );
    const stepId = await logAgentStep(
      supabase,
      state.agentRunId,
      "synthesizer",
      "ok",
      startedAt,
      new Date(),
    );
    await supabase.from("llm_usage").insert({
      agent_run_step_id: stepId,
      model: usage.model,
      prompt_tokens: usage.promptTokens,
      completion_tokens: usage.completionTokens,
      total_tokens: usage.totalTokens,
    });
    return { draftBriefing: content, llmUsage: usage };
  })
  .addEdge(START, "weather")
  .addEdge("weather", "risk")
  .addEdge("risk", "synthesizer")
  .addEdge("synthesizer", END)
  .compile();

export async function runBriefingGraph(input: {
  agentRunId: string;
  destinationId: string;
  destinationName: string;
  lat: number | null;
  lng: number | null;
}) {
  return graph.invoke(input);
}
