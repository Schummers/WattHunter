-- Rollback for 20260703000100_classic_v2_open_slot.sql
-- Restores the original max_players and invite code on the V2 playtest league.

UPDATE public.leagues
SET max_players = 8,
    invite_code = 'CLASSIC2'
WHERE id = '00000000-0000-4000-8000-c1a551c2026e';
