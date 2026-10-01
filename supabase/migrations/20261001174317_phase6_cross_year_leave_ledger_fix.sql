-- Phase 6: approved leave may span calendar years.
-- The original single-request unique index conflicts with the later
-- per-year ledger segmentation introduced by Phase 6 hardening.
drop index if exists public.leave_ledger_approved_request_uidx;

-- Keep the per-segment idempotency guarantee.
create unique index if not exists leave_ledger_request_year_effect_unique
  on public.leave_ledger(
    request_id,
    leave_type_id,
    effective_date,
    transaction_type
  )
  where request_id is not null;
