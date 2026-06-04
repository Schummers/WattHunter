"""RPC / trigger integration tests against the LOCAL Supabase Postgres.

These run real SQL against the Colima/Supabase-local DB (the schema produced by
`supabase db reset`), exercising the June Spec A/B/C RPCs and triggers end to end:

  - place_bid          — 1 000 € increment validation (20260602110100)
  - gt_add_to_squad    — invalid-role / not-owner / underdog eligibility +
                         per-role cap (underdog = 2) (20260605000100)
  - enforce_gt_squad_cap — dynamic squad cap 8 / 10, scoped PER race_slug
  - confirm_phase_setup — reversible underdog −50 % payday discount (20260605000300)

Auth is simulated with `SET LOCAL request.jwt.claims` so auth.uid() resolves
inside SECURITY DEFINER functions. Every test runs inside a transaction that is
ROLLED BACK, so the DB is left untouched.

Skipped automatically when the local DB container is not reachable (so the unit
suite still runs on machines without Colima).
"""
from __future__ import annotations

import subprocess

import pytest

_CONTAINER = "supabase_db_WattHunter"
OWNER = "11111111-1111-1111-1111-111111111111"
OTHER = "99999999-9999-9999-9999-999999999999"
LEAGUE = "22222222-2222-2222-2222-222222222222"
TEAM = "33333333-3333-3333-3333-333333333333"
OTHER_TEAM = "44444444-4444-4444-4444-444444444444"
GIRO = "race/giro-d-italia/2026/stage-4"
TOUR = "race/tour-de-france/2026/stage-4"


def _db_available() -> bool:
    try:
        r = subprocess.run(
            ["docker", "exec", "-i", _CONTAINER, "psql", "-U", "postgres", "-d",
             "postgres", "-c", "select 1"],
            capture_output=True, text=True, timeout=15,
        )
        return r.returncode == 0
    except Exception:
        return False


pytestmark = pytest.mark.skipif(
    not _db_available(),
    reason="local Supabase DB container not reachable (start Colima + supabase start)",
)


def _run(sql: str) -> subprocess.CompletedProcess:
    """Run a SQL script in the local DB with ON_ERROR_STOP; return the process."""
    return subprocess.run(
        ["docker", "exec", "-i", _CONTAINER, "psql", "-U", "postgres", "-d",
         "postgres", "-v", "ON_ERROR_STOP=1", "-q"],
        input=sql, capture_output=True, text=True, timeout=60,
    )


def _seed(*, eligible: bool, riders: int = 0, contracts: bool = False,
          locked_salary: int = 23000, underdog_discount: bool = False) -> str:
    """SQL that seeds an owner, a league, a team (eligible or not), an 'other'
    user+team, and optionally N riders (rank 200) + active contracts."""
    parts = [
        f"INSERT INTO auth.users (id, email) VALUES "
        f"('{OWNER}','owner@test.local'), ('{OTHER}','other@test.local');",
        f"INSERT INTO public.leagues (id, name, invite_code, commissioner_id, status, season_year) "
        f"VALUES ('{LEAGUE}','L','CODE01','{OWNER}','active',2026);",
        f"INSERT INTO public.teams (id, user_id, league_id, name, underdog_eligible, level, treasury) "
        f"VALUES ('{TEAM}','{OWNER}','{LEAGUE}','T',{str(eligible).lower()},5,5000000);",
        f"INSERT INTO public.teams (id, user_id, league_id, name, underdog_eligible, level, treasury) "
        f"VALUES ('{OTHER_TEAM}','{OTHER}','{LEAGUE}','T2',false,5,5000000);",
    ]
    for i in range(1, riders + 1):
        rid = f"aaaaaaaa-0000-0000-0000-{i:012d}"
        parts.append(
            f"INSERT INTO public.riders (id, pcs_slug, full_name, pcs_rank, monthly_salary) "
            f"VALUES ('{rid}','rider-{i}','Rider {i}',200,5000);"
        )
        if contracts:
            parts.append(
                f"INSERT INTO public.contracts (team_id, rider_id, league_id, locked_salary, status, underdog_discount) "
                f"VALUES ('{TEAM}','{rid}','{LEAGUE}',{locked_salary},'active',{str(underdog_discount).lower()});"
            )
    return "\n".join(parts)


def _tx(body: str, *, claims: str | None = None, seed: str = "") -> str:
    claim_line = (
        f"SET LOCAL request.jwt.claims = '{claims}';\n" if claims else ""
    )
    return f"BEGIN;\n{seed}\n{claim_line}{body}\nROLLBACK;\n"


def _claims(sub: str) -> str:
    return f'{{"sub":"{sub}","role":"authenticated"}}'


# ---------------------------------------------------------------------------
# place_bid — 1 000 € increment validation
# ---------------------------------------------------------------------------

