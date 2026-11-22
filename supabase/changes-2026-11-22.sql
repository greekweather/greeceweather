-- Run once in the Supabase SQL editor (safe to re-run).
--
-- Scheduled notifications (maps, banners, articles that go live by their start time) used to depend
-- only on a GitHub Actions schedule, which GitHub delays or skips under load, so announcements
-- often went out only when something was saved in the admin. This makes the database itself call
-- the site every minute. Nothing is sent twice: each item is claimed in the database first.
--
-- BEFORE RUNNING: replace PASTE_CRON_SECRET_HERE below with the same value as the CRON_SECRET
-- environment variable on Vercel. Do not commit this file with the real secret in it.

create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
declare
	cron_secret text := 'PASTE_CRON_SECRET_HERE';
begin
	if exists (select 1 from vault.secrets where name = 'greeceweather_cron_secret') then
		return; -- already stored, keep it
	end if;

	if cron_secret = 'PASTE_CRON_SECRET_HERE' then
		raise exception 'Put the real CRON_SECRET in this script before running it';
	end if;

	perform vault.create_secret(cron_secret, 'greeceweather_cron_secret');
end
$$;

-- Same name again replaces the job, so re-running is harmless.
select cron.schedule(
	'greeceweather-push-check',
	'* * * * *',
	$job$
	select net.http_get(
		url := 'https://www.greeceweather.gr/api/cron/push',
		headers := jsonb_build_object(
			'Authorization',
			'Bearer ' || (
				select decrypted_secret
				from vault.decrypted_secrets
				where name = 'greeceweather_cron_secret'
			)
		),
		timeout_milliseconds := 60000
	);
	$job$
);

-- To check it works (a minute or two later):
--   select status, start_time from cron.job_run_details order by start_time desc limit 5;
--   select status_code, created from net._http_response order by created desc limit 5;
-- To stop it:
--   select cron.unschedule('greeceweather-push-check');
