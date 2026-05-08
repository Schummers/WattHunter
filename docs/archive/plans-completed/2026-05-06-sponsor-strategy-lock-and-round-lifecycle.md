# Sponsor/Strategy Lock Window + Round Lifecycle — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre aux joueurs de changer de sponsor et de stratégie pendant toute la fenêtre d'enchères (Rounds 1-3), et non plus uniquement Round 1. Inclut la refonte du cycle de vie des rounds pour que les transitions soient déclenchées par `validate_round`.

**Architecture:** Un helper `getOpenAuction()` lazy-ouvre Round 1 si sa date est passée et remplace les queries directes dans les server actions. Le RPC `validate_round` ferme le round courant et ouvre le suivant atomiquement. La condition `isImmediate` passe de `name === "Round 1"` à `!!openAuction`.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase (Postgres RPCs), Zod v4, vitest

**Spec:** `docs/superpowers/specs/2026-05-06-sponsor-strategy-lock-and-round-lifecycle.md`

---

## File Map

| Fichier | Action | Rôle |
|---|---|---|
| `supabase/migrations/20260508000000_round_lifecycle.sql` | Créer | Modifier validate_round + place_bid |
| `apps/web/lib/supabase/get-open-auction.ts` | Créer | Helper lazy-open partagé |
| `apps/web/app/(game)/league/[leagueId]/budget/actions.ts` | Modifier | `!!openAuction` via helper |
| `apps/web/app/(game)/league/[leagueId]/team/strategies/actions.ts` | Modifier | `!!openAuction` via helper |
| `apps/web/app/(game)/league/[leagueId]/auction/[auctionId]/actions.ts` | Modifier | Supprimer check `closes_at` dans cancelBid |
| `apps/web/app/(game)/league/[leagueId]/auction/rounds/actions.ts` | Modifier | createNextPhaseAuctions + updateRoundDates |
| `apps/web/app/(game)/league/[leagueId]/auction/market/actions.ts` | Modifier | setRoundDates : closes_at seulement |
| `apps/web/app/(game)/league/[leagueId]/auction/rounds/page.tsx` | Modifier | Lire `closes_at` pour le form |
| `apps/web/app/(game)/league/[leagueId]/auction/rounds/rounds-client.tsx` | Modifier | Supprimer "Closes at", labeller "Closes" |
| `apps/web/app/(game)/league/[leagueId]/budget/marketplace/page.tsx` | Modifier | isImmediate via DB |
| `apps/web/app/(game)/league/[leagueId]/team/strategies/page.tsx` | Modifier | isInAuctionWindow via DB |
| `apps/web/lib/supabase/get-open-auction.test.ts` | Créer | Tests helper |

---

## Task 1 — SQL Migration : validate_round + place_bid

**Files:**
- Create: `supabase/migrations/20260508000000_round_lifecycle.sql`

**Contexte :** `validate_round` convertit les draft_bids mais ne touche pas les statuts des rounds. `place_bid` rejette les bids quand `closes_at < now()` même si le round est `open`. Les deux comportements changent ici.

- [ ] **Step 1: Créer la migration**

