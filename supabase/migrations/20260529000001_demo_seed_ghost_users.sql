-- Chantier B (demo mode) — seed step.
-- Creates the demo_league_id() helper, adds is_demo on leagues, inserts the
-- 8 ghost auth.users + public.users rows, and a placeholder demo league row.
-- All operations are idempotent (ON CONFLICT DO NOTHING) so re-applying is safe.

------------------------------------------------------------------------------
-- 1. Helper function used by every anon RLS policy.
------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.demo_league_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT '00000000-0000-4000-8000-d3110d3110d3'::uuid;
$$;

GRANT EXECUTE ON FUNCTION public.demo_league_id() TO anon, authenticated;

------------------------------------------------------------------------------
-- 2. is_demo column on leagues.
------------------------------------------------------------------------------

ALTER TABLE public.leagues
  ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false;

------------------------------------------------------------------------------
-- 3. 8 ghost auth.users (cannot log in: encrypted_password = '').
------------------------------------------------------------------------------

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, is_sso_user, is_anonymous
)
SELECT
  uid::uuid,
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'demo-team-' || idx || '@watthunter.demo',
  '',
  now(),
  '{"provider":"demo","providers":["demo"]}'::jsonb,
  '{}'::jsonb,
  now(),
  now(),
  false,
  false
FROM (VALUES
  (1, '00000000-0000-4000-8000-d3110d310001'),
  (2, '00000000-0000-4000-8000-d3110d310002'),
  (3, '00000000-0000-4000-8000-d3110d310003'),
  (4, '00000000-0000-4000-8000-d3110d310004'),
  (5, '00000000-0000-4000-8000-d3110d310005'),
  (6, '00000000-0000-4000-8000-d3110d310006'),
  (7, '00000000-0000-4000-8000-d3110d310007'),
  (8, '00000000-0000-4000-8000-d3110d310008')
) AS demo(idx, uid)
ON CONFLICT (id) DO NOTHING;

------------------------------------------------------------------------------
-- 4. 8 public.users mirroring the ghost auth rows. display_name = team name.
--    Note: public.users has no email column — only id, display_name, avatar_url.
--    Uses DO UPDATE to correct generic names if rows already exist.
------------------------------------------------------------------------------

INSERT INTO public.users (id, display_name, avatar_url)
SELECT
  uid::uuid,
  team_name,
  NULL
FROM (VALUES
  (1, '00000000-0000-4000-8000-d3110d310001', 'Flamme Rouge'),
  (2, '00000000-0000-4000-8000-d3110d310002', 'Les Grimpeurs'),
  (3, '00000000-0000-4000-8000-d3110d310003', 'Cinq Etoiles'),
  (4, '00000000-0000-4000-8000-d3110d310004', 'Bidon Vert'),
  (5, '00000000-0000-4000-8000-d3110d310005', 'Echappee Belle'),
  (6, '00000000-0000-4000-8000-d3110d310006', 'Pave Royal'),
  (7, '00000000-0000-4000-8000-d3110d310007', 'Maillot Jaune'),
  (8, '00000000-0000-4000-8000-d3110d310008', 'Domestique XI')
) AS demo(idx, uid, team_name)
ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name;

------------------------------------------------------------------------------
-- 5. Placeholder demo league row. Refresh script overwrites the rest.
--    commissioner_id = demo user 1 (inserted in step 4 above).
------------------------------------------------------------------------------

INSERT INTO public.leagues (id, name, invite_code, commissioner_id, status, max_players, is_demo)
VALUES (
  public.demo_league_id(),
  'WattHunter Demo League',
  'DEMO00',
  '00000000-0000-4000-8000-d3110d310001',
  'active',
  8,
  true
)
ON CONFLICT (id) DO UPDATE SET is_demo = true;
