-- Deal-scraping agent (Phase 0 schema).
--
-- A weekly job finds happy-hour / specials for NON-partner restaurants from their
-- own website (source of truth), extracts deals with an LLM, and writes them to a
-- review QUEUE. An admin approves candidates; approved ones are published into
-- `deals` with source='scraped'. See docs/deal-scraping-agent.md.
--
-- All additive / idempotent. Apply with the other migrations (needs set_updated_at()).

-- 1) restaurants: discovery + crawl bookkeeping + opt-out -----------------------
alter table public.restaurants
  add column if not exists website_url           text,
  add column if not exists google_place_id       text,
  add column if not exists deals_last_crawled_at  timestamptz,
  -- One-click opt-out: agent skips these and we purge their scraped deals.
  add column if not exists deals_scrape_opt_out   boolean not null default false;

-- 2) deals: provenance for auto-detected deals ---------------------------------
alter table public.deals
  add column if not exists source           text not null default 'owner',
  add column if not exists source_url        text,
  add column if not exists confidence        numeric,
  add column if not exists last_verified_at  timestamptz;

-- Constrain source values (guarded: ADD CONSTRAINT has no IF NOT EXISTS).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'deals_source_check'
  ) then
    alter table public.deals
      add constraint deals_source_check check (source in ('owner','scraped','seed'));
  end if;
end$$;

create index if not exists idx_deals_source on public.deals(source) where source <> 'owner';

-- 3) review queue --------------------------------------------------------------
create table if not exists public.scraped_deal_candidates (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,

  -- normalized deal fields (mirror `deals`)
  title                 text not null,
  description           text,
  deal_category         text,   -- happy_hour | daily_special | bogo | student_discount | other
  discount_type         text check (discount_type in ('percent','fixed','bogo')),
  discount_value        numeric,
  is_recurring          boolean default true,
  recurrence_days       int[],  -- 0=Sun .. 6=Sat
  recurrence_start_time time,
  recurrence_end_time   time,
  start_at              timestamptz,
  end_at                timestamptz,
  tags                  text[] not null default '{}'::text[],

  -- provenance / trust
  source_url    text,
  evidence_quote text,   -- the exact text the deal was extracted from (audit trail)
  confidence    numeric, -- 0..1
  content_hash  text,    -- hash of the source content used for this extraction
  dedupe_hash   text not null, -- stable hash of (restaurant_id + normalized title/days/time)

  -- review workflow
  status text not null default 'pending'
    check (status in ('pending','published','rejected','stale','superseded')),
  reviewed_by       uuid references public.profiles(id),
  reviewed_at       timestamptz,
  published_deal_id uuid references public.deals(id) on delete set null,

  first_seen_at timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  unique (restaurant_id, dedupe_hash)
);

create index if not exists idx_scraped_candidates_status     on public.scraped_deal_candidates(status);
create index if not exists idx_scraped_candidates_restaurant on public.scraped_deal_candidates(restaurant_id);

-- 4) RLS: admins manage the queue; the agent uses the service role (bypasses RLS).
alter table public.scraped_deal_candidates enable row level security;

drop policy if exists scraped_candidates_admin_all on public.scraped_deal_candidates;
create policy scraped_candidates_admin_all on public.scraped_deal_candidates
  for all to authenticated
  using     (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

drop trigger if exists scraped_candidates_set_updated_at on public.scraped_deal_candidates;
create trigger scraped_candidates_set_updated_at
  before update on public.scraped_deal_candidates
  for each row execute function public.set_updated_at();