```sql
-- supabase/migrations/20260508000000_round_lifecycle.sql
-- 1. Modify validate_round: close current round + open next after bid conversion
-- 2. Remove closes_at deadline check from place_bid (bids valid while round is 'open')

-- ============================================================
-- patch validate_round
-- ============================================================
CREATE OR REPLACE FUNCTION public.validate_round(
  p_league_id uuid,
  p_current_phase_id int
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_team record;
  v_auction record;
  v_auction_round int;
  v_draft record;
  v_drafts_total bigint := 0;
  v_drafts_count int := 0;
  v_active_salaries bigint := 0;
  v_sponsor_income bigint := 0;
  v_available bigint;
  v_max_slots int;
  v_roster_count int;
  v_inserted int := 0;
BEGIN
  -- 1. Auth
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  -- 2. Resolve team for this user in the league + LOCK row
  SELECT t.* INTO v_team
  FROM public.teams t
  JOIN public.league_members lm ON lm.team_id = t.id
  WHERE lm.league_id = p_league_id
    AND lm.user_id = v_user_id
    AND t.user_id = v_user_id
  FOR UPDATE OF t;

  IF v_team IS NULL THEN
    RETURN jsonb_build_object('error', 'Team not found');
  END IF;

  -- 3. Find open auction for this league
  SELECT * INTO v_auction
  FROM public.auctions
  WHERE league_id = p_league_id AND status = 'open'
  ORDER BY opens_at ASC
  LIMIT 1;

  IF v_auction IS NULL THEN
    RETURN jsonb_build_object('error', 'No open auction round found');
  END IF;

  -- Determine round: max round this team has used + 1, or 1 if first time
  SELECT COALESCE(MAX(round), 0) + 1 INTO v_auction_round
  FROM public.auction_bids
  WHERE auction_id = v_auction.id AND team_id = v_team.id;

  -- 4. Sum draft bids for this team + league
  SELECT COALESCE(SUM(amount), 0), COUNT(*)
  INTO v_drafts_total, v_drafts_count
  FROM public.draft_bids
  WHERE team_id = v_team.id AND league_id = p_league_id;

  -- 5. Sum active contract salaries
  SELECT COALESCE(SUM(locked_salary), 0), COUNT(*)
  INTO v_active_salaries, v_roster_count
  FROM public.contracts
  WHERE team_id = v_team.id AND status = 'active';

  -- 6. Get sponsor income
  SELECT COALESCE(s.monthly_budget, 0) INTO v_sponsor_income
  FROM public.team_sponsors ts
  JOIN public.sponsors s ON s.id = ts.sponsor_id
  WHERE ts.team_id = v_team.id;

  IF NOT FOUND THEN
    v_sponsor_income := 0;
  END IF;

  -- 7. Budget check (pre-payday vs post-payday)
  IF v_team.phase_confirmed_id = p_current_phase_id THEN
    v_available := v_team.treasury - v_drafts_total;
  ELSE
    v_available := v_team.treasury + v_sponsor_income - v_active_salaries - v_drafts_total;
  END IF;

  IF v_available < 0 THEN
    RETURN jsonb_build_object(
      'error',
      format('Budget exceeded: you cannot afford %s € of drafts with your current purchasing power.', v_drafts_total)
    );
  END IF;

  -- 8. Slot check
  v_max_slots := CASE v_team.level
    WHEN 8 THEN 12 WHEN 7 THEN 12 WHEN 6 THEN 11
    WHEN 5 THEN 10 WHEN 4 THEN 9 WHEN 3 THEN 8
    WHEN 2 THEN 7 ELSE 6
  END;

  IF v_roster_count + v_drafts_count > v_max_slots THEN
    RETURN jsonb_build_object(
      'error',
      format('Roster limit exceeded: %s active + %s new bids = %s riders, but your level allows %s slots',
             v_roster_count, v_drafts_count, v_roster_count + v_drafts_count, v_max_slots)
    );
  END IF;

  -- 9. Cancel previous active bids for this team in this auction
  UPDATE public.auction_bids
  SET status = 'cancelled'
  WHERE auction_id = v_auction.id
    AND team_id = v_team.id
    AND status = 'active';

  -- 10. Insert new auction_bids from draft_bids
  INSERT INTO public.auction_bids (auction_id, team_id, rider_id, amount, round, status, placed_at)
  SELECT v_auction.id, v_team.id, db.rider_id, db.amount, v_auction_round, 'active', now()
  FROM public.draft_bids db
  WHERE db.team_id = v_team.id AND db.league_id = p_league_id;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  -- 11. Close current round
  UPDATE public.auctions
  SET status = 'closed', resolved_at = now()
  WHERE id = v_auction.id;

  -- 12. Open next scheduled round (if any) — set opens_at = now() (actual open time)
  UPDATE public.auctions
  SET status = 'open', opens_at = now()
  WHERE league_id = p_league_id
    AND status = 'scheduled'
    AND id IN (
      SELECT id FROM public.auctions
      WHERE league_id = p_league_id AND status = 'scheduled'
      ORDER BY closes_at ASC
      LIMIT 1
    );

  RETURN jsonb_build_object('ok', true, 'inserted', v_inserted);
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_round(uuid, int) TO authenticated;

-- ============================================================
-- patch place_bid: remove closes_at deadline check
-- Bids are valid as long as the round is 'open' (validate_round controls closing)
-- ============================================================
CREATE OR REPLACE FUNCTION public.place_bid(
  p_auction_id uuid,
  p_rider_id uuid,
  p_amount int,
  p_round int
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_team record;
  v_auction record;
  v_rider record;
  v_total_commitments bigint;
  v_existing_bid_id uuid;
  v_existing_bid_amount int;
  v_bid_id uuid;
  v_required_level int;
  v_qualifying_teams int;
  v_max_slots int;
  v_used_slots int;
BEGIN
  -- 1. Auth
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  -- 2. Bounds check
  IF p_amount < 5000 OR p_amount > 100000000 THEN
    RETURN jsonb_build_object('error', 'Amount out of bounds');
  END IF;
  IF p_amount % 100 <> 0 THEN
    RETURN jsonb_build_object('error', 'Amount must be multiple of 100');
  END IF;
  IF p_round < 1 OR p_round > 8 THEN
    RETURN jsonb_build_object('error', 'Invalid round number');
  END IF;

  -- 3. Lookup auction + verify open (no closes_at check — validate_round controls closing)
  SELECT * INTO v_auction FROM public.auctions WHERE id = p_auction_id;
  IF v_auction IS NULL THEN
    RETURN jsonb_build_object('error', 'Auction not found');
  END IF;
  IF v_auction.status <> 'open' THEN
    RETURN jsonb_build_object('error', 'Auction is not open');
  END IF;
```

- [ ] **Step 2: Compléter la migration place_bid (suite)**

Lire `supabase/migrations/20260503000000_rpc_place_bid.sql` lignes 58-fin pour copier le reste des checks (team lookup, rider, level gating, co-unlock, solvency, slot, upsert) dans la migration, en omettant uniquement le check `closes_at`. Terminer avec :

```sql
GRANT EXECUTE ON FUNCTION public.place_bid(uuid, uuid, int, int) TO authenticated;
```

