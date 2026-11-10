-- Shared index for the duplicate-image check: one small row per library image, so the check
-- no longer downloads the pictures again on every browser / device. Safe to run twice.

create table if not exists public.image_fingerprints (
	url text primary key,
	hash text not null,
	ratio real not null,
	colors smallint[] not null
);

alter table public.image_fingerprints enable row level security;

drop policy if exists "image_fingerprints admin all" on public.image_fingerprints;
create policy "image_fingerprints admin all" on public.image_fingerprints
	for all to authenticated
	using (public.is_admin())
	with check (public.is_admin());
