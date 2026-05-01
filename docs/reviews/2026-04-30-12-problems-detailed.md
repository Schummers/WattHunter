# 12 problèmes — analyse détaillée

> Suite à la code review du 2026-04-30. Chaque problème est analysé avec preuve directe, risque concret, solution et risques de la solution. Niveau de confiance honnête à la fin de chaque section.

## Légende des niveaux de confiance

- **HIGH** : j'ai lu le code moi-même, c'est factuel et reproductible
- **MEDIUM** : claim d'agent, recoupée mais pas relue ligne par ligne par moi
- **LOW** : recommandation de senior dev, pas un bug observé mais une bonne pratique

---

# #1 — `teams_update_own` permet l'auto-élévation

## Le problème

Tout joueur peut, depuis sa console navigateur, exécuter une requête Supabase qui met `level=8`, `treasury=999_999_999`, `cumulative_xp=99_999` sur sa propre équipe. Aucun flag d'admin, aucun outil de triche, juste un appel direct à l'API Supabase avec son anon JWT légitime.

## Preuve

`supabase/migrations/20260221000000_initial_schema.sql:297` :

```sql
create policy "teams_update_own" on public.teams
  for update using (auth.uid() = user_id);
```

Trois choses manquent :
- Pas de `WITH CHECK` (donc aucune validation post-update)
- Pas de restriction de colonne (UPDATE peut toucher n'importe quel champ)
- Pas de trigger BEFORE UPDATE qui rejette les changements de colonnes sensibles

J'ai vérifié moi-même — la policy se lit comme telle.

## Risque concret dans le jeu

Un joueur ouvre la console F12, tape :
```js
await supabase.from("teams")
  .update({ level: 8, treasury: 999_999_999, cumulative_xp: 99999 })
  .eq("id", "<son-team-id>")
```

Conséquences immédiates :
- Bypass total du level gating (peut bid sur les coureurs Top 1)
- Bypass total des unlock sponsors
- Bypass de la solvabilité bid (treasury infinie)
- Bypass du Co-Unlock (sa propre L8 fait sauter le verrou pour les autres)
- Bypass des stratégies (maxActive=3 dispo)

C'est silencieux : aucun log côté serveur, aucun audit. CLAUDE.md dit "NEVER bypass RLS" — c'est précisément ce qui est possible ici.

## Solution proposée

**Option A — Trigger BEFORE UPDATE (recommandé, simple)** :
```sql
create function block_team_field_updates() returns trigger as $$
begin
  if NEW.level is distinct from OLD.level
     or NEW.treasury is distinct from OLD.treasury
     or NEW.cumulative_xp is distinct from OLD.cumulative_xp
     or NEW.user_id is distinct from OLD.user_id
     or NEW.league_id is distinct from OLD.league_id then
    raise exception 'Field protected: only service_role can modify level/treasury/xp';
  end if;
  return NEW;
end;
$$ language plpgsql security definer;

create trigger teams_protect_sensitive_fields
  before update on public.teams
  for each row
  when (current_setting('role', true) <> 'service_role')
  execute function block_team_field_updates();
```

Le trigger laisse passer service_role (Python pcs-sync, RPC SECURITY DEFINER) mais bloque tout UPDATE direct depuis l'app. La policy RLS reste, on rajoute juste cette couche.

**Option B — Révoquer UPDATE général + RPC ciblées** : plus propre architecturalement mais demande de tout refactorer.

## Risques de la solution

| Risque | Probabilité | Mitigation |
|---|---|---|
| Le trigger casse un UPDATE légitime depuis une server action | Moyenne | Toutes les server actions actuelles qui touchent `treasury` (`validateRound`, `confirmPhaseSetup`, `placeBid` resolution) font des UPDATE depuis `@supabase/ssr` qui utilise l'anon key — donc elles vont être bloquées. Il faut **les déplacer côté RPC SECURITY DEFINER** OU détecter via une variable de session. |
| Migration plante en prod si `current_setting('role')` n'existe pas | Faible | Tester en local d'abord, le `, true` du second arg rend la lecture safe (return NULL si absent). |
| Joueurs en cours de partie ne peuvent plus mettre à jour leur nom | Faible | `name` n'est pas dans la liste des champs protégés. À tester quand même. |

**Risque majeur** : aujourd'hui, **`validateRound` et la résolution d'auction écrivent sur `treasury` via `supabase.from("teams").update(...)` avec l'anon key**. Si on pose ce trigger, **ces actions vont casser**. Donc l'ordre d'exécution doit être :
1. D'abord migrer les UPDATE treasury en RPC SECURITY DEFINER (chantier #10)
2. Ensuite poser le trigger

Sinon on déploie un site cassé.

## Niveau de confiance : **HIGH**

Lu directement la migration ligne 297. Le diff est trivial, l'exploit est trivial.

---

# #2 — XP drift DB ↔ code (Anti-Runaway Mech 3 jamais migrée)

## Le problème

La stretch curve de l'Anti-Runaway System (mémoire `anti_runaway_system.md`, mécanique 3) augmente les seuils XP des niveaux 6-8. Le code TypeScript et Python a été mis à jour, mais **aucune migration SQL ne re-recalcule les `teams.level` existants**. Les équipes en DB sont au "ancien niveau", l'UI affiche le "nouveau niveau", scoring.py applique les "nouveaux seuils".

## Preuve

| Source | L6 seuil | L7 seuil | L8 seuil |
|---|---|---|---|
| `supabase/migrations/20260402000000_level_rework_8_levels.sql:8-17` | **900** | **1500** | **2000** |
| `apps/web/lib/levels.ts:6-9` | 1200 | 1800 | 2400 |
| `services/pcs-sync/scoring.py:28` (rapporté par agent) | 1200 | 1800 | 2400 |

Vérifié moi-même par lecture directe.

Concrètement : une équipe avec `cumulative_xp = 950` est à `level=6` en DB (selon la migration de 2026-04-02), mais `lib/levels.ts:getLevelForXp(950)` retourne 5.

## Risque concret dans le jeu

Avant Giro 2026-05-08 :
- Équipe affichée L5 dans l'UI mais niveau réellement L6 en DB
- Slots autorisés : UI dit 10 (L5), mais `team.level=6` permet 11 → divergence à chaque slot check
- Solvabilité bid : `getMaxSlots(team.level)` lit la valeur DB → permet 11 slots, mais l'UI a affiché 10 → bugs visuels et de validation
- Sponsor unlock : `level=6` débloque T5 (1M) en DB, mais l'UI dit qu'il faut L6 (1200 XP) qu'on n'a pas atteint
- Co-Unlock Rule : si une équipe est faussement en L6 en DB, elle compte comme L6 dans `fetchLeagueTeamLevels` → débloque des coureurs Top 10 alors qu'aucun joueur n'a réellement 1200 XP

C'est un bug de cohérence qui sera **immédiatement visible** dès qu'un joueur dépassera 900 XP dans le Giro.

## Solution proposée

Nouvelle migration `20260501000000_xp_stretched_curve_recompute.sql` :

```sql
-- Re-compute team levels with stretched XP curve
-- New thresholds (from lib/levels.ts and scoring.py):
-- L1=0, L2=25, L3=150, L4=350, L5=600, L6=1200, L7=1800, L8=2400

UPDATE public.teams SET level = CASE
  WHEN cumulative_xp >= 2400 THEN 8
  WHEN cumulative_xp >= 1800 THEN 7
  WHEN cumulative_xp >= 1200 THEN 6
  WHEN cumulative_xp >=  600 THEN 5
  WHEN cumulative_xp >=  350 THEN 4
  WHEN cumulative_xp >=  150 THEN 3
  WHEN cumulative_xp >=   25 THEN 2
  ELSE 1
END;

-- Bonus: créer une fonction réutilisable pour éviter le 4e drift
CREATE OR REPLACE FUNCTION public.compute_level(xp numeric) RETURNS int
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN xp >= 2400 THEN 8
    WHEN xp >= 1800 THEN 7
    WHEN xp >= 1200 THEN 6
    WHEN xp >=  600 THEN 5
    WHEN xp >=  350 THEN 4
    WHEN xp >=  150 THEN 3
    WHEN xp >=   25 THEN 2
    ELSE 1
  END;
$$;
```

Et idéalement un test cross-stack étendu (`levels-sync-check.test.ts`) qui vérifie que les seuils TS == seuils Python == seuils SQL function. Pattern déjà existant dans le projet.

## Risques de la solution

| Risque | Probabilité | Mitigation |
|---|---|---|
| Une équipe rétrogradée brutalement (ex. L6 → L5) perd des slots et se retrouve avec trop de coureurs | **Élevée si des équipes ont déjà 900-1199 XP** | Vérifier en DB **avant migration** : `SELECT count(*) FROM teams WHERE cumulative_xp BETWEEN 900 AND 1199` (et idem 1500-1799, 2000-2399). Si > 0, prévoir un mécanisme de "grâce" (les laisser à L6 jusqu'à atteindre 1200, ou les laisser releaser des coureurs). |
| Sponsors débloqués qui se reverrouillent | Moyenne | Idem — vérifier d'abord l'état actuel. Communiquer aux joueurs si rétrogradation. |
| Backfill historique de `team_ranking_daily` désormais incohérent | Faible | Acceptable, c'est de l'historique. |

**Risque principal** : si la base contient déjà des équipes "boostées" par les anciens seuils, la migration les rétrograde sans avertissement. **À faire avant la migration** : un `SELECT user_id, cumulative_xp, level FROM teams WHERE level NOT IN (compute_level(cumulative_xp))`. Si ça retourne des lignes, prévoir une comm aux joueurs concernés.

Vu que **WattHunter n'est pas encore en alpha publique** (CLAUDE.md "à calibrer avant le lancement alpha"), il y a probablement très peu de comptes affectés. À vérifier.

## Niveau de confiance : **HIGH**

Drift confirmé par lecture directe de la migration ET de `lib/levels.ts`. La migration de fix est mécanique, testable. Le risque principal est de la cohérence métier, pas technique.

---

# #3 — Solvabilité bids non agrégée cross-rounds

## Le problème

Quand un joueur place une enchère, le code vérifie qu'il a les moyens de payer **uniquement pour le round courant**. Si un round 1 et un round 2 sont ouverts simultanément, il peut placer la totalité de sa trésorerie sur chaque round indépendamment.

## Preuve

`apps/web/app/(game)/league/[leagueId]/auction/[auctionId]/actions.ts:95-110` (lu moi-même) :

```ts
const { data: activeBids } = await supabase
  .from("auction_bids")
  .select("id, amount")
  .eq("team_id", team.id)
  .eq("auction_id", parsed.data.auctionId)
  .eq("round", parsed.data.round)         // ← FILTRE QUI POSE PROBLÈME
  .eq("status", "active");

const otherBidsTotal = (activeBids ?? [])
  .filter((b) => b.id !== existingBid?.id)
  .reduce((s, b) => s + b.amount, 0);

if (currentSalaries + otherBidsTotal + parsed.data.amount > team.treasury) {
  return { error: "Insufficient budget" };
}
```

De plus, `draft_bids` (les drafts non encore validés) ne sont **jamais** sommés dans la solvabilité. Donc un joueur peut avoir 200K en draft + 200K en active bid round 1 + 200K en active bid round 2 avec une trésorerie de 200K, et tout passe.

## Risque concret dans le jeu

Scénario :
- Joueur A a 200K trésorerie, 0 contrat actif
- Round 1 ouvert et round 2 ouvert (cas réel selon CLAUDE.md, plusieurs rounds successifs avant phase WT)
- A place 150K sur Pogačar dans round 1 → check passe (150 < 200)
- A place 150K sur Vingegaard dans round 2 → check passe (150 < 200, l'autre round n'est pas compté)
- Si A gagne les deux : contrat à 300K de salaire sur 200K de trésorerie → faillite immédiate au prochain payday

L'invariant CLAUDE.md "NEVER autoriser une enchère si treasury < total des enchères actives" est violé par construction.

## Solution proposée

Remplacer le check par un calcul agrégé. Pseudo-code :

```ts
// Sum ALL active bids (toutes auctions, tous rounds) + drafts
const [{ data: allActiveBids }, { data: allDrafts }] = await Promise.all([
  supabase.from("auction_bids")
    .select("amount")
    .eq("team_id", team.id)
    .eq("status", "active"),
  supabase.from("draft_bids")
    .select("amount")
    .eq("team_id", team.id),
]);

const totalCommitments = currentSalaries
  + sumExcluding(allActiveBids, existingBid?.id)
  + sumOf(allDrafts);

if (totalCommitments + parsed.data.amount > team.treasury) {
  return { error: "Insufficient total budget across all rounds + drafts" };
}
```

Idéalement, extraire cette logique dans `lib/budget.ts` :
```ts
export async function computeTeamCommitments(supabase, teamId, excludeBidId?): Promise<{
  salaries: number; activeBids: number; drafts: number; total: number;
}>
```

Réutilisable par `placeBid`, `validateRound`, `confirmPhaseSetup`, et l'affichage budget P&L.

## Risques de la solution

| Risque | Probabilité | Mitigation |
|---|---|---|
| Compter les drafts dans la solvabilité change l'UX : un joueur ne peut plus "explorer" plein de drafts en même temps | Élevée | Choix produit. Soit on compte les drafts (rigueur), soit on ne les compte pas (UX exploratoire). Selon CLAUDE.md le draft n'est pas validé donc l'UX actuelle laisse le joueur explorer ; mais la solvabilité doit être validée à la conversion en `auction_bid`. → **Compromis : ne pas compter drafts ici, mais compter cross-rounds active_bids.** |
| Une bid mise à jour se retrouve sommée deux fois | Moyenne | Le filter `existingBid?.id` doit être appliqué. Tester avec mock vitest avant déploiement. |
| Race condition persiste (deux requêtes concurrentes peuvent encore passer indépendamment) | Élevée | C'est le sujet de #10 (RPC SECURITY DEFINER). Le cross-round fix résout l'erreur de logique, pas la race. **Les deux fixes sont complémentaires, pas substituables.** |

**Recommandation finale** : compter cross-rounds active bids (rigueur) + ne pas compter drafts (UX). Documenter ce choix.

## Niveau de confiance : **HIGH**

Lu directement les lignes 95-110. Le bug est mécanique et reproductible.

---

# #4 — `apps/web/middleware.ts` n'existe pas

## Le problème

Next.js exécute un middleware uniquement s'il existe à `apps/web/middleware.ts` (ou `src/middleware.ts`). Le projet a `lib/supabase/middleware.ts` qui exporte `updateSession()` pour rafraîchir les cookies Supabase, mais **rien ne l'appelle**. Conséquence : les cookies Supabase ne sont jamais rafraîchis sur navigation, et la défense d'auth est uniquement page-par-page.

## Preuve

Vérifié : `ls apps/web/middleware.ts` retourne "No such file or directory". `lib/supabase/middleware.ts:4` exporte `updateSession` qui n'est importé nulle part dans `apps/web/`.

## Risque concret dans le jeu

Trois symptômes possibles :
1. **Sessions qui expirent inopinément** : sans refresh, le JWT expire après 1h (default Supabase). L'utilisateur se retrouve déconnecté en plein milieu d'une enchère.
2. **Routes oubliées non protégées** : si à l'avenir on ajoute une page `(game)/admin` sans `getUser()` inline, elle est ouverte à tous. La défense en couches manque.
3. **Cookies stale** : un changement de session côté serveur (ex. user refresh de role) n'est pas propagé.

Aucun bug observable maintenant **parce que** chaque page fait `getUser()` inline. Mais c'est fragile.

## Solution proposée

Créer `apps/web/middleware.ts` (lecture du code de `lib/supabase/middleware.ts` confirme la signature) :

```ts
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/webhook).*)",
  ],
};
```

## Risques de la solution

| Risque | Probabilité | Mitigation |
|---|---|---|
| Le middleware ralentit chaque request (overhead Supabase auth refresh) | Faible | C'est l'overhead standard d'auth refresh, ~50-100ms. Acceptable. |
| Le matcher exclut un chemin important par erreur | Faible | Utiliser le matcher ci-dessus qui exclut explicitement `_next`, images, et webhooks. |
| Public paths du `lib/supabase/middleware.ts:33-42` redirigent un user authentifié déjà loggé vers `/league/choose` alors qu'il est sur `/login` | Possible | Lire le fichier, valider la liste des public paths. Si elle inclut `/login`, attention aux loops. |

**Risque principal** : pas de risque de cassure majeur. Le middleware se limite à refresh la session — il ne change pas le comportement actuel des pages, il ajoute juste une couche de robustesse.

## Niveau de confiance : **HIGH**

Vérifié manuellement que le fichier n'existe pas. Le code à ajouter est documenté dans `lib/supabase/middleware.ts` (j'ai vu la signature dans l'audit).

---

# #5 — `auction.py run_payday` ↔ `confirmPhaseSetup` TS (double source de vérité)

## Le problème

CLAUDE.md déclare "Pipeline D SUPPRIMÉ — remplacé par confirmPhaseSetup server action (in-app)". C'est faux : le code Python `auction.py:290 def run_payday()` existe toujours et est appelable via FastAPI `main.py:92 /jobs/resolve-auction`. Si jamais ce endpoint est appelé, le payday est exécuté **deux fois** (Python + TS) ou **dans la mauvaise stack**.

## Preuve

Vérifié moi-même :
- `services/pcs-sync/auction.py:290` → `def run_payday(supabase, league_id) -> dict`
- `apps/web/app/(game)/league/[leagueId]/auction/market/actions.ts:89` → `export async function confirmPhaseSetup(teamId)`
- `services/pcs-sync/main.py:15` → `from auction import resolve_current_round`

Les deux exécutent essentiellement la même opération financière (collecte sponsor income, déduction salaires, log treasury_log).

## Risque concret dans le jeu

Trois scénarios :
1. **Si quelqu'un appelle `/jobs/resolve-auction` aujourd'hui** : Python `resolve_current_round` chaîne sur `run_payday` → double paiement (la TS l'a déjà fait au confirm phase) → trésorerie ne reflète plus la réalité.
2. **Si un dev modifie la logique payday TS sans toucher Python** : drift silencieux qui se manifeste comme un bug économique en prod.
3. **Si le Python est rétabli (Railway, cron)** : les deux tournent en parallèle.

Note : le service Python est **déjà cassé à l'import** (#6) donc le scénario 1 ne peut pas arriver tant que main.py n'est pas réparé. Mais la dette est là.

## Solution proposée

Vu que CLAUDE.md a déjà tranché pour la version TS, **supprimer la version Python** :
1. Supprimer `services/pcs-sync/auction.py:290 run_payday()` (la fonction)
2. Supprimer dans `main.py` la route `/jobs/resolve-auction` et l'import `resolve_current_round`
3. Supprimer `services/pcs-sync/run_auction_resolve.py`
4. Supprimer `services/pcs-sync/resolve_now.py`
5. Décider du sort de `auction.py:resolve_current_round` (résolution d'enchères 3 rounds) — selon CLAUDE.md ça fait partie du flow, mais aucun cron Python ne tourne actuellement, donc inutilisé. Probablement à supprimer aussi.

## Risques de la solution

| Risque | Probabilité | Mitigation |
|---|---|---|
| `resolve_current_round` est en fait nécessaire pour la résolution d'enchères et je supprime un truc utile | **Élevée** | À vérifier : d'où viennent les `auctions.status='resolved'` ? Si c'est uniquement Python, on doit migrer le flow vers TS avant de supprimer. |
| Tests Python `test_auction.py` deviennent obsolètes | Faible | Acceptable, on les supprime aussi. |
| Le code Python est en fait référencé par un cron Railway que CLAUDE.md ignore | Moyenne | Vérifier `services/pcs-sync/Dockerfile` et la config Railway. |

**Risque principal** : `resolve_current_round` est le seul code qui résout les enchères 3 rounds (selon ce qu'on a vu). Si je le supprime sans migration TS, on n'a plus de résolution d'enchères. **À ne PAS supprimer aveuglément**. D'abord auditer : qui appelle `resolve_current_round` aujourd'hui ?

→ Avant fix, **vérifier** comment se résout une enchère en pratique. Si la résolution est manuelle / commissioner, OK pour supprimer. Si elle est censée être automatique mais le code Python est mort, alors on a un autre bug (les enchères ne se résolvent jamais).

## Niveau de confiance : **MEDIUM**

`run_payday` confirmé doublon. Mais le périmètre exact à supprimer (`resolve_current_round` ou pas ?) demande une investigation supplémentaire avant fix.

---

# #6 — Service FastAPI Python cassé à l'import

## Le problème

`services/pcs-sync/main.py:13 from sync import sync_all_riders` → cette fonction n'existe pas. Le module `sync.py` exporte `sync_top500`, pas `sync_all_riders`. Donc importer `main.py` raise `ImportError` immédiatement → le service ne démarre pas.

## Preuve

Vérifié :
- `services/pcs-sync/main.py:13` → `from sync import sync_all_riders`
- `services/pcs-sync/sync.py:83` → "This replaces sync_all_riders() — the game pool is the top 600 PCS global"
- `grep "def sync_all_riders" services/pcs-sync/sync.py` → 0 résultat (la fonction n'existe pas)
- `services/pcs-sync/run_daily_pipeline.py:23` même problème + 2 autres imports cassés (`sync_race_results`, `purge_old_history`)

## Risque concret dans le jeu

**Aujourd'hui** : aucun. Le service FastAPI ne tourne pas, personne ne l'appelle.

**Demain** : si quelqu'un veut exposer une route Python pour, par exemple, déclencher `sync_top500` depuis un cron ou une UI admin, le déploiement Railway plante immédiatement et il y a 2-3 jours de debug pour comprendre.

C'est de la dette d'infra, pas un bug actif.

## Solution proposée

Trois options selon le futur du service :

**Option A — Supprimer le service FastAPI (recommandé si pas d'usage prévu)** :
1. `rm services/pcs-sync/main.py`
2. `rm services/pcs-sync/run_daily_pipeline.py`
3. `rm services/pcs-sync/Dockerfile` (si pas utilisé pour autre chose)
4. Vérifier si Railway a une config qui pointe dessus → désactiver

**Option B — Réparer les imports** :
1. `main.py:13` → `from sync import sync_top500 as sync_all_riders` (alias) ou refactor les call sites
2. `run_daily_pipeline.py:23` → idem + supprimer les 2 imports inexistants (`sync_race_results`, `purge_old_history` qui n'ont jamais existé)

**Option C — Garder le squelette mais marqué deprecated** : `raise NotImplementedError` dans les routes, supprimer les imports cassés.

## Risques de la solution

| Risque | Probabilité | Mitigation |
|---|---|---|
| Suppression A : un jour on regrette d'avoir supprimé une infra | Faible | C'est dans Git, on peut restaurer. |
| Réparation B : on remet en circuit du code qui n'a pas été testé depuis longtemps | Moyenne | Ne réparer que si on a un usage immédiat prévu. Sinon supprimer. |
| Le Dockerfile est référencé par autre chose que je n'ai pas vu | Faible | Faire un `grep -r "Dockerfile" .` avant suppression. |

**Recommandation** : Option A (supprimer). CLAUDE.md dit que les pipelines tournent "en local uniquement" via CLI `run_pipeline.py`. Le service FastAPI n'a pas de raison d'exister. À confirmer.

## Niveau de confiance : **HIGH**

Imports cassés vérifiés directement. La décision (supprimer vs réparer) est un choix produit, pas technique.

---

# #7 — `leagues.invite_code` lisible par tous les users authentifiés

## Le problème

La policy RLS sur `leagues` autorise tout user authentifié à `SELECT * FROM leagues`. Le commentaire dit "the invite_code acts as the access barrier" — mais dès que tu peux lire la colonne `invite_code`, ce n'est plus une barrière.

## Preuve

`supabase/migrations/20260222120000_leagues_select_authenticated.sql:4-6` (lu moi-même) :

```sql
create policy "leagues_select_authenticated" on public.leagues
  for select using (auth.uid() is not null);
```

Avec son anon JWT, n'importe quel user peut faire :
```js
const { data } = await supabase.from("leagues").select("id, name, invite_code");
// → liste de toutes les ligues + leurs codes invite
```

## Risque concret dans le jeu

- Un joueur curieux scrape tous les codes invite et peut rejoindre n'importe quelle ligue privée
- Quelqu'un de malveillant peut spammer joins → faire dépasser `max_players` si pas de check
- Atteinte à la confidentialité : "ligue privée entre amis" devient publique de facto

C'est un vrai trou. Pas dramatique au sens "casse le jeu", mais incompatible avec la promesse "ligue privée".

## Solution proposée

**Option recommandée — VIEW avec column whitelist** :

```sql
-- Migration
create or replace view public.leagues_public as
  select id, name, status, max_players, season_year, commissioner_id, created_at
  from public.leagues;

-- Restreindre la SELECT directe à commissioner + members
drop policy "leagues_select_authenticated" on public.leagues;

create policy "leagues_select_member_or_commissioner" on public.leagues
  for select using (
    auth.uid() = commissioner_id
    OR auth.uid() in (select user_id from public.league_members where league_id = leagues.id)
  );

grant select on public.leagues_public to authenticated;
```

Ensuite côté app : tous les `from("leagues").select(...)` qui ne nécessitent pas `invite_code` passent à `leagues_public`. Seul le `join` flow et les pages commissioner gardent l'accès direct.

## Risques de la solution

| Risque | Probabilité | Mitigation |
|---|---|---|
| Casse la page `(auth)/league/join` qui doit pouvoir lookup une ligue par invite_code | **Élevée** | Le flow join est : "user entre code → on cherche la league par code → on l'ajoute". Avec la nouvelle policy, le lookup `from("leagues").select().eq("invite_code", code)` retourne 0 ligne pour un non-membre. → **Solution** : créer une RPC SECURITY DEFINER `join_league_by_code(code)` qui fait le lookup + insert atomique. |
| Casse `(auth)/league/choose` si elle liste toutes les ligues du user | Moyenne | Vérifier ce que liste cette page ; passer à `leagues_public` ou filter via membership. |
| Migration sur prod avec des users connectés casse temporairement leur affichage | Faible | Déployer à un moment creux. |

**Risque principal** : il faut **migrer le flow de join en RPC** avant de poser cette policy, sinon on casse la page join.

## Niveau de confiance : **HIGH**

Policy lue directement. La solution demande un peu de refactor mais c'est mécanique.

---

# #8 — Tests manquants sur logique économique critique

## Le problème

`validateRound` (357 lignes, l'invariant économique central qui convertit drafts en bids) a **0 test**. `lib/budget.ts:computeAvailableBudget` (LE point unique de vérité pour "puis-je payer ce draft ?") a **0 test**. `lib/strategies.ts` (cap maxActive, level gates) a **0 test**.

## Preuve

Trouvé par l'agent 5 :
- `find apps/web -name "*.test.ts" -not -path "*/node_modules/*"` → 8 fichiers test
- Sur ces 8, les fichiers couverts sont : `auction/[auctionId]/actions`, `auction/market/actions`, `team/gt/actions`, `rider/[riderId]/actions`, plus 4 lib (`format`, `co-unlock`, `levels-sync-check`, `audit`)
- Pas de fichier `auction/actions.test.ts`, ni `budget.test.ts`, ni `strategies.test.ts`, ni `phases.test.ts`

J'ai vu moi-même `apps/web/app/(game)/league/[leagueId]/auction/actions.ts` faire 357 lignes — c'est le fichier le plus gros du projet pour les server actions.

## Risque concret dans le jeu

À chaque modification de la logique économique :
- Pas de filet de sécurité
- Régression silencieuse possible (ex: une condition `>=` changée en `>` qui laisse passer 1 EUR de trop)
- Impossible de refactorer ces fichiers en confiance (ce qui bloque le chantier #10 RPC)

Le risque ne se matérialise que **lors de modifications futures**. Pas de bug actif. Mais comme le projet est en pleine évolution (Anti-Runaway, GT mode, sponsors rework), c'est un risque récurrent.

## Solution proposée

Ajouter, par ordre de priorité :

1. **`lib/budget.test.ts`** — couvre `computeAvailableBudget` :
   - phase confirmée vs non confirmée
   - draft = 0 → remaining = treasury - salaries
   - draft excède budget → remaining < 0
   - sponsor income ajouté correctement
   - cas limites (treasury négative, draft négatif si possible)

2. **`auction/actions.test.ts`** — couvre `validateRound` :
   - Happy path : drafts cohérents, treasury suffisante, slots OK → bids créés
   - Budget dépassement → erreur, pas de bid créé, pas de cancel
   - Slot dépassement → erreur, pas de bid créé
   - Re-validation : annule les bids précédents puis insert (pattern observé L322 selon agent)
   - Auth manquante / team pas owner → erreur

3. **`team/strategies.test.ts`** — couvre `saveStrategies` :
   - maxActive cap respecté selon level
   - Strategy sous level débloqué → erreur
   - Mode immediate vs pending selon round 1

4. **`lib/phases.test.ts`** — couvre `getCurrentPhase` :
   - Boundary math (le `nextPhase.startDay - 1, 23:59:59` selon l'agent)
   - Cas trans-année (Vuelta → Season Start)

Effort estimé : 1-2 jours pour un dev qui connaît le projet. ROI très élevé.

## Risques de la solution

| Risque | Probabilité | Mitigation |
|---|---|---|
| Tests trop rigides (testent l'implémentation, pas le comportement) | Moyenne | Mocker au niveau Supabase chain, pas au niveau fonction interne. Déjà le pattern dans les tests existants. |
| Tests font baisser la vélocité de refactor | Faible | C'est l'inverse : ils permettent de refactorer avec confiance. |
| Un test révèle un bug existant | **Élevée et c'est tant mieux** | C'est le but. À gérer un par un. |

**Aucun risque de casser la prod** — ajouter des tests est strictement additif.

## Niveau de confiance : **HIGH**

Comptage des fichiers test fait directement (8 fichiers test web, lu la liste). L'identification des manques est mécanique.

---

# #9 — Pas de génération de types Supabase

## Le problème

Le code TypeScript écrit ses propres types pour les retours Supabase via 81 casts inline (`as { data: ... }`, `Array.isArray ? [0] : ...`). Aucun type n'est généré depuis le schéma DB. À chaque rename de colonne ou ajout de table, le compilo n'attrape rien — les bugs se découvrent au runtime.

## Preuve

J'ai compté : `grep -rn "Array.isArray" apps/web/{app,components,lib}` → **50 occurrences**. `grep -rEn "as \{ [a-z_]+:" apps/web/{app,components,lib}` → **31 occurrences**. Total **81 casts inline** (l'agent disait 89, fourchette correcte).

Les cas typiques :
```ts
// Pattern 1: cast inline
const sponsorIncome = (sp as { monthly_budget: number }).monthly_budget ?? 0;

// Pattern 2: Array unwrap pour join one-to-one
const team = Array.isArray(member.teams) ? member.teams[0] : member.teams;
```

## Risque concret dans le jeu

- **Renommage silencieux** : si on rename `monthly_budget` → `monthly_income` dans la DB, les 5+ sites qui font `(sp as { monthly_budget: number })` continuent à compiler mais runtime undefined.
- **Drift** : la migration `20260402200000_rename_ever_in_top500_to_ever_in_pool.sql` a renommé une colonne. Sans types générés, on a dû `grep` à la main pour trouver tous les usages.
- **DX dégradée** : pas d'autocomplete sur les colonnes, pas d'erreur de compilation sur les typos.

Pas un bug actif, mais un multiplicateur de risque sur tous les autres chantiers.

## Solution proposée

```bash
# Une fois
pnpm add -D supabase@latest -w
supabase gen types typescript --project-id uuvshpykvpnhpeondqjt > apps/web/lib/database.types.ts

# Mettre à jour les clients
# apps/web/lib/supabase/server.ts
import type { Database } from "@/lib/database.types";
return createServerClient<Database>(...)

# apps/web/lib/supabase/browser.ts
return createBrowserClient<Database>(...)
```

Ensuite les retours sont typés automatiquement. Les `as { ... }` peuvent disparaître.

Add `"db:types": "supabase gen types typescript --project-id uuvshpykvpnhpeondqjt > apps/web/lib/database.types.ts"` au `package.json` pour la régénération.

## Risques de la solution

| Risque | Probabilité | Mitigation |
|---|---|---|
| La génération révèle des typages incohérents (ex. on lisait `team.user_id` quand la colonne est nullable) → erreurs TS partout d'un coup | **Élevée** | Tackle progressif. Soit on commit le fichier types et on fix au fur et à mesure ; soit on fait un gros sprint dédié. |
| Le `Array.isArray` unwrap pour les joins one-to-one ne disparaît pas automatiquement (Supabase JS retourne array même pour FK simples) | Élevée | Les types générés explicitent `Array<T>` pour les joins. Le unwrap reste nécessaire mais devient typesafe. Possibly use `.maybeSingle()` ou helper `unwrapJoin<T>(x: T | T[])` typé. |
| Le fichier `database.types.ts` est gros (peut-être 1000+ lignes) et pollue le git diff | Faible | Acceptable. C'est un build artifact mais qu'on commit pour la DX. |
| Les types générés exposent des colonnes service_role-only en `public` | Moyenne | Le générateur ne génère que ce qui est sous `public` schema. À vérifier. |

**Risque principal** : la première génération va probablement faire crasher le typecheck sur des dizaines de lignes. À planifier comme un sprint dédié, pas un fix d'un soir.

## Niveau de confiance : **HIGH**

Casts comptés directement. La solution est documentée par Supabase, pas inventée.

---

# #10 — Migration des mutations financières en RPC Postgres

## Le problème

Les fonctions critiques (`placeBid`, `validateRound`, `releaseRider`, `confirmPhaseSetup`, `leaveLeague`) font des séquences SELECT + INSERT/UPDATE en JavaScript. Entre les SELECT et les writes, la DB peut bouger (autre user, autre requête). Pas de transaction → race conditions, pas de rollback en cas d'échec partiel.

## Preuve

Pour `placeBid` (`auction/[auctionId]/actions.ts:85-167`, lu moi-même) :
- L40 SELECT auction
- L60 SELECT existing draft to upsert from
- L75 SELECT rider for level/rank check
- L85 SELECT contracts (current salaries)
- L95 SELECT active bids same round
- L114 fetchLeagueTeamLevels
- L139 SELECT contract count for slot check
- L154 INSERT auction_bid

8 round-trips. Aucune transaction. Si entre L95 et L154, un autre user place un bid concurrent, les deux passent indépendamment.

Pareil pour `validateRound` (357 L), `confirmPhaseSetup`, `leaveLeague` (5 deletes séquentiels selon l'agent 1).

## Risque concret dans le jeu

- **Double-spend trésorerie** : deux bids concurrents passent, total > treasury
- **`leaveLeague` partiel** : si l'un des 5 deletes plante (RLS, contrainte FK), la team est dans un état incohérent (bids cancelled mais team encore présente, ou inverse)
- **Slot overflow** : 2 bids simultanés sur le 12e slot, les deux passent

L'agent 1 a noté ce risque comme critical. Vérifié plausible par lecture du code.

## Solution proposée

Migrer chaque flow critique en RPC Postgres `SECURITY DEFINER`. Exemple `place_bid` :

```sql
CREATE OR REPLACE FUNCTION public.place_bid(
  p_auction_id uuid,
  p_rider_id uuid,
  p_amount int,
  p_round int
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_team teams%ROWTYPE;
  v_total_commitments int;
BEGIN
  -- Lock team row
  SELECT * INTO v_team FROM teams
   WHERE user_id = v_user_id AND league_id = (SELECT league_id FROM auctions WHERE id = p_auction_id)
   FOR UPDATE;

  IF v_team IS NULL THEN RETURN jsonb_build_object('error', 'No team'); END IF;

  -- Solvency check (cross-rounds)
  SELECT COALESCE(SUM(amount), 0) INTO v_total_commitments
   FROM auction_bids WHERE team_id = v_team.id AND status = 'active';

  IF v_total_commitments + p_amount > v_team.treasury THEN
    RETURN jsonb_build_object('error', 'Insufficient budget');
  END IF;

  -- ... slot check, level gating, co-unlock
  -- INSERT auction_bid
  RETURN jsonb_build_object('ok', true);
END;
$$;
```

Côté TS, l'action devient :
```ts
const { data, error } = await supabase.rpc("place_bid", { ... });
```

3 lignes côté action. Toute la logique critique en SQL, atomique, lock natif via `FOR UPDATE`.

## Risques de la solution

| Risque | Probabilité | Mitigation |
|---|---|---|
| **Réécriture lourde** : ces fonctions font 100-200 lignes chacune en TS, à porter en plpgsql | **Élevée** | Chantier d'1 semaine minimum. Pas un quick win. À planifier. |
| Bug de portage : la RPC n'est pas iso-fonctionnelle | Élevée | Tests Vitest sur le wrapping action + tests SQL `pg_tap` ou snapshot. |
| Debug plus dur (logs Postgres au lieu de logs JS) | Moyenne | Acceptable, c'est le tradeoff. Ajouter `RAISE NOTICE` dans les RPCs en mode dev. |
| Couplage fort entre app et schéma DB (changement de colonne = changement RPC) | Moyenne | C'est déjà le cas. Mais avec RPC c'est concentré dans la DB, pas dispersé en JS. |
| Le RLS ne s'applique plus dans une fonction `SECURITY DEFINER` | **Critique si mal implémenté** | C'est le point sensible : la fonction tourne avec les droits du créateur, pas du caller. **Doit valider explicitement `auth.uid()` au début de chaque RPC.** Ne pas faire confiance au caller. |

**Risque principal** : `SECURITY DEFINER` bypass RLS. Si la RPC oublie le check `auth.uid() = team.user_id`, c'est une faille majeure. Discipline absolue requise dans le code SQL.

**Verdict** : c'est le bon design, mais c'est un gros chantier. Recommandation : **commencer par UNE RPC** (`place_bid`), valider le pattern, puis migrer les autres. Pas tout d'un coup.

## Niveau de confiance : **MEDIUM**

Le pattern est correct (Supabase recommande SECURITY DEFINER pour les invariants critiques). Mais l'effort réel et les pièges (RLS bypass) demandent de la prudence à l'exécution.

---

# #11 — Tokens semantic backgrounds manquants (Rule #1 incompatible avec UI réelle)

## Le problème

Le design system v3 dit "couleurs sémantiques sur texte + icône uniquement, pas de background coloré". Mais le code a 25+ occurrences de `bg-emerald-500/10`, `bg-red-500/30`, `border-amber-500/X` parce que les UIs réelles (banners deficit, error toasts, success states) **ont besoin** de backgrounds colorés. La règle DS est en pratique inappliquable sans tokens dédiés.

## Preuve

L'agent 3 a remonté ~25 occurrences. Échantillon vérifié :
- `auctions-client.tsx` (lignes 306, 331, 388, 397, 447) — banners erreur/succès
- `budget-summary.tsx` — deficit messaging
- `pill.tsx` (lignes 15, 17), `ui/badge.tsx` (lignes 17, 19) — `success`/`warning` Tag variants

Et `globals.css` ne définit que `--success`, `--danger`, `--warning` (couleurs pleines), pas leurs variantes background.

## Risque concret dans le jeu

- Pas de bug fonctionnel
- Mais : 25 sites où la sémantique est hardcodée → si on change la couleur success (ex. `#10b981` → `#22c55e`), 25 fichiers à modifier au lieu de 1
- Cohérence visuelle : 3 opacités différentes sur les fonds rouge dans le code
- CLAUDE.md Rule #1 violée → confusion sur ce qui est contractuel

## Solution proposée

Ajouter dans `globals.css` :

```css
:root {
  /* ... existing tokens ... */

  /* Semantic backgrounds (10% opacity) */
  --success-bg: rgba(16, 185, 129, 0.10);
  --danger-bg:  rgba(239, 68, 68, 0.10);
  --warning-bg: rgba(245, 158, 11, 0.10);

  /* Semantic borders (30% opacity) */
  --success-border: rgba(16, 185, 129, 0.30);
  --danger-border:  rgba(239, 68, 68, 0.30);
  --warning-border: rgba(245, 158, 11, 0.30);

  /* Modal scrim & overlay surface */
  --scrim: rgba(0, 0, 0, 0.50);
  --surface-overlay: rgba(255, 255, 255, 0.05);
}
```

Puis migration mécanique sur les ~25 sites :
- `bg-emerald-500/10` → `bg-[var(--success-bg)]`
- `bg-red-500/10` → `bg-[var(--danger-bg)]`
- `bg-black/50` → `bg-[var(--scrim)]`

Mettre à jour `docs/watthunter-design-system-v3.md` pour documenter les tokens et clarifier la Rule #1 ("backgrounds sémantiques OK via les tokens dédiés").

## Risques de la solution

| Risque | Probabilité | Mitigation |
|---|---|---|
| Les opacités choisies ne match pas exactement l'existant (10/30 vs 8/30 actuels) | Moyenne | Faire un tour visuel après migration ; ajuster si besoin. |
| Migration manque un site | Faible | Grep automatisable. |
| Confusion entre `bg-[var(--success)]` (couleur pleine, mauvais usage) et `bg-[var(--success-bg)]` (overlay, bon usage) | Moyenne | Documenter clairement dans la DS. |

**Aucun risque fonctionnel** — c'est purement cosmétique/structurel.

## Niveau de confiance : **HIGH**

Identifié et localisé par l'agent. Migration mécanique. La seule incertitude est le choix exact des opacités (à valider visuellement).

---

# #12 — `rail-pages/*` réimplémente les server pages côté client

## Le problème

Les composants `apps/web/components/rail-pages/rider-detail-rail.tsx` (360 lignes), `strategies-rail.tsx`, `levels-rail.tsx` refont **côté client** (avec l'anon key Supabase) le travail des server pages correspondantes (`rider/[riderId]/page.tsx`, `team/strategies/page.tsx`, etc.). Deux implémentations de la même logique → drift garanti.

## Preuve

Lecture directe de `rider-detail-rail.tsx:49-321` (déjà cité par l'agent 2) : 270 lignes de queries Supabase dans un `useEffect`, imports dynamiques inline (`await import("@/lib/phases")` L219), pas d'abort propre. La page server fait pcsPoints, currentRound, ownerDisplayName ; la rail ne calcule **pas** ces champs → bug visible selon le chemin d'entrée.

## Risque concret dans le jeu

- Bug actuel : opening rider via la rail → champs vides ou incorrects (rank/xp_gained/team_id à null là où la page les a)
- Drift à chaque modif de la page server (oubli de modifier la rail)
- Bundle JS plus gros (2× la logique de fetch)
- Aucun bénéfice de SSR sur la rail (pas de SEO non plus mais)

## Solution proposée

**Option A — Parallel routes Next.js (recommandé)** :

Au lieu de :
```
app/(game)/league/[leagueId]/
  rider/[riderId]/page.tsx
components/rail-pages/rider-detail-rail.tsx (client, dup)
```

Refactorer en :
```
app/(game)/league/[leagueId]/
  layout.tsx           ← affiche {children} et {@rail}
  page.tsx
  rider/[riderId]/page.tsx
  @rail/
    default.tsx        ← null (rail vide par défaut)
    rider/[riderId]/page.tsx  ← même contenu que la page principale, version compacte
```

Le contenu est rendu côté serveur, partagé entre les deux slots. Le rail ouvert affiche le contenu rail ; navigation full screen affiche la page complète.

**Option B — Intercepting routes** : `(.)rider/[riderId]` intercepte la nav vers le rail mais c'est plus complexe.

**Option C — Refactor a minima** : extraire la logique de fetch dans `lib/queries/rider-detail.ts` partagée entre la page et la rail. La rail reste client mais consomme la même fonction. Quick fix mais ne résout pas la duplication.

## Risques de la solution

| Risque | Probabilité | Mitigation |
|---|---|---|
| **Refactor lourd** : ~600 lignes à toucher, plusieurs entry points | **Élevée** | Effort 3-5 jours minimum. |
| Parallel routes Next.js sont peu connues, comportement subtil | Moyenne | Lire la doc Next 16, tester en isolation d'abord. |
| Impact UX : transitions rail/page peuvent changer | Moyenne | Valider avec toi avant déploiement (tu es designer, tu sentiras la différence). |
| Performance : SSR sur chaque ouverture de rail (au lieu de fetch client) | Faible | C'est positif, pas un risque. |
| Animation/state du drawer rail à préserver | Moyenne | DetailRail garde son state UI (open/close) mais le contenu vient du slot. |

**Risque principal** : c'est **le plus gros chantier des 12**. Faisable, mais à découper. Si l'objectif est l'alpha, l'option C (extraction `lib/queries`) est plus pragmatique pour gagner du temps.

## Niveau de confiance : **MEDIUM-LOW**

Le diagnostic est solide (duplication réelle, bug de data shape réel). La solution est conceptuelle — Parallel routes Next.js demande de la pratique. Recommandation : ne **pas** attaquer ça avant l'alpha, le mettre en backlog post-Giro.

---

# Recommandation finale d'ordre d'exécution

Avant de te lancer dans les 12, voici l'ordre que je recommande pour minimiser les risques de cassure :

### Phase 1 — Quick wins isolés (1-2 jours, aucune dépendance)
1. **#4 middleware.ts** — additif, pas de risque
2. **#6 Décision FastAPI** : trancher option A (suppr) ou C (deprecated)
3. **#11 Tokens DS + migration mécanique** — additif visuel
4. Tous les quick wins listés dans le rapport principal (sponsor-bonus-card, gradient, zod/v4, etc.)

### Phase 2 — Sécurité critique (3-5 jours, ordre important)
5. **#3 Solvabilité cross-rounds** — bug fonctionnel à corriger en TS d'abord
6. **#7 invite_code caché** — nécessite RPC join_league_by_code
7. **#5 Trancher Python run_payday** — investigation puis suppression

### Phase 3 — Tests pour sécuriser le chantier suivant (2-3 jours)
8. **#8 Tests sur validateRound, budget, strategies** — préparer le filet pour #10

### Phase 4 — Architecture profonde (1-2 semaines)
9. **#10 Migration RPC SECURITY DEFINER** (commencer par `place_bid` puis itérer)
10. **#1 Trigger teams_protect_sensitive_fields** ← seulement APRÈS #10, sinon casse les writes treasury
11. **#9 Types Supabase générés** ← idéalement avant #10 pour fiabiliser le port

### Phase 5 — XP drift (avant Giro 2026-05-08, ordre dépendant des autres)
12. **#2 Migration XP stretched curve** — peut être fait dès Phase 1 si la base est encore peu peuplée. **Vérifier d'abord** combien de teams sont dans la zone de rétrogradation.

### Phase 6 — Backlog post-alpha
13. **#12 rail-pages refactor** — gros chantier sans urgence

---

# Synthèse confiance

| # | Problème | Confiance | Risque solution | Effort |
|---|---|---|---|---|
| 1 | teams_update_own | HIGH | **Élevé** (casse #10 si fait avant) | M |
| 2 | XP drift | HIGH | Moyen (vérif en DB d'abord) | S |
| 3 | Cross-round solvency | HIGH | Faible | M |
| 4 | middleware.ts | HIGH | Faible | S |
| 5 | run_payday Python | MEDIUM | Moyen (vérif d'abord) | S |
| 6 | FastAPI cassé | HIGH | Faible | S |
| 7 | invite_code | HIGH | Moyen (RPC à faire) | M |
| 8 | Tests économiques | HIGH | Aucun | M |
| 9 | Types Supabase | HIGH | Élevé (révèle bugs cachés) | M |
| 10 | RPC SECURITY DEFINER | MEDIUM | Élevé (gros chantier, pièges RLS) | L |
| 11 | Tokens DS | HIGH | Aucun | S |
| 12 | rail-pages | MEDIUM-LOW | Élevé (gros refactor) | L |

---

# Ce que je ne sais pas (et que tu devrais valider)

1. **Combien de teams sont dans la zone de rétrogradation XP** (#2) ? Query `SELECT count(*), level FROM teams GROUP BY level` à faire avant migration.
2. **Le service FastAPI Python a-t-il un usage prévu** (#5, #6) ? Si oui : option B. Si non : option A.
3. **Quelqu'un appelle-t-il aujourd'hui `resolve_current_round` Python pour résoudre les enchères** (#5) ? Si oui, on a un autre bug à creuser.
4. **L'UX rail vs page complète** (#12) — est-ce qu'on garde la rail ou on simplifie vers full-page sur mobile + split panel sur desktop ?

Pour les autres, j'ai assez d'evidence pour avancer.
