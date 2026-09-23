# DestiXIQ — Candidate Data Sources

Status: draft for review, based on web research as of September 2026.
Pricing/tiers for third-party commercial APIs change frequently —
re-verify against the vendor's pricing page before finalizing.

Target regions: USA, India, Canada, Europe, Australia, South American
countries.

## 1. Weather

- **Open-Meteo** — `open-meteo.com`
  Global (aggregates NOAA/GFS, ECMWF, DWD, MSC, BOM and other national
  models) — good default across all 6 regions.
  Free, no API key for **non-commercial use**; ~600 calls/min, 10,000/day,
  300,000/month. Commercial use requires a paid plan (from $29/mo,
  unlimited).
  Trust: aggregates directly from official meteorological agencies' models;
  open-source project.
  Caveat: free tier is licensed non-commercial only — check terms if
  DestiXIQ ever monetizes.

- **NOAA / National Weather Service API** — `api.weather.gov`
  USA only. Fully free, no key, no account; generous undocumented rate
  limits.
  Trust: official US government meteorological authority.
  Caveat: US-only.

- **OpenWeatherMap** — `openweathermap.org`
  Global. Freemium — free tier ~60 calls/min, up to 1M calls/month for
  basic current/forecast; One Call 3.0 gives 1,000 calls/day free, paid
  from ~$40/mo.
  Trust: widely used, blends multiple official model sources; not itself a
  government agency.
  Caveat: basic vs. One Call endpoints have different quotas.

- **Region-specific gap-fillers:**
  - India: IMD (`mausam.imd.gov.in`, gateway `api.imd.gov.in`) — official,
    but registration/IP whitelisting makes it hard to integrate; treat as
    stretch goal, fall back to Open-Meteo/OpenWeatherMap for India.
  - Canada: MSC GeoMet (`api.weather.gc.ca`) — official ECCC data, free,
    anonymous, OGC API/WMS/WFS standards (needs a geospatial-aware client).
  - Australia: BOM (`bom.gov.au/resources/data-services`) — official,
    CC-BY/PAL licensed, but **open-data delivery currently suspended
    during a platform upgrade** — verify status before relying on it;
    Open-Meteo is the safer fallback for AU right now.

## 2. News

- **GDELT Project** — `gdeltproject.org`
  Global, 1979–present, updated every 15 minutes. Free and open — raw
  files, Analysis Service, or BigQuery (1TB free query processing/month).
  Trust: academic/open-data project widely cited in conflict/media
  research; codes events by category (CAMEO), not just headlines.
  Caveat: steep learning curve; needs event-code filtering to act like a
  simple headline feed.

- **NewsData.io** — `newsdata.io`
  Global — 206 countries, 50,000+ sources. Freemium — 200 calls/day free,
  **permits commercial use on the free tier** (unusual); paid from
  ~$199.99/mo.
  Trust: aggregates mainstream and regional press wires across many
  languages.
  Caveat: free-tier volume is modest for frequent multi-region polling.

- **NewsAPI.org** — `newsapi.org`
  Global, large publisher list. Free "Developer" tier (100–1,000
  req/day) is **dev/localhost only**, articles delayed ~24h; production
  requires the $449/mo plan.
  Trust: long-established aggregator of mainstream wire/publisher content.
  Caveat: free tier cannot be used in a deployed (Vercel) production app.

- **GNews** — `gnews.io`
  Global. Free tier 100 req/day, dev/test only, no full article content;
  paid from €49.99/mo.
  Trust: aggregates Google News-indexed sources.
  Caveat: same "not for production" restriction as NewsAPI's free tier.

## 3. Health Alerts

- **WHO Disease Outbreak News** — `who.int`
  Global. Free; RESTful endpoint (`/api/news/diseaseoutbreaknews`) plus
  RSS, no key.
  Trust: the single most authoritative global outbreak-alert source.
  Caveat: lightly-structured/undocumented as a "developer API" — parse
  defensively.

- **CDC Travel Health Notices** — `wwwnc.cdc.gov/travel/notices`
  Global destinations, US-traveler framing. Free public RSS
  (`wwwnc.cdc.gov/travel/rss/notices.xml`), no auth.
  Trust: official US CDC; notices tiered (Watch/Alert/Warning) — good
  structured severity signal.
  Caveat: US-centric prioritization; not exhaustive.

