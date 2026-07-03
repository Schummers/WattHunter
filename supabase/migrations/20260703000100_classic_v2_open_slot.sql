-- Migration: 20260703000100_classic_v2_open_slot.sql
-- Purpose: open one slot in the "Classiques de l'individualisme V2" playtest
--          league for a new player, and fix its invite code so it is usable
--          from the join form.
--
-- Two one-off data fixes on this specific league row:
--   1. max_players 8 -> 9 (the league was full at 8/8).
--   2. invite_code 'CLASSIC2' (8 chars) -> 'CLASV2' (6 chars). The join form
--      enforces /^[A-Z2-9]{6}$/ (exactly 6 chars), so the original 8-char code
--      could never be entered. 'CLASV2' is a free, valid 6-char code.
--
-- Idempotent on local `db reset`: if the V2 seed is skipped (no prod users),
-- this UPDATE matches 0 rows and is a no-op.

UPDATE public.leagues
SET max_players = 9,
    invite_code = 'CLASV2'
WHERE id = '00000000-0000-4000-8000-c1a551c2026e';
