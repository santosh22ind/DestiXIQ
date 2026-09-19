# DestiXIQ

Destination-specific travel briefings, generated from public weather, news,
health, civil-unrest, transport, events, and government-advisory feeds via
a multi-agent (LangGraph) pipeline and Gemini.

Design docs live in [`docs/`](docs/):

- [`architecture.md`](docs/architecture.md) — overall system design
- [`requirements.md`](docs/requirements.md) — product requirements
- [`sources.md`](docs/sources.md) — candidate data sources per category
- [`mvp.md`](docs/mvp.md) — MVP scope
- [`technical-design.md`](docs/technical-design.md) — schema, LangGraph
  node specs, API contract

## Getting started

Copy `.env.example` to `.env.local` and fill in your Supabase and Gemini
credentials, then:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Stack

Next.js (App Router, TypeScript) on Vercel, Supabase (Postgres, Auth,
logging), LangChain/LangGraph for agent orchestration, Gemini API for
inference.
