# DestiXIQ — MVP Scope

Status: draft for review. Builds on `architecture.md`, `requirements.md`,
and `sources.md`.

Last updated: 2026-09-19

## 1. What the MVP proves

The smallest end-to-end slice that proves: a logged-in user can request a
briefing for a supported destination, the multi-agent pipeline collects
and synthesizes real data from live sources, and the result is cached,
regenerable, logged, and cost-tracked.

## 2. Decisions locked for MVP

| Area | Decision |
|---|---|
| Destinations | Fixed curated list (not free-text) — see §3 |
| Auth | Required. Supabase Auth: email/password + email OTP verification before any briefing can be generated |
| Risk indicator | Simple label per briefing: Low / Medium / High |
| Cache | TTL-based auto-refresh **plus** a manual "Regenerate" button that bypasses cache |
| LLM | Gemini API (personal AI Studio key), server-side only |
| Hosting | Vercel (Next.js) + Supabase (DB, Auth, cache, logs) |

## 3. Curated destination list (proposal — edit freely)

One or two cities per region, chosen where source coverage from
`sources.md` is strongest, to avoid the MVP's first impression being a
destination with thin data:

| Region | Proposed cities |
|---|---|
| USA | New York, Los Angeles |
| Canada | Toronto |
| India | Delhi, Mumbai |
| Europe | London, Paris |
| Australia | Sydney |
| South America | São Paulo, Buenos Aires |

Note: India and South America have the weakest source coverage per
`sources.md` — expect those briefings to lean more heavily on the
global fallbacks (Open-Meteo, GDELT, PredictHQ, government travel
advisories) and to have visibly thinner transport/events sections.
That's expected for MVP, not a bug to chase.

## 4. Source shortlist for MVP (from `sources.md`)

| Category | Source | Notes |
|---|---|---|
| Weather | Open-Meteo | Free, global, no key |
| News | NewsData.io (free tier) | Only free tier explicitly allowing production use |
| Health alerts | WHO Disease Outbreak News + CDC Travel Notices | Both free, no key |
| Civil unrest | GDELT | Free, unlimited, global |
| Transport/airport | FAA NAS Status (US only) + AviationStack (global, low volume) | Accept India/South America gap for MVP |
| Local events | Ticketmaster Discovery API | Thin/no coverage in South America, India |
| Government travel advisories | US State Dept + UK FCDO | Free, structured JSON, no key |

ACLED, Eurocontrol, FlightAware, PredictHQ (paid tiers) are explicitly
**deferred post-MVP** — either not self-serve at personal scale or add
cost that isn't justified until the pipeline itself is proven.

## 5. Auth & abuse protection design

Since the LLM key and several source API keys are tied to your personal
account/quota, MVP-level protection is a hard requirement, not a
nice-to-have:

- Supabase Auth: email/password signup + **email OTP verification**
  required before the account can call the briefing endpoint.
- Per-user rate limit (e.g. N briefing generations per day, N being small
  — suggest starting at 5-10) enforced server-side, tracked in a
  Supabase table keyed by user id. Applies to both fresh generations and
  manual "Regenerate" — the regenerate button is a UX convenience, not
  an exemption from the limit.
- No public sign-up announcement — treat this as invite-only in practice
  (share the URL only with people you trust) even though the mechanism
  is self-serve OTP, not a manual allow-list.
- All source/LLM API keys stay server-side (Vercel env vars), never
  reach the client.

## 6. In scope for MVP

- Sign up / log in (email + password + OTP).
- Select a destination from the curated list + a date range.
- Trigger briefing generation (or hit cache).
- LangGraph pipeline: 7 collector agents (one per category in §4) running
  in parallel → aggregator → risk labeling → Gemini synthesis call.
- Manual "Regenerate" button (rate-limited).
- Briefing display: categorized sections + overall risk label.
- Logging: `agent_runs`, `agent_run_steps`, `llm_usage` tables populated
  on every run.
- Graceful degradation: a source timing out shows "data unavailable" for
  that section, doesn't fail the whole briefing.

## 7. Explicitly out of scope for MVP

- Free-text/arbitrary destinations.
- ACLED, Eurocontrol, FlightAware, PredictHQ, or any paid-tier source.
- Push notifications / real-time re-briefing during a trip.
- Multi-tenant sharing, teams, or public sign-up.
- A monitoring dashboard UI — logs/usage are queried directly via
  Supabase SQL for now.
- Non-English destinations' local-language sources (assume English
  sources only where available).

## 8. Success criteria

- A real briefing can be generated end-to-end for every city in §3
  without an unhandled failure.
- Uncached generation completes without hitting Vercel's function
  timeout (validates the parallel-collector design from
  `architecture.md`).
- Token/cost usage per briefing is visible in Supabase and looks
  reasonable against no fixed budget yet, since you haven't set one —
  **still an open item**, worth a rough number before real usage starts.
- OTP-gated auth successfully blocks unauthenticated access; rate limit
  successfully blocks a user from exceeding N generations/day (test by
  trying to exceed it).

## 9. Remaining open item

- Budget ceiling for LLM/API usage per month — not yet set. Worth a
  rough number now so the rate limit in §5 can be tuned against it
  rather than picked arbitrarily.

## 10. Suggested build order (once design is approved)

1. Supabase schema (auth handled by Supabase Auth itself; add
   `agent_runs`, `agent_run_steps`, `llm_usage`, `rate_limits`,
   `briefings`, `raw_signal_cache`).
2. Auth flow (sign up, OTP verify, login) — nothing else works without
   this gate.
3. One collector agent end-to-end (e.g. weather) through to a stored
   briefing, to validate the LangGraph + Supabase + Gemini wiring before
   adding the rest.
4. Remaining collector agents in parallel.
5. Aggregator + risk label + synthesizer.
6. Caching + manual regenerate + rate limiting.
7. Minimal UI (destination picker, briefing view).

This is a proposed order, not a commitment — we'll revisit once you've
reviewed this doc.
