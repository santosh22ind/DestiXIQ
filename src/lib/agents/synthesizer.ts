import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { isAIMessage } from "@langchain/core/messages";
import { z } from "zod";
import type { BriefingContent, CollectorResult, RiskLabel } from "./state";

// Tried in order until one succeeds. gemini-3.5-flash-lite and
// gemini-3.1-flash-lite are separate models with separate free-tier
// quotas (500 req/day each as of Sept 2026), so a 3.5 quota exhaustion
// doesn't affect 3.1. gemma-4-26b-a4b-it is the last resort: a
// different model family (Google's open-weight Gemma line, served
// through the same generateContent API) with historically much more
// generous free-tier limits (Gemma 3 was 14,400 req/day; Gemma 4's
// exact number isn't published). Verified all three work with this
// file's exact structured-output schema before relying on this list.
const FALLBACK_MODELS = [
  process.env.GEMINI_MODEL ?? "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemma-4-26b-a4b-it",
];

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
  const signalsText = rawSignals
    .map((r) => {
      if (r.status !== "ok") return `${r.category}: unavailable (${r.status})`;
      const lines = r.items.map((i) => `- ${i.title}: ${i.description}`).join("\n");
      return `${r.category}:\n${lines || "(no items)"}`;
    })
    .join("\n\n");

  const prompt = `You are writing a short travel briefing for ${destinationName}. Summarize ONLY the information given below — do not invent facts not present in it. For any category marked "unavailable", list its name in unavailableSections and leave its section as an empty string.

${signalsText}`;

  // Dedupe while preserving order, in case GEMINI_MODEL is already one
  // of the hardcoded fallbacks.
  const modelsToTry = [...new Set(FALLBACK_MODELS)];

  let lastError: unknown;
  for (const modelName of modelsToTry) {
    try {
      const model = new ChatGoogleGenerativeAI({
        model: modelName,
        apiKey: process.env.GEMINI_API_KEY,
        temperature: 0.2,
      });
      const structuredModel = model.withStructuredOutput(briefingSchema, {
        includeRaw: true,
        name: "briefing",
      });

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
          model: modelName,
          promptTokens: usage?.input_tokens ?? 0,
          completionTokens: usage?.output_tokens ?? 0,
          totalTokens: usage?.total_tokens ?? 0,
        },
      };
    } catch (err) {
      lastError = err;
      // Try the next model in the chain.
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`All synthesizer models failed: ${modelsToTry.join(", ")}`);
}
