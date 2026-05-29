# PR2 Handoff — `grant_xp` RPC + clean migration audit pattern

**Status:** Ready to start (fresh conversation)
**Predecessor PR:** #15 (merged 2026-05-08) — manual force-resolve round
**Audience:** Fresh Claude session with no prior context

---

## TL;DR

PR1 a livré la feature force-resolve. En passant on a découvert un anti-pattern dans la migration `20260506100000_team_xp_adjustments.sql` : elle contient 3 INSERTs hardcodés vers des UUIDs de teams prod (Klimax, Dixon Hormous, bigdaddy) — données runtime mélangées avec du schema. Ça cassait `supabase db reset` from-scratch.

**Quick fix appliqué dans PR1** (commit `b5e905b`) : ajouter `WHERE EXISTS` guards aux 3 INSERTs pour qu'ils skippent silencieusement quand les teams n'existent pas. Ça débloque `db reset`. **C'est un workaround, pas la solution propre.**

**Objectif PR2** : nettoyer définitivement le pattern, sans perdre les audit rows en prod.

---

## Problème de fond

### Anti-pattern

Une migration ne doit décrire QUE du schema (CREATE TABLE, ALTER, CREATE FUNCTION). Pas des données runtime ni des évènements historiques. Quand tu fais `db reset` sur une nouvelle machine, la migration va re-tourner — et si elle dépend de données absentes, elle plante.

### Ce qui est dans la migration aujourd'hui

`supabase/migrations/20260506100000_team_xp_adjustments.sql` fait :
1. **Schéma** (légitime) : `CREATE TABLE team_xp_adjustments` + RLS policy
2. **Données historiques** (anti-pattern) : 3 INSERTs avec UUIDs hardcodés :
   - Klimax `68ccf635-...` : +20 XP, "level 2 catch-up" (2026-04-02)
   - Dixon Hormous `75122355-...` : +120 XP, "level 4 catch-up" (2026-05-06)
   - bigdaddy `9ed75546-...` : +120 XP, "level 4 catch-up" (2026-05-06)

### Ce qu'on veut

- **Préserver** les 3 audit rows en prod (elles documentent de vraies actions admin passées — important pour la traçabilité)
- **Nettoyer** la migration pour qu'elle soit pure schema
- **Fournir un mécanisme propre** pour les futurs grants XP (RPC ou UI admin)

---

## Plan PR2

### Étape 1 — Sortir les INSERTs de la migration

Modifier `supabase/migrations/20260506100000_team_xp_adjustments.sql` :
- **Garder** le `CREATE TABLE`, `ALTER TABLE ENABLE RLS`, `CREATE POLICY`
- **Supprimer** les 3 `INSERT INTO public.team_xp_adjustments ...` (les WHERE EXISTS de PR1 inclus)

Effet attendu :
- Sur **remote prod** : aucun changement (la migration est déjà appliquée, les 3 rows restent intactes dans la table)
- Sur **local fresh** : `db reset` passe sans rien insérer, table vide (acceptable pour dev)

⚠️ **Important** : ne pas DELETE les rows en prod. Elles restent.

### Étape 2 — Créer la RPC `grant_xp`

Nouvelle migration `supabase/migrations/<timestamp>_grant_xp_rpc.sql` :

```sql
CREATE OR REPLACE FUNCTION public.grant_xp(
  p_team_id uuid,
  p_amount numeric,
  p_reason text,
  p_adjusted_at date DEFAULT current_date
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_team record;
BEGIN
  -- Auth: only the user himself OR a service_role caller can grant
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  -- TODO: décider du auth model :
  --   Option A : seul jonathan.schummers@gmail.com peut appeler (hardcode user_id)
  --   Option B : ajouter une colonne is_admin sur auth.users / profiles
  --   Option C : laisser le user_id bypass et appeler uniquement via service_role
  -- Pour l'alpha → Option A est le plus simple

  -- Verify team exists
  SELECT * INTO v_team FROM public.teams WHERE id = p_team_id FOR UPDATE;
  IF v_team IS NULL THEN
    RETURN jsonb_build_object('error', 'Team not found');
  END IF;

  -- Atomic: update + audit
  UPDATE public.teams
  SET cumulative_xp = cumulative_xp + p_amount
  WHERE id = p_team_id;

  INSERT INTO public.team_xp_adjustments (team_id, amount, reason, adjusted_at)
  VALUES (p_team_id, p_amount, p_reason, p_adjusted_at);

  RETURN jsonb_build_object(
    'ok', true,
    'team_id', p_team_id,
    'new_xp', v_team.cumulative_xp + p_amount
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.grant_xp(uuid, numeric, text, date) TO authenticated;
```

