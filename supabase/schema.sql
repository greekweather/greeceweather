-- GreeceWeather: production-oriented schema.
-- Run in Supabase SQL Editor after creating the project.
-- Public readers can only SELECT published articles.
-- Admin writes are authorized through public.admin_users + is_admin().

create extension if not exists pgcrypto;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 180),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  description text not null default '' check (char_length(description) <= 400),
  content text not null check (char_length(content) between 1 and 500000),
  image_url text,
  image_alt text not null default '' check (char_length(image_alt) <= 180),
  tags text[] not null default '{}',
  published boolean not null default false,
  published_at timestamptz,
  views bigint not null default 0 check (views >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists posts_published_date_idx on public.posts (published, published_at desc);
create index if not exists posts_tags_gin_idx on public.posts using gin (tags);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists posts_set_updated_at on public.posts;
create trigger posts_set_updated_at before update on public.posts for each row execute function public.set_updated_at();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admin_users where user_id = auth.uid());
$$;

grant execute on function public.is_admin() to anon, authenticated;

alter table public.posts enable row level security;
alter table public.admin_users enable row level security;

drop policy if exists "published_posts_are_public" on public.posts;
create policy "published_posts_are_public" on public.posts
for select to anon, authenticated
using (published = true and published_at is not null and published_at <= now());

drop policy if exists "admins_can_read_all_posts" on public.posts;
create policy "admins_can_read_all_posts" on public.posts
for select to authenticated
using (public.is_admin());

drop policy if exists "admins_can_insert_posts" on public.posts;
create policy "admins_can_insert_posts" on public.posts
for insert to authenticated
with check (public.is_admin());

drop policy if exists "admins_can_update_posts" on public.posts;
create policy "admins_can_update_posts" on public.posts
for update to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "admins_can_delete_posts" on public.posts;
create policy "admins_can_delete_posts" on public.posts
for delete to authenticated
using (public.is_admin());

-- No application-level client is allowed to modify admin_users.
-- Manage this table only from the Supabase SQL editor.

insert into storage.buckets (id, name, public)
values ('post-images', 'post-images', true)
on conflict (id) do update set public = true;

drop policy if exists "public_can_read_post_images" on storage.objects;
create policy "public_can_read_post_images" on storage.objects
for select to public
using (bucket_id = 'post-images');

drop policy if exists "admins_can_upload_post_images" on storage.objects;
create policy "admins_can_upload_post_images" on storage.objects
for insert to authenticated
with check (bucket_id = 'post-images' and public.is_admin());

drop policy if exists "admins_can_update_post_images" on storage.objects;
create policy "admins_can_update_post_images" on storage.objects
for update to authenticated
using (bucket_id = 'post-images' and public.is_admin())
with check (bucket_id = 'post-images' and public.is_admin());

drop policy if exists "admins_can_delete_post_images" on storage.objects;
create policy "admins_can_delete_post_images" on storage.objects
for delete to authenticated
using (bucket_id = 'post-images' and public.is_admin());

-- Anonymous, low-integrity view counter. It is intentionally not used for security.
-- Each browser is expected to call it at most once per article/session, but exact anti-bot
-- analytics are better handled by an analytics provider rather than trusting this counter.
create or replace function public.increment_post_views(p_slug text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.posts
  set views = views + 1
  where slug = p_slug and published = true and published_at is not null and published_at <= now();
end;
$$;

grant execute on function public.increment_post_views(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Outlooks (Χάρτες): unofficial hand-drawn development-chance maps.
-- The map itself (areas, X markers, storms) is stored as validated JSON.
-- ---------------------------------------------------------------------------
create table if not exists public.outlooks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 140),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 100),
  summary text not null default '' check (char_length(summary) <= 20000),
  map_data jsonb not null check (jsonb_typeof(map_data) = 'object' and pg_column_size(map_data) <= 200000),
  legend_position text not null default 'tr' check (legend_position in ('tr', 'tl', 'br', 'bl')),
  issued_at timestamptz not null default now(),
  valid_until timestamptz,
  published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists outlooks_published_idx on public.outlooks (published, published_at desc);

drop trigger if exists outlooks_set_updated_at on public.outlooks;
create trigger outlooks_set_updated_at
before update on public.outlooks
for each row execute function public.set_updated_at();

alter table public.outlooks enable row level security;

drop policy if exists "public_can_read_published_outlooks" on public.outlooks;
create policy "public_can_read_published_outlooks" on public.outlooks
for select to anon, authenticated
using (published = true and published_at is not null and published_at <= now() and issued_at <= now());

drop policy if exists "admins_can_read_outlooks" on public.outlooks;
create policy "admins_can_read_outlooks" on public.outlooks
for select to authenticated
using (public.is_admin());

drop policy if exists "admins_can_insert_outlooks" on public.outlooks;
create policy "admins_can_insert_outlooks" on public.outlooks
for insert to authenticated
with check (public.is_admin());

drop policy if exists "admins_can_update_outlooks" on public.outlooks;
create policy "admins_can_update_outlooks" on public.outlooks
for update to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "admins_can_delete_outlooks" on public.outlooks;
create policy "admins_can_delete_outlooks" on public.outlooks
for delete to authenticated
using (public.is_admin());
