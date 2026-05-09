-- Add auto_validated flag on round_validations to distinguish manual
-- user validation from automatic system marking (teams that can't bid).
-- Default false preserves existing rows as manual validations.

ALTER TABLE public.round_validations
  ADD COLUMN auto_validated boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.round_validations.auto_validated IS
  'True when the row was inserted by the auto-validation helper (team had nothing actionable). False for manual user validations.';
