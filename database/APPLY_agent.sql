-- ============================================================================
-- APPLY_agent.sql  --  Deal-scraping agent schema (Phase 0).
-- One paste in the Supabase SQL editor. Idempotent / additive.
-- Prereqs already live: profiles.is_operator, set_updated_at(), deal_flags.
-- After this: set GitHub Actions secrets + flip is_operator on the reviewer.
-- See docs/deal-scraping-agent.md > Operations.
-- ============================================================================

-- ---------- 1/2: add_deal_scraping_agent.sql ----------
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
-- `deals.source` records how a deal was created. It MAY already exist (the Google
-- Sheets sync uses values like 'manual'/'sheets'), so we add it defensively to keep
-- this migration self-sufficient -- otherwise the index below fails on a DB where
-- `source` was never created. No CHECK constraint, so existing rows / the sheets
-- sync are never rejected; the agent simply writes 'scraped'. NULL = ordinary deal.
alter table public.deals
  add column if not exists source            text,
  add column if not exists source_url        text,
  add column if not exists confidence        numeric,
  add column if not exists last_verified_at  timestamptz;

create index if not exists idx_deals_source_scraped on public.deals(source) where source = 'scraped';

-- Platform-operator flag: who may review the scraped-deal queue. Distinct from the
-- 'owner' (restaurant) and 'admin' (in-store scanner) roles. Founder flips this true.
alter table public.profiles
  add column if not exists is_operator boolean not null default false;

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
drop policy if exists scraped_candidates_operator_all on public.scraped_deal_candidates;
create policy scraped_candidates_operator_all on public.scraped_deal_candidates
  for all to authenticated
  using     (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_operator))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_operator));

drop trigger if exists scraped_candidates_set_updated_at on public.scraped_deal_candidates;
create trigger scraped_candidates_set_updated_at
  before update on public.scraped_deal_candidates
  for each row execute function public.set_updated_at();

-- ---------- 2/2: add_scraped_deal_flag_deactivation.sql ----------
-- Auto-deactivate scraped (unverified) deals that users repeatedly flag as wrong.
--
-- Only affects deals with source='scraped'. Owner/partner deals are never touched
-- by this trigger. Threshold: >= 3 thumbs_down AND more downs than ups.
-- Apply after add_deal_scraping_agent.sql. See docs/deal-scraping-agent.md.

create or replace function public.auto_deactivate_flagged_scraped_deal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source text;
  v_down   int;
  v_up     int;
begin
  select source into v_source from public.deals where id = NEW.deal_id;
  if v_source is distinct from 'scraped' then
    return NEW;
  end if;

  select
    count(*) filter (where type = 'thumbs_down'),
    count(*) filter (where type = 'thumbs_up')
  into v_down, v_up
  from public.deal_flags
  where deal_id = NEW.deal_id;

  if v_down >= 3 and v_down > v_up then
    update public.deals
      set is_active = false, is_flagged = true
      where id = NEW.deal_id and is_active = true;
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_auto_deactivate_scraped on public.deal_flags;
create trigger trg_auto_deactivate_scraped
  after insert or update on public.deal_flags
  for each row execute function public.auto_deactivate_flagged_scraped_deal();
