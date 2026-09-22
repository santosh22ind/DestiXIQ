-- Atomic daily-usage increment for rate_limits (docs/mvp.md §5).
-- Upsert + increment happens under a single row lock, so concurrent
-- requests from the same user can't race past the limit.
create or replace function increment_rate_limit(p_user_id uuid)
returns integer
language sql
security definer
set search_path = public
as $$
  insert into rate_limits (user_id, usage_date, generation_count)
  values (p_user_id, current_date, 1)
  on conflict (user_id, usage_date)
  do update set generation_count = rate_limits.generation_count + 1
  returning generation_count;
$$;
