# DestiXIQ Backlog

Living list of what's shipped and what's open. Priority column is blank —
fill in as we agree on ordering (e.g. P0/P1/P2, or a number).

## Shipped

- Auth: email/password signup + login (OTP verification currently disabled, see below)
- Cloudflare Turnstile bot check on signup/login (real production keys)
- Destination picker + date range UI
- LangGraph pipeline: 7 collector agents (weather, news, health, civil_unrest,
  transport, events, advisories) running in parallel → risk label → Gemini synthesis
- Automatic Gemini model fallback (flash-lite → flash-lite-2 → Gemma) on quota exhaustion
- Per-user daily rate limiting on briefing generation (10/day, atomic, server-enforced)
- Deployed to Vercel, connected to GitHub for auto-deploy on push to `master`
- Global transport/congestion collector (AirLabs Flight Delays), replacing the
  US-only FAA source — verified against real US + non-US destinations
- News and Events collectors verified working end-to-end with real API keys (local)
- NWS severe weather alerts added to the weather collector (US destinations, free/no key)
- Smartraveller (Australia) advisories added; fixed a pre-existing gap where US
  destinations got zero advisories from either existing source

## Open

| Priority | Item | Why it matters |
|---|---|---|
| | Re-enable OTP email verification | Disabled for now. Now that there's a real Vercel URL, the app-level "Send Email Hook" approach (Gmail App Password stays only in your own env vars, never given to Supabase) is viable — was blocked earlier only by the lack of a public URL for the hook. |
| | Response caching on `/api/briefings` | Every "Generate" click reruns the full 7-agent + Gemini pipeline, even for an identical destination/date range already generated recently. Rate limiting bounds the damage but doesn't eliminate wasted quota. `briefings.expires_at` already exists in the schema for this. |
| | Add `NEWSDATA_API_KEY` / `TICKETMASTER_API_KEY` / `AIRLABS_API_KEY` to Vercel | All three verified working in local dev. Still need adding to Vercel's env vars + redeploy to take effect in production. |
| | Ticketmaster has ~no France coverage (known limitation) | Confirmed directly against the API: `countryCode=FR` returns 0 total events vs. 10,000+ for GB/US. Paris (and likely other non-US/UK destinations) will consistently show "no data" for Events — not a code bug. Would need a broader events source (Eventbrite, PredictHQ, etc.) to fix. |
| | LLM / API monthly budget ceiling | No hard spending stop if usage spikes unexpectedly (e.g. rate limit misconfigured, or bug causing retries). |
| | Tune risk-scoring thresholds | Current Low/Medium/High labeling is placeholder deterministic rules, not yet validated against real multi-destination data. |
| | Real aggregator / dedup logic | Signals from different sources are currently just concatenated, no deduplication of overlapping stories/alerts. |
| | Verify civil_unrest (GDELT) reliability from Vercel | In local dev this consistently timed out/429'd, root-caused to Capgemini's shared corporate egress IP hitting GDELT's rate limiter — should behave better from Vercel's network, but not yet confirmed in production. |
| | Custom domain | Currently on the default `*.vercel.app` domain. |
| | Basic usage/error monitoring | No visibility into quota usage or failures beyond manually querying `agent_runs`/`llm_usage` — could add a simple admin view or alert. |
| | Clean up leftover cert files | `cert-00.pem`...`cert-03.pem`, `chain.pem` left over at the repo root from corporate CA extraction — never deleted, user-side cleanup (blocked from touching `.pem` paths myself). |
