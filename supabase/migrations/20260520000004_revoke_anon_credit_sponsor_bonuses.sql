-- Fix: anon role still had EXECUTE after REVOKE PUBLIC.
-- On Supabase, anon is a distinct role that must be revoked separately.
REVOKE EXECUTE ON FUNCTION public.credit_sponsor_bonuses(uuid, jsonb) FROM anon;
