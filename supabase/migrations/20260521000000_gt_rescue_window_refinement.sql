-- ============================================================
-- GT Rescue Window — refinement (2026-05-21)
--
-- Changes:
--   1. NEW table public.gt_rescue_windows : matérialise pour chaque GT
--      (gt_identifier, gt_year) le timestamp de fermeture de la fenêtre
--      replace (1er rest day chronologique, fin de journée Europe/Paris).
--   2. RPC gt_place_emergency_bid : ajoute la garde "replace window closed"
--      (lookup dans gt_rescue_windows).
--   3. RPC gt_claim_dnf_refund : restaure le bloc UPDATE contracts disparu
--      en 20260519000000 (régression silencieuse). Refund continue d'être
--      claim-able anytime post-DNF — pas de garde temporelle.
--
-- Rule rappelée (cf. docs/GAME_RULES.md §16) :
--   - Refund : claim-able tout au long du GT, post-DNF
--   - Replace : claim-able uniquement jusqu'à la fin du 1er rest day du GT
--
-- Note Giro 2026 : 3 rest days (11/18/25 mai) à cause du transfert au
-- départ. Le rest day du 11 mai compte comme rest day 1 — donc replace
-- déjà fermé au moment de cette migration.
-- ============================================================

-- ============================================================
-- Part 1 : Table gt_rescue_windows
-- ============================================================
CREATE TABLE IF NOT EXISTS public.gt_rescue_windows (
  gt_identifier     text        NOT NULL,
  gt_year           int         NOT NULL,
  replace_closes_at timestamptz NOT NULL,
  PRIMARY KEY (gt_identifier, gt_year)
);

ALTER TABLE public.gt_rescue_windows ENABLE ROW LEVEL SECURITY;

-- Read-only pour authenticated. Aucune policy d'écriture : la table est
-- seedée uniquement par migration (= service_role / postgres).
CREATE POLICY "gt_rescue_windows_read_authenticated"
  ON public.gt_rescue_windows FOR SELECT
  TO authenticated USING (true);

COMMENT ON TABLE public.gt_rescue_windows IS
  'GT Rescue : timestamp de fermeture de la fenêtre replace (1er rest day, fin de journée Europe/Paris). Seedé par migration de chaque saison.';

-- ============================================================
-- Part 2 : Seed Giro 2026
-- 1er rest day = 2026-05-11. Fenêtre ferme 23:59:59 Europe/Paris (CEST = +02:00).
-- = 2026-05-11 21:59:59 UTC
-- ============================================================
INSERT INTO public.gt_rescue_windows (gt_identifier, gt_year, replace_closes_at)
VALUES ('giro-d-italia', 2026, '2026-05-11 21:59:59+00')
ON CONFLICT (gt_identifier, gt_year) DO NOTHING;
-- TDF 2026 et Vuelta 2026 seront seedés dans une migration ultérieure
-- quand wt_calendar_2026.json sera complété avec leurs rest_days.

-- ============================================================
-- Part 3 : RPC gt_place_emergency_bid (refined)
-- Ajoute la garde temporelle "replace window closed" en s'appuyant sur
-- gt_rescue_windows. Reste de la logique = identique à 20260519000001.
-- ============================================================
CREATE OR REPLACE FUNCTION public.gt_place_emergency_bid(
  p_rider_id      uuid,
  p_amount        int,
  p_phase_id      int,
  p_gt_identifier text,
  p_gt_year       int,
  p_league_id     uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_team_id   uuid;
  v_treasury  bigint;
  v_closes_at timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'not authenticated');
  END IF;

  -- NEW (2026-05-21) : Replace window check.
  -- Refund reste anytime, mais replace est gated au 1er rest day.
  SELECT replace_closes_at INTO v_closes_at
  FROM public.gt_rescue_windows
  WHERE gt_identifier = p_gt_identifier
    AND gt_year = p_gt_year;

  IF v_closes_at IS NULL THEN
    RETURN jsonb_build_object('error', 'replace window not configured for this GT');
  END IF;

  IF now() > v_closes_at THEN
    RETURN jsonb_build_object('error', 'replace window closed');
  END IF;

  -- Get team in this league
  SELECT t.id, t.treasury INTO v_team_id, v_treasury
  FROM public.teams t
  WHERE t.league_id = p_league_id AND t.user_id = auth.uid();

  IF v_team_id IS NULL THEN
    RETURN jsonb_build_object('error', 'team not found');
  END IF;

  -- Eligibility gate: team must have claimed a DNF refund for this GT
  IF NOT EXISTS (
    SELECT 1 FROM public.gt_squad
    WHERE team_id = v_team_id
      AND phase_id = p_phase_id
      AND year = p_gt_year
      AND dnf_refund_claimed = true
  ) THEN
    RETURN jsonb_build_object('error', 'no DNF refund claimed for this GT');
  END IF;

  -- Max 1 active emergency bid per team per GT
  IF EXISTS (
    SELECT 1 FROM public.gt_emergency_bids
    WHERE team_id = v_team_id
      AND phase_id = p_phase_id
      AND gt_identifier = p_gt_identifier
      AND gt_year = p_gt_year
      AND resolved = false
  ) THEN
    RETURN jsonb_build_object('error', 'already have an active emergency bid');
  END IF;

  -- Rider must not already be contracted in this league
  IF EXISTS (
    SELECT 1 FROM public.contracts c
    JOIN public.teams t ON t.id = c.team_id
    WHERE c.rider_id = p_rider_id
      AND t.league_id = p_league_id
      AND c.status = 'active'
  ) THEN
    RETURN jsonb_build_object('error', 'rider already contracted in this league');
  END IF;

  -- Amount validation
  IF p_amount < 5000 OR p_amount % 100 != 0 THEN
    RETURN jsonb_build_object('error', 'amount must be >= 5000 and a multiple of 100');
  END IF;

  -- Solvency check
  IF v_treasury < p_amount THEN
    RETURN jsonb_build_object('error', 'insufficient treasury');
  END IF;

  INSERT INTO public.gt_emergency_bids (
    league_id, team_id, rider_id, amount, phase_id, gt_identifier, gt_year
  ) VALUES (
    p_league_id, v_team_id, p_rider_id, p_amount, p_phase_id, p_gt_identifier, p_gt_year
  );

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.gt_place_emergency_bid(uuid, int, int, text, int, uuid) TO authenticated;

