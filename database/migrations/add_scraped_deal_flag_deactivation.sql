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
