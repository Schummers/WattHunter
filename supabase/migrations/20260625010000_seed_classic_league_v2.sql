-- Seed "Classiques de l'individualisme V2" — a classic-mode league for Tour de France playtesting.
--
-- Clones the 8 players from the live manager league "Classiques de l'individualisme"
-- (id adaec367-784a-4580-8001-52405a2df5b9), copying ONLY their cumulative XP. Everything
-- else starts fresh: treasury 0 (becomes 1.5M at the first classic_phase_reset), no roster,
-- no sponsors, no policies, no underdog.
--
-- The 8 auth users + public.users rows already exist (real players), so we do NOT touch
-- auth.users / public.users here — only leagues, teams, league_members.
--
-- Frozen XP snapshot (verified against prod 2026-06-25): NOT a live SELECT, so a db reset
-- reproduces V2 from these literals. Idempotent via fixed UUIDs + ON CONFLICT DO NOTHING.

-- 1. The V2 league (classic mode, active).
INSERT INTO public.leagues (id, name, invite_code, commissioner_id, status, max_players, season_year, starting_level, mode)
VALUES (
  '00000000-0000-4000-8000-c1a551c2026e'::uuid,
  'Classiques de l''individualisme V2',
  'CLASSIC2',
  'dc1380b4-4147-4f4a-840b-7b5ed602669f'::uuid,  -- Leopard_Trek = commissioner
  'active',
  8,
  2026,
  8,           -- irrelevant in classic mode; set for consistency
  'classic'
)
ON CONFLICT (id) DO NOTHING;

-- 2. The 8 teams (cumulative_xp from snapshot; everything else fresh).
--    Direct INSERT is not blocked by teams_protect_sensitive_fields (that trigger fires on UPDATE only).
INSERT INTO public.teams (id, user_id, league_id, name, cumulative_xp, treasury, level, underdog_eligible)
VALUES
  ('00000000-0000-4000-8000-c1a551c00001'::uuid, 'd05767bd-6bc3-415b-8163-fcf4617bd550'::uuid, '00000000-0000-4000-8000-c1a551c2026e'::uuid, 'Klimax',         2643.16, 0, 8, false),
  ('00000000-0000-4000-8000-c1a551c00002'::uuid, 'dc1380b4-4147-4f4a-840b-7b5ed602669f'::uuid, '00000000-0000-4000-8000-c1a551c2026e'::uuid, 'Leopard_Trek',   2590.09, 0, 8, false),
  ('00000000-0000-4000-8000-c1a551c00003'::uuid, '1e8b3f48-d6c4-413a-bd04-dcae642af64d'::uuid, '00000000-0000-4000-8000-c1a551c2026e'::uuid, 'TheAussieMate',  2102.61, 0, 8, false),
  ('00000000-0000-4000-8000-c1a551c00004'::uuid, '68ac0829-6244-4b49-8d69-3392b3991596'::uuid, '00000000-0000-4000-8000-c1a551c2026e'::uuid, 'GoudalEnergies', 1814.84, 0, 8, false),
  ('00000000-0000-4000-8000-c1a551c00005'::uuid, '01f66baa-ffdd-474e-ad21-0cb9b0d64d52'::uuid, '00000000-0000-4000-8000-c1a551c2026e'::uuid, 'Dixon Hormous',  1655.63, 0, 8, false),
  ('00000000-0000-4000-8000-c1a551c00006'::uuid, '0a6bcf31-c138-457b-ab5c-9091f630f62b'::uuid, '00000000-0000-4000-8000-c1a551c2026e'::uuid, 'Peejee',         1642.05, 0, 8, false),
  ('00000000-0000-4000-8000-c1a551c00007'::uuid, '8688fdb5-d9aa-4240-9c29-3e7c9502e9eb'::uuid, '00000000-0000-4000-8000-c1a551c2026e'::uuid, 'Muscat Romain',  1209.88, 0, 8, false),
  ('00000000-0000-4000-8000-c1a551c00008'::uuid, '5346b6b6-15a0-4d50-8825-697a259d0acb'::uuid, '00000000-0000-4000-8000-c1a551c2026e'::uuid, 'bigdaddy',        983.26, 0, 8, false)
ON CONFLICT (id) DO NOTHING;

-- 3. League memberships (link each user to its V2 team).
INSERT INTO public.league_members (id, league_id, user_id, team_id)
VALUES
  ('00000000-0000-4000-8000-c1a551d00001'::uuid, '00000000-0000-4000-8000-c1a551c2026e'::uuid, 'd05767bd-6bc3-415b-8163-fcf4617bd550'::uuid, '00000000-0000-4000-8000-c1a551c00001'::uuid),
  ('00000000-0000-4000-8000-c1a551d00002'::uuid, '00000000-0000-4000-8000-c1a551c2026e'::uuid, 'dc1380b4-4147-4f4a-840b-7b5ed602669f'::uuid, '00000000-0000-4000-8000-c1a551c00002'::uuid),
  ('00000000-0000-4000-8000-c1a551d00003'::uuid, '00000000-0000-4000-8000-c1a551c2026e'::uuid, '1e8b3f48-d6c4-413a-bd04-dcae642af64d'::uuid, '00000000-0000-4000-8000-c1a551c00003'::uuid),
  ('00000000-0000-4000-8000-c1a551d00004'::uuid, '00000000-0000-4000-8000-c1a551c2026e'::uuid, '68ac0829-6244-4b49-8d69-3392b3991596'::uuid, '00000000-0000-4000-8000-c1a551c00004'::uuid),
  ('00000000-0000-4000-8000-c1a551d00005'::uuid, '00000000-0000-4000-8000-c1a551c2026e'::uuid, '01f66baa-ffdd-474e-ad21-0cb9b0d64d52'::uuid, '00000000-0000-4000-8000-c1a551c00005'::uuid),
  ('00000000-0000-4000-8000-c1a551d00006'::uuid, '00000000-0000-4000-8000-c1a551c2026e'::uuid, '0a6bcf31-c138-457b-ab5c-9091f630f62b'::uuid, '00000000-0000-4000-8000-c1a551c00006'::uuid),
  ('00000000-0000-4000-8000-c1a551d00007'::uuid, '00000000-0000-4000-8000-c1a551c2026e'::uuid, '8688fdb5-d9aa-4240-9c29-3e7c9502e9eb'::uuid, '00000000-0000-4000-8000-c1a551c00007'::uuid),
  ('00000000-0000-4000-8000-c1a551d00008'::uuid, '00000000-0000-4000-8000-c1a551c2026e'::uuid, '5346b6b6-15a0-4d50-8825-697a259d0acb'::uuid, '00000000-0000-4000-8000-c1a551c00008'::uuid)
ON CONFLICT (id) DO NOTHING;
