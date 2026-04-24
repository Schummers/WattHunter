-- Remontada Boost audit column on rider_xp_daily.
-- Follow-up to 20260423120000_remontada_boost.sql — that file was already applied.
alter table rider_xp_daily
  add column if not exists remontada_mult numeric(3,1) not null default 1.0;

comment on column rider_xp_daily.remontada_mult is
  'Remontada boost multiplier applied to this row. 1.0 = no boost, 2.0 = active.';
