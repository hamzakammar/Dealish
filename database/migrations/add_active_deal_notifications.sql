-- ============================================================================
-- "Deal becoming active" favourite notifications — dedup column + claim RPC
-- ----------------------------------------------------------------------------
-- Supports notifying users when a restaurant they favourited has a deal that has
-- just entered its active window (a recurring deal whose daily window opened, or
-- a one-time deal whose start_at arrived). This complements the existing
-- "new deal published" push (utils/notifications.ts notifyNewDeal), which fires
-- at deal-creation time.
--
-- Design (bounded, reuses the existing service-key-cron pattern —
-- scripts/notify-active-deals.js run by .github/workflows/notify-active-deals.yml):
--   * `deals.last_active_notified_at` is the idempotency marker.
--   * `claim_active_deal_notifications()` atomically finds deals that are active
--     NOW (America/Toronto, matching utils/dealActivity semantics), have at least
--     one favouriter, and have not yet been notified for the CURRENT active
--     window, stamps last_active_notified_at, and returns them. The atomic
--     UPDATE ... RETURNING is the claim, so overlapping/re-run crons never double-send.
--   * Deals created in the last 20 min are skipped so a deal that is created
--     already-active does not get both the "new deal" and "becoming active" push.
--
-- Limitation: cross-midnight recurring windows (end_time <= start_time) are not
-- covered by this "becoming active" push (they still get the new-deal push and
-- render correctly in-app). Documented rather than adding date-wrap complexity.
-- ============================================================================

alter table public.deals
  add column if not exists last_active_notified_at timestamptz;

create or replace function public.claim_active_deal_notifications()
returns table (deal_id uuid, restaurant_id uuid, restaurant_name text, deal_title text)
language sql
security definer
set search_path = public
as $$
  update public.deals d
  set last_active_notified_at = now()
  from public.restaurants r
  where r.id = d.restaurant_id
    and d.is_active = true
    and coalesce(d.is_flagged, false) = false
    -- Skip freshly-created deals — they already got the "new deal" push.
    and d.created_at < now() - interval '20 minutes'
    -- Only notify when at least one user has favourited this restaurant.
    and exists (
      select 1 from public.profiles p
      where p.favourites @> array[d.restaurant_id]::uuid[]
    )
    and (
      -- Recurring: today (local) is a recurrence day and the current local time
      -- is inside a normal (non-cross-midnight) window; notified once per window.
      (
        d.is_recurring = true
        and d.recurrence_days is not null
        and extract(dow from (now() at time zone 'America/Toronto'))::int = any (d.recurrence_days)
        and d.recurrence_start_time is not null
        and d.recurrence_end_time is not null
        and d.recurrence_end_time > d.recurrence_start_time
        and (now() at time zone 'America/Toronto')::time >= d.recurrence_start_time
        and (now() at time zone 'America/Toronto')::time <= d.recurrence_end_time
        and (
          d.last_active_notified_at is null
          or d.last_active_notified_at <
             ((((now() at time zone 'America/Toronto')::date + d.recurrence_start_time)) at time zone 'America/Toronto')
        )
      )
      or
      -- One-time: inside its window; notified once, at first activation.
      (
        d.is_recurring is distinct from true
        and d.start_at is not null
        and d.start_at <= now()
        and (d.end_at is null or d.end_at >= now())
        and (
          d.last_active_notified_at is null
          or d.last_active_notified_at < d.start_at
        )
      )
    )
  returning d.id, d.restaurant_id, r.name, d.title;
$$;

-- Only the cron (service role) may claim/mark deals as notified. App users must
-- not be able to suppress real notifications by calling this.
revoke all on function public.claim_active_deal_notifications() from public;
revoke all on function public.claim_active_deal_notifications() from anon;
revoke all on function public.claim_active_deal_notifications() from authenticated;
grant execute on function public.claim_active_deal_notifications() to service_role;