-- ============================================================
-- Part 4 : RPC gt_claim_dnf_refund (fix régression)
-- Restaure le bloc UPDATE contracts qui a disparu en 20260519000000
-- (régression silencieuse lors de la consolidation du feature rescue
-- window). Bloc copié verbatim depuis 20260511000004 lignes 80-88.
-- Refund reste claim-able anytime post-DNF — pas de garde temporelle.
-- ============================================================
CREATE OR REPLACE FUNCTION public.gt_claim_dnf_refund(
  p_gt_squad_id uuid,
  p_contract_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_team_id     uuid;
  v_rider_id    uuid;
  v_salary      int;
  v_refund      int;
  v_xp_total    numeric;
  v_gt_id       text;
  v_phase_id    int;
  v_gt_year     int;
  v_rider_name  text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'not authenticated');
  END IF;

  -- Validate gt_squad entry: must have dnf_stage set, not yet claimed, owned by caller
  SELECT gs.team_id, gs.rider_id, gs.phase_id, gs.year
  INTO v_team_id, v_rider_id, v_phase_id, v_gt_year
  FROM public.gt_squad gs
  JOIN public.teams t ON t.id = gs.team_id
  WHERE gs.id = p_gt_squad_id
    AND gs.dnf_stage IS NOT NULL
    AND gs.dnf_refund_claimed = false
    AND t.user_id = auth.uid();

  IF v_team_id IS NULL THEN
    RETURN jsonb_build_object('error', 'DNF entry not found or already claimed');
  END IF;

  -- Lock team row to prevent concurrent treasury mutations
  PERFORM 1 FROM public.teams WHERE id = v_team_id FOR UPDATE;

  -- Derive gt_identifier from phase_id
  v_gt_id := CASE v_phase_id
    WHEN 4 THEN 'giro-d-italia'
    WHEN 6 THEN 'tour-de-france'
    WHEN 8 THEN 'vuelta-a-espana'
  END;

  -- Get locked_salary from the active contract
  SELECT c.locked_salary INTO v_salary
  FROM public.contracts c
  WHERE c.id = p_contract_id
    AND c.team_id = v_team_id
    AND c.rider_id = v_rider_id
    AND c.status = 'active';

  IF v_salary IS NULL THEN
    RETURN jsonb_build_object('error', 'active contract not found');
  END IF;

  v_refund := ROUND(v_salary * 0.5);

  -- Get rider name for audit logs
  SELECT full_name INTO v_rider_name FROM public.riders WHERE id = v_rider_id;

  -- Sum GT XP earned by this rider for this team on this GT
  SELECT COALESCE(SUM(xp_gained), 0) INTO v_xp_total
  FROM public.rider_xp_daily
  WHERE team_id = v_team_id
    AND rider_id = v_rider_id
    AND race_slug LIKE 'race/' || v_gt_id || '/' || v_gt_year || '%';

  -- Retroactively forfeit XP.
  -- grant_xp has GRANT EXECUTE TO service_role + supabase_admin.
  -- This SECURITY DEFINER function runs as the postgres superuser, so the call succeeds.
  IF v_xp_total > 0 THEN
    PERFORM public.grant_xp(
      v_team_id,
      -v_xp_total,
      'GT DNF forfeit — ' || v_rider_name
    );
  END IF;

  -- Credit 50% refund to treasury
  INSERT INTO public.treasury_log (team_id, type, amount, description, rider_id)
  VALUES (v_team_id, 'gt_dnf_refund', v_refund, 'GT DNF refund 50% — ' || v_rider_name, v_rider_id);

  UPDATE public.teams SET treasury = treasury + v_refund WHERE id = v_team_id;

  -- RESTORED (2026-05-21) : Release the contract (5-day cooldown, mirrors release_rider).
  -- Ce bloc avait disparu en 20260519000000 lors de la consolidation du
  -- feature GT Rescue Window. Sans lui, le coureur disparaît du squad
  -- mais le contrat reste actif → salaire prélevé chaque phase WT.
  UPDATE public.contracts
  SET status = 'released',
      released_at = now(),
      available_from = now() + interval '5 days'
  WHERE id = p_contract_id;

  -- Remove any draft bids for this rider in this team
  DELETE FROM public.draft_bids
  WHERE rider_id = v_rider_id AND team_id = v_team_id;

  -- Mark DNF as claimed + soft-delete from squad
  UPDATE public.gt_squad
  SET dnf_refund_claimed = true, removed_at = now()
  WHERE id = p_gt_squad_id;

  RETURN jsonb_build_object(
    'ok', true,
    'refund_amount', v_refund,
    'xp_forfeited', v_xp_total
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.gt_claim_dnf_refund(uuid, uuid) TO authenticated;
