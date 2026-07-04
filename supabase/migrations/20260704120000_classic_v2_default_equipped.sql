-- Default equipped achievement badge for Classic V2 teams (playtest kickoff).
--
-- The V2 seed cloned only cumulative XP, so these teams start with no pinned
-- badge even though they earned palmares in V1 (transferred via the app's
-- HARDCODED_GRANTS map). Here we set each team's headline V1 badge as their
-- DEFAULT equipped badge so they show something out of the box. Players can
-- re-equip anything they've unlocked afterwards.
--
-- Idempotent + non-destructive: only sets when currently NULL, so a re-run
-- (or a `db reset`) never clobbers a later user choice.

update public.teams set equipped_achievement_slug = 'giro-kom-victory'
  where id = '00000000-0000-4000-8000-c1a551c00005'  -- Dixon Hormous
    and equipped_achievement_slug is null;

update public.teams set equipped_achievement_slug = 'paris-roubaix-podium'
  where id = '00000000-0000-4000-8000-c1a551c00002'  -- Leopard_Trek
    and equipped_achievement_slug is null;

update public.teams set equipped_achievement_slug = 'flandres-top10'
  where id = '00000000-0000-4000-8000-c1a551c00001'  -- Klimax
    and equipped_achievement_slug is null;
