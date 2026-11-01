-- Run once in the Supabase SQL editor (safe to re-run).

-- 1. Phones that turned notifications on. No policies: only the site's server (service role
--    key) can read or write this table, nobody can list the subscriptions from a browser.
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

-- 2. Remember what has already been announced, so each map / emergency bulletin is sent once.
alter table public.outlooks add column if not exists push_sent_at timestamptz;
alter table public.weather_banner add column if not exists push_emergency_key text;

-- Everything that exists today counts as already announced: no notification for old content.
update public.outlooks set push_sent_at = now() where push_sent_at is null;
update public.weather_banner
set push_emergency_key = md5(emergency_url)
where emergency_url is not null and push_emergency_key is null;