- **ECDC** — `ecdc.europa.eu`
  Europe-focused, plus some global communicable-disease surveillance.
  Free, open-data portal, some direct JSON endpoints.
  Trust: official EU health agency.
  Caveat: best for Europe; thin for South America/Australia/India.

- **HealthMap** — `healthmap.org`
  Global. Free to browse; aggregates news wires, ProMED-mail, WHO and
  EuroSurveillance alerts hourly.
  Trust: Boston Children's Hospital/Harvard-affiliated, used by US
  HHS/DoD for surveillance — semi-official.
  Caveat: no clearly documented public API for third-party integration —
  treat as secondary/backup.

## 4. Civil Unrest / Protests / Strikes

- **ACLED** — `acleddata.com`
  Global (170+ countries) — covers all 6 target regions. Freemium — free
  "myACLED" account gives aggregated real-time data, Explorer, Conflict
  Index; full disaggregated API requires a Research/Partner tier
  negotiated case-by-case (`developer.acleddata.com`).
  Trust: the most widely cited academic/authoritative source for
  protest/riot/conflict events; used by UN, World Bank, journalists.
  Caveat: full API access isn't self-serve — expect to contact ACLED
  directly for a personal project.

- **GDELT** — `gdeltproject.org` (see News section for access details)
  Global, near-real-time (15-min), CAMEO-coded protest/unrest events.
  Free, unlimited, no key.
  Caveat: noisier/less curated than ACLED — good early signal, not
  authoritative confirmation.

- **Crowd Counting Consortium (CCC)** — `countingcrowds.org`
  **USA only.** Free CSV download via Dataverse — no live API.
  Trust: rigorously fact-checked, academic (Harvard/UConn) — gold
  standard for US protest sizing.
  Caveat: US-only, batch download, not real-time.

- **ReliefWeb (OCHA)** — `reliefweb.int`
  Global, humanitarian-crisis focused. Free, official public API, no key
  for basic use.
  Trust: run by UN OCHA.
  Caveat: oriented toward humanitarian crises, not day-to-day
  strikes/protests — supplementary only.

**Gap:** no single free, real-time, global "protests/strikes today" API
exists. Realistic approach: GDELT for near-real-time signal + ACLED
(registered) for periodic authoritative confirmation, CCC as a US-only
cross-check.

## 5. Transport Disruptions & Airport Congestion

- **AirLabs Flight Delays** — `airlabs.co/docs/delays` — **implemented (MVP)**
  Global coverage, per-airport currently-delayed-flights list (delayed
  count + delay minutes per flight). Free tier ~1,000 requests/month.
  Signup went through a waitlist (no fixed ETA) before a key was issued.
  Caveat: no total-scheduled-flights denominator, so absolute delay
  counts/durations had to be calibrated against live data rather than
  treated as a clean "% of flights delayed" signal — see severity
  thresholds in `src/lib/agents/transport.ts`. Superseded the FAA-only
  approach below, since it covers every curated destination, not just US.

- **FAA NAS Status** — `nasstatus.faa.gov` — superseded by AirLabs above
  USA airports only. Free, public domain, no key; XML/JSON feed of ground
  stops, ground delay programs, closures, arrival/departure delays.
  Trust: official FAA operational data.
  Caveat: US-only, lightly documented (community wrappers exist, e.g.
  `faadelays` on PyPI).

- **FlightAware AeroAPI** — `flightaware.com/commercial/aeroapi`
  Global flight status/tracking — strongest commercial option across all
  6 regions. Paid, usage-based (~$0.002/query) or tiered subscriptions;
  small free evaluation credit only, not a durable free tier.
  Caveat: not realistically free for sustained use — budget for it or
  limit to an on-demand feature.

- **OpenSky Network** — `opensky-network.org`
  Global (denser ADS-B coverage in US/Europe, sparser in South
  America/parts of India). Free for non-commercial/research use; strict
  rate limits; **now requires OAuth2 client-credentials** (basic auth
  retired March 2026).
  Caveat: raw ADS-B state vectors, not "congestion" — would need to
  derive congestion/delay signals yourself.

- **AviationStack** — `aviationstack.com`
  Global flight status/schedules/routes. Freemium — 100 requests/month
  free, live data, no card; paid from $49.99/mo (10,000 req).
  Caveat: free tier volume very low for a multi-airport feature.

- **Eurocontrol Network Manager (B2B)** — `eurocontrol.int`
  Europe — best authoritative source for European airspace/airport
  congestion, but the B2B API is **restricted to aviation stakeholders**
  (ANSPs, airlines, airports, ground handlers), not open to individual
  developers (free orgs get 2 tokens, extra tokens €200 each).
  Caveat: effectively out of reach for DestiXIQ — use FlightAware/
  AviationStack for European coverage instead.