> **Note pour l'agent :** Lis `supabase/migrations/20260503000000_rpc_place_bid.sql` et copie tout depuis la ligne 58 (team lookup) jusqu'à la fin de la fonction, en sautant uniquement les lignes 54-56 (`IF v_auction.closes_at < now() THEN ... END IF;`). Colle dans la migration après la section place_bid.

- [ ] **Step 3: Appliquer la migration**

```bash
cd /Users/jonathanschummers/Documents/WattHunter
supabase db push
```

Vérifier : pas d'erreur Postgres. Les deux fonctions doivent être recréées.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260508000000_round_lifecycle.sql
git commit -m "feat(db): validate_round closes current + opens next round, place_bid removes closes_at deadline"
```

---

## Task 2 — Helper `getOpenAuction`

**Files:**
- Create: `apps/web/lib/supabase/get-open-auction.ts`
- Create: `apps/web/lib/supabase/get-open-auction.test.ts`

**Contexte :** Helper partagé qui cherche un round `open`. Si aucun round n'est `open` mais qu'un round `scheduled` a dépassé son `opens_at`, il le passe à `open` (lazy-open de Round 1). Utilisé uniquement depuis des server actions (jamais depuis des server components qui rendent des pages).

- [ ] **Step 1: Écrire le test**

```typescript
// apps/web/lib/supabase/get-open-auction.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getOpenAuction } from "./get-open-auction";

const mockUpdate = vi.fn().mockReturnValue({ error: null });
const mockEqUpdate = vi.fn().mockReturnValue({ error: null });

function makeSupabase(openData: unknown, scheduledData: unknown) {
  const updateChain = { eq: vi.fn().mockReturnValue({ error: null }) };
  const updateFn = vi.fn().mockReturnValue(updateChain);

  let callCount = 0;
  const maybeSingle = vi.fn().mockImplementation(() => {
    callCount++;
    if (callCount === 1) return Promise.resolve({ data: openData, error: null });
    return Promise.resolve({ data: scheduledData, error: null });
  });
  const limit = vi.fn().mockReturnValue({ maybeSingle });
  const order = vi.fn().mockReturnValue({ limit });
  const lte = vi.fn().mockReturnValue({ order });
  const eqStatus2 = vi.fn().mockReturnValue({ lte });
  const eqLeague2 = vi.fn().mockReturnValue({ eqStatus2 });
  const eqStatus1 = vi.fn().mockReturnValue({ maybeSingle });
  const eqLeague1 = vi.fn().mockReturnValue({ eqStatus1 });

  let fromCallCount = 0;
  const select = vi.fn().mockImplementation(() => {
    fromCallCount++;
    if (fromCallCount <= 1) return { eq: eqLeague1 };
    return { eq: eqLeague2 };
  });
  const from = vi.fn().mockReturnValue({ select, update: updateFn });

  return { from, updateChain };
}

describe("getOpenAuction", () => {
  it("returns open round when one exists", async () => {
    const openRound = { id: "abc", name: "Round 1" };
    const { from } = makeSupabase(openRound, null);
    const supabase = { from } as unknown as Parameters<typeof getOpenAuction>[0];
    const result = await getOpenAuction(supabase, "league-1");
    expect(result).toEqual(openRound);
    expect(from).toHaveBeenCalledWith("auctions");
  });

  it("returns null when no open and no scheduled past opens_at", async () => {
    const { from } = makeSupabase(null, null);
    const supabase = { from } as unknown as Parameters<typeof getOpenAuction>[0];
    const result = await getOpenAuction(supabase, "league-1");
    expect(result).toBeNull();
  });

  it("lazy-opens scheduled round past opens_at and returns it", async () => {
    const scheduledRound = { id: "xyz", name: "Round 1" };
    const updateChain = { eq: vi.fn().mockReturnValue({ error: null }) };
    const update = vi.fn().mockReturnValue(updateChain);

    let selectCallCount = 0;
    const maybeSingleOpen = vi.fn().mockResolvedValue({ data: null, error: null });
    const maybeSingleScheduled = vi.fn().mockResolvedValue({ data: scheduledRound, error: null });

    const from = vi.fn().mockReturnValue({
      select: vi.fn().mockImplementation(() => ({
        eq: vi.fn().mockImplementation(() => {
          selectCallCount++;
          if (selectCallCount <= 2) {
            // first select chain (open check)
            return { maybeSingle: maybeSingleOpen };
          }
          // second select chain (scheduled check)
          return {
            lte: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({ maybeSingle: maybeSingleScheduled }),
              }),
            }),
          };
        }),
      })),
      update,
    });

    const supabase = { from } as unknown as Parameters<typeof getOpenAuction>[0];
    const result = await getOpenAuction(supabase, "league-1");
    expect(result).toEqual(scheduledRound);
    expect(update).toHaveBeenCalledWith({ status: "open" });
    expect(updateChain.eq).toHaveBeenCalledWith("id", "xyz");
  });
});
```

- [ ] **Step 2: Vérifier que le test échoue**

```bash
cd apps/web && pnpm test lib/supabase/get-open-auction.test.ts --run 2>&1 | tail -20
```

Attendu : erreur "Cannot find module './get-open-auction'"

- [ ] **Step 3: Implémenter le helper**

```typescript
// apps/web/lib/supabase/get-open-auction.ts
import type { SupabaseClient } from "@supabase/supabase-js";

