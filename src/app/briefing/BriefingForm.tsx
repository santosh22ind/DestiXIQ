"use client";

import { useState } from "react";

type Destination = { id: string; name: string; region: string };

type BriefingResponse = {
  briefingId: string;
  riskLabel: "Low" | "Medium" | "High";
  content: {
    summary: string;
    sections: Partial<Record<string, string | null>>;
    unavailableSections: string[];
  };
  generatedAt: string;
  cached: boolean;
};

const SECTION_LABELS: Record<string, string> = {
  weather: "Weather",
  news: "News",
  health: "Health",
  civil_unrest: "Civil Unrest",
  transport: "Transport",
  events: "Events",
  advisories: "Advisories",
};

const RISK_COLORS: Record<string, string> = {
  Low: "bg-green-100 text-green-800",
  Medium: "bg-yellow-100 text-yellow-800",
  High: "bg-red-100 text-red-800",
};

function defaultDateRange() {
  const start = new Date();
  const end = new Date();
  end.setDate(end.getDate() + 5);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { start: fmt(start), end: fmt(end) };
}

export function BriefingForm({ destinations }: { destinations: Destination[] }) {
  const defaults = defaultDateRange();
  const [destinationId, setDestinationId] = useState(destinations[0]?.id ?? "");
  const [dateRangeStart, setDateRangeStart] = useState(defaults.start);
  const [dateRangeEnd, setDateRangeEnd] = useState(defaults.end);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BriefingResponse | null>(null);

  async function generate(forceRegenerate: boolean) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/briefings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destinationId, dateRangeStart, dateRangeEnd, forceRegenerate }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message ?? data.error ?? `Request failed with status ${res.status}`);
      }
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          generate(false);
        }}
        className="flex flex-col gap-6"
      >
        <label className="flex flex-col gap-1 text-sm text-ink/60">
          Destination
          <select
            value={destinationId}
            onChange={(e) => setDestinationId(e.target.value)}
            className="border-b border-ink/30 bg-transparent px-1 py-2 text-ink focus:border-ink focus:outline-none"
          >
            {destinations.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.region})
              </option>
            ))}
          </select>
        </label>

        <div className="flex gap-6">
          <label className="flex flex-1 flex-col gap-1 text-sm text-ink/60">
            From
            <input
              type="date"
              value={dateRangeStart}
              onChange={(e) => setDateRangeStart(e.target.value)}
              className="border-b border-ink/30 bg-transparent px-1 py-2 text-ink focus:border-ink focus:outline-none"
            />
          </label>
          <label className="flex flex-1 flex-col gap-1 text-sm text-ink/60">
            To
            <input
              type="date"
              value={dateRangeEnd}
              onChange={(e) => setDateRangeEnd(e.target.value)}
              className="border-b border-ink/30 bg-transparent px-1 py-2 text-ink focus:border-ink focus:outline-none"
            />
          </label>
        </div>

        <button
          type="submit"
          disabled={loading || !destinationId}
          className="inline-flex w-fit items-center gap-2 rounded-full bg-ink px-6 py-3 font-medium text-cream hover:bg-ink/90 disabled:opacity-50"
        >
          {loading ? "Generating…" : "Generate briefing"}
          {!loading && <span aria-hidden>→</span>}
        </button>
      </form>

      {error && <p className="text-sm text-red-700">{error}</p>}

      {result && (
        <div className="flex flex-col gap-4 rounded-2xl border border-ink/20 p-6">
          <div className="flex items-center justify-between">
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${RISK_COLORS[result.riskLabel]}`}
            >
              Risk: {result.riskLabel}
            </span>
            <button
              onClick={() => generate(true)}
              disabled={loading}
              className="text-xs underline decoration-ink/30 underline-offset-4 hover:decoration-ink disabled:opacity-50"
            >
              Regenerate
            </button>
          </div>

          <p className="text-sm">{result.content.summary}</p>

          {Object.entries(result.content.sections)
            .filter(([, text]) => text && text.trim().length > 0)
            .map(([category, text]) => (
              <div key={category} className="flex flex-col gap-1">
                <h3 className="text-sm font-semibold">{SECTION_LABELS[category] ?? category}</h3>
                <p className="text-sm text-ink/60">{text}</p>
              </div>
            ))}

          {result.content.unavailableSections.length > 0 && (
            <p className="text-xs text-ink/40">
              No data available for:{" "}
              {result.content.unavailableSections
                .map((c) => SECTION_LABELS[c] ?? c)
                .join(", ")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
