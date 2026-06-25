# Classic League Mode — Design Spec

> Date: 2026-06-25
> Statut: design validé, en attente de relecture avant writing-plans
> Auteur: brainstorming Jonathan + Claude

## Context

WattHunter a un seul mode de jeu ("Manager"): économie de rareté complète (enchères,
trésorerie alimentée par sponsors, salaires récurrents, déblocage des coureurs par level,
co-unlock, underdog, policies). Ce mode est riche mais lourd à prendre en main.

On veut un **second mode "Classic"**, plus simple et égalitaire, sans toucher au mode
Manager. Objectif explicite: **minimum de code custom**, un maximum de réutilisation, un
simple `switch` entre deux modes. Le seul invariant partagé entre les deux modes est le
**cumul d'XP + classement GC de ligue**.

Insight clé qui rend ça peu coûteux: le moteur de scoring (`scoring.py`) ne dépend ni de la
trésorerie ni du level. Il ne lit que les coureurs détenus + leurs perfs PCS + la squad GT +
les rôles. Donc le "scoring qu'on veut garder" est déjà découplé des mécaniques qu'on veut
neutraliser.

## Goal / Non-goals

**Goal**: une ligue peut être créée en mode `classic`, où chaque phase de jeu redistribue le
même budget à toutes les équipes, le marché est complet pour tous, on draft 8 coureurs par
phase, on score, l'XP part au cumul, puis tout repart à zéro à la phase suivante.

**Non-goals**:
- Pas de matrice de feature-flags configurables. Deux modes cohérents, point.
- Pas de modification du mode Manager.
- Pas de nouvelle table. Pas de réécriture du lifecycle d'enchère ni du scoring.
- Pas de budget configurable par commissaire (constante fixe).

## Les deux modes

| | Manager (existant) | Classic (nouveau) |
|---|---|---|
| Économie | Trésorerie persistante, sponsors, salaires récurrents | Budget plat **1,5M remis à chaque phase**, pas de salaire récurrent, pas de sponsor |
| Marché | Déblocage progressif par level + co-unlock | **Tout le monde level 8** → marché complet |
| Équilibrage | Level curve, co-unlock, underdog | Aucun (égalité par budget) |
| Roster | Roster ≤12 (contracts) + squad GT 8 + bench | **Couche unique: 8 coureurs = la squad** |
| Tactiques | 5 tactiques | 4 tactiques (**Call the Bus supprimé**, plus de bench) |
| Policies | Oui | Non |
| Persistance inter-phase | Roster + trésorerie persistent | **Seul le cumul XP + GC persiste** |

## Règles du mode Classic (verrouillées)

1. **`leagues.mode`** = `'manager' | 'classic'` (défaut `'manager'`).
2. **4 phases**: Classics (tous les classiques regroupés) → Giro → Tour → Vuelta.
3. **Budget = 1,5M ferme**, remis à zéro au début de chaque phase. Pas de trésorerie qui
   traîne, pas de salaire récurrent. Un bid = coût one-time dans l'enveloppe de la phase.
4. **Toutes les équipes sont level 8** → marché complet, co-unlock toujours satisfait,
   plus de différenciation de niveau (neutralisé par config, pas par code dans `place_bid`).
5. **8 coureurs par phase**, couche unique (la GT squad EST le roster). Caps par rôle
   inchangés (1 GC, 1 sprint, 1 climb, 1 TT, 2 stage hunters, 2 domestiques = 8).