⚠️ **Trigger `teams_protect_sensitive_fields`** : il bloque les UPDATE sur `cumulative_xp` (j'ai vérifié — ce trigger bloque level/treasury/xp/user_id/league_id sauf service_role/supabase_admin). La RPC `SECURITY DEFINER` tourne avec les droits du créateur — il faut vérifier si ça bypass le trigger ou non. Si ça plante, deux options :
- Désactiver le trigger temporairement dans la transaction (`SET LOCAL session_replication_role = replica`)
- Ajouter `cumulative_xp` à la whitelist des champs modifiables par les RPCs SECURITY DEFINER dans le trigger

### Étape 3 — UI admin (optionnel)

Pas indispensable pour l'alpha. Tu peux appeler la RPC directement :
```bash
# Via supabase CLI en local
docker exec -i supabase_db_WattHunter psql -U postgres -c \
  "SELECT grant_xp('<team_uuid>'::uuid, 20, 'Admin balance – level 2 catch-up')"

# Ou via le dashboard Supabase remote SQL editor
```

Si tu veux une UI : page `/admin/xp` avec un form simple (team selector, amount, reason) appelant un server action. Hors scope MVP.

### Étape 4 — Vérification finale

1. `supabase db reset` doit passer **sans erreur**
2. Le test `pnpm test` doit toujours passer (145+)
3. Sur remote, vérifier que les 3 audit rows historiques sont **toujours présents** dans `team_xp_adjustments`
4. Tester la RPC sur remote en ajoutant un nouveau grant test (puis le supprimer)

---

## Contraintes / risques

| Risque | Mitigation |
|--------|-----------|
| Perdre les 3 audit rows en prod | NE PAS faire `DELETE` — juste retirer les INSERTs du fichier .sql |
| Trigger `teams_protect_sensitive_fields` bloque l'UPDATE | Vérifier le comportement SECURITY DEFINER vs trigger ; ajuster si besoin |
| Concurrence sur `cumulative_xp` | RPC fait `FOR UPDATE` sur la team row — atomique |
| Migration appliquée 2x | `CREATE OR REPLACE FUNCTION` est idempotent ; INSERTs retirés donc pas de doublons |

---

## Fichiers à toucher

**Modifier :**
- `supabase/migrations/20260506100000_team_xp_adjustments.sql` — retirer les 3 INSERTs

**Créer :**
- `supabase/migrations/<timestamp>_grant_xp_rpc.sql` — RPC `grant_xp`
- `supabase/migrations/_rollback/<timestamp>_grant_xp_rpc_rollback.sql` — `DROP FUNCTION grant_xp`

**Optionnel (out of scope MVP) :**
- `apps/web/app/admin/xp/page.tsx` + server action
- Tests vitest

---

## Hors scope PR2 (encore plus tard)

- Refactor des autres migrations data-coupled (s'il y en a)
- Audit log centralisé pour toutes les admin actions (pas juste XP)
- Permissions granulaires (rôle `admin` / `commissioner`)
- Migration des audit rows existants vers une table `admin_actions` plus générique

---

## Contexte technique pour le fresh agent

- Stack : Next.js 16 App Router, Supabase (Postgres + Auth + RLS), TypeScript strict, Vitest
- Working directory : `/Users/jonathanschummers/Documents/WattHunter`
- Branch principale : `main`
- Convention : SECURITY DEFINER RPCs pour toute mutation économique (5 RPCs existantes : `place_bid`, `validate_round`, `release_rider`, `confirm_phase_setup`, `leave_league` — voir `apps/web/app/(game)/league/[leagueId]/auction/actions.ts` pour le pattern d'appel TS)
- Convention commits : `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:` (conventional commits)
- Branch naming : `feature/<description>` ou `fix/<bug>`

---

## Instructions pour le fresh agent

1. **Lis ce fichier en entier** avant de commencer.
2. **Lis** `supabase/migrations/20260506100000_team_xp_adjustments.sql` pour voir l'état actuel.
3. **Lis** une RPC existante (par ex. `supabase/migrations/20260504100000_rpc_release_rider.sql`) pour le pattern SECURITY DEFINER + auth check.
4. **Vérifie** le trigger `teams_protect_sensitive_fields` dans `supabase/migrations/20260505000000_protect_team_sensitive_fields.sql` — comprends ce qu'il bloque et comment le contourner depuis une RPC SECURITY DEFINER.
5. **Décide** du auth model pour `grant_xp` (Option A/B/C ci-dessus). Demande à Jonathan si pas clair — pour l'alpha, Option A (hardcode son user_id) est OK.
6. **Implémente** Étapes 1 + 2 (4 ne pas oublier rollback).
7. **Teste** localement avec `supabase db reset` puis `pnpm test`.
8. **Push remote** avec `supabase db push --linked` (depuis le main repo, pas un worktree — `supabase link` est dans `/Users/jonathanschummers/Documents/WattHunter/supabase/.temp/`).
9. **PR** avec description claire.

---

## Estimation

- ~30 min implementation
- ~20 min testing
- ~50 lignes SQL totales (pas de TS sauf si tu fais l'UI admin)

**Confiance one-shot : 80%+** — c'est une refactor mécanique avec un risque circonscrit (trigger interaction).

---

## Ce qui était fait dans PR1 (pour rappel)

PR #15 (merged) :
- Nouvelle table `round_validations` + backfill Giro
- RPC `validate_round` patchée (ajoute INSERT round_validations)
- TS server action `forceResolveRound` (port Python)
- Service-role admin client (`apps/web/lib/supabase/admin.ts`) — gated `import "server-only"`
- Page `/auction/status` (table + bouton + modale)
- Quick fix : `team_xp_adjustments.sql` avec WHERE EXISTS guards (workaround)

PR2 nettoie ce dernier point en mode propre.
