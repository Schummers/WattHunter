# Architecture review — candidats de deepening (2026-07-02)

> Revue d'architecture menée le 2026-07-02 via `/improve-codebase-architecture`
> (3 agents d'exploration : apps/web, services/pcs-sync, supabase/migrations).
> Objectif : identifier les refactors qui transforment des modules shallow en
> modules deep (beaucoup de comportement derrière une petite interface), pour
> la testabilité et la navigabilité.
>
> **Rien n'est validé ni planifié.** Ce rapport documente des candidats, pas
> des décisions. Voir le post-scriptum du 2026-09-12 en bas : la décision
> classic-only du 2026-07-04 invalide ou affaiblit une partie des candidats.

Vocabulaire : module (interface + implémentation), seam (où vit l'interface),
deep/shallow (levier à l'interface), locality (changement concentré en un
lieu), leverage (une interface, N appelants).

---

## Candidat 1 — Donner à chaque RPC une définition courante lisible — **Strong**

**Fichiers** : `supabase/migrations/*.sql`.

**Problème.** L'interface du seam DB (ADR-015, mutations = RPCs SECURITY
DEFINER) est saine, mais l'implémentation courante de chaque RPC n'a pas de
domicile. Chaque évolution copie la fonction entière pour changer 3 lignes :

| RPC | Redéfinitions | Note |
|---|---|---|
| `place_bid` | 10 | v9 : « verbatim copy + a classic slot-cap branch » |
| `validate_round` | 7 | |
| `gt_add_to_squad` / `gt_assign_role` | 6 chacune | toujours recréées ensemble |
| `confirm_phase_setup` | 6 | |
| `gt_claim_dnf_refund` | 6 | 3 versions en 24 h (hotfixes) |
| `join_league_by_code` / `place_tactic` | 5 chacune | |

Environ 13 000 lignes SQL dupliquées sur 40+ migrations. Trouver la
définition courante = grep + tri par timestamp.

**Solution.** Schéma déclaratif Supabase : `supabase/schemas/functions/`, un
fichier par fonction. On édite la définition courante, `supabase db diff`
génère la migration. Compatible ADR-015 et Rule #2 (les migrations restent le
seul canal d'application).

**Gains** : locality (une fonction, un fichier, un diff lisible), leverage
(les reviews voient le vrai delta), navigabilité AI, supprime la cause racine
des collisions de version.

---

## Candidat 2 — Approfondir un module « contexte d'équipe » côté web — **Strong**

**Fichiers** : 22+ `page.tsx`/`actions.ts`, `lib/rider-detail-data.ts`,
`lib/budget.ts` (sous-utilisé), `auction/actions.ts` (`getTeamForUser` non
exporté).

**Problème.** Le concept « mon équipe dans cette ligue » n'a pas de module :

- la chaîne `league_members` → `teams` est refaite dans 22 fichiers ;
- le calcul de budget (treasury + sponsor − salaires − draft bids) est
  recopié 7 fois ;
- chaque page duplique son chemin demo à ~90 % (22 forks `DEMO_LEAGUE_ID`) ;
- requêtes brutes hors lib/ : `teams` ×53, `auctions` ×38, `contracts` ×34,
  `league_members` ×22.

**Solution.** Un fetcher deep `lib/supabase/get-team-context.ts` : une
interface, tout l'état d'équipe pré-calculé derrière (team, treasury,
sponsorIncome, activeSalaries, availableBudget, phaseConfirmed,
isCommissioner), qui résout aussi la ligue demo vers la visitor team. Test de
suppression : le supprimer ferait réapparaître la complexité dans 22
appelants, il gagne sa place.

**Gains** : leverage (~50 sites d'appel), locality (le calcul budget change en
un endroit), les forks demo s'effondrent, l'interface devient la surface de
test (un fake au lieu de 22 mocks).

---

## Candidat 3 — Une source unique pour les constantes du jeu — **Strong**

**Fichiers** : salaire (`sync.py` + `lib/format.ts`), phases (`auction.py` +
`lib/phases.ts`), goals sponsors (`goal_evaluator.py` + `lib/gt-goals.ts`, 18
goals en miroir copy-paste), levels (`scoring.py` + `lib/levels.ts`, gardé par
un test post-hoc), co-unlock (`lib/co-unlock.ts` + 9 copies SQL), caps de
slots (23× verbatim dans les migrations).

**Problème.** Six familles de règles vivent en double ou triple exemplaire à
travers le seam TS / Python / SQL, sans mécanisme de synchronisation. La
formule salaire diverge déjà subtilement (`//` Python vs `Math.floor` TS) ;
GAME_RULES §11 déclare une « source unique » qui n'est pas câblée.

**Solution.** Extraire constantes et barèmes dans un module données unique
(JSON versionné à côté de GAME_RULES.md), consommé par des adapters TS et
Python ; pour SQL, des tests de synchronisation (le candidat 1 réduit déjà le
nombre de copies).

**Gains** : locality, supprime la classe de bugs « drift Python/TS » (déjà
vécue), GAME_RULES §11 devient câblé.

---

## Candidat 4 — Faire du mode de ligue un vrai seam — **Worth exploring**

**Fichiers** : 53 usages `isClassic` sur 15+ fichiers TS, `lib/league-mode.ts`,
migrations `20260625000200` + `20260630130000` (RPCs recopiés entiers pour 3
lignes de branche).

**Problème.** Le mode classic a été livré comme 53 branches ponctuelles côté
TS et des copies intégrales de RPCs côté SQL : la définition du mode est
éparpillée.

**Solution.** Étendre `lib/league-mode.ts` en module de règles de mode
(`getModeRules(mode)` → squadSize, phaseBudget, phaseResetRpc, tactics,
navTabs, roles), deux adapters (manager, classic) ; côté SQL une branche sur
des valeurs, pas des copies de fonction.

**Gains** : « ce que classic change » tient dans un fichier ; le prochain
ajustement playtest = 1 diff.

---

## Candidat 5 — Expliciter l'ordre du pipeline post-race — **Worth exploring**

**Fichiers** : `run_pipeline.py:603-709` (`run_post_race`),
`scoring.py:161-193` + `run_pipeline.py:74-91` (`_stage_race_slug_prefixes`
dupliqué à l'identique, ordre d'append divergent).

**Problème.** La contrainte « goals avant bonuses » (règle no-cumul) n'existe
que dans un commentaire (« MUST run BEFORE ») ; `_maybe_import_finals` avale
les exceptions (`except Exception: continue`) ; pas de check d'idempotence en
cas de re-run partiel.

**Solution.** Extraire l'orchestration dans un module pipeline dont
l'interface déclare les étapes (import → score → goals → bonuses) et leurs
prérequis : l'ordre devient vérifié, plus commenté. Fusionner le helper
calendrier dupliqué.

**Gains** : l'invariant no-cumul devient exécutable ; l'ordre du pipeline se
lit et se teste en un endroit.

---

## Candidat 6 — Séparer parse et persist dans sync_race — **Speculative**

**Fichiers** : `sync_race.py` (842 lignes, 6 fonctions `import_*` mêlant fetch
HTML, parsing procyclingstats, lookup riders et upsert).

**Problème.** Le parsing PCS (la partie qui casse quand PCS change son HTML)
ne peut pas se tester offline : il est enchevêtré avec le fetch et l'upsert
(double mock obligatoire).

**Solution.** Un module de parse pur (HTML → rows) testé sur des fixtures HTML
enregistrées ; la persistance reste dans un module mince. Un seul adapter
aujourd'hui (procyclingstats) : seam interne, d'où Speculative.

---

## Top recommandation (au 2026-07-02)

**Candidat 1.** C'est la friction qui taxe toutes les autres : chaque feature
touche un RPC, chaque RPC coûte 300 lignes recopiées et une chasse au
timestamp. Le régler débloque les candidats 3 et 4 sans toucher au
comportement prod ni contredire ADR-015 / Rule #2.

## Annexe — fix ponctuel identifié

`auction.py` (~lignes 96 et 112) : deux fetches en `.execute()` brut au lieu
de `db_utils._fetch_all` → troncature silencieuse possible au cap PostgREST
1000 lignes en multi-ligue. Vérifier aussi `validation.py`.

---

## Post-scriptum 2026-09-12 — impact de la décision classic-only

La décision produit du **2026-07-04** (mode classic unique, mode manager
condamné, refonte post-Tour : jeter budgets / levels / bonus financiers,
passer les sponsors et goals sur une logique XP) change la valeur des
candidats :

- **Candidat 4 : obsolète.** Plus de seam de mode à construire si le manager
  disparaît ; la bonne action est la suppression du mode, pas son abstraction.
- **Candidats 2 et 3 : à réviser.** Le calcul de budget (cœur du candidat 2)
  et les constantes financières (une partie du candidat 3) partent avec la
  refonte. Le principe reste valable (contexte d'équipe unique, constantes
  non dupliquées Python/TS), mais le périmètre est à redessiner après la
  refonte, pas avant.
- **Candidats 1, 5, 6 : toujours valables tels quels.** Définitions courantes
  des RPCs, pipeline post-race explicite et parse/persist du scraper
  survivent à la refonte, et le candidat 1 la rendrait même moins coûteuse
  (supprimer le mode manager = éditer des définitions courantes, pas empiler
  une 11e copie de place_bid).

Référencé depuis le backlog du goal : `second-brain/knowledge/notes/watthunter-backlog.md`.
