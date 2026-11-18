-- ============================================================
-- 7games — Supabase schema
-- Run this whole file in: Supabase Dashboard → SQL Editor
-- ============================================================

-- 1) Profiles: display names for the global leaderboard
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Public read access to profiles" on public.profiles;
create policy "Public read access to profiles"
on public.profiles for select
to anon, authenticated
using (true);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
on public.profiles for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
on public.profiles for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

-- Auto-create a profile whenever a user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(new.email, '@', 1)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Re-create trigger (drop first so re-runs don't fail)
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Backfill profiles for users created before this trigger existed
insert into public.profiles (id, display_name)
select u.id,
  coalesce(
    u.raw_user_meta_data ->> 'full_name',
    u.raw_user_meta_data ->> 'name',
    split_part(u.email, '@', 1)
  )
from auth.users u
on conflict (id) do nothing;

-- 2) Game scores: one row per finished round
create table if not exists public.game_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  game_id text not null,
  score integer not null default 0,
  seconds integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.game_scores enable row level security;

drop policy if exists "Users can insert their own scores" on public.game_scores;
create policy "Users can insert their own scores"
on public.game_scores for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can read their own scores" on public.game_scores;
create policy "Users can read their own scores"
on public.game_scores for select
to authenticated
using (auth.uid() = user_id);

create index if not exists game_scores_user_game_idx
on public.game_scores (user_id, game_id, created_at desc);

create index if not exists game_scores_game_score_idx
on public.game_scores (game_id, score);

-- 3) Leaderboard views: best result per player per game.
--    Most games are high-score-wins (max). Timed games (minefield,
--    slide) are fastest-wins (min) — the client picks the right view.
create or replace view public.leaderboard
with (security_invoker = false) as
select
  s.game_id,
  s.user_id,
  coalesce(p.display_name, 'Player') as display_name,
  max(s.score) as best_score
from public.game_scores s
left join public.profiles p on p.id = s.user_id
group by s.game_id, s.user_id, p.display_name;

create or replace view public.leaderboard_fastest
with (security_invoker = false) as
select
  s.game_id,
  s.user_id,
  coalesce(p.display_name, 'Player') as display_name,
  min(s.score) as best_score
from public.game_scores s
left join public.profiles p on p.id = s.user_id
group by s.game_id, s.user_id, p.display_name;

grant select on public.leaderboard to anon, authenticated;
grant select on public.leaderboard_fastest to anon, authenticated;

-- 4) Optional: run once to fix profiles for users who signed up
--    with Google before the trigger above existed:
--    (already handled by the backfill insert in section 1)

-- 5) Make the API see the new tables/views right away
notify pgrst, 'reload schema';