6. **3 rounds par enchère** (inchangé).
7. **Roster figé** pendant une phase: pas de release/rebid une fois la phase lancée.
8. Pas de sponsors, pas de policies, pas d'underdog.
9. **Call the Bus supprimé** (plus de bench). Les 4 autres tactiques restent.
10. Achievements **laissés tels quels** (les Monuments redeviennent débloquables grâce à la
    phase Classics ; ce qui ne se débloque pas reste verrouillé, on s'en fiche).
11. Classement: colonnes Level et Treasury **laissées telles quelles**, elles s'affichent
    vides en classic (pas de retrait de colonne = pas de code custom).

## Approche d'architecture

Principe directeur: **réutiliser le système de phases existant** plutôt que d'inventer un
lifecycle "par course". L'enchère est déjà conçue par phase (`lib/phases.ts`), chaque
transition de phase déclenche déjà un "payday" (`confirm_phase_setup`). En classic on:

- pointe la ligue vers une **liste de phases plus courte** (les 4 phases classic),
- remplace le corps du payday par un **reset budget + vidage squad** au lieu de
  "income sponsor − salaires".

Tout le reste (création d'enchère, rounds, `place_bid`, scoring, rôles, tactiques) est
réutilisé tel quel et conditionné par `mode` à quelques points de branchement.

### Couche unique (Option A) et pont enchère → squad

La "Race Team" (`gt_squad`) est déjà une couche unique de 8 coureurs avec rôles et caps.
On ne scinde rien: en classic, la squad EST le roster.

- L'enchère crée des **contracts** (mécanisme inchangé).
- Pour les 3 phases GT (Giro/Tour/Vuelta): construction de squad **manuelle**, exactement
  comme en mode manager GT. Le joueur ajoute ses coureurs détenus à la Race Team via le
  rider picker et assigne les rôles → le scoring applique rôles + tactiques. Comme les 8
  contrats correspondent exactement aux 8 slots de rôles, la seule décision qui reste est
  l'assignation des rôles (gameplay). **Décision (2026-06-25): pas de pont auto-rempli**
  (Option A), zéro code neuf, cohérent avec le manager.
- Pour la phase **Classics** (courses d'un jour): le scoring lit directement les contracts
  (chemin non-GT, points PCS bruts, pas de rôles ni tactiques).

Auto-remplissage de la squad (insérer les 8 contrats dans `gt_squad` à la résolution
d'enchère) = enhancement possible plus tard si le clic manuel gêne ; non retenu en v1.

### Modèle de budget

`teams.treasury` existe déjà. En classic, au lancement de chaque phase, le payday classic
fait `treasury = 1_500_000` pour toutes les équipes et **archive/release les contracts de la
phase précédente** (la nouvelle enchère démarre sur une squad vide, budget plein). La
solvabilité de `place_bid` (somme des bids ≤ treasury) fonctionne alors inchangée.

Calibrage (salaires réels prod, plancher d'enchère = `monthly_salary`):
Pogačar 795k, Vingegaard 484k, Evenepoel 447k, rang 10 ~253k, rang 50 ~137k, rang 600 ~14k.
Somme top 8 = 3,38M. À **1,5M pour 8 coureurs** (moyenne 187k ≈ rang 30), on peut s'offrir
~1 superstar + 7 ouvriers, ou une équipe homogène rang ~30. Une équipe all-stars est hors
de portée → tension d'enchère voulue.

## Impact backend (RPC / SQL)

Contenu à ~4 fonctions, **zéro nouvelle table**.

- **Migration**: ajout `leagues.mode` (enum/text + CHECK, défaut `'manager'`).
- **`confirm_phase_setup`** (payday): branche `mode = 'classic'` → reset treasury 1,5M +
  archive contracts/squad de la phase précédente, skip income sponsor + déduction salaire.
  C'est le morceau principal.
- **`place_bid`**: marche en level 8 tel quel (pool complet, co-unlock satisfait). Ajout:
  cap à 8 slots en classic (au lieu de 12).
- **`createLeague` / `join_league_by_code`**: branche classic → level 8, treasury 1,5M,
  pas d'assignation de sponsor, `underdog_eligible = false`.
- **Pont** résolution d'enchère → insertion dans `gt_squad` (rôle non assigné) pour les
  phases GT.
- Réutilisés tels quels: `launch_first_auction`, création d'enchère par phase,
  `gt_add_to_squad`, caps de rôles, `place_tactic`, scoring RPC.

## Impact pipelines (Python `services/pcs-sync`)

Quasi nul.

- **`scoring.py`**: inchangé. En classic la donnée ne remplit ni policies (→ bonus
  stratégie = 0) ni underdog (→ mult = 1) ; ces termes sont neutres sans branche de code.
  Tactiques GT (Nemesis…) fonctionnent.
- **`sponsor_bonus.py`** / **`goal_evaluator.py`**: **non lancés** sur une ligue classic.
  S'ils tournaient, aucun `team_sponsors` → no-op. (Garde de mode optionnelle, 1 ligne.)
- Sync (post-race, startlists, enrich, init-riders): inchangés (données globales).

## Impact données (tables)

- `leagues`: **+ `mode`** (seule modif de schéma). Budget = constante côté code, pas de
  colonne.
- `teams`: aucune nouvelle colonne (réutilise `level`, `treasury`, `underdog_eligible`).
- `contracts`, `auction_bids`, `gt_squad`, `gt_tactic_activations`, `rider_xp_daily`,
  `team_ranking_daily`: **inchangées**.
- `treasury_log`: éventuellement un nouveau type `budget_reset` (optionnel, pour l'audit du
  reset de phase).

## Impact frontend (rendu conditionnel piloté par `mode`)

Concentré sur quelques composants. Idéalement un flag `mode` exposé via un contexte/lecture
unique, lu là où il faut, pour éviter d'éparpiller du custom code.

- **Sub-tabs Team** (`team/layout.tsx`): masquer "My Team" et "Budget", ne garder que
  "Race Team".
- **Race Team** (`team/gt/gt-team-client.tsx`): masquer la section "Sponsors Goals".
- **Auction** (`auction/auctions-client.tsx`, `config-cards.tsx`, `budget-summary.tsx`):
  masquer sponsor + strategies ; remplacer la barre budget par "Budget 1,5M / reste X".
- **Tactiques** (`team-tactics-section.tsx`): masquer la carte Call the Bus.
- **Nav** (`bottom-nav.tsx`, `sidebar.tsx`): masquer l'onglet/sous-item Budget (et My Team).
- **Lobby**: masquer l'onglet "Level & Pool" (tout le monde level 8).
- **Ranking** (`ranking-client.tsx`): inchangé, colonnes Level/Treasury simplement vides.
- **Achievements**: inchangé.

## Ce qu'on garde / neutralise / supprime

| Système | Classic | Mécanisme |
|---|---|---|
| Enchères + 3 rounds | Garde | Inchangé |
| Possession exclusive | Garde | Contrainte unique `contracts` |
| Scoring + cumul XP + GC | Garde | `scoring.py` inchangé |
| Tactiques (4) | Garde | Call the Bus retiré |
| Rôles GT + caps (8) | Garde | `gt_squad` réutilisé |
| Team levels / pool gating / co-unlock | Neutralise | Tout le monde level 8 (config) |
| Underdog | Neutralise | `underdog_eligible = false` |
| Sponsors + bonuses + GT goals | Supprime | Pas d'assignation, pipelines non lancés |
| Policies / strategies | Supprime | Non exposées, bonus = 0 |
| Trésorerie persistante / salaires récurrents | Remplace | Reset 1,5M par phase |
| Call the Bus / bench / roster ≤12 | Supprime | Couche unique de 8 |

## Risques / points de vigilance

- **Pont contracts → gt_squad**: seul code neuf non trivial. Bien gérer l'idempotence
  (re-résolution d'enchère) et le cas "phase Classics" (pas de pont).
- **Phase Classics sans rôles ni tactiques**: la Race Team doit afficher une variante sans
  rôles pour cette phase (les 8 coureurs détenus, scoring brut). À designer dans le plan.
- **Cap 8 en classic vs cap 12 du level 8**: ne pas oublier la branche dans `place_bid`,
  sinon une équipe pourrait acheter 12 coureurs.
- **Reset de phase**: l'archive des contracts précédents doit être propre (statut, pas de
  fuite de cooldown 7j inter-phase puisque le roster repart à zéro).
- **Discipline opérationnelle**: ne pas lancer `sponsor_bonus.py` / `goal_evaluator.py` sur
  les ligues classic.

## Approche de test

- pytest (`services/pcs-sync/tests/`): vérifier que `scoring.py` produit le même XP en
  classic (sans policies/underdog) et que le pont alimente bien `gt_squad`.
- vitest (`apps/web`): rendu conditionnel par `mode` (sub-tabs, auction, tactiques, nav).
- Test e2e bout-en-bout d'une phase classic: création ligue classic → enchère 3 rounds →
  8 coureurs → assignation rôles → scoring → cumul XP → reset phase suivante.
- Vérifier la non-régression du mode Manager (mode = défaut, comportement identique).

## Inventaire de fichiers (référence, détail dans le plan)

- Migrations: nouvelle (`leagues.mode`), modif `confirm_phase_setup`, `place_bid`,
  `join_league_by_code`.
- `apps/web/app/(auth)/league/create/actions.ts` (defaults classic).
- `apps/web/lib/phases.ts`, `apps/web/lib/gt-phases.ts` (liste 4 phases classic).
- Résolution d'enchère (où bids → contracts) + pont `gt_squad`.
- UI: `team/layout.tsx`, `team/gt/gt-team-client.tsx`, `auction/auctions-client.tsx`,
  `components/config-cards.tsx`, `components/budget-summary.tsx`,
  `components/team-tactics-section.tsx`, `components/bottom-nav.tsx`, `components/sidebar.tsx`,
  lobby (`app/(lobby)/lobby/[leagueId]/`), `ranking/ranking-client.tsx`.
- Pipelines: `services/pcs-sync/sponsor_bonus.py`, `goal_evaluator.py` (gardes mode).
