-- Rollback : restaurer les corps pre-fix.
-- NOTE: à executer en réappliquant les bodies de 20260605000100 (gt_add_to_squad,
-- gt_assign_role) et 20260605000200 (flag_underdog_contract) verbatim.
-- Puis supprimer le helper:
DROP FUNCTION IF EXISTS public.is_underdog_rank(uuid);