export async function getOpenAuction(
  supabase: SupabaseClient,
  leagueId: string
): Promise<{ id: string; name: string } | null> {
  // 1. Check for an already-open round
  const { data: openRound } = await supabase
    .from("auctions")
    .select("id, name")
    .eq("league_id", leagueId)
    .eq("status", "open")
    .maybeSingle();

  if (openRound) return openRound;

  // 2. Check for a scheduled round whose opens_at has passed (lazy-open Round 1)
  const { data: dueRound } = await supabase
    .from("auctions")
    .select("id, name")
    .eq("league_id", leagueId)
    .eq("status", "scheduled")
    .lte("opens_at", new Date().toISOString())
    .order("opens_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!dueRound) return null;

  // 3. Open it
  await supabase
    .from("auctions")
    .update({ status: "open" })
    .eq("id", dueRound.id);

  return dueRound;
}
```

- [ ] **Step 4: Vérifier que les tests passent**

```bash
cd apps/web && pnpm test lib/supabase/get-open-auction.test.ts --run 2>&1 | tail -20
```

Attendu : 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/supabase/get-open-auction.ts apps/web/lib/supabase/get-open-auction.test.ts
git commit -m "feat: add getOpenAuction lazy-open helper"
```

---

## Task 3 — `saveSponsor` : condition immédiate via helper

**Files:**
- Modify: `apps/web/app/(game)/league/[leagueId]/budget/actions.ts`

**Contexte :** Remplacer la query inline et le check `name === "Round 1"` par `getOpenAuction()`. La logique immediate/pending en aval ne change pas.

- [ ] **Step 1: Modifier `budget/actions.ts`**

Remplacer les lignes 80-115 (la section `// Check if we're in Round 1` jusqu'à `return { success: true as const, sponsorName: sponsor.name, pending: true }`):

```typescript
import { getOpenAuction } from "@/lib/supabase/get-open-auction";

  // ...après le check existingSponsor...

  // --- Sponsor change ---
  if (existingSponsor.sponsor_id === sponsorId) {
    return { success: false as const, error: "Already your active sponsor" };
  }

  // Immediate during any open auction round; pending between phases
  const openAuction = await getOpenAuction(supabase, team.league_id);
  const isImmediate = !!openAuction;

  if (isImmediate) {
    // Any open round: immediate effect — replace active sponsor
    await supabase
      .from("team_sponsors")
      .update({ sponsor_id: sponsorId, activated_at: new Date().toISOString() })
      .eq("team_id", teamId);

    // Clear any pending if set
    await supabase
      .from("teams")
      .update({ pending_sponsor_id: null })
      .eq("id", teamId);

    revalidatePath(`/league/${team.league_id}`);
    return { success: true as const, sponsorName: sponsor.name, immediate: true };
  }

  // No open round: save as pending, effective next phase
  await supabase
    .from("teams")
    .update({ pending_sponsor_id: sponsorId })
    .eq("id", teamId);

  revalidatePath(`/league/${team.league_id}`);
  return { success: true as const, sponsorName: sponsor.name, pending: true };
```

- [ ] **Step 2: Vérifier typecheck**

```bash
cd apps/web && pnpm typecheck 2>&1 | grep "budget/actions"
```

Attendu : aucune erreur.

- [ ] **Step 3: Run tests**

```bash
cd apps/web && pnpm test --run 2>&1 | tail -10
```

Attendu : tous les tests passent (123+3).

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/\(game\)/league/\[leagueId\]/budget/actions.ts
git commit -m "feat: saveSponsor — immediate during any open auction round (was Round 1 only)"
```

---

## Task 4 — `saveStrategies` : condition immédiate via helper

**Files:**
- Modify: `apps/web/app/(game)/league/[leagueId]/team/strategies/actions.ts`

**Contexte :** Même pattern que `saveSponsor`. Remplacer la query inline et `openAuction?.name === "Round 1"` par `getOpenAuction()`.

- [ ] **Step 1: Modifier `strategies/actions.ts`**

Ajouter l'import en haut du fichier :

```typescript
import { getOpenAuction } from "@/lib/supabase/get-open-auction";
```

Remplacer les lignes 56-64 :

```typescript
  // Immediate during any open auction round; pending between phases
  const openAuction = await getOpenAuction(supabase, leagueId);
  const immediate = !!openAuction;
```

Supprimer l'import de `getNextPhase` si plus utilisé (vérifier — il est utilisé ligne 121 : `const nextPhase = immediate ? null : getNextPhase(getCurrentPhase())`). Garder l'import.

- [ ] **Step 2: Vérifier typecheck**

```bash
cd apps/web && pnpm typecheck 2>&1 | grep "strategies/actions"
```

Attendu : aucune erreur.

- [ ] **Step 3: Run tests**

```bash
cd apps/web && pnpm test --run 2>&1 | tail -10
```

Attendu : tous les tests passent.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/\(game\)/league/\[leagueId\]/team/strategies/actions.ts
git commit -m "feat: saveStrategies — immediate during any open auction round (was Round 1 only)"
```

---

## Task 5 — `cancelBid` : supprimer check `closes_at`

**Files:**
- Modify: `apps/web/app/(game)/league/[leagueId]/auction/[auctionId]/actions.ts`

**Contexte :** Le check `closes_at < now()` dans `cancelBid` rejette les annulations après la date affichée même si le round est encore `open`. Les bids sont autorisées tant que le round est `open`.

- [ ] **Step 1: Modifier `cancelBid`**

Dans `apps/web/app/(game)/league/[leagueId]/auction/[auctionId]/actions.ts`, remplacer les lignes 65-77 :

```typescript
  // Before
  const { data: auction } = await supabase
    .from("auctions")
    .select("status, closes_at")
    .eq("id", bid.auction_id)
    .single();

  if (!auction || auction.status !== "open") {
    return { error: "Auction is no longer open" };
  }
  if (auction.closes_at && new Date(auction.closes_at) < new Date()) {
    return { error: "Auction bidding period has ended" };
  }
```

Par :

```typescript
  // After
  const { data: auction } = await supabase
    .from("auctions")
    .select("status")
    .eq("id", bid.auction_id)
    .single();

  if (!auction || auction.status !== "open") {
    return { error: "Auction is no longer open" };
  }
```

- [ ] **Step 2: Vérifier typecheck + tests**

```bash
cd apps/web && pnpm typecheck 2>&1 | grep "auctionId\]/actions" && pnpm test --run 2>&1 | tail -5
```

Attendu : aucune erreur TS, tous les tests passent.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/\(game\)/league/\[leagueId\]/auction/\[auctionId\]/actions.ts
git commit -m "fix: cancelBid — remove closes_at deadline check, valid while round is open"
```

---

## Task 6 — `createNextPhaseAuctions` : nouveau cycle de création

**Files:**
- Modify: `apps/web/app/(game)/league/[leagueId]/auction/rounds/actions.ts`

**Contexte :**
- Round 1 passe de `status = 'open'` à `status = 'scheduled'`, avec `opens_at` = date de début de phase depuis `AUCTION_PHASES`
- Les dates saisies dans l'UI = `closes_at` de chaque round
- `opens_at` de Round 2 et 3 = placeholder = `closes_at` du round précédent (sera mis à jour par `validate_round`)
- Les dates par défaut sont pré-remplies depuis `AUCTION_PHASES[currentPhase].auctionDates`

- [ ] **Step 1: Modifier `createNextPhaseAuctions` dans `rounds/actions.ts`**

Ajouter l'import en haut :

```typescript
import { getCurrentPhase, AUCTION_PHASES } from "@/lib/phases";
```

Remplacer la fonction `createNextPhaseAuctions` (lignes 80-155) par :

```typescript
export async function createNextPhaseAuctions(input: {
  leagueId: string;
  rounds: { date: string; time: string }[];
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated." };
  }

  const { data: league } = await supabase
    .from("leagues")
    .select("id, commissioner_id, status")
    .eq("id", input.leagueId)
    .single();

  if (!league || league.commissioner_id !== user.id) {
    return { error: "Only the Race Director can create auction rounds." };
  }

  if (league.status !== "active") {
    return { error: "League must be active to create new rounds." };
  }

  const { data: existing } = await supabase
    .from("auctions")
    .select("id")
    .eq("league_id", input.leagueId)
    .in("status", ["open", "scheduled"])
    .limit(1);

  if (existing && existing.length > 0) {
    return { error: "Active rounds already exist. Edit them instead." };
  }

  if (!input.rounds || input.rounds.length === 0 || input.rounds.length > 3) {
    return { error: "Configure 1 to 3 rounds." };
  }

  for (const round of input.rounds) {
    if (!round.date || !round.time) {
      return { error: "All rounds require a date and time." };
    }
  }

  // Round 1 opens_at = phase start date from lib/phases.ts
  const currentPhase = getCurrentPhase();
  const year = new Date().getFullYear();
  const phaseStartOffset = getParisOffset(
    `${year}-${String(currentPhase.startMonth).padStart(2, "0")}-${String(currentPhase.startDay).padStart(2, "0")}`
  );
  const round1OpensAt = `${year}-${String(currentPhase.startMonth).padStart(2, "0")}-${String(currentPhase.startDay).padStart(2, "0")}T00:00:00${phaseStartOffset}`;

  const rows = input.rounds.map((round, i) => {
    const offset = getParisOffset(round.date);
    // closes_at = date/time saisie par le commissaire
    const closesAt = `${round.date}T${round.time}:00${offset}`;

    // opens_at:
    //   Round 1: phase start date (lazy-open source of truth)
    //   Round 2+: closes_at of previous round (placeholder, updated by validate_round)
    let opensAt: string;
    if (i === 0) {
      opensAt = round1OpensAt;
    } else {
      const prev = input.rounds[i - 1];
      const prevOffset = getParisOffset(prev.date);
      opensAt = `${prev.date}T${prev.time}:00${prevOffset}`;
    }

    return {
      league_id: input.leagueId,
      name: `Round ${i + 1}`,
      status: "scheduled" as const,  // All rounds start scheduled; lazy-open handles Round 1
      opens_at: opensAt,
      closes_at: closesAt,
    };
  });

  const { error: insertError } = await supabase.from("auctions").insert(rows);
  if (insertError) return { error: "Failed to create auction rounds." };

  revalidatePath(`/league/${input.leagueId}/auction`);
  revalidatePath(`/league/${input.leagueId}/auction/rounds`);
  return { success: true };
}
```

- [ ] **Step 2: Modifier `updateRoundDates` — closes_at uniquement**

Remplacer la fonction `updateRoundDates` (lignes 17-78) par :

```typescript
export async function updateRoundDates(input: {
  leagueId: string;
  rounds: { id: string; date: string; time: string }[];
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated." };
  }

  const { data: league } = await supabase
    .from("leagues")
    .select("id, commissioner_id")
    .eq("id", input.leagueId)
    .single();

  if (!league || league.commissioner_id !== user.id) {
    return { error: "Only the Race Director can edit round dates." };
  }

  if (!input.rounds || input.rounds.length === 0) {
    return { error: "No rounds to update." };
  }

  for (let i = 0; i < input.rounds.length; i++) {
    const round = input.rounds[i];
    const { date, time } = round;

    if (!date || !time) {
      return { error: `Round ${i + 1}: date and time are required.` };
    }

    const offset = getParisOffset(date);
    // Only update closes_at — opens_at is controlled by phase start date + validate_round
    const closesAt = `${date}T${time}:00${offset}`;

    const { error: updateError } = await supabase
      .from("auctions")
      .update({ closes_at: closesAt })
      .eq("id", round.id);

    if (updateError) {
      return { error: `Failed to update Round ${i + 1}.` };
    }
  }

  revalidatePath(`/league/${input.leagueId}/auction`);
  revalidatePath(`/league/${input.leagueId}/auction/rounds`);
  return { success: true };
}
```

- [ ] **Step 3: Vérifier typecheck**

```bash
cd apps/web && pnpm typecheck 2>&1 | grep "rounds/actions"
```

Attendu : aucune erreur.

- [ ] **Step 4: Run tests**

```bash
cd apps/web && pnpm test --run 2>&1 | tail -5
```

Attendu : tous les tests passent.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/\(game\)/league/\[leagueId\]/auction/rounds/actions.ts
git commit -m "feat: createNextPhaseAuctions — all rounds scheduled, opens_at from phase start, closes_at from input"
```

---

## Task 7 — `setRoundDates` : closes_at uniquement

**Files:**
- Modify: `apps/web/app/(game)/league/[leagueId]/auction/market/actions.ts`

**Contexte :** `setRoundDates` écrasait aussi `opens_at`, ce qui corromprait l'heure d'ouverture du Round 1 (source de vérité pour le lazy-open). Elle ne doit toucher que `closes_at`.

- [ ] **Step 1: Modifier `setRoundDates`**

Dans `apps/web/app/(game)/league/[leagueId]/auction/market/actions.ts`, remplacer le bloc d'update (lignes 58-67) :

```typescript
  // Before
  for (const round of rounds) {
    const { error: updateError } = await supabase
      .from("auctions")
      .update({
        opens_at: `${round.date}T00:00:00+01:00`,
        closes_at: `${round.date}T23:59:59+01:00`,
      })
      .eq("id", round.auctionId)
      .eq("league_id", leagueId);
```

Par :

```typescript
  // After — only update closes_at; opens_at is controlled by phase start date + validate_round
  for (const round of rounds) {
    const { error: updateError } = await supabase
      .from("auctions")
      .update({
        closes_at: `${round.date}T23:59:59+01:00`,
      })
      .eq("id", round.auctionId)
      .eq("league_id", leagueId);
```

- [ ] **Step 2: Vérifier typecheck + tests**

```bash
cd apps/web && pnpm typecheck 2>&1 | grep "market/actions" && pnpm test --run 2>&1 | tail -5
```

Attendu : aucune erreur TS, tous les tests passent.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/\(game\)/league/\[leagueId\]/auction/market/actions.ts
git commit -m "fix: setRoundDates — only update closes_at, never opens_at"
```

---

## Task 8 — UI rounds : closes_at dans le form

**Files:**
- Modify: `apps/web/app/(game)/league/[leagueId]/auction/rounds/page.tsx`
- Modify: `apps/web/app/(game)/league/[leagueId]/auction/rounds/rounds-client.tsx`

**Contexte :** La page lit actuellement `opens_at` pour pré-remplir le form (sémantique incorrecte). Le client a un champ "Closes at" séparé pour le dernier round. Les deux doivent être corrigés : les inputs = `closes_at`, le champ séparé disparaît.

- [ ] **Step 1: Modifier `rounds/page.tsx`**

Lire le fichier complet. Remplacer la ligne qui lit `opens_at` pour les initialRounds :

```typescript
// Avant (ligne 49)
const { date, time } = splitDateTime(r.opens_at);

// Après
const { date, time } = splitDateTime(r.closes_at);
```

Remplacer aussi la ligne qui lit `closes_at` pour `initialClosingTime` (actuellement lignes 55-58 — cette variable disparaît) :

```typescript
// Avant
const lastRound = auctionRounds?.[auctionRounds.length - 1];
const initialClosingTime = isCreating
  ? "12:00"
  : (splitDateTime(lastRound?.closes_at ?? null).time || "23:59");

// Après — supprimer ces 3 lignes, initialClosingTime n'est plus utilisé
```

Supprimer `initialClosingTime` du passage de props à `RoundsClient`.

- [ ] **Step 2: Modifier `rounds-client.tsx`**

Remplacer le contenu entier par la version sans `closingTime` et avec libellé "Closes" :

```typescript
"use client";

import { useState, useTransition } from "react";
import { BackHeader } from "@/components/back-header";
import { useScrollDirection } from "@/hooks/use-scroll-direction";
import { updateRoundDates, createNextPhaseAuctions } from "./actions";

interface RoundRow {
  id: string;
  name: string;
  date: string;
  time: string;
}

interface RoundsClientProps {
  leagueId: string;
  leagueName: string;
  initialRounds: RoundRow[];
  isCreating: boolean;
}

function getParisDate(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" });
}

export function RoundsClient({
  leagueId,
  leagueName,
  initialRounds,
  isCreating,
}: RoundsClientProps) {
  const [rounds, setRounds] = useState<RoundRow[]>(
    isCreating
      ? [
          { id: "", name: "Round 1", date: getParisDate(1), time: "23:59" },
          { id: "", name: "Round 2", date: getParisDate(2), time: "23:59" },
          { id: "", name: "Round 3", date: getParisDate(3), time: "23:59" },
        ]
      : initialRounds
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();
  const navVisible = useScrollDirection();

  const inputClass =
    "flex-1 min-w-0 bg-transparent border border-[var(--border-default)] rounded-[var(--radius-md)] px-3 py-2 text-[length:var(--type-body)] font-mono text-[var(--text-high)] focus:border-[var(--accent-default)] focus:outline-none transition-colors [color-scheme:dark]";

  function handleChange(index: number, field: "date" | "time", value: string) {
    setRounds((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
    setSuccess(false);
    setError(null);
  }

  function handleSave() {
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      let result;
      if (isCreating) {
        result = await createNextPhaseAuctions({
          leagueId,
          rounds: rounds.map((r) => ({ date: r.date, time: r.time })),
        });
      } else {
        result = await updateRoundDates({
          leagueId,
          rounds: rounds.map((r) => ({ id: r.id, date: r.date, time: r.time })),
        });
      }
      if (result?.error) {
        setError(result.error);
      } else {
        setSuccess(true);
      }
    });
  }

  return (
    <div className="flex flex-col min-h-svh bg-[var(--bg-app)]">
      <BackHeader label={isCreating ? "Setup Phase Rounds" : "Edit Round Dates"} />

      <div className="flex-1 px-4 pt-4 pb-28 space-y-6 max-w-lg mx-auto w-full">
        <div>
          <h1 className="text-[length:var(--type-page-title)] font-semibold text-[var(--text-high)]">
            {leagueName}
          </h1>
          <p className="mt-1 text-[length:var(--type-body)] text-[var(--text-mid)]">
            {isCreating
              ? "Set the closing date and time for each auction round."
              : "Adjust the closing date and time for each auction round."}
          </p>
        </div>

        <div className="border-b border-[var(--border-subtle)]" />

        <div className="space-y-4">
          {rounds.map((round, i) => (
            <div key={round.name} className="space-y-2">
              <p className="text-[length:var(--type-caption)] font-semibold text-[var(--text-mid)] uppercase tracking-wide">
                {round.name} — Closes
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={round.date}
                  onChange={(e) => handleChange(i, "date", e.target.value)}
                  autoComplete="off"
                  className={inputClass}
                />
                <input
                  type="time"
                  value={round.time}
                  onChange={(e) => handleChange(i, "time", e.target.value)}
                  autoComplete="off"
                  className={inputClass}
                />
              </div>
            </div>
          ))}
        </div>

        {error && (
          <p className="text-[length:var(--type-body)] text-[var(--status-danger)]">
            {error}
          </p>
        )}
        {success && (
          <p className="text-[length:var(--type-body)] text-[var(--status-success)]">
            {isCreating ? "Rounds created." : "Round dates saved."}
          </p>
        )}
      </div>

      <div
        className="fixed inset-x-0 z-30 border-t border-[var(--border-default)] bg-[var(--bg-app)] px-4 py-3 transition-[bottom] duration-200 lg:hidden"
        style={{ bottom: navVisible ? "3.5rem" : "0" }}
      >
        <div className="max-w-lg mx-auto">
          <button
            onClick={handleSave}
            disabled={isPending}
            className="w-full rounded-[var(--radius-md)] cta-gradient px-4 py-2.5 text-[length:var(--type-emphasis)] font-semibold text-black transition-opacity disabled:opacity-50"
          >
            {isPending ? "Saving..." : isCreating ? "Create rounds" : "Save changes"}
          </button>
        </div>
      </div>

      <div className="hidden lg:block fixed bottom-0 inset-x-0 border-t border-[var(--border-default)] bg-[var(--bg-app)] px-4 py-3 lg:left-[180px]">
        <div className="max-w-lg mx-auto">
          <button
            onClick={handleSave}
            disabled={isPending}
            className="w-full rounded-[var(--radius-md)] cta-gradient px-4 py-2.5 text-[length:var(--type-emphasis)] font-semibold text-black transition-opacity disabled:opacity-50"
          >
            {isPending ? "Saving..." : isCreating ? "Create rounds" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Vérifier typecheck**

```bash
cd apps/web && pnpm typecheck 2>&1 | grep "rounds/"
```

Attendu : aucune erreur.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/\(game\)/league/\[leagueId\]/auction/rounds/page.tsx \
        apps/web/app/\(game\)/league/\[leagueId\]/auction/rounds/rounds-client.tsx
git commit -m "feat(ui): rounds form shows closes_at for all rounds, remove separate Closes At field"
```

---

## Task 9 — Pages marketplace + strategies : `isImmediate` via DB

**Files:**
- Modify: `apps/web/app/(game)/league/[leagueId]/budget/marketplace/page.tsx`
- Modify: `apps/web/app/(game)/league/[leagueId]/team/strategies/page.tsx`

**Contexte :** Les pages utilisent `isInAuctionWindow()` (dates hardcodées de `lib/phases.ts`) pour déterminer si les changements sont immédiats. Ce check doit utiliser la DB (round avec `status = 'open'`) pour être cohérent avec les server actions.

- [ ] **Step 1: Modifier `marketplace/page.tsx`**

Ajouter l'import :
```typescript
import { getOpenAuction } from "@/lib/supabase/get-open-auction";
```

Remplacer les lignes 41-43 :
```typescript
// Avant
const immediate = isInAuctionWindow() || await isLeagueFirstCycle(supabase, leagueId);

// Après
const [openAuction, isFirstCycle] = await Promise.all([
  // Read-only check (no lazy-open in page rendering; lazy-open fires on first save action)
  supabase.from("auctions").select("id").eq("league_id", leagueId).eq("status", "open").maybeSingle().then(r => r.data),
  isLeagueFirstCycle(supabase, leagueId),
]);
const immediate = !!openAuction || isFirstCycle;
```

Supprimer l'import de `isInAuctionWindow` si plus utilisé dans ce fichier.

- [ ] **Step 2: Modifier `strategies/page.tsx`**

Remplacer les lignes qui calculent `isInAuctionWindow` :

```typescript
// Avant
import { getCurrentPhase, getNextPhase, isInAuctionWindow } from "@/lib/phases";
// ...
isInAuctionWindow={isInAuctionWindow()}

// Après
import { getCurrentPhase, getNextPhase } from "@/lib/phases";
// Dans la fonction page, ajouter :
const { data: openAuction } = await supabase
  .from("auctions")
  .select("id")
  .eq("league_id", leagueId)
  .eq("status", "open")
  .maybeSingle();
// ...
isInAuctionWindow={!!openAuction}
```

- [ ] **Step 3: Vérifier typecheck**

```bash
cd apps/web && pnpm typecheck 2>&1 | grep "marketplace/page\|strategies/page"
```

Attendu : aucune erreur.

- [ ] **Step 4: Run tous les tests**

```bash
cd apps/web && pnpm test --run 2>&1 | tail -10
```

Attendu : tous les tests passent.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/\(game\)/league/\[leagueId\]/budget/marketplace/page.tsx \
        apps/web/app/\(game\)/league/\[leagueId\]/team/strategies/page.tsx
git commit -m "feat: marketplace + strategies pages use DB open auction for isImmediate display"
```

---

## Task 10 — Vérification finale

- [ ] **Step 1: Build complet**

```bash
cd /Users/jonathanschummers/Documents/WattHunter && pnpm build 2>&1 | tail -30
```

Attendu : build sans erreurs. Zéro erreur TS.

- [ ] **Step 2: Tests complets**

```bash
cd apps/web && pnpm test --run 2>&1 | grep -E "Tests|passed|failed"
```

Attendu : tous les tests passent, aucun échec.

- [ ] **Step 3: Lint**

```bash
cd /Users/jonathanschummers/Documents/WattHunter && pnpm lint 2>&1 | grep -v "^$" | tail -20
```

Attendu : aucune erreur lint.

- [ ] **Step 4: Commit final si nécessaire**

Si des fichiers sont restés non commités :

```bash
git status
# Commiter tout ce qui reste
git add -A && git commit -m "chore: final cleanup after round lifecycle refactor"
```

---

## Résumé des commits attendus

1. `feat(db): validate_round closes current + opens next round, place_bid removes closes_at deadline`
2. `feat: add getOpenAuction lazy-open helper`
3. `feat: saveSponsor — immediate during any open auction round (was Round 1 only)`
4. `feat: saveStrategies — immediate during any open auction round (was Round 1 only)`
5. `fix: cancelBid — remove closes_at deadline check, valid while round is open`
6. `feat: createNextPhaseAuctions — all rounds scheduled, opens_at from phase start, closes_at from input`
7. `fix: setRoundDates — only update closes_at, never opens_at`
8. `feat(ui): rounds form shows closes_at for all rounds, remove separate Closes At field`
9. `feat: marketplace + strategies pages use DB open auction for isImmediate display`