def test_place_bid_rejects_non_multiple_of_1000():
    body = """
    DO $$
    DECLARE r jsonb;
    BEGIN
      r := public.place_bid('00000000-0000-0000-0000-0000000000a1'::uuid,
                            '00000000-0000-0000-0000-0000000000b1'::uuid, 5500, 1);
      IF r->>'error' <> 'Amount must be multiple of 1000' THEN
        RAISE EXCEPTION 'expected multiple-of-1000 rejection, got %', r;
      END IF;
    END $$;
    """
    p = _run(_tx(body, claims=_claims(OWNER), seed=_seed(eligible=False)))
    assert p.returncode == 0, p.stderr


def test_place_bid_accepts_multiple_of_1000_past_increment_gate():
    # 5000 is a valid multiple → it must clear the increment gate and fail later
    # (auction not found), proving the gate targets the increment specifically.
    body = """
    DO $$
    DECLARE r jsonb;
    BEGIN
      r := public.place_bid('00000000-0000-0000-0000-0000000000a1'::uuid,
                            '00000000-0000-0000-0000-0000000000b1'::uuid, 5000, 1);
      IF r->>'error' = 'Amount must be multiple of 1000' THEN
        RAISE EXCEPTION 'multiple-of-1000 should pass for 5000, got %', r;
      END IF;
      IF r->>'error' IS NULL THEN
        RAISE EXCEPTION 'expected a downstream error (no auction), got %', r;
      END IF;
    END $$;
    """
    p = _run(_tx(body, claims=_claims(OWNER), seed=_seed(eligible=False)))
    assert p.returncode == 0, p.stderr


# ---------------------------------------------------------------------------
# gt_add_to_squad — validation + authorization + underdog eligibility/cap
# ---------------------------------------------------------------------------

def test_add_to_squad_rejects_invalid_role():
    body = f"""
    DO $$
    DECLARE r jsonb;
    BEGIN
      r := public.gt_add_to_squad('{TEAM}'::uuid,'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
                                  'banana', 4, 2026, '{GIRO}');
      IF r->>'error' <> 'Invalid role' THEN
        RAISE EXCEPTION 'expected Invalid role, got %', r;
      END IF;
    END $$;
    """
    p = _run(_tx(body, claims=_claims(OWNER), seed=_seed(eligible=True, riders=1, contracts=True)))
    assert p.returncode == 0, p.stderr


def test_add_to_squad_rejects_non_owner():
    # OTHER user tries to modify OWNER's team → 'Not team owner'.
    body = f"""
    DO $$
    DECLARE r jsonb;
    BEGIN
      r := public.gt_add_to_squad('{TEAM}'::uuid,'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
                                  'domestique', 4, 2026, '{GIRO}');
      IF r->>'error' <> 'Not team owner' THEN
        RAISE EXCEPTION 'expected Not team owner, got %', r;
      END IF;
    END $$;
    """
    p = _run(_tx(body, claims=_claims(OTHER), seed=_seed(eligible=True, riders=1, contracts=True)))
    assert p.returncode == 0, p.stderr


def test_underdog_role_requires_eligibility():
    body = f"""
    DO $$
    DECLARE r jsonb;
    BEGIN
      r := public.gt_add_to_squad('{TEAM}'::uuid,'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
                                  'underdog', 4, 2026, '{GIRO}');
      IF r->>'error' NOT LIKE 'Underdog role is only available%' THEN
        RAISE EXCEPTION 'expected eligibility rejection, got %', r;
      END IF;
    END $$;
    """
    # team NOT eligible
    p = _run(_tx(body, claims=_claims(OWNER), seed=_seed(eligible=False, riders=1, contracts=True)))
    assert p.returncode == 0, p.stderr


def test_underdog_role_cap_is_2():
    # Eligible team, 3 contracted riders → 2 underdogs OK, 3rd hits the cap.
    body = f"""
    DO $$
    DECLARE r jsonb;
    BEGIN
      PERFORM public.gt_add_to_squad('{TEAM}'::uuid,'aaaaaaaa-0000-0000-0000-000000000001'::uuid,'underdog',4,2026,'{GIRO}');
      PERFORM public.gt_add_to_squad('{TEAM}'::uuid,'aaaaaaaa-0000-0000-0000-000000000002'::uuid,'underdog',4,2026,'{GIRO}');
      r := public.gt_add_to_squad('{TEAM}'::uuid,'aaaaaaaa-0000-0000-0000-000000000003'::uuid,'underdog',4,2026,'{GIRO}');
      IF r->>'error' NOT LIKE 'Role underdog is at capacity%' THEN
        RAISE EXCEPTION 'expected underdog cap (2), got %', r;
      END IF;
    END $$;
    """
    p = _run(_tx(body, claims=_claims(OWNER), seed=_seed(eligible=True, riders=3, contracts=True)))
    assert p.returncode == 0, p.stderr


# ---------------------------------------------------------------------------
# enforce_gt_squad_cap — dynamic 8/10 cap, scoped per race_slug
# ---------------------------------------------------------------------------

