-- DestiXIQ initial schema (docs/technical-design.md §1)
-- Run in Supabase SQL Editor. Tables reordered from the doc so foreign
-- keys resolve without forward references.

create extension if not exists pgcrypto;

-- Curated destinations (MVP: fixed list, see docs/mvp.md §3)
create table destinations (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  region        text not null,
  country_code  text not null,
  lat           numeric,
  lng           numeric,
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

-- Source registry (docs/architecture.md FR7)
create table sources (
  id             uuid primary key default gen_random_uuid(),
  category       text not null,
  name           text not null,
  base_url       text not null,
  auth_type      text not null default 'none',
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
  payload        jsonb not null,
  status         text not null default 'ok',
  error_detail   text,
  unique (destination_id, source_id)
);

-- One row per LangGraph execution
create table agent_runs (
  id              uuid primary key default gen_random_uuid(),
  destination_id  uuid not null references destinations(id),
  triggered_by    uuid not null references auth.users(id),
  trigger_type    text not null,
  status          text not null default 'running',
  started_at      timestamptz not null default now(),
  completed_at    timestamptz,
  error_detail    text
);

-- Final generated briefings
create table briefings (
  id               uuid primary key default gen_random_uuid(),
  destination_id   uuid not null references destinations(id),
  date_range_start date not null,
  date_range_end   date not null,
  risk_label       text not null,
  content          jsonb not null,
  requested_by     uuid not null references auth.users(id),
  generated_at     timestamptz not null default now(),
  expires_at       timestamptz not null,
  source_run_id    uuid references agent_runs(id)
);
create index on briefings (destination_id, date_range_start, date_range_end);

-- Per-node log within a run
create table agent_run_steps (
  id             uuid primary key default gen_random_uuid(),
  agent_run_id   uuid not null references agent_runs(id),
  node_name      text not null,
  status         text not null,
  started_at     timestamptz not null,
  completed_at   timestamptz,
  latency_ms     integer,
  input_summary  text,
  output_summary text,
  error_detail   text
);

-- Token/cost tracking per LLM call
create table llm_usage (
  id                 uuid primary key default gen_random_uuid(),
  agent_run_step_id  uuid not null references agent_run_steps(id),
  model              text not null,
  prompt_tokens      integer not null,
  completion_tokens  integer not null,
  total_tokens       integer not null,
  cost_estimate_usd  numeric(10,4)
);

-- Per-user daily rate limiting (docs/mvp.md §5)
create table rate_limits (
  user_id          uuid not null references auth.users(id),
  usage_date       date not null default current_date,
  generation_count integer not null default 0,
  primary key (user_id, usage_date)
);

-- Row-level security: deny by default, service role bypasses RLS
-- entirely so all server-side app code keeps working unchanged.

alter table destinations enable row level security;
create policy "destinations are publicly readable"
  on destinations for select
  using (true);

alter table sources enable row level security;
-- no public policy: only server-side (service role) needs this table.

alter table raw_signal_cache enable row level security;
-- no public policy: internal cache, server-side only.

alter table agent_runs enable row level security;
create policy "users can read their own agent runs"
  on agent_runs for select
  using (triggered_by = auth.uid());

alter table briefings enable row level security;
create policy "users can read their own briefings"
  on briefings for select
  using (requested_by = auth.uid());

alter table agent_run_steps enable row level security;
create policy "users can read steps of their own runs"
  on agent_run_steps for select
  using (
    exists (
      select 1 from agent_runs
      where agent_runs.id = agent_run_steps.agent_run_id
        and agent_runs.triggered_by = auth.uid()
    )
  );

alter table llm_usage enable row level security;
create policy "users can read usage of their own runs"
  on llm_usage for select
  using (
    exists (
      select 1 from agent_run_steps
      join agent_runs on agent_runs.id = agent_run_steps.agent_run_id
      where agent_run_steps.id = llm_usage.agent_run_step_id
        and agent_runs.triggered_by = auth.uid()
    )
  );

alter table rate_limits enable row level security;
create policy "users can read their own rate limit"
  on rate_limits for select
  using (user_id = auth.uid());

-- Seed the MVP curated destination list (docs/mvp.md §3)
insert into destinations (name, region, country_code) values
  ('New York', 'USA', 'US'),
  ('Los Angeles', 'USA', 'US'),
  ('Toronto', 'Canada', 'CA'),
  ('Delhi', 'India', 'IN'),
  ('Mumbai', 'India', 'IN'),
  ('London', 'Europe', 'GB'),
  ('Paris', 'Europe', 'FR'),
  ('Sydney', 'Australia', 'AU'),
  ('São Paulo', 'South America', 'BR'),
  ('Buenos Aires', 'South America', 'AR');
