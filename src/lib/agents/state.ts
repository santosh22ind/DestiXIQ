export type SourceCategory =
  | "weather"
  | "news"
  | "health"
  | "civil_unrest"
  | "transport"
  | "events"
  | "advisories";

export type SignalSeverity = "info" | "advisory" | "warning" | "critical";

export type NormalizedSignal = {
  title: string;
  description: string;
  severity?: SignalSeverity;
  timestamp: string; // ISO 8601
  url?: string;
  sourceName: string;
};

export type CollectorResult = {
  category: SourceCategory;
  sourceName: string;
  status: "ok" | "error" | "timeout" | "skipped";
  items: NormalizedSignal[];
};

export type RiskLabel = "Low" | "Medium" | "High";

export type BriefingContent = {
  summary: string;
  sections: Partial<Record<SourceCategory, string | null>>;
  unavailableSections: SourceCategory[];
  riskLabel: RiskLabel;
};

export type BriefingState = {
  destinationId: string;
  destination: {
    name: string;
    region: string;
    countryCode: string;
    lat?: number;
    lng?: number;
  };
  dateRange: { start: string; end: string };
  agentRunId: string;

  rawSignals: CollectorResult[];

  riskLabel?: RiskLabel;
  draftBriefing?: BriefingContent;
  errors: { node: string; detail: string }[];
};
