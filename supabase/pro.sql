-- ============================================================
-- Senevon Pro membership
-- Run in: Supabase Dashboard → SQL Editor (after schema.sql)
--
-- Players can only READ their own row (to know if they're Pro).
-- Nobody can write from the browser: rows are added/removed by the admin panel
-- (server function with the service-role key), and later by the payment webhook.
-- ============================================================

create table if not exists public.pro_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  note text,
  created_at timestamptz not null default now()
);

alter table public.pro_members enable row level security;

drop policy if exists "Members can read their own Pro status" on public.pro_members;
create policy "Members can read their own Pro status"
on public.pro_members for select
to authenticated
using (auth.uid() = user_id);

-- No insert / update / delete policies on purpose: only the service role can change Pro.
