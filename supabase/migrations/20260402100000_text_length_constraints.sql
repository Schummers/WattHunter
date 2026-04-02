-- Enforce max length on user-facing text fields as a safety net
-- App-level validation is the primary guard; these are DB-level fallbacks

-- NOT VALID defers row validation — constraint applies to future writes only.
-- Avoids blocking deploy if OAuth display_name exceeds 50 chars.
ALTER TABLE users
  ADD CONSTRAINT chk_display_name_length CHECK (char_length(display_name) <= 50) NOT VALID;

ALTER TABLE teams
  ADD CONSTRAINT chk_team_name_length CHECK (char_length(name) <= 50) NOT VALID;

ALTER TABLE leagues
  ADD CONSTRAINT chk_league_name_length CHECK (char_length(name) <= 50) NOT VALID;
