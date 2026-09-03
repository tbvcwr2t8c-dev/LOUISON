-- Run as the project administrator once; no application service-role key needed.
create table if not exists public.constante_backups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  device_id uuid not null,
  digest text not null check (digest ~ '^[a-f0-9]{64}$'),
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and payload->>'schemaVersion' = '2' and octet_length(payload::text) < 2200000),
  created_at timestamptz not null default now(),
  unique (user_id, device_id, digest)
);
alter table public.constante_backups enable row level security;
revoke all on public.constante_backups from anon, authenticated;
grant select, insert on public.constante_backups to authenticated;
create policy "Read own backups" on public.constante_backups for select to authenticated using ((select auth.uid()) = user_id);
create policy "Append own backups" on public.constante_backups for insert to authenticated with check ((select auth.uid()) = user_id);
create index if not exists constante_backups_recent on public.constante_backups(user_id, created_at desc);
-- No UPDATE or DELETE grants/policies: snapshots cannot overwrite one another.