**Ground transport add-ons:**
- UK: TfL Unified API (`api.tfl.gov.uk`) — free, official; National Rail
  Darwin feeds via Rail Data Marketplace — free, official, real-time UK
  train disruptions.
- US regional: 511.org / 511 Open Data (`511.org/open-data`) — free with
  token, GTFS/GTFS-RT, covers SF Bay Area (similar 511 programs exist
  per-state/city).
- India: no reliable official public API for IRCTC/Indian Railways
  disruptions — CRIS gateway (`crisapis.indianrail.gov.in`) isn't
  self-serve for individual developers; only unofficial/scraped
  third-party APIs exist. **Genuine coverage gap for India.**

## 6. Local Events

- **Ticketmaster Discovery API** — `developer.ticketmaster.com`
  Broadest official multi-region coverage: US, Canada, Mexico, Australia,
  New Zealand, UK, and other European countries; 230K+ events. Free API
  key, 5,000 calls/day, 5 req/sec default.
  Caveat: thin/no coverage in South America and India — verify before
  relying on it there.

- **PredictHQ** — `predicthq.com`
  Global — 20M+ events across ~30,000 cities (concerts, sports,
  festivals, public/school holidays, some "unplanned" event signals).
  Freemium — 14-day trial, then a Free plan with unpublished limits; paid
  tiers not publicly priced — contact sales.
  Caveat: exact free-tier limits unverified at signup; likely the best
  single source for South America/India coverage, but depth there is
  unverified.

- **SeatGeek Platform API** — `seatgeek.com/build`
  US and Canada only. Freemium, requires approved API key/account.
  Caveat: North America only.

- **Eventbrite API** — `eventbrite.com/platform`
  Free, but **the public event-search endpoint was permanently shut down
  Dec 2019/Feb 2020** and remains unavailable. Only event-by-ID,
  by-venue, or by-organization lookups work.
  Caveat: **do not plan around Eventbrite for local-event discovery** —
  unusable for "what's happening near X"; only useful with known
  organizer/venue IDs.

**Gap:** South America has no strong dedicated official/global events
API confirmed — PredictHQ is the most likely candidate, but should be
spot-checked with real queries before committing to it.

## 7. Government Travel Advisories

Official advisories from **travelers' home-country governments** (not
destination-country self-reporting), since these already fuse
safety/civil-unrest/health signal into one authoritative per-country
rating. Relevant for outbound travelers from the US, Canada, Australia,
UK/EU.

- **US State Department — Travel Advisories** — `cadataapi.state.gov`
  (`/api/TravelAdvisories` JSON, `/api/XMLTravelAdvisories` XML), catalog
  at `cadatacatalog.state.gov`. Legacy RSS also at
  `travel.state.gov/_res/rss/TAsTWs.xml`.
  Coverage: all countries, 4-level advisory scale plus risk tags (crime,
  terrorism, civil unrest, health, kidnapping, etc.).
  Free, public, no key — genuinely structured, not HTML-only.
  Trust: primary official US source; public-domain data.
  Caveat: lightly documented, hosted on a Consular Affairs subdomain
  rather than a formal dev portal — endpoint stability not guaranteed
  long-term; event-driven updates, not a fixed schedule. Note: OSAC
  (`osac.gov`) is largely a membership-gated portal, not a public API —
  not needed as a separate feed.

- **UK FCDO — Foreign Travel Advice (GOV.UK Content API)** —
  `www.gov.uk/api/content/foreign-travel-advice` (index) and
  `.../foreign-travel-advice/<country-slug>` (per-country detail).
  Coverage: ~225 countries/territories; structured sections for
  safety/security, entry requirements, health, local laws.
  Free, no auth, no published rate limit beyond fair-use; returns JSON.
  Trust: official UK source, one of the most mature/genuinely
  machine-readable of the group.
  Caveat: licensed under **Open Government Licence v3.0** — free reuse
  including commercial, but requires an attribution statement when
  republishing derived content.

