# DestiXIQ — Detailed Technical Design

Status: draft for review. Goes one level below `architecture.md` and
`mvp.md` — still design, no code yet.

Last updated: 2026-09-19

## 1. Supabase schema

Sketch DDL below — column types/constraints are illustrative, not final
migrations. `auth.users` is managed by Supabase Auth itself; every
user-linked table below references `auth.users.id`.

```sql
-- Curated destinations (MVP: fixed list, see mvp.md §3)
create table destinations (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,           -- e.g. "New York"
  region        text not null,           -- e.g. "USA"
  country_code  text not null,           -- ISO 3166-1 alpha-2
  lat           numeric,
  lng           numeric,
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

-- Source registry (per architecture.md; FR7)
create table sources (
  id             uuid primary key default gen_random_uuid(),
  category       text not null,          -- weather | news | health | civil_unrest
                                          -- | transport | events | advisories
  name           text not null,          -- e.g. "Open-Meteo"
  base_url       text not null,
  auth_type      text not null default 'none',   -- none | api_key | oauth2
  cache_ttl_secs integer not null default 1800,
  active         boolean not null default true,
  notes          text
);

-- Cached raw pulls per destination+source
create table raw_signal_cache (
  id             uuid primary key default gen_random_uuid(),
  destination_id uuid not null references destinations(id),
  source_id      uuid not null references sources(id),
  fetched_at     timestamptz not null default now(),
  expires_at     timestamptz not null,
  payload        jsonb not null,        -- normalized signal(s) from this source
  status         text not null default 'ok',   -- ok | error | timeout
  error_detail   text,
  unique (destination_id, source_id)
);

-- Final generated briefings
create table briefings (
  id               uuid primary key default gen_random_uuid(),
  destination_id   uuid not null references destinations(id),
  date_range_start date not null,
  date_range_end   date not null,
  risk_label       text not null,        -- Low | Medium | High
  content          jsonb not null,       -- structured sections, see §3.3
  requested_by     uuid not null references auth.users(id),
  generated_at     timestamptz not null default now(),
  expires_at       timestamptz not null,
  source_run_id    uuid references agent_runs(id)
);
create index on briefings (destination_id, date_range_start, date_range_end);

-- One row per LangGraph execution
create table agent_runs (
  id              uuid primary key default gen_random_uuid(),
  destination_id  uuid not null references destinations(id),
  triggered_by    uuid not null references auth.users(id),
  trigger_type    text not null,         -- cache_miss | manual_regenerate
  status          text not null default 'running',  -- running | completed | failed
  started_at      timestamptz not null default now(),
  completed_at    timestamptz,
  error_detail    text
);

-- Per-node log within a run
create table agent_run_steps (
  id             uuid primary key default gen_random_uuid(),
  agent_run_id   uuid not null references agent_runs(id),
  node_name      text not null,          -- e.g. "weather_agent", "synthesizer"
  status         text not null,          -- ok | error | timeout | skipped
  started_at     timestamptz not null,
  completed_at   timestamptz,
  latency_ms     integer,
  input_summary  text,                   -- truncated, not full payload
  output_summary text,                   -- truncated, not full payload
  error_detail   text
);

-- Token/cost tracking per LLM call
create table llm_usage (
  id                 uuid primary key default gen_random_uuid(),
  agent_run_step_id  uuid not null references agent_run_steps(id),
  model              text not null,      -- e.g. "gemini-2.x-flash"
  prompt_tokens      integer not null,
  completion_tokens  integer not null,
  total_tokens       integer not null,
  cost_estimate_usd  numeric(10,4)
);

-- Per-user daily rate limiting (mvp.md §5)
create table rate_limits (
  user_id        uuid not null references auth.users(id),
  usage_date     date not null default current_date,
  generation_count integer not null default 0,
  primary key (user_id, usage_date)
);
```

Row-level security: enable RLS on `briefings`, `agent_runs`,
`agent_run_steps`, `llm_usage`, `rate_limits` — users can only read rows
tied to their own `requested_by`/`triggered_by`/`user_id`. Writes happen
only from server-side (service role), never directly from the client.

## 2. LangGraph state & node specs

### 2.1 Shared state (passed through every node)

```ts
type BriefingState = {
  destinationId: string;
  destination: { name: string; region: string; countryCode: string; lat?: number; lng?: number };
  dateRange: { start: string; end: string };
  agentRunId: string;

  rawSignals: {
    category: SourceCategory;
    sourceName: string;
    status: "ok" | "error" | "timeout" | "skipped";
    items: NormalizedSignal[];
  }[];

  riskLabel?: "Low" | "Medium" | "High";
  draftBriefing?: BriefingContent;
  errors: { node: string; detail: string }[];
};

type NormalizedSignal = {
  title: string;
  description: string;
  severity?: "info" | "advisory" | "warning" | "critical";
  timestamp: string;       // ISO 8601
  url?: string;
  sourceName: string;
};
```

`NormalizedSignal` is the common schema every collector agent must
produce, regardless of the underlying API's native shape — this is what
makes the aggregator category-agnostic.

### 2.2 Collector nodes (parallel, one per category)

Timeouts below are tightened from an earlier draft (6-8s) to 4-5s,
given the Hobby-plan risk noted in §4 item 2 — every second shaved off a
collector is a second of headroom for the synthesizer's LLM call.

