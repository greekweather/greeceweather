-- Run once in the Supabase SQL editor (safe to re-run).
-- Run it AFTER changes-2026-10-31.sql (it replaces the same function).

-- Views per article per day, for the admin "Στατιστικά" page. The total in posts.views stays
-- as it is; this only adds the day-by-day history, counting from the moment this is run.
-- Days are Athens days.
create table if not exists public.post_view_days (
  slug text not null,
  day date not null,
  views integer not null default 0,
  primary key (slug, day)
);

alter table public.post_view_days enable row level security;

drop policy if exists "admins_read_post_view_days" on public.post_view_days;
create policy "admins_read_post_view_days" on public.post_view_days
for select to authenticated
using (public.is_admin());

-- Same function as before, plus one line that adds the view to today's count.
create or replace function public.increment_post_views(
  p_slug text,
  p_visitor text,
  p_min_gap_minutes integer,
  p_max_per_day integer
)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.posts
    where slug = p_slug and published = true and published_at is not null and published_at <= now()
  ) then
    return 'not_live';
  end if;

  if exists (
    select 1 from public.post_view_log
    where slug = p_slug and visitor = p_visitor
      and viewed_at > now() - make_interval(mins => p_min_gap_minutes)
  ) then
    return 'gap';
  end if;

  if (
    select count(*) from public.post_view_log
    where visitor = p_visitor and viewed_at > now() - interval '1 day'
  ) >= p_max_per_day then
    return 'daily_cap';
  end if;

  insert into public.post_view_log (slug, visitor) values (p_slug, p_visitor);
  update public.posts set views = views + 1 where slug = p_slug;

  insert into public.post_view_days (slug, day, views)
  values (p_slug, (now() at time zone 'Europe/Athens')::date, 1)
  on conflict (slug, day) do update set views = public.post_view_days.views + 1;

  delete from public.post_view_log where viewed_at < now() - interval '2 days';

  return 'counted';
end;
$$;

revoke all on function public.increment_post_views(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.increment_post_views(text, text, integer, integer) to service_role;
