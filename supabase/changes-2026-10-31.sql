-- Run once in the Supabase SQL editor (safe to re-run).

-- 1. Safety copy of everything deleted from the admin panel (articles, tags, maps, banners).
--    Each delete first saves the item and its links here; the admin "Αντίγραφα ασφαλείας"
--    page can bring it back. Items older than 90 days are removed automatically.
create table if not exists public.deleted_items (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('posts', 'tags', 'outlooks', 'weather_banner')),
  label text not null default '',
  data jsonb not null,
  deleted_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists deleted_items_created_idx on public.deleted_items (created_at desc);

alter table public.deleted_items enable row level security;

drop policy if exists "admins_manage_deleted_items" on public.deleted_items;
create policy "admins_manage_deleted_items" on public.deleted_items
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

-- 2. View counter: say WHY a view was not counted (visible in the browser network tab as
--    "reason"), instead of only true/false. Same name and arguments as before.
drop function if exists public.increment_post_views(text, text, integer, integer);

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

  delete from public.post_view_log where viewed_at < now() - interval '2 days';

  return 'counted';
end;
$$;

revoke all on function public.increment_post_views(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.increment_post_views(text, text, integer, integer) to service_role;
