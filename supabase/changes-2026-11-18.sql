-- Run once in the Supabase SQL editor (safe to re-run).
-- Banners are now announced by notification when they go live, whatever they contain.
-- Banners that already exist are marked as announced, so none of them is sent again now.
update public.weather_banner
set push_emergency_key = coalesce(push_emergency_key, 'before-2026-11-18')
where push_emergency_key is null;
