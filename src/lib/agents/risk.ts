import type { CollectorResult, RiskLabel } from "./state";

export function computeRiskLabel(rawSignals: CollectorResult[]): RiskLabel {
  const items = rawSignals.flatMap((r) => r.items);
  if (items.some((i) => i.severity === "critical")) return "High";
  if (items.some((i) => i.severity === "warning")) return "Medium";
  return "Low";
}