def _fill_squad_sql(n: int, race_slug: str, phase_id: int = 4, start: int = 1) -> str:
    rows = []
    for i in range(start, start + n):
        rid = f"aaaaaaaa-0000-0000-0000-{i:012d}"
        rows.append(
            f"INSERT INTO public.gt_squad (team_id, phase_id, year, rider_id, role, race_slug) "
            f"VALUES ('{TEAM}',{phase_id},2026,'{rid}','domestique','{race_slug}');"
        )
    return "\n".join(rows)


def test_squad_cap_8_for_non_underdog_team():
    body = _fill_squad_sql(8, GIRO) + f"""
    DO $$
    BEGIN
      BEGIN
        INSERT INTO public.gt_squad (team_id, phase_id, year, rider_id, role, race_slug)
        VALUES ('{TEAM}',4,2026,'aaaaaaaa-0000-0000-0000-000000000009','domestique','{GIRO}');
        RAISE EXCEPTION 'cap not enforced: 9th insert succeeded';
      EXCEPTION WHEN check_violation THEN
        NULL;  -- expected: 'Squad already at max (8 riders)'
      END;
    END $$;
    """
    p = _run(_tx(body, seed=_seed(eligible=False, riders=9)))
    assert p.returncode == 0, p.stderr


def test_squad_cap_10_for_underdog_team():
    body = _fill_squad_sql(10, GIRO) + f"""
    DO $$
    BEGIN
      BEGIN
        INSERT INTO public.gt_squad (team_id, phase_id, year, rider_id, role, race_slug)
        VALUES ('{TEAM}',4,2026,'aaaaaaaa-0000-0000-0000-000000000011','domestique','{GIRO}');
        RAISE EXCEPTION 'cap not enforced: 11th insert succeeded';
      EXCEPTION WHEN check_violation THEN
        NULL;  -- expected: 'Squad already at max (10 riders)'
      END;
    END $$;
    """
    p = _run(_tx(body, seed=_seed(eligible=True, riders=11)))
    assert p.returncode == 0, p.stderr


def test_squad_cap_is_scoped_per_race_slug():
    # 8 on the Giro stage must NOT block filling a Tour stage (separate race_slug).
    # Giro = phase 4, Tour = phase 6 → the phase-scoped unique index allows the same
    # riders in both; the cap trigger scopes by race_slug.
    body = _fill_squad_sql(8, GIRO, phase_id=4, start=1) + _fill_squad_sql(8, TOUR, phase_id=6, start=1) + f"""
    DO $$
    DECLARE n_giro int; n_tour int;
    BEGIN
      SELECT count(*) INTO n_giro FROM public.gt_squad WHERE team_id='{TEAM}' AND race_slug='{GIRO}';
      SELECT count(*) INTO n_tour FROM public.gt_squad WHERE team_id='{TEAM}' AND race_slug='{TOUR}';
      IF n_giro <> 8 OR n_tour <> 8 THEN
        RAISE EXCEPTION 'per-race scoping broken: giro=% tour=%', n_giro, n_tour;
      END IF;
    END $$;
    """
    # 8 distinct riders reused across both race_slugs (same riders, different stage).
    p = _run(_tx(body, seed=_seed(eligible=False, riders=8)))
    assert p.returncode == 0, p.stderr


# ---------------------------------------------------------------------------
# confirm_phase_setup — reversible underdog −50 % discount
# ---------------------------------------------------------------------------

def test_underdog_discount_halves_salary_rounded_to_1000():
    # locked_salary 23000, eligible + flagged → floor(23000*0.5/1000)*1000 = 11000.
    body = f"""
    DO $$
    DECLARE amt int;
    BEGIN
      PERFORM public.confirm_phase_setup('{TEAM}'::uuid, 4, 'Giro', now());
      SELECT amount INTO amt FROM public.treasury_log
      WHERE team_id='{TEAM}' AND type='payday_salary' ORDER BY created_at DESC LIMIT 1;
      IF amt <> -11000 THEN
        RAISE EXCEPTION 'expected -11000 discounted salary, got %', amt;
      END IF;
    END $$;
    """
    p = _run(_tx(body, seed=_seed(eligible=True, riders=1, contracts=True,
                                  locked_salary=23000, underdog_discount=True)))
    assert p.returncode == 0, p.stderr


def test_underdog_discount_reverts_to_full_when_not_eligible():
    # Same flagged contract, but team NOT eligible → full 23000 charged (reversible).
    body = f"""
    DO $$
    DECLARE amt int;
    BEGIN
      PERFORM public.confirm_phase_setup('{TEAM}'::uuid, 4, 'Giro', now());
      SELECT amount INTO amt FROM public.treasury_log
      WHERE team_id='{TEAM}' AND type='payday_salary' ORDER BY created_at DESC LIMIT 1;
      IF amt <> -23000 THEN
        RAISE EXCEPTION 'expected full -23000 (reverted), got %', amt;
      END IF;
    END $$;
    """
    p = _run(_tx(body, seed=_seed(eligible=False, riders=1, contracts=True,
                                  locked_salary=23000, underdog_discount=True)))
    assert p.returncode == 0, p.stderr
