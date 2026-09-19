# DestiXIQ — Requirements

Status: draft for review. Items marked **[ASSUMPTION]** are guesses based on
our design discussion — flag any that are wrong.

Last updated: 2026-09-19

## 1. Problem statement

Travelers need a single, up-to-date view of conditions at a destination
before/during a trip — weather, safety, disruptions, and local context —
instead of checking many separate sources manually.

## 2. Goals

- G1: Given a destination (and date range), produce a single readable
  briefing summarizing the relevant risks/conditions.
- G2: Pull from multiple public feeds per category (weather, news, health
  alerts, protests/strikes, transport disruptions, airport congestion,
  local events) and reconcile them into one coherent output.
- G3: Keep the pipeline observable — every run's steps, latency, and LLM
  token/cost usage are logged.
- G4: Run as a personal/small-scale tool first (hosted on Vercel + Supabase,
  using a personal Google Gemini API key), with a path to scale later if
  needed.

## 3. Non-goals (out of scope for now)

- Booking, itinerary management, or trip planning beyond the briefing itself.
- Multi-tenant accounts, teams, or sharing features. **[ASSUMPTION]**
- Real-time push alerts/notifications during a trip (e.g. "strike just
  started"). **[ASSUMPTION — confirm if this should be in scope later]**
- Mobile app — web only for now. **[ASSUMPTION]**
- Historical trend analysis (e.g. "safest month to visit X"). **[ASSUMPTION]**

## 4. Target users

- **[ASSUMPTION]** Primary user: you (personal use), possibly extended to
  friends/family or a small group later. Not a commercial multi-tenant
  product at this stage.

## 5. Functional requirements

### 5.1 Briefing generation

- FR1: User submits a destination (city/country) and a date range.
- FR2: System checks for a cached briefing for that destination + date
  range within a TTL window before generating a new one.
- FR3: If no valid cache, system runs the multi-agent pipeline to collect,
  aggregate, score, and synthesize a new briefing.
- FR4: Output is a structured briefing containing, at minimum:
  - Weather summary/advisories
  - Relevant news headlines
  - Health alerts (if any)
  - Civil unrest / strikes / protests (if any)
  - Transport disruptions and airport congestion notes
  - Local events of note
  - An overall risk/priority indicator **[ASSUMPTION — e.g. low/medium/high, tbc]**
- FR5: If a given source/category has no data or fails to respond, the
  briefing still generates, with that section marked as unavailable rather
  than failing the whole request.

### 5.2 Sources

- FR6: Each source category is served by one or more public APIs/feeds,
  normalized into a common internal schema before aggregation.
- FR7: Source registry (which feeds are active per category, their auth,
  and their cache TTL) is configurable without a code deploy.
  **[ASSUMPTION — may be overkill for MVP; could hardcode initially]**

### 5.3 Agent pipeline

- FR8: Multi-agent pipeline built with LangGraph: parallel collector agents
  per category → aggregator → risk scoring → synthesizer (single LLM call).
- FR9: Collector agents do not themselves call the LLM (deterministic
  parsing only); only the synthesizer step uses the LLM.

### 5.4 Logging & monitoring

- FR10: Every pipeline run is logged: which nodes ran/were skipped, latency
  per node, and any errors.
- FR11: Every LLM call logs prompt/completion token counts and an estimated
  cost.

### 5.5 User interface

- FR12: A simple web form to request a briefing (destination + dates) and
  view the resulting briefing. **[ASSUMPTION on minimal UI scope for MVP]**

## 6. Non-functional requirements

- NFR1: **Latency** — first-time (uncached) briefing generation should
  complete within Vercel's function timeout; degrade gracefully (partial
  results) rather than fail outright. Target: **[ASSUMPTION — e.g. under 30-60s]**
- NFR2: **Cost control** — token usage per briefing should be tracked and
  visible, since LLM calls run against a personal Gemini API key/quota.
- NFR3: **Reliability** — a single failing source must not break the whole
  briefing (partial degradation, not full failure).
- NFR4: **Security** — Gemini API key and any source API keys are
  server-side only, never exposed to the client.
- NFR5: **Data freshness** — cached briefings expire on a TTL (default
  **[ASSUMPTION — 30-60 min]**) so information doesn't go stale silently.
- NFR6: **Observability** — logs/metrics from section 5.4 should be
  queryable (even if just via Supabase SQL initially, no dashboard needed
  for MVP). **[ASSUMPTION]**

## 7. Constraints

- Hosting: Vercel (app + API) + Supabase (DB/cache/logs).
- LLM: Google Gemini API via a personal AI Studio key (not Vertex AI, for
  now).
- No dedicated backend worker/queue service decided yet — async execution
  path (if needed to avoid Vercel timeouts) is still open, see Architecture
  doc §"Hosting constraint."
- Single developer/maintainer. **[ASSUMPTION]**

## 8. Success criteria (how we'll know it works)

- **[ASSUMPTION — draft, needs your input]**
  - A briefing for a real destination can be generated end-to-end and reads
    as useful/accurate against what you'd find by checking sources manually.
  - Uncached generation completes reliably without hitting Vercel timeouts.
  - Token/cost usage per briefing is visible and within an acceptable
    budget (budget TBD).

## 9. Open questions (need your input before MVP scoping)

1. Which specific APIs/feeds do you want per category (weather, news,
   health, unrest, transport/airport, events)? Free/public APIs have
   varying reliability and rate limits — this affects design directly.
2. Is this strictly personal-use for now, or should basic auth (e.g. Google
   sign-in via Supabase Auth) be in scope from the start?
3. Do you want a fixed list of supported destinations initially, or fully
   open free-text destination input (harder to guarantee source coverage)?
4. What should the "risk indicator" look like — a simple label, a score, or
   omitted entirely for MVP?
5. Any budget ceiling in mind for LLM token usage / API calls per month?
6. Do briefings need to be re-requestable/regenerable on demand by the user
   (ignore cache), or is TTL-based refresh enough?

## 10. Next step

Once you've reviewed/edited this document, we'll use it to scope an MVP
(smallest version that proves the end-to-end flow: 1-2 sources per
category, on-demand generation, minimal UI, basic logging) versus
everything listed above as the fuller product target.