- **Australia — Smartraveller (DFAT)** —
  `smartraveller.gov.au/destinations-export` (bulk JSON export of all
  current advisories); country RSS feeds also listed on the site's
  Resources/RSS page.
  Coverage: ~170+ destinations, with sub-national advice for some large
  countries.
  Free, public, no key; export endpoint confirmed real (independently
  verified via a third-party GitHub client) but not formally documented
  as a versioned API — treat as quasi-official, stable-but-undocumented.
  Trust: official Australian government advisory data.
  Caveat: no formal SLA/versioning docs — parse defensively, check schema
  periodically.

- **Canada — travel.gc.ca / Global Affairs Canada** — live RSS feeds
  **discontinued** (redirects to the HTML advisories page). Structured
  data instead lives in the Open Government Portal dataset "Country
  Travel Advice and Advisories" (`open.canada.ca`/`ouvert.canada.ca`,
  CKAN-based, downloadable CSV/JSON/XML).
  Coverage: ~230 destinations.
  Free, public, open data — but a **periodic bulk-download dataset**, not
  a real-time feed.
  Trust: official Canadian government source.
  Caveat: no live RSS anymore; the dataset's "record modified" timestamp
  is flagged by Canada's own portal as unreliable for tracking actual
  update recency — poll the underlying resource directly.

- **EU / European countries — fragmented, no consolidated feed.** No
  single EU-wide machine-readable advisory API exists; coverage is
  per-member-state with inconsistent (often absent) machine-readable
  access:
  - Germany (Auswärtiges Amt): no officially supported API; an unofficial
    JSON interface (`bundesAPI/travelwarning-api` on GitHub, reverse
    engineered via a German FOI request) exists but isn't guaranteed
    stable.
  - France (France Diplomatie): per-country pages only, no public API or
    RSS found.
  For DestiXIQ: either use UK FCDO as the best-documented European-
  government proxy, or treat Germany/France as HTML-scrape-only with
  lower reliability/legal-reuse certainty. Commercial aggregators
  blending multiple governments' advisories exist but carry their own
  licensing terms — a separate reuse-terms check.

**Cross-cutting for this category:** US (JSON/XML), UK (JSON), and
Australia (JSON export) are genuinely structured; Canada is
structured-but-batch; continental Europe is largely HTML-only/unofficial.
All are event-driven updates, not fixed-interval — build in periodic
re-fetch (e.g. daily) plus change-detection. **Licensing:** US content is
public domain; UK is OGL v3.0 (attribution required); Australian/Canadian
reuse terms should be re-confirmed against site terms-of-use before
redistributing advisory text verbatim — a Legal/Compliance check, not an
engineering judgment call, if advisory text is shown to end users rather
than just linked/summarized.

## Cross-cutting notes

- Several "free" tiers (NewsAPI, GNews) explicitly forbid production/
  deployed use — for a Vercel-hosted app, budget for at least
  NewsData.io or a paid NewsAPI tier before launch.
- Google News RSS is unofficial, undocumented, and licensed for
  personal/non-commercial reading only — usable for prototyping but
  carries ToS/stability risk in a shipped product.
- **Terms-of-service note:** several sources above (Google News RSS,
  scraped/unofficial rail feeds, etc.) carry licensing or ToS
  restrictions on redistribution or commercial use. This is a factual
  flag, not legal advice — if DestiXIQ moves toward production or any
  commercial use, run the specific source list past Legal/Compliance
  before relying on them.
- India and South America are the weakest regions across nearly every
  category (weather access friction, no rail disruption API, thin
  events/civil-unrest granularity) — plan explicit fallbacks (GDELT,
  PredictHQ, Open-Meteo) rather than expecting official single-country
  APIs to be developer-friendly there.

## Suggested MVP shortlist (one per category, lowest friction)

| Category | MVP pick | Why |
|---|---|---|
| Weather | Open-Meteo | Free, global, no key, covers all 6 regions reasonably |
| News | NewsData.io (free tier) | Only major aggregator whose free tier explicitly allows production use |
| Health alerts | WHO Disease Outbreak News + CDC Travel Notices | Both free, official, no key |
| Civil unrest | GDELT | Free, unlimited, global, real-time-ish; add ACLED later once registered |
| Transport/airport | AirLabs Flight Delays (global, ~1,000 req/mo free) | Implemented — replaces the earlier FAA-only plan, covers all curated destinations |
| Local events | Ticketmaster Discovery API | Free key, decent multi-region coverage except South America/India (PredictHQ as later addition) |
| Government travel advisories | US State Dept + UK FCDO | Both genuinely free, public, structured (JSON), no key needed |

This shortlist is a starting proposal for MVP scoping, not a final
decision — flag any picks you disagree with.