| Node | Sources called | Timeout | On failure |
|---|---|---|---|
| `weather_agent` | Open-Meteo | 4s | mark category `skipped`, note "weather data unavailable" |
| `news_agent` | NewsData.io | 4s | same pattern |
| `health_agent` | WHO Disease Outbreak News, CDC Travel Notices | 4s | same |
| `civil_unrest_agent` | GDELT | 5s (larger payload) | same |
| `transport_agent` | FAA NAS Status (US only), AviationStack | 4s | same; always `skipped` for non-US destinations until a real feed exists |
| `events_agent` | Ticketmaster Discovery API | 4s | same |
| `advisories_agent` | US State Dept, UK FCDO | 4s | same |

Each collector node:
1. Checks `raw_signal_cache` for a non-expired row (destination + source)
   before calling the live API.
2. On live call, normalizes the response into `NormalizedSignal[]`.
3. Writes/updates `raw_signal_cache`.
4. Appends its result (`ok`/`error`/`timeout`, items) to
   `state.rawSignals`.
5. Never calls the LLM — deterministic parsing only (per
   `architecture.md` FR9).

All 7 collector nodes run in parallel via LangGraph's fan-out; the graph
waits for all to settle (not fail-fast) before proceeding, since a
partial result is still a valid briefing.

### 2.3 Aggregator node

- Input: `state.rawSignals` (7 category results, some possibly
  `skipped`/`error`).
- Dedupes near-identical items within a category (e.g. same headline from
  two sources) by simple title-similarity check.
- Sorts each category's items by recency/severity.
- Output: unchanged `rawSignals`, just cleaned — no LLM call.

### 2.4 Risk scoring node

MVP approach: **deterministic rule-based**, not LLM-based — keeps this
step free, fast, and predictable to test.

Rules (proposed, tune after real data is seen):
- `High` if any signal has `severity: "critical"`, or a government
  advisory (from `advisories_agent`) is at the two highest levels (e.g.
  US State Dept level 3-4), or civil unrest signals exceed a count
  threshold in the date range.
- `Medium` if any `warning`-level signal exists, or a moderate advisory
  level, or isolated transport/health disruptions.
- `Low` otherwise.

This is a starting heuristic, not a validated scoring model — expect to
revise after seeing real briefings.

### 2.5 Synthesizer node (the only LLM call)

- Input: cleaned `rawSignals` + `riskLabel`.
- Single Gemini call, **structured output** (JSON schema, not free text)
  so `briefings.content` is reliably parseable:

```json
{
  "summary": "string, 2-3 sentence overview",
  "sections": {
    "weather": "string or null",
    "news": "string or null",
    "health": "string or null",
    "civil_unrest": "string or null",
    "transport": "string or null",
    "events": "string or null",
    "advisories": "string or null"
  },
  "unavailable_sections": ["string"],
  "riskLabel": "Low | Medium | High"
}
```

- System prompt responsibilities: summarize each category's normalized
  signals into plain-language prose, cite nothing fabricated (only use
  what's in the input), explicitly list any `unavailable_sections`,
  and pass through the deterministic `riskLabel` unchanged (LLM doesn't
  re-decide risk — keeps risk logic testable independent of the LLM).
- Records `llm_usage` row (prompt/completion tokens from the Gemini
  response's usage metadata).

## 3. API contract

### 3.1 `POST /api/briefings`

Request:
```json
{ "destinationId": "uuid", "dateRangeStart": "2026-10-01", "dateRangeEnd": "2026-10-05", "forceRegenerate": false }
```

Auth: Supabase session required (JWT in cookie/header). Unauthenticated
→ `401`.

Server logic:
1. Check `rate_limits` for today's `generation_count` for this user; if
   at/over limit → `429` with `{ "error": "rate_limit_exceeded", "resetAt": "..." }`.
2. If `forceRegenerate` is false, check `briefings` for a non-expired row
   matching destination+date range → return it directly, `200`, no
   LangGraph run, no rate-limit decrement (cache hits are free).
3. Otherwise increment `rate_limits.generation_count`, start an
   `agent_runs` row, and run the LangGraph pipeline **synchronously
   within the request, no async fallback for MVP**. If the pipeline
   doesn't finish before Vercel's function timeout, the request fails
   outright (`504`/timeout) — no `202`/processing/polling path. See the
   Vercel Hobby timeout risk noted in §4.

Response (success, `200`):
```json
{ "briefingId": "uuid", "riskLabel": "Medium", "content": { /* see §2.5 schema */ }, "generatedAt": "...", "cached": false }
```

### 3.2 `GET /api/destinations`

Returns the curated destination list (from mvp.md §3) for the UI picker.
No auth beyond a logged-in session.

## 4. Open questions for this layer

1. Rule thresholds in §2.4 are a first guess — worth revisiting once
   real signals from a few destinations are seen.
2. ~~Vercel plan~~ — resolved: Hobby plan. Serverless function
   duration on Hobby is capped low (commonly cited as ~10s; verify the
   exact current number in your Vercel dashboard, since plan limits
   change). **Real risk:** the full pipeline — 7 parallel collectors
   (6-8s worst case) + aggregator/risk scoring (negligible) + one Gemini
   synthesis call (latency varies, easily 2-5s+) — can plausibly exceed
   a 10s budget even with parallelization. Since §3 now has no async
   fallback, a slow run simply fails the request. Mitigation for MVP:
   keep collector timeouts tight (4-5s, not 6-8s) and treat occasional
   timeout failures on first uncached generation as an accepted MVP
   limitation to observe, not something to solve via async right now.
   If it fails often in practice, that's the trigger to revisit the
   Vercel plan or add async — not a reason to add it preemptively.
3. ~~Realtime vs. polling~~ — moot: no async path in MVP, so no status
   endpoint, polling, or Realtime subscription needed for this feature.
