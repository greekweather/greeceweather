-- Notification topics and notifications for new articles. Safe to run twice.

-- 1. What each phone wants to receive: any of maps, posts, banner.
alter table public.push_subscriptions
  add column if not exists topics text[] not null default '{maps,posts,banner}';

-- 2. Remember which articles were already announced, so each one is sent once.
alter table public.posts add column if not exists push_sent_at timestamptz;

-- Everything published today counts as already announced: no notification for old articles.
update public.posts set push_sent_at = now() where push_sent_at is null;
