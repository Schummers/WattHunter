drop function if exists public.team_race_xp_breakdown(uuid, text);
alter table public.rider_xp_daily
  drop column if exists gc_classif_bonus,
  drop column if exists points_classif_bonus,
  drop column if exists kom_classif_bonus,
  drop column if exists youth_classif_bonus;
