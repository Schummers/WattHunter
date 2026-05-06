# Budget & Transactions Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix missing treasury_log entries (sponsor payments, Round 1 salaries), correct budget P&L display to read from typed log entries, show race names on bonus transactions, backfill Classics phases, adjust Jonathan's treasury, and filter released riders from GT squad view.

**Architecture:** Seven independent tasks in sequence. Tasks 2–4 form the core data + display fix; Tasks 5–7 are follow-on. Each task is self-contained and safe to commit individually. All SQL changes tested against local Supabase before touching prod.

**Tech Stack:** PostgreSQL (Supabase), Next.js 15 App Router, TypeScript strict, Vitest, Colima + Docker CLI

---

## Prerequisites — Local Supabase

Before starting any task, local Supabase must be running with migrations applied.

- [ ] Start Colima:
  ```bash
  colima start --cpu 4 --memory 6
  ```
- [ ] Start Supabase (exclude heavy services):
  ```bash
  cd /Users/jonathanschummers/Documents/WattHunter
  supabase start --exclude vector,edge-runtime,logflare,imgproxy,studio,mailpit
  ```
- [ ] Verify DB is accessible:
  ```bash
  docker exec -i supabase_db_WattHunter psql -U postgres -d postgres -c "SELECT count(*) FROM public.teams;"
  ```
  Expected: a number (may be 0 if fresh reset — that's fine for this plan).

---

## File Map

| File | Action | Task |
|------|--------|------|
| `supabase/migrations/20260506100000_rpc_confirm_phase_setup_payday.sql` | Create | 2 |
| `supabase/migrations/20260506200000_backfill_classics_sponsor_salary.sql` | Create | 5 |
| `apps/web/app/(game)/league/[leagueId]/budget/page.tsx` | Modify | 3 |
| `apps/web/app/(game)/league/[leagueId]/budget/budget-client.tsx` | Modify | 3 |
| `apps/web/components/transaction-row.tsx` | Modify | 4 |
| `apps/web/components/transaction-row.test.ts` | Create | 4 |
| `apps/web/app/(game)/league/[leagueId]/team/gt/actions.ts` | Modify | 7 |

Manual (no code change): Task 6 (Jonathan treasury adjustment via docker exec psql).

---

## Task 1 — Create branch

- [ ] Create and switch to feature branch:
  ```bash
  git checkout -b fix/budget-transactions
  ```

---

## Task 2 — Extend `confirm_phase_setup` RPC with payday logic

**Files:**
- Create: `supabase/migrations/20260506100000_rpc_confirm_phase_setup_payday.sql`

This migration replaces the RPC entirely (CREATE OR REPLACE). The new version adds steps 5b–5e between existing step 5 (strategies) and step 6 (mark confirmed).

- [ ] **Step 1: Write the migration**

  Create `supabase/migrations/20260506100000_rpc_confirm_phase_setup_payday.sql`:

  ```sql
  -- Migration: extend confirm_phase_setup with payday logic.
  -- Adds: sponsor_payment log, per-rider payday_salary logs, treasury update.
  -- Guard against double-execution already exists: phase_confirmed_id check (step 3).

  CREATE OR REPLACE FUNCTION public.confirm_phase_setup(
    p_team_id uuid,
    p_current_phase_id int,
    p_current_phase_label text
  ) RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $$
  DECLARE
    v_user_id       uuid := auth.uid();
    v_team          record;
    v_strat         record;
    v_sponsor_budget bigint := 0;
    v_contract      record;
    v_total_salaries bigint := 0;
  BEGIN
    -- 1. Auth
    IF v_user_id IS NULL THEN
      RETURN jsonb_build_object('error', 'Not authenticated');
    END IF;

    -- 2. Fetch team (verifies ownership) + LOCK
    SELECT * INTO v_team
    FROM public.teams
    WHERE id = p_team_id AND user_id = v_user_id
    FOR UPDATE;

    IF v_team IS NULL THEN
      RETURN jsonb_build_object('error', 'Team not found');
    END IF;

    -- 3. Guard: already confirmed for this phase
    IF v_team.phase_confirmed_id = p_current_phase_id THEN
      RETURN jsonb_build_object('error', 'Already confirmed for this phase');
    END IF;

    -- 4. Apply pending sponsor change (runs BEFORE sponsor fetch so new sponsor is picked up)
    IF v_team.pending_sponsor_id IS NOT NULL THEN
      INSERT INTO public.team_sponsors (team_id, sponsor_id, activated_at)
      VALUES (p_team_id, v_team.pending_sponsor_id, now())
      ON CONFLICT (team_id) DO UPDATE
      SET sponsor_id = EXCLUDED.sponsor_id, activated_at = EXCLUDED.activated_at;

      UPDATE public.teams
      SET pending_sponsor_id = NULL
      WHERE id = p_team_id;
    END IF;

    -- 5. Apply pending strategy changes
    FOR v_strat IN
      SELECT id, pending_is_active, pending_config
      FROM public.team_strategies
      WHERE team_id = p_team_id
        AND pending_is_active IS NOT NULL
    LOOP
      IF v_strat.pending_is_active = false THEN
        DELETE FROM public.team_strategies WHERE id = v_strat.id;
      ELSE
        UPDATE public.team_strategies
        SET is_active        = COALESCE(v_strat.pending_is_active, true),
            config           = v_strat.pending_config,
            activated_at     = now(),
            pending_is_active = NULL,
            pending_config   = NULL
        WHERE id = v_strat.id;
      END IF;
    END LOOP;

    -- 5b. Fetch current sponsor monthly budget (after pending sponsor applied in step 4)
    SELECT COALESCE(s.monthly_budget, 0)
    INTO v_sponsor_budget
    FROM public.team_sponsors ts
    JOIN public.sponsors s ON s.id = ts.sponsor_id
    WHERE ts.team_id = p_team_id;
    -- If no row found, v_sponsor_budget stays 0 (COALESCE handles NULL from NOT FOUND)

    -- 5c. Log sponsor income (skip if no sponsor)
    IF v_sponsor_budget > 0 THEN
      INSERT INTO public.treasury_log (team_id, type, amount, description)
      VALUES (
        p_team_id,
        'sponsor_payment',
        v_sponsor_budget,
        format('Sponsor income — %s', p_current_phase_label)
      );
    END IF;

    -- 5d. Log per-rider salaries + compute total
    FOR v_contract IN
      SELECT c.locked_salary, c.rider_id, r.full_name
      FROM public.contracts c
      JOIN public.riders r ON r.id = c.rider_id
      WHERE c.team_id = p_team_id AND c.status = 'active'
    LOOP
      INSERT INTO public.treasury_log (team_id, type, amount, description, rider_id)
      VALUES (
        p_team_id,
        'payday_salary',
        -v_contract.locked_salary,
        format('Salary — %s', v_contract.full_name),
        v_contract.rider_id
      );
      v_total_salaries := v_total_salaries + v_contract.locked_salary;
    END LOOP;

    -- 5e. Update treasury atomically
    UPDATE public.teams
    SET treasury = treasury + v_sponsor_budget - v_total_salaries
    WHERE id = p_team_id;

    -- 6. Mark confirmed
    UPDATE public.teams
    SET phase_confirmed_at = now(),
        phase_confirmed_id = p_current_phase_id
    WHERE id = p_team_id;

    RETURN jsonb_build_object(
      'ok',             true,
      'phaseId',        p_current_phase_id,
      'phaseLabel',     p_current_phase_label,
      'sponsorPayment', v_sponsor_budget,
      'totalSalaries',  v_total_salaries
    );
  END;
  $$;

  GRANT EXECUTE ON FUNCTION public.confirm_phase_setup(uuid, int, text) TO authenticated;
  ```

- [ ] **Step 2: Apply migration to local Supabase**

  ```bash
  supabase db push --local
  ```
  Expected: `Applying migration 20260506100000_rpc_confirm_phase_setup_payday.sql` with no errors.

- [ ] **Step 3: Verify RPC in local DB with a dry-run inspection**

  First check the function body was updated:
  ```bash
  docker exec -i supabase_db_WattHunter psql -U postgres -d postgres -c "
  SELECT prosrc FROM pg_proc WHERE proname = 'confirm_phase_setup';
  " | grep -c "sponsor_payment"
  ```
  Expected: `1` (the new line is present in the function body).

  Then verify the return signature includes the new fields (integration test via local seed):
  ```bash
  docker exec -i supabase_db_WattHunter psql -U postgres -d postgres -c "
  -- This will fail auth (no session) but shows function exists and has right signature
  SELECT proargtypes, pronargs FROM pg_proc WHERE proname = 'confirm_phase_setup';
  "
  ```
  Expected: 3 args (uuid, int, text) — no error.

- [ ] **Step 4: Commit**

  ```bash
  git add supabase/migrations/20260506100000_rpc_confirm_phase_setup_payday.sql
  git commit -m "feat: extend confirm_phase_setup RPC with payday — sponsor_payment + per-rider salary logs + treasury update"
  ```

---

## Task 3 — Budget page: typed sums from treasury_log

**Files:**
- Modify: `apps/web/app/(game)/league/[leagueId]/budget/page.tsx`
- Modify: `apps/web/app/(game)/league/[leagueId]/budget/budget-client.tsx`

The server component computes three typed sums from treasury_log. The client displays them directly without derivation.

- [ ] **Step 1: Update `budget/page.tsx`**

  Replace the `phaseTotals` → `income`/`outgoing`/`phaseSalaries` block with typed sums. Also remove the `activeContracts` query (no longer needed).

  Replace the entire `Promise.all` block and everything below it until `return <BudgetClient ...>` with:

  ```ts
  const [
    { data: teamSponsor },
    { data: transactions },
    { data: phaseTotals },
  ] = await Promise.all([
    supabase
      .from("team_sponsors")
      .select("id, sponsor_id, activated_at, sponsors(*)")
      .eq("team_id", team.id)
      .maybeSingle(),
    supabase
      .from("treasury_log")
      .select("*, riders:rider_id(photo_url, full_name)")
      .eq("team_id", team.id)
      .gte("created_at", start.toISOString())
      .lte("created_at", end.toISOString())
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("treasury_log")
      .select("amount, type")
      .eq("team_id", team.id)
      .gte("created_at", start.toISOString())
      .lte("created_at", end.toISOString()),
  ]);

  const totals = phaseTotals ?? [];

  const sponsorPaid = totals
    .filter((t) => t.type === "sponsor_payment")
    .reduce((s, t) => s + t.amount, 0);

  const bonusEarned = totals
    .filter((t) => t.type === "sponsor_bonus")
    .reduce((s, t) => s + t.amount, 0);

  const salariesPaid = totals
    .filter((t) => t.type === "payday_salary")
    .reduce((s, t) => s + Math.abs(t.amount), 0);

  const sponsorRow = teamSponsor?.sponsors
    ? (Array.isArray(teamSponsor.sponsors) ? teamSponsor.sponsors[0] : teamSponsor.sponsors)
    : null;

  const mappedTransactions = (transactions ?? []).map((t: Record<string, unknown>) => {
    const rider = t.riders as { photo_url: string | null; full_name: string } | null;
    return {
      id: t.id as string,
      type: t.type as string,
      amount: t.amount as number,
      description: t.description as string | null,
      created_at: t.created_at as string,
      rider_photo_url: rider?.photo_url ?? null,
      rider_name: rider?.full_name ?? null,
    };
  });

  return (
    <BudgetClient
      leagueId={leagueId}
      treasury={team.treasury}
      level={team.level}
      sponsorPaid={sponsorPaid}
      bonusEarned={bonusEarned}
      salariesPaid={salariesPaid}
      transactions={mappedTransactions}
      phaseIndex={phaseIndex}
      currentSponsor={sponsorRow as SponsorRow | null}
    />
  );
  ```

- [ ] **Step 2: Update `budget-client.tsx`**

  Replace the `BudgetClientProps` interface and the `BudgetClient` function signature and P&L logic.

  New interface (replace old one):
  ```ts
  interface BudgetClientProps {
    leagueId: string;
    treasury: number;
    level: number;
    sponsorPaid: number;
    bonusEarned: number;
    salariesPaid: number;
    transactions: Transaction[];
    phaseIndex: number;
    currentSponsor: SponsorRow | null;
  }
  ```

  New function signature and P&L vars (replace old ones):
  ```ts
  export function BudgetClient({
    leagueId,
    treasury,
    sponsorPaid,
    bonusEarned,
    salariesPaid,
    transactions,
    currentSponsor,
    phaseIndex,
  }: BudgetClientProps) {
    const router = useRouter();
    const [filterIndex, setFilterIndex] = useState(0);
    const [sponsorExpanded, setSponsorExpanded] = useState(false);

    const filtered = useMemo(
      () => filterTransactions(transactions, filterIndex),
      [transactions, filterIndex],
    );

    const realCurrentPhaseIndex = useMemo(() => {
      const current = getCurrentPhase();
      return AUCTION_PHASES.findIndex((p) => p.id === current.id);
    }, []);

    function handlePhaseChange(newIndex: number) {
      router.replace(`?phase=${newIndex}`, { scroll: false });
    }

    const phaseResult = sponsorPaid + bonusEarned - salariesPaid;
    const isBankruptcyRisk = salariesPaid > sponsorPaid && sponsorPaid > 0;
  ```

  Replace the P&L rows JSX (the three `div` rows for Sponsor / Bonuses / Salaries):
  ```tsx
  <div className="mt-3 space-y-1.5">
    <div className="flex items-center justify-between text-[length:var(--type-caption)]">
      <span className="text-[var(--text-low)]">Sponsor</span>
      <span className="font-[family-name:var(--font-geist-mono)] font-semibold text-[var(--text-high)] tabular-nums">
        +{formatCompact(sponsorPaid)}
      </span>
    </div>
    <div className="flex items-center justify-between text-[length:var(--type-caption)]">
      <span className="text-[var(--text-low)]">Bonuses</span>
      <span className="font-[family-name:var(--font-geist-mono)] font-semibold text-[var(--text-high)] tabular-nums">
        +{formatCompact(bonusEarned)}
      </span>
    </div>
    <div className="flex items-center justify-between text-[length:var(--type-caption)]">
      <span className="text-[var(--text-low)]">Salaries</span>
      <span className="font-[family-name:var(--font-geist-mono)] font-semibold text-[var(--text-high)] tabular-nums">
        -{formatCompact(salariesPaid)}
      </span>
    </div>
    <div className="border-t border-white/10 pt-1.5">
      <div className="flex items-center justify-between text-[length:var(--type-caption)]">
        <span className="font-semibold text-[var(--text-high)]">Phase result</span>
        <span className="font-[family-name:var(--font-geist-mono)] font-bold text-[var(--text-high)] tabular-nums">
          {phaseResult >= 0 ? "+" : ""}{formatCompact(phaseResult)}
        </span>
      </div>
    </div>
  </div>
  ```

- [ ] **Step 3: Typecheck**

  ```bash
  cd apps/web && pnpm typecheck
  ```
  Expected: 0 errors.

- [ ] **Step 4: Commit**

  ```bash
  git add apps/web/app/\(game\)/league/\[leagueId\]/budget/page.tsx \
          apps/web/app/\(game\)/league/\[leagueId\]/budget/budget-client.tsx
  git commit -m "feat: budget card reads typed sums from treasury_log (sponsorPaid, bonusEarned, salariesPaid)"
  ```

---

## Task 4 — Transaction row: race name for sponsor_bonus

**Files:**
- Modify: `apps/web/components/transaction-row.tsx`
- Create: `apps/web/components/transaction-row.test.ts`

- [ ] **Step 1: Write failing tests**

  Create `apps/web/components/transaction-row.test.ts`:

  ```ts
  import { describe, it, expect } from "vitest";
  import { extractRaceLabel } from "./transaction-row";

  describe("extractRaceLabel", () => {
    it("formats a stage race bonus", () => {
      expect(
        extractRaceLabel("Sponsor bonus: stage rank 3 in race/giro-d-italia/2026/stage-5 (×1.0)")
      ).toBe("Giro d'Italia — Stage 5");
    });

    it("formats a one-day race bonus", () => {
      expect(
        extractRaceLabel("Sponsor bonus: one_day rank 1 in race/milan-san-remo/2026 (×1.0)")
      ).toBe("Milan — San Remo");
    });

    it("formats a GC result bonus", () => {
      expect(
        extractRaceLabel("Sponsor bonus: gc rank 2 in race/tour-de-france/2026/gc (×1.25)")
      ).toBe("Tour de France — GC");
    });

    it("returns 'Race bonus' for null description", () => {
      expect(extractRaceLabel(null)).toBe("Race bonus");
    });

    it("returns 'Race bonus' for unrecognised format", () => {
      expect(extractRaceLabel("some random text")).toBe("Race bonus");
    });

    it("falls back to slug humanisation for unknown race", () => {
      expect(
        extractRaceLabel("Sponsor bonus: gc rank 5 in race/paris-nice/2026 (×1.0)")
      ).toBe("Paris — Nice");
    });
  });
  ```

- [ ] **Step 2: Run tests — expect FAIL**

  ```bash
  cd apps/web && pnpm test -- transaction-row
  ```
  Expected: `extractRaceLabel is not a function` or similar import error.

- [ ] **Step 3: Add `extractRaceLabel` to `transaction-row.tsx`**

  Add this function near the top of `transaction-row.tsx`, before the component:

  ```ts
  const RACE_DISPLAY: Record<string, string> = {
    "giro-d-italia":          "Giro d'Italia",
    "tour-de-france":         "Tour de France",
    "vuelta-a-espana":        "La Vuelta",
    "milan-san-remo":         "Milan — San Remo",
    "paris-roubaix":          "Paris — Roubaix",
    "liege-bastogne-liege":   "Liège — Bastogne — Liège",
    "ronde-van-vlaanderen":   "Tour of Flanders",
    "il-lombardia":           "Il Lombardia",
    "paris-nice":             "Paris — Nice",
    "tirreno-adriatico":      "Tirreno — Adriatico",
    "amstel-gold-race":       "Amstel Gold Race",
    "la-fleche-wallonne":     "La Flèche Wallonne",
    "omloop-het-nieuwsblad":  "Omloop Het Nieuwsblad",
    "strade-bianche":         "Strade Bianche",
  };

  export function extractRaceLabel(description: string | null): string {
    if (!description) return "Race bonus";
    // Match "in race/slug/year" or "in race/slug/year/stage-N" or "in race/slug/year/gc"
    const match = description.match(/in (race\/[\w-]+(?:\/\d+)?(?:\/[\w-]+)?)/);
    if (!match) return "Race bonus";
    const parts = match[1].split("/"); // ["race", "slug", "2026"] or ["race", "slug", "2026", "stage-5"]
    const raceSlug = parts[1];
    const segment  = parts[3]; // "stage-5", "gc", or undefined

    const raceName = RACE_DISPLAY[raceSlug] ?? raceSlug.split("-").map(
      (w) => w.charAt(0).toUpperCase() + w.slice(1)
    ).join(" ");

    if (segment?.startsWith("stage-")) {
      return `${raceName} — Stage ${segment.replace("stage-", "")}`;
    }
    if (segment === "gc") {
      return `${raceName} — GC`;
    }
    return raceName;
  }
  ```

  Then update the `getDescription` function inside `TransactionRow` to use it for `sponsor_bonus`:

  Find the existing `getDescription` function (or wherever the description is built for `sponsor_bonus`) and replace the `sponsor_bonus` case:

  ```ts
  case "sponsor_bonus": return extractRaceLabel(description);
  ```

- [ ] **Step 4: Run tests — expect PASS**

  ```bash
  cd apps/web && pnpm test -- transaction-row
  ```
  Expected: all 6 tests pass.

- [ ] **Step 5: Typecheck**

  ```bash
  pnpm typecheck
  ```
  Expected: 0 errors.

- [ ] **Step 6: Commit**

  ```bash
  git add apps/web/components/transaction-row.tsx \
          apps/web/components/transaction-row.test.ts
  git commit -m "feat: show race name on sponsor_bonus transaction rows (Giro d'Italia — Stage 5)"
  ```

---

## Task 5 — Backfill Classics Part 1 & Part 2

**Files:**
- Create: `supabase/migrations/20260506200000_backfill_classics_sponsor_salary.sql`

This migration inserts missing treasury_log entries for the two Classics phases. It does NOT modify `teams.treasury` (assumed correct). Safe to re-run (no unique conflict because treasury_log has no unique constraint on these columns — the script is idempotent by intent, not enforcement).

- [ ] **Step 1: Write the backfill migration**

  Create `supabase/migrations/20260506200000_backfill_classics_sponsor_salary.sql`:

  ```sql
  -- Backfill missing treasury_log entries for Classics Part 1 and Part 2.
  -- Does NOT update teams.treasury (assumed already correct).
  -- Safe to apply once: inserts new rows, no updates.

  -- ==========================================================================
  -- Classics Part 1 (Phase 2: Mar 2 – Apr 1 2026)
  -- All teams: 200K sponsor income, 200K salary deduction (game decision at the time).
  -- No per-rider breakdown for salaries (flat bulk entry per team).
  -- ==========================================================================

  INSERT INTO public.treasury_log (team_id, type, amount, description, created_at)
  SELECT DISTINCT
    lm.team_id,
    'sponsor_payment',
    200000,
    'Sponsor income — Classics Part 1 [backfill]',
    '2026-03-02 12:00:00+00'
  FROM public.league_members lm
  JOIN public.teams t ON t.id = lm.team_id;

  INSERT INTO public.treasury_log (team_id, type, amount, description, created_at)
  SELECT DISTINCT
    lm.team_id,
    'payday_salary',
    -200000,
    'Phase salaries — Classics Part 1 [backfill]',
    '2026-03-02 12:00:01+00'
  FROM public.league_members lm
  JOIN public.teams t ON t.id = lm.team_id;

  -- ==========================================================================
  -- Classics Part 2 (Phase 3: Apr 2 – May 1 2026)
  -- Sponsor: 450K per team — use current team_sponsors (sponsors unchanged since).
  -- Salaries: per-rider from contracts active during Apr 2 – May 1 2026.
  -- ==========================================================================

  INSERT INTO public.treasury_log (team_id, type, amount, description, created_at)
  SELECT
    ts.team_id,
    'sponsor_payment',
    450000,
    format('Sponsor income — Classics Part 2 [backfill] (%s)', s.name),
    '2026-04-02 12:00:00+00'
  FROM public.team_sponsors ts
  JOIN public.sponsors s ON s.id = ts.sponsor_id;

  INSERT INTO public.treasury_log (team_id, type, amount, description, rider_id, created_at)
  SELECT
    c.team_id,
    'payday_salary',
    -c.locked_salary,
    format('Salary — %s [backfill]', r.full_name),
    c.rider_id,
    '2026-04-02 12:00:01+00'
  FROM public.contracts c
  JOIN public.riders r ON r.id = c.rider_id
  WHERE c.purchased_at < '2026-05-01 00:00:00+00'
    AND (c.released_at IS NULL OR c.released_at > '2026-04-02 00:00:00+00');
  ```

- [ ] **Step 2: Apply and verify locally**

  Apply to local:
  ```bash
  supabase db push --local
  ```

  Verify Classics Part 1 entries (adjust team count to your league):
  ```bash
  docker exec -i supabase_db_WattHunter psql -U postgres -d postgres -c "
  SELECT type, count(*), sum(amount)
  FROM public.treasury_log
  WHERE created_at::date = '2026-03-02'
  GROUP BY type ORDER BY type;
  "
  ```
  Expected: two rows — `payday_salary` with negative sum, `sponsor_payment` with positive sum. Counts should equal number of teams in the league.

  Verify Classics Part 2 sponsor entries:
  ```bash
  docker exec -i supabase_db_WattHunter psql -U postgres -d postgres -c "
  SELECT type, count(*), sum(amount)
  FROM public.treasury_log
  WHERE created_at::date = '2026-04-02'
  GROUP BY type ORDER BY type;
  "
  ```
  Expected: `sponsor_payment` rows at 450K each, `payday_salary` rows per rider active during that phase.

- [ ] **Step 3: Commit**

  ```bash
  git add supabase/migrations/20260506200000_backfill_classics_sponsor_salary.sql
  git commit -m "feat: backfill treasury_log for Classics Part 1 (200K flat) and Part 2 (450K + per-rider salaries)"
  ```

---

## Task 6 — Sujet 3: Jonathan treasury adjustment (manual SQL, no code)

This runs directly against the **local** DB first, then **prod** via `docker exec` (bypasses the `teams_protect_sensitive_fields` trigger which blocks non-service-role updates on `treasury`).

- [ ] **Step 1: Find Jonathan's team_id in local DB**

  ```bash
  docker exec -i supabase_db_WattHunter psql -U postgres -d postgres -c "
  SELECT t.id, t.name, t.treasury, u.email
  FROM public.teams t
  JOIN public.users u ON u.id = t.user_id
  WHERE u.email = 'jonathan.schummers@gmail.com';
  "
  ```
  Note the `id` value — call it `<TEAM_ID>`.

- [ ] **Step 2: Apply adjustment in local DB**

  ```bash
  docker exec -i supabase_db_WattHunter psql -U postgres -d postgres <<'SQL'
  BEGIN;

  INSERT INTO public.treasury_log (team_id, type, amount, description)
  VALUES (
    '<TEAM_ID>',
    'starting_fund',
    -50000,
    'Fair Play — Équilibrage'
  );

  UPDATE public.teams
  SET treasury = treasury - 50000
  WHERE id = '<TEAM_ID>';

  -- Verify
  SELECT treasury FROM public.teams WHERE id = '<TEAM_ID>';

  COMMIT;
  SQL
  ```
  Expected: treasury shows `old_value - 50000`.

- [ ] **Step 3: Verify log entry visible**

  ```bash
  docker exec -i supabase_db_WattHunter psql -U postgres -d postgres -c "
  SELECT type, amount, description, created_at
  FROM public.treasury_log
  WHERE team_id = '<TEAM_ID>'
  ORDER BY created_at DESC LIMIT 5;
  "
  ```
  Expected: top row is `starting_fund | -50000 | Fair Play — Équilibrage`.

- [ ] **Step 4: Apply to PROD** *(only after full local verification)*

  Connect to prod DB via Supabase service role or direct connection (use `SUPABASE_DB_URL` from `.env.local` if available, or Supabase Dashboard SQL editor):

  ```sql
  -- Run in Supabase Dashboard > SQL Editor (uses service_role, bypasses trigger)
  BEGIN;

  INSERT INTO public.treasury_log (team_id, type, amount, description)
  VALUES (
    '<JONATHAN_PROD_TEAM_ID>',
    'starting_fund',
    -50000,
    'Fair Play — Équilibrage'
  );

  UPDATE public.teams
  SET treasury = treasury - 50000
  WHERE id = '<JONATHAN_PROD_TEAM_ID>';

  SELECT treasury FROM public.teams WHERE id = '<JONATHAN_PROD_TEAM_ID>';

  COMMIT;
  ```

  > Find prod team_id with: `SELECT t.id, t.treasury FROM teams t JOIN users u ON u.id = t.user_id WHERE u.email = 'jonathan.schummers@gmail.com';`

---

## Task 7 — GT squad: filter released riders from view

**Files:**
- Modify: `apps/web/app/(game)/league/[leagueId]/team/gt/actions.ts`

No migration needed. Change is in `getSquadWithRoles` only — `ensureGtSquad` and `assignRole` are untouched.

- [ ] **Step 1: Update `getSquadWithRoles`**

  In `apps/web/app/(game)/league/[leagueId]/team/gt/actions.ts`, locate the `getSquadWithRoles` function.

  After the `const roles = await latestRolesMap(...)` line and before the `xpRows` fetch, add the active-contract filter:

  ```ts
  const { data: activeContracts } = await supabase
    .from("contracts")
    .select("rider_id")
    .eq("team_id", teamId)
    .eq("status", "active");

  const activeRiderIds = new Set(
    (activeContracts ?? []).map((c) => (c as { rider_id: string }).rider_id)
  );
  ```

  Then in the final `.map(...)` call, add a `.filter()` before it:

  ```ts
  return ((squad ?? []) as Array<{
    rider_id: string;
    riders: RiderRow | RiderRow[] | null;
  }>)
    .filter((s) => activeRiderIds.has(s.rider_id))   // ← add this line
    .map((s) => {
      const rider = Array.isArray(s.riders) ? s.riders[0] : s.riders;
      return {
        riderId: s.rider_id,
        role: (roles.get(s.rider_id) ?? "domestique") as GtRole,
        xp: Math.round(xpMap.get(s.rider_id) ?? 0),
        rider,
      };
    });
  ```

- [ ] **Step 2: Typecheck**

  ```bash
  cd apps/web && pnpm typecheck
  ```
  Expected: 0 errors.

- [ ] **Step 3: Verify locally in the app**

  ```bash
  pnpm dev
  ```
  Navigate to `/league/<id>/team/gt`. Released riders should no longer appear. Verify a rider you know was released is gone from the GT view but still appears in their correct "released" state in My Team.

- [ ] **Step 4: Commit**

  ```bash
  git add apps/web/app/\(game\)/league/\[leagueId\]/team/gt/actions.ts
  git commit -m "fix: filter released riders from GT squad view in getSquadWithRoles"
  ```

---

## Task 8 — End-to-end verification (local app)

Before merging and pushing to prod.

- [ ] Start dev server:
  ```bash
  pnpm dev
  ```

- [ ] **Budget page — current phase (Giro):**
  - Navigate to `/league/<id>/budget`
  - Sponsor line shows 0 (no payday yet this phase) → correct — payday happens at end of Round 1
  - Bonuses line shows sum of Giro race bonuses from Pipeline B
  - Salaries shows 0 (no payday yet) → correct

- [ ] **Budget page — Classics Part 2:**
  - Use phase navigator to go to Phase 3 (Classics Part 2)
  - Sponsor line: 450K ✓
  - Salaries: sum of per-rider backfill entries ✓
  - Phase result: 450K - salaries ✓

- [ ] **Budget page — Classics Part 1:**
  - Navigate to Phase 2
  - Sponsor: 200K ✓, Salaries: 200K ✓, Phase result: 0 ✓

- [ ] **Transaction log — bonus entries:**
  - Navigate to `/league/<id>/budget/transactions`
  - Filter: Bonuses
  - Each bonus entry shows race name (e.g. "Giro d'Italia — Stage 5") instead of raw description

- [ ] **GT squad:**
  - Navigate to `/league/<id>/team/gt`
  - Verify only currently active riders appear
  - No released riders visible

- [ ] **Run full test suite:**
  ```bash
  cd apps/web && pnpm test
  ```
  Expected: all tests pass (≥124 total with new transaction-row tests).

---

## Task 9 — Push to prod

Only after Task 8 passes completely.

- [ ] Run typecheck + lint one final time:
  ```bash
  pnpm typecheck && pnpm lint
  ```

- [ ] Push branch and create PR:
  ```bash
  git push -u origin fix/budget-transactions
  gh pr create --title "fix: budget transactions — payday logs, typed sums, GT roster, backfill" \
    --body "$(cat <<'EOF'
  ## Summary
  - extend confirm_phase_setup RPC to log sponsor_payment + per-rider payday_salary + update treasury
  - budget P&L card reads typed sums from treasury_log (no more live-state bleed across phases)
  - transaction rows show race name for bonus entries (Giro d'Italia — Stage 5)
  - backfill Classics Part 1 (200K flat) and Part 2 (450K + per-rider) treasury_log entries
  - GT squad view filters out released riders
  - Jonathan treasury: -50K Fair Play adjustment (applied manually to prod)

  ## Test plan
  - [ ] Local Supabase: confirm_phase_setup RPC verified with SQL
  - [ ] TypeScript: pnpm typecheck 0 errors
  - [ ] Vitest: transaction-row.test.ts (6 new tests)
  - [ ] E2E: budget page displays correct per-phase P&L
  - [ ] E2E: GT squad shows only active riders
  EOF
  )"
  ```

- [ ] Apply migrations to prod:
  ```bash
  supabase db push
  ```

- [ ] Apply Sujet 3 (Jonathan -50K) in prod SQL editor (see Task 6 Step 4).

- [ ] Merge PR.
