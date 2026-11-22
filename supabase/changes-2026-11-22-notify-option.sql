-- Run once in the Supabase SQL editor (safe to re-run). Run it BEFORE deploying the new code.
-- The article, map and banner forms get a "send a notification" tick, ticked by default. When it
-- is not ticked the item goes live without any announcement on the phones.
-- Everything that exists now keeps the default (on); what was already announced stays announced.
alter table public.posts add column if not exists push_enabled boolean not null default true;
alter table public.outlooks add column if not exists push_enabled boolean not null default true;
alter table public.weather_banner add column if not exists push_enabled boolean not null default true;
