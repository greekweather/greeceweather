-- Run once in the Supabase SQL editor (safe to re-run).

-- 1. Caption for the main image of a post
alter table public.posts
  add column if not exists image_caption text not null default ''
  check (char_length(image_caption) <= 300);

-- 2. Custom headline for the weather banner (empty = default headline)
alter table public.weather_banner
  add column if not exists title text
  check (title is null or char_length(title) <= 80);

-- 3. View counter (run this part ONLY if views are not being counted: check the browser
--    network tab for a 500 from /api/views, or the Supabase logs for "function ... does not exist")
-- app/api/views/route.ts calls increment_post_views(p_slug, p_visitor, p_min_gap_minutes,
-- p_max_per_day), but supabase/schema.sql only defined the old one-argument version.
-- If your live database lacks the four-argument function, every view fails with a 500 and
-- the counter stays at 0. This creates it. It is only callable with the service role key
-- (used by the API route), so nobody can inflate the counter by calling it from a browser.
create table if not exists public.post_view_log (
  id bigint generated always as identity primary key,
  slug text not null,
  visitor text not null,
  viewed_at timestamptz not null default now()
);

create index if not exists post_view_log_lookup_idx
  on public.post_view_log (slug, visitor, viewed_at desc);

alter table public.post_view_log enable row level security;
-- no policies: only the service role (which bypasses RLS) can read or write the log

create or replace function public.increment_post_views(
  p_slug text,
  p_visitor text,
  p_min_gap_minutes integer,
  p_max_per_day integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.posts
    where slug = p_slug and published = true and published_at is not null and published_at <= now()
  ) then
    return false;
  end if;

  -- same visitor, same article, within the minimum gap
  if exists (
    select 1 from public.post_view_log
    where slug = p_slug and visitor = p_visitor
      and viewed_at > now() - make_interval(mins => p_min_gap_minutes)
  ) then
    return false;
  end if;

  -- daily cap per visitor across all articles
  if (
    select count(*) from public.post_view_log
    where visitor = p_visitor and viewed_at > now() - interval '1 day'
  ) >= p_max_per_day then
    return false;
  end if;

  insert into public.post_view_log (slug, visitor) values (p_slug, p_visitor);
  update public.posts set views = views + 1 where slug = p_slug;

  -- keep the log small
  delete from public.post_view_log where viewed_at < now() - interval '2 days';

  return true;
end;
$$;

revoke all on function public.increment_post_views(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.increment_post_views(text, text, integer, integer) to service_role;

-- The old one-argument version let anyone raise the counter from the browser.
drop function if exists public.increment_post_views(text);

-- 4. Forecast posts shown on the banner's "ΠΡΟΓΝΩΣΗ" button.
-- Each row = one post with its own display window. The button opens the post whose window is
-- open right now (latest start wins), so a second post takes over as soon as the first one
-- ends or the second one's start time arrives. No active post = no button.
create table if not exists public.banner_forecast_posts (
  id uuid primary key default gen_random_uuid(),
  banner_id uuid not null references public.weather_banner(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  check (starts_at is null or ends_at is null or ends_at > starts_at)
);

create index if not exists banner_forecast_posts_banner_idx
  on public.banner_forecast_posts (banner_id);

alter table public.banner_forecast_posts enable row level security;

drop policy if exists "public_can_read_banner_forecast_posts" on public.banner_forecast_posts;
create policy "public_can_read_banner_forecast_posts" on public.banner_forecast_posts
for select to anon, authenticated
using (true);

drop policy if exists "admins_manage_banner_forecast_posts" on public.banner_forecast_posts;
create policy "admins_manage_banner_forecast_posts" on public.banner_forecast_posts
for all to authenticated
using (public.is_admin())
with check (public.is_admin());
