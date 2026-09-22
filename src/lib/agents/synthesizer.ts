import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { isAIMessage } from "@langchain/core/messages";
import { z } from "zod";
import type { BriefingContent, CollectorResult, RiskLabel } from "./state";

// gemini-3.5-flash-lite over gemini-3.8-flash: free tier is 500 req/day
// vs. 20 req/day (Sept 2026 quotas) — matters while this is still being
// tested frequently. Revisit if output quality becomes the bottleneck
// instead of quota. Override via env without a code change either way.
const MODEL_NAME = process.env.GEMINI_MODEL ?? "gemini-3.5-flash-lite";

const briefingSchema = z.object({
  summary: z.string().describe("2-3 sentence overview of the destination's current conditions"),
  sections: z.object({
    weather: z.string().describe("empty string if unavailable"),
    news: z.string().describe("empty string if unavailable"),
    health: z.string().describe("empty string if unavailable"),
    civil_unrest: z.string().describe("empty string if unavailable"),
    transport: z.string().describe("empty string if unavailable"),
    events: z.string().describe("empty string if unavailable"),
    advisories: z.string().describe("empty string if unavailable"),
  }),
  unavailableSections: z.array(z.string()),
});

export type LlmUsage = {
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

export type SynthesisResult = {
  content: BriefingContent;
  usage: LlmUsage;
};

export async function runSynthesizer(
  destinationName: string,
  rawSignals: CollectorResult[],
  riskLabel: RiskLabel,
): Promise<SynthesisResult> {
  const model = new ChatGoogleGenerativeAI({
    model: MODEL_NAME,
    apiKey: process.env.GEMINI_API_KEY,
    temperature: 0.2,
  });

  const structuredModel = model.withStructuredOutput(briefingSchema, {
    includeRaw: true,
    name: "briefing",
  });

  const signalsText = rawSignals
    .map((r) => {
      if (r.status !== "ok") return `${r.category}: unavailable (${r.status})`;
      const lines = r.items.map((i) => `- ${i.title}: ${i.description}`).join("\n");
      return `${r.category}:\n${lines || "(no items)"}`;
    })
    .join("\n\n");

  const prompt = `You are writing a short travel briefing for ${destinationName}. Summarize ONLY the information given below — do not invent facts not present in it. For any category marked "unavailable", list its name in unavailableSections and leave its section as an empty string.

${signalsText}`;

  const { raw, parsed } = await structuredModel.invoke(prompt);
  const usage = isAIMessage(raw) ? raw.usage_metadata : undefined;

  return {
    content: {
      summary: parsed.summary,
      sections: parsed.sections,
      unavailableSections: parsed.unavailableSections as BriefingContent["unavailableSections"],
      riskLabel,
    },
    usage: {
      model: MODEL_NAME,
      promptTokens: usage?.input_tokens ?? 0,
      completionTokens: usage?.output_tokens ?? 0,
      totalTokens: usage?.total_tokens ?? 0,
    },
  };
}
