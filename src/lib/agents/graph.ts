import { Annotation, StateGraph, START, END } from "@langchain/langgraph";
import { createServiceClient } from "@/lib/supabase/server";
import { runWeatherAgent } from "./weather";
import { runNewsAgent } from "./news";
import { runHealthAgent } from "./health";
import { runCivilUnrestAgent } from "./civil_unrest";
import { runTransportAgent } from "./transport";
import { runEventsAgent } from "./events";
import { runAdvisoriesAgent } from "./advisories";
import { computeRiskLabel } from "./risk";
import { runSynthesizer, type LlmUsage } from "./synthesizer";
import { logAgentStep } from "./logging";
import type { BriefingContent, CollectorResult, RiskLabel } from "./state";

const BriefingGraphState = Annotation.Root({
  agentRunId: Annotation<string>,
  destinationId: Annotation<string>,
  destinationName: Annotation<string>,
  countryCode: Annotation<string>,
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

type CollectorNodeName =
  | "weather"
  | "news"
  | "health"
  | "civil_unrest"
  | "transport"
  | "events"
  | "advisories";

function collectorNode(
  nodeName: CollectorNodeName,
  run: (state: typeof BriefingGraphState.State) => Promise<CollectorResult>,
) {
  return async (state: typeof BriefingGraphState.State) => {
    const supabase = createServiceClient();
    const startedAt = new Date();
    const result = await run(state);
    await logAgentStep(supabase, state.agentRunId, `${nodeName}_agent`, result.status, startedAt, new Date());
    return { rawSignals: [result] };
  };
}

const graph = new StateGraph(BriefingGraphState)
  .addNode(
    "weather",
    collectorNode("weather", (state) =>
      runWeatherAgent({
        id: state.destinationId,
        lat: state.lat,
        lng: state.lng,
        countryCode: state.countryCode,
      }),
    ),
  )
  .addNode(
    "news",
    collectorNode("news", (state) =>
      runNewsAgent({ id: state.destinationId, countryCode: state.countryCode }),
    ),
  )
  .addNode(
    "health",
    collectorNode("health", (state) =>
      runHealthAgent({ id: state.destinationId, countryCode: state.countryCode }),
    ),
  )
  .addNode(
    "civil_unrest",
    collectorNode("civil_unrest", (state) =>
      runCivilUnrestAgent({ id: state.destinationId, countryCode: state.countryCode }),
    ),
  )
  .addNode(
    "transport",
    collectorNode("transport", (state) =>
      runTransportAgent({
        id: state.destinationId,
        name: state.destinationName,
        countryCode: state.countryCode,
      }),
    ),
  )
  .addNode(
    "events",
    collectorNode("events", (state) =>
      runEventsAgent({ id: state.destinationId, name: state.destinationName }),
    ),
  )
  .addNode(
    "advisories",
    collectorNode("advisories", (state) =>
      runAdvisoriesAgent({ id: state.destinationId, countryCode: state.countryCode }),
    ),
  )
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
  .addEdge(START, "news")
  .addEdge(START, "health")
  .addEdge(START, "civil_unrest")
  .addEdge(START, "transport")
  .addEdge(START, "events")
  .addEdge(START, "advisories")
  .addEdge("weather", "risk")
  .addEdge("news", "risk")
  .addEdge("health", "risk")
  .addEdge("civil_unrest", "risk")
  .addEdge("transport", "risk")
  .addEdge("events", "risk")
  .addEdge("advisories", "risk")
  .addEdge("risk", "synthesizer")
  .addEdge("synthesizer", END)
  .compile();

export async function runBriefingGraph(input: {
  agentRunId: string;
  destinationId: string;
  destinationName: string;
  countryCode: string;
  lat: number | null;
  lng: number | null;
}) {
  return graph.invoke(input);
}
