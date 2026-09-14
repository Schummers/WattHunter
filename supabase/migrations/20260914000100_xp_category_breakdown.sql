-- Ticket 08 — XP decomposition by category, jerseys separated.
--
-- CHOICE: traceability columns, not a recalculation.
-- A recalculation from `gt_daily_classifications` would re-derive the split with
-- today's barème, which is exactly the move the Vuelta postmortem warned about:
-- a value recomputed from a stored rank proves nothing about what was actually
-- credited. These four columns record what the scorer credited, at the moment it
-- credited it, and stay true across every later barème change.
--
-- `gt_classif_bonus` stays the sum of the four, untouched: nothing that reads it
-- today has to change, and the split is verifiable against it.

alter table public.rider_xp_daily
  add column if not exists gc_classif_bonus numeric(6,2) not null default 0,
  add column if not exists points_classif_bonus numeric(6,2) not null default 0,
  add column if not exists kom_classif_bonus numeric(6,2) not null default 0,
  add column if not exists youth_classif_bonus numeric(6,2) not null default 0;

comment on column public.rider_xp_daily.gc_classif_bonus is
  'Yellow jersey share of gt_classif_bonus (daily general classification).';
comment on column public.rider_xp_daily.points_classif_bonus is
  'Green jersey share of gt_classif_bonus (daily points classification).';
comment on column public.rider_xp_daily.kom_classif_bonus is
  'Polka dot jersey share of gt_classif_bonus (daily mountains classification).';
comment on column public.rider_xp_daily.youth_classif_bonus is
  'White jersey share of gt_classif_bonus (daily youth classification).';

-- Full XP breakdown of a team on one event, categories summing to the stored XP.
--
-- `p_race_prefix` is a parent race slug (`race/tour-de-france/2026`): the
-- function takes that row and every child of it — stages, and the four final
-- classifications.
--
-- A final-classification row (`.../gc`, `.../points`, `.../kom`, `.../youth`) is
-- attributed whole to its jersey: the white jersey only ever exists there, since
-- a final classification is the only place it is awarded as a title.
--
-- The stage-finish term is taken as the RESIDUAL — stored XP minus every additive
-- bonus — and not recomputed from raw points × multipliers. That makes the sum of
-- the categories equal the stored XP by construction, instead of equal to a
-- second computation that may have drifted.
create or replace function public.team_race_xp_breakdown(
  p_team_id uuid,
  p_race_prefix text
)
returns table (
  category text,
  xp numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  with rows_of_event as (
    select
      d.xp_gained,
      d.nemesis_modifier,
      d.gc_classif_bonus,
      d.points_classif_bonus,
      d.kom_classif_bonus,
      d.youth_classif_bonus,
      d.gt_distance_bonus,
      d.assist_bonus,
      d.kom_event_bonus,
      d.sprint_event_bonus,
      case
        when d.race_slug like '%/gc' then 'gc'
        when d.race_slug like '%/points' then 'points'
        when d.race_slug like '%/kom' then 'kom'
        when d.race_slug like '%/youth' then 'youth'
        else null
      end as final_type
    from public.rider_xp_daily d
    where d.team_id = p_team_id
      and (d.race_slug = p_race_prefix or d.race_slug like p_race_prefix || '/%')
  ),
  per_category as (
    select
      -- A final classification row belongs whole to its jersey.
      sum(case when final_type is null
               then round(gc_classif_bonus * nemesis_modifier, 2)
               when final_type = 'gc' then xp_gained else 0 end) as jersey_yellow,
      sum(case when final_type is null
               then round(points_classif_bonus * nemesis_modifier, 2)
               when final_type = 'points' then xp_gained else 0 end) as jersey_green,
      sum(case when final_type is null
               then round(kom_classif_bonus * nemesis_modifier, 2)
               when final_type = 'kom' then xp_gained else 0 end) as jersey_polka,
      sum(case when final_type is null
               then round(youth_classif_bonus * nemesis_modifier, 2)
               when final_type = 'youth' then xp_gained else 0 end) as jersey_white,
      sum(case when final_type is null
               then round(kom_event_bonus * nemesis_modifier, 2) else 0 end) as summits,
      sum(case when final_type is null
               then round(sprint_event_bonus * nemesis_modifier, 2) else 0 end) as sprints,
      sum(case when final_type is null
               then round(gt_distance_bonus * nemesis_modifier, 2) else 0 end) as breakaway,
      sum(case when final_type is null
               then round(assist_bonus * nemesis_modifier, 2) else 0 end) as teammates,
      sum(xp_gained) as total
    from rows_of_event
  )
  select category, xp from (
    select 'stage_finish' as category,
           coalesce(total, 0)
             - coalesce(jersey_yellow, 0) - coalesce(jersey_green, 0)
             - coalesce(jersey_polka, 0) - coalesce(jersey_white, 0)
             - coalesce(summits, 0) - coalesce(sprints, 0)
             - coalesce(breakaway, 0) - coalesce(teammates, 0) as xp,
           1 as sort
    from per_category
    union all select 'summits', coalesce(summits, 0), 2 from per_category
    union all select 'sprints', coalesce(sprints, 0), 3 from per_category
    union all select 'breakaway', coalesce(breakaway, 0), 4 from per_category
    union all select 'teammates', coalesce(teammates, 0), 5 from per_category
    union all select 'jersey_yellow', coalesce(jersey_yellow, 0), 6 from per_category
    union all select 'jersey_green', coalesce(jersey_green, 0), 7 from per_category
    union all select 'jersey_polka', coalesce(jersey_polka, 0), 8 from per_category
    union all select 'jersey_white', coalesce(jersey_white, 0), 9 from per_category
  ) breakdown
  order by sort;
$$;

comment on function public.team_race_xp_breakdown(uuid, text) is
  'XP of a team on one event, split by category. The categories sum to the stored XP: the stage-finish term is the residual.';

grant execute on function public.team_race_xp_breakdown(uuid, text) to anon, authenticated;
