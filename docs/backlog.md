# DestiXIQ Backlog

Living list of what's shipped and what's open. Priority column is blank —
fill in as we agree on ordering (e.g. P0/P1/P2, or a number).

## Shipped

- Passwordless auth: email -> Cloudflare Turnstile -> 6-digit OTP (no
  passwords at all). Disposable/temporary email domains rejected before an
  OTP is even sent (`disposable-email-domains`, 121k+ known domains, local
  check, no external API).
- OTP delivery runs through Brevo via a Supabase Auth "Send Email" hook —
  the Brevo API key lives only in our own env vars, never given to Supabase.
- Hard 5-minute session expiry, independent of Supabase's own session
  (which auto-refreshes silently by design and would otherwise defeat a
  short expiry) — a separate signed cookie gates `/briefing` and
  `/api/briefings`, verified via Web Crypto so it works in both the Node
  and Edge runtimes.
- Destination picker + date range UI
- LangGraph pipeline: 7 collector agents (weather, news, health, civil_unrest,
  transport, events, advisories) running in parallel → risk label → Gemini synthesis
- Automatic Gemini model fallback (flash-lite → flash-lite-2 → Gemma) on quota exhaustion
- Per-user daily rate limiting on briefing generation (10/day, atomic, server-enforced)
- Deployed to Vercel, connected to GitHub for auto-deploy on push to `master`
- Global transport/congestion collector (AirLabs Flight Delays), replacing the
  US-only FAA source — verified against real US + non-US destinations
- News and Events collectors (NewsData.io, Ticketmaster) — keys verified
  working in both local and production
- NWS severe weather alerts added to the weather collector (US destinations, free/no key)
- Smartraveller (Australia) advisories added; fixed a pre-existing gap where US
  destinations got zero advisories from either existing source
- Canada government travel advisories added — every destination now gets 3-4
  cross-referenced government advisories instead of up to 2
- Response caching on `/api/briefings` — cache hits (same destination + exact
  date range, within the 30-min TTL) skip the pipeline entirely and don't
  count against the daily rate limit; UI shows a "Cached" badge

## Open

| Priority | Item | Why it matters |
|---|---|---|
| | Ticketmaster has ~no France coverage (known limitation) | Confirmed directly against the API: `countryCode=FR` returns 0 total events vs. 10,000+ for GB/US. Paris (and likely other non-US/UK destinations) will consistently show "no data" for Events — not a code bug. Would need a broader events source (PredictHQ, etc.) to fix. |
| | LLM / API monthly budget ceiling | No hard spending stop if usage spikes unexpectedly (e.g. rate limit misconfigured, or bug causing retries). |
| | ~~ACLED civil unrest upgrade~~ — not viable | Confirmed hands-on: the free self-registered "Open myACLED" tier only gives dashboards/aggregated files, not disaggregated event-level API access. Real API access needs their Research/Partner tier (manual approval, not self-serve). Pending their email reply to our outreach; GDELT remains the civil_unrest source either way. |
| | Tune risk-scoring thresholds | Current Low/Medium/High labeling is placeholder deterministic rules, not yet validated against real multi-destination data. |
| | Real aggregator / dedup logic | Signals from different sources are currently just concatenated, no deduplication of overlapping stories/alerts. |
| | Verify civil_unrest (GDELT) reliability from Vercel | In local dev this consistently timed out/429'd, root-caused to Capgemini's shared corporate egress IP hitting GDELT's rate limiter — should behave better from Vercel's network, but not yet confirmed in production. |
| | Custom domain | Currently on the default `*.vercel.app` domain. |
| | Basic usage/error monitoring | No visibility into quota usage or failures beyond manually querying `agent_runs`/`llm_usage` — could add a simple admin view or alert. |
| | Clean up leftover cert files | `cert-00.pem`...`cert-03.pem`, `chain.pem` left over at the repo root from corporate CA extraction — never deleted, user-side cleanup (blocked from touching `.pem` paths myself). |
| | "Practical prep" section (medicines, food/milk, clothing norms, kid-friendliness) | Deferred feature request: a new AI-synthesized (not source-fetched) section covering destination-specific practical guidance, plus having the synthesizer explicitly reason about war/political-disruption risk from existing signals. Bigger change — new category type, new graph node, synthesizer schema changes, UI labels. |
| | Mobile/SMS OTP | Researched, not pursued: no durable free tier exists for SMS OTP (trial credits only, then per-message cost). Email OTP alone covers the security goal at this project's scale. |
