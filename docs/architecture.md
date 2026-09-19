# DestiXIQ — Architecture & Design Notes

Status: design discussion, no implementation yet.
Last updated: 2026-09-19

## Goal

Generate destination-specific travel briefings by pulling from multiple public
feeds (weather, news, health alerts, protests/strikes, transport disruptions,
airport congestion, weather advisories, local events, etc.), summarizing them
via a multi-agent pipeline, and producing a final briefing through an LLM.

## Stack decisions

- Hosting: Vercel (Next.js app + API routes) + Supabase (Postgres, cache,
  logging, realtime).
- Multi-agent orchestration: LangChain + LangGraph.
- LLM inference: Gemini API (Google AI Studio key), tied to a personal Google
  account. Server-side only — never exposed to the client bundle.
- Trigger model: on-demand generation with Supabase-backed caching (not a
  scheduled pre-generation batch).

## High-level flow

```
Client (Next.js on Vercel)
   |  POST /api/briefing { destination, dateRange }
   v
Vercel API Route (Edge or Node function)
   |  1. Check Supabase cache (briefings table, keyed by destination+date,
   |     TTL e.g. 30-60 min)
   |     -> HIT: return cached briefing immediately
   |     -> MISS: continue
   v
LangGraph run (server-side)
   |  Collector agents (parallel) -> Aggregator -> Risk scoring -> Synthesizer
   |  (Gemini call)
   v
Write result to Supabase `briefings` (+ `llm_usage`, `agent_run_steps`)
   v
Return to client
```

## Agent design (LangGraph)

- **Collector agents** — one per source *category*, not per individual feed.
  Each internally calls 2-3 APIs/RSS feeds for that category and normalizes
  results into a common schema. Keeps the graph small (6-8 nodes) instead of
  one node per feed.
  - Weather Agent
  - News Agent
  - Health Alerts Agent
  - Civil Unrest / Strikes Agent
  - Transport / Airport Congestion Agent
  - Local Events Agent
- **Shared state** passed through the graph:
  `{ destination, date_range, raw_signals[], normalized_signals[], risk_flags[], draft_briefing, token_usage[] }`
- **Conditional edges** — skip a collector if the destination has no relevant
  source (e.g. no nearby airport); fan back in at the aggregator.
- **Aggregator node** — merges + dedupes signals from all collectors.
- **Risk/Priority scoring node** — rule-based or LLM-assisted triage of
  signals.
- **Synthesizer node** — the only node making a "creative" LLM call; produces
  the final structured briefing document. Collectors stay deterministic
  (parsing/tool calls), not LLM calls — cheaper, more reliable, and keeps
  token usage concentrated in one place to monitor.

## Data layer (Supabase)

| Table              | Purpose |
|---------------------|---------|
| `sources`           | Registry of feeds (type, endpoint, auth, TTL/cache policy). |
| `raw_signal_cache`   | Cached raw pulls per source+destination, with TTL, to avoid re-hitting rate-limited APIs. |
| `briefings`          | Final generated output, versioned by destination+date. |
| `agent_runs`         | One row per graph execution: status, duration, which nodes ran/skipped. |
| `agent_run_steps`    | Per-node log: latency, error, truncated input/output summary. Primary logging layer. |
| `llm_usage`          | Prompt/completion tokens, model, cost estimate, linked to `agent_run_steps`. Token monitor. |

## Hosting constraint: Vercel function timeouts

On-demand generation means the first request per destination pays the full
multi-agent latency. Vercel serverless/edge functions have hard execution
limits (10-60s on lower tiers, up to 300s on Pro/Enterprise). Mitigations:

1. Run all collector agents in parallel (not sequentially) — the biggest
   latency lever.
2. Set aggressive per-source timeouts (e.g. 5-8s) with graceful degradation —
   if one feed times out, the briefing still generates with a "data
   unavailable" note instead of failing the whole run.
3. Cache raw per-source pulls separately from the final briefing
   (`raw_signal_cache`, shorter TTL) so a partial refresh doesn't require
   re-fetching everything.
4. If still at risk of hitting the ceiling: return "generating..."
   immediately, run the graph asynchronously (e.g. Supabase Edge Function),
   and have the client poll or subscribe via Supabase Realtime for
   completion.

## Gemini API key handling

- Stored as a Vercel environment variable, used only server-side.
- Treated as a credential: not committed, not logged in full in
  prompt/response logs.
- If this ever moves beyond a personal prototype toward a client-facing or
  production tool with real user data in prompts, revisit: switch to a
  Vertex AI service account (proper IAM, quota isolation, billing
  separation), and flag to Legal/Compliance if user data is involved.

## Logging + token monitoring

- `agent_run_steps`: node name, status, latency_ms, error (nullable),
  truncated input/output summary — enough to debug without storing full raw
  payloads long-term.
- `llm_usage`: model name, prompt_tokens, completion_tokens,
  cost_estimate_usd, agent_run_id — Gemini API responses include usage
  metadata, so this is a direct pass-through.
- Optional: LangSmith for tracing during development, even if Supabase
  tables remain the production monitoring/dashboard source.

## Open questions

- Final list of sources per category (which weather/news/transport APIs
  specifically) — affects rate limits and caching TTLs.
- Single-user (personal) vs multi-tenant — affects whether Supabase
  RLS/auth matters now or can wait.
- Whether briefings need to update *during* a trip (re-briefing) or are a
  one-time pre-trip pull.
