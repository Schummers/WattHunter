# Axe 1 — Couplage Classic/Manager dans la base de données

> Périmètre : `supabase/migrations/` (186 fichiers, `20260221000000` à `20260821000100`, hors `_rollback/`).
> Méthode : lecture chronologique intégrale, reconstitution de l'état final table par table (CREATE, puis tout ALTER/DROP/RENAME qui la touche).

---

## 1. Tables et colonnes qui n'existent QUE pour le mode manager

Ces tables/colonnes n'ont **aucun rôle** en mode classic (classic ne les lit ni ne les écrit). Elles seraient toutes JETÉES dans un rewrite classic-only.

| Élément | Créé | Usage manager |
|---|---|---|
| `teams.treasury` (bigint) | `20260221000000` (défaut 500k → 200k → `20260402400000` défaut 0) | Trésorerie persistante entre phases. En classic, `treasury` existe toujours (même colonne) mais est **réinitialisée à plat** chaque phase par `classic_phase_reset` (2M, migration `20260630130000`) — c'est un cas de colonne partagée avec sémantique divergente, pas une colonne manager-only au sens strict. Voir §2. |
| `teams.level` (int, 1-8) | `20260221000000`, contrainte réécrite `20260402400000`/`20260402000000` | Progressive unlock (pool gating, slots, co-unlock). En classic, `level` est figé à 8 partout (`classicTeamDefaults()`) : colonne présente mais **valeur constante et inerte**. |
| `teams.phase_confirmed_at` / `phase_confirmed_id` | `20260402400000` | Utilisé par les DEUX modes (`confirm_phase_setup` en manager, `classic_phase_reset` en classic) — donc en réalité partagée, cf. §2. |
| `teams.pending_sponsor_id` | `20260402400000` (FK → `sponsors`) | Sponsor manager en attente d'activation au prochain payday. **Manager only** — classic n'a pas de sponsor (GAME_RULES §19 pt 7 "No sponsors, no policies, no underdog"). JETER en classic-only. |
| `teams.underdog_eligible` | `20260605000000_underdog_eligibility.sql:7` | Flag d'éligibilité anti-rattrapage manager. En classic la colonne existe mais reste **toujours `false`** (GAME_RULES §19 : "Underdog | Reused as 2 Underdog slots per squad (`underdog_eligible` stays false)"). Colonne manager-only dont la valeur est structurellement inerte en classic — GARDER seulement si on garde le rôle Underdog scoring (voir §3), pas la colonne d'éligibilité elle-même. |
| `underdog_eligibility` (table) | `20260605000000:9-18` (`team_id, phase_id, year, is_eligible, leader_xp, team_xp, computed_at`) | Snapshot d'éligibilité par phase, alimenté par `recompute_underdog_eligibility(phase_id, year)`. **100 % manager** — jamais peuplé pour une league classic puisque `underdog_eligible` y reste `false` par construction. JETER. |
| `contracts.underdog_discount` (boolean) | `20260605000200_underdog_salary_flag.sql:5` | Pilote la remise salariale −50 % au payday manager (`confirm_phase_setup` v3, `20260605000300`). Classic n'a pas de salaire récurrent (bid = coût one-shot dans l'enveloppe de phase) donc cette colonne est **inerte en classic**. JETER si on jette le payday manager. |
| `rider_xp_daily.underdog_mult` (NUMERIC(3,2)) | `20260605000250` | Traçabilité du boost Underdog séparée de `role_mult`. Utilisé par le scoring quel que soit le mode où le rôle `underdog` est assigné (manager OU classic Wildcard) — donc en réalité PAS manager-only, cf. §3. |
| `sponsors` (13 lignes) + `team_sponsors` + `sponsor_bonuses` + `sponsor_goal_completions` | `20260402300000`, `20260519000002` | Sponsors avec bonus financiers. Analyse fine en §3 : une partie (goals/tiers/nationalité) est récupérable XP-only, une partie (montants €, `treasury_log`) est jetable telle quelle. |
| `treasury_log` (table entière) | `20260221000000:132-147`, types étendus 6 fois (dernier état `20260625000100`) | Journal de trésorerie : 18 types (`starting_fund`, `auction_purchase`, `monthly_salary`, `rider_revenue`, `sponsor_payment`, `bankruptcy_release`, `monthly_bonus`, `phase_salary`, `phase_sponsor_base`, `sponsor_bonus`, `release_fee`, `transfer_bonus`, `payday_salary`, `gt_dnf_refund`, `gt_emergency_purchase`, `gt_goal_bonus`, `sponsor_bonus_revert`, `budget_reset`). Seul `budget_reset` sert au reset classic ; les 17 autres sont manager (payday, sponsor income, bankruptcy). Si le budget classic était géré sans journal (juste `UPDATE teams SET treasury`), toute la table serait jetable. Actuellement classic **dépend encore** de `treasury_log` pour tracer `budget_reset` (`20260625000100_classic_phase_reset_rpc.sql:36-37`) → JETER la table nécessite de redéfinir comment on trace/affiche l'historique de budget classic (probablement pas nécessaire du tout si le budget repart à 2M chaque phase sans P&L à afficher). |
| `teams.is_bankrupt` (boolean) | `20260221000000:45` | Cascade de faillite manager (release du rider à + haute XP cumulée si treasury < −10 000). Aucune notion de faillite en classic (budget plat, jamais négatif par construction du cap enchère). JETER. |
| Anti-Runaway : mécanismes Co-Unlock + Level Curve Stretch | Pas de tables dédiées — implémentés en **logique inline dans `place_bid`** (`v_required_level`, `v_required_teams`, `CEIL(0.30 * team_count)`, cf. `20260630130000_classic_squad10_budget2m.sql:262-292`) + seuils XP dans `apps/web/lib/levels.ts` | Pas de table à dropper, mais ~30 lignes de logique dans le RPC partagé `place_bid` (voir §2 — c'est un couplage de CODE, pas de schéma). En classic, `v_required_level` est toujours 1 (tous niveau 8) donc la branche s'exécute mais est toujours vraie — code mort actif, pas dormant. |
| ~~`remontada_boost_triggers` / `remontada_boosts`~~ | Créées `20260423120000`, **DROPPÉES `20260602120000`** | Déjà supprimées, aucune trace restante sauf `treasury_log` type historique (`monthly_bonus`?) — non, remontada n'avait pas son propre type dans `treasury_log`. Mentionné pour mémoire, sans action. |

**Incertitude** : je n'ai pas vérifié si `is_bankrupt` est encore lu quelque part côté TS/Python en dehors des RPCs manager (`place_bid` la lit-elle ? non trouvé dans les extraits examinés) — à confirmer par un grep applicatif si besoin, hors périmètre DB.

---

## 2. Tables PARTAGÉES où les deux modes cohabitent

### `leagues` — colonne de mode explicite
- `leagues.mode text NOT NULL DEFAULT 'manager' CHECK (mode IN ('manager','classic'))`, ajoutée `20260625000000_leagues_mode_column.sql:4-6`.
- **Mécanisme de cohabitation** : colonne discriminante lue par les RPCs (`SELECT mode INTO v_league_mode FROM leagues WHERE id = ...`) dans `place_bid`, `validate_round`, `gt_add_to_squad`, `gt_assign_role`, `enforce_gt_squad_cap` (trigger). Toutes ces fonctions contiennent un `IF v_league_mode = 'classic' THEN ... ELSE ...` inline. Il n'y a **pas de séparation en deux RPCs distincts** — le couplage est dans le corps de fonctions partagées, pas seulement dans une colonne de table. C'est la donnée la plus importante de cet audit : **le couplage réel n'est pas au niveau du schéma (propre), il est au niveau des RPCs PL/pgSQL (entrelacé)**.

### `teams` — colonne `treasury` + `level`, sémantique différente par mode
- Même colonnes physiques, deux logiques :
  - Manager : `treasury` alimentée par payday (`confirm_phase_setup`), déduite des salaires + sponsor income, peut devenir négative (`bankruptcy_release`).
  - Classic : `treasury` réinitialisée à 2 000 000 par `classic_phase_reset` (`20260630130000:… v_budget constant int := 2000000`), jamais négative par construction (enchères plafonnées par le budget disponible dans `place_bid` étape 9).
  - `level` : manager progresse via XP (`compute_level`), classic figé à 8 à la création (`classicTeamDefaults()`, non trouvé dans les migrations — logique TS, `apps/web/lib/league-mode.ts`).
- Pas de valeur sentinelle ni de NULL : la distinction se fait entièrement via `leagues.mode`, lu à chaque appel RPC.

### `contracts` — squad cap variable selon mode
- Colonnes physiques identiques (`team_id, rider_id, locked_salary, status, released_at, phase_recruited_id, available_from, league_id, underdog_discount`).
- Cap de slots : manager = fonction du `level` (6 à 12, `place_bid` étape 10, `20260630130000:296-301`) ; classic = fixe à 10 (même bloc, branche `IF v_league_mode = 'classic' THEN v_max_slots := 10`).
- `underdog_discount` : posé par trigger `trg_flag_underdog_contract` à l'INSERT quel que soit le mode, mais n'a d'effet qu'au payday manager (`confirm_phase_setup` v3) — en classic il reste `true`/`false` sans jamais être consommé (pas de payday récurrent classic).

### `auction_bids` — table strictement identique, comportement différent porté par le RPC `place_bid`
- Aucune colonne de mode sur la table elle-même. Toute la divergence (min salary, slots, co-unlock/pas de co-unlock effectif car niveau 8 partout, budget plat vs progressif) est dans `place_bid`.

### `rider_xp_daily` — table unique, seule source de vérité XP pour les deux modes
- C'est la table qui matérialise **l'invariant partagé documenté dans GAME_RULES §19** : "Les deux modes partagent exactement un invariant persistant : cumulative XP + le classement GC de la ligue."
- Colonnes de scoring (`role_mult`, `gt_classif_bonus`, `gt_distance_bonus`, `assist_bonus`, `underdog_mult`) sont utilisées identiquement par le pipeline Python `scoring.py`, sans branchement de mode : le scoring ne sait pas si l'équipe est classic ou manager, il score le squad GT/Race Team peu importe. C'est une **bonne nouvelle structurelle** pour le rewrite : le moteur de scoring XP est déjà mode-agnostique.

### `gt_squad` / `gt_role_assignments` — rôle `underdog` réutilisé, cap dynamique
- Cap 8→10 piloté par `enforce_gt_squad_cap` (trigger) : `CASE WHEN t.underdog_eligible OR l.mode = 'classic' THEN 10 ELSE 8 END` (`20260630130000:24-29`). Un seul trigger, deux conditions OR'ées — couplage direct et explicite dans le code du trigger.
- Rôle `underdog` : en manager il est gated par `underdog_eligible` (issu de la table `underdog_eligibility`) ; en classic il est ouvert à tous sans condition d'éligibilité (juste `v_league_mode = 'classic'` dans `gt_add_to_squad`/`gt_assign_role`, `20260630130000:99-102` et `217-220`). **Même colonne `role`, même valeur `'underdog'`, deux voies d'autorisation différentes dans le même RPC.**

### `sponsors`, `team_sponsors`, `sponsor_bonuses`, `sponsor_goal_completions`
- Non utilisées du tout en classic (GAME_RULES §19 pt 7). Pas de mécanisme de cohabitation à proprement parler — c'est une désactivation totale côté classic (front masque les sections, aucun appel RPC sponsor n'est fait pour une league classic). Analyse détaillée en §3.

---

## 3. SPONSORS — ce qui est réutilisable XP-only vs intrinsèquement financier

Table `sponsors` (`20260402300000_sponsors_rework.sql:17-39`, valeurs mises à jour `20260603120000` sans changement de schéma) :

```
id, name, slug, tier(1-6), unlock_level(1-8), monthly_budget,
orientation('gc'|'one_day'|'neutral'), nationality,
bonus_gc, bonus_one_day, bonus_stage,
gc_threshold, one_day_threshold, stage_threshold,
has_explicit_prestige, bonus_monument, bonus_grand_tour,
monument_threshold, grand_tour_threshold, sort_order
```

**Réutilisable XP-only** (rejoint la direction produit ROADMAP_ET_REX §2.2 "Sponsors, goals, bonus de nationalité : à rapatrier, recentrés autour de l'XP") :
- `orientation`, `nationality` : la mécanique de ciblage (GC / one-day / stage-hunter, nationalité du sponsor) est un pur système de règles/tags, transposable telle quelle en multiplicateur XP.
- `tier`, `sort_order` : structure de progression/collection, indépendante de la monnaie.
- La **structure des goals** (`sponsor_goal_completions` : `goal_index`/`goal_key`, `goal_label`, `race_slug`, `stage_slug`, `rider_id`) est réutilisable : c'est un système d'accomplissement (goal atteint ou non, par archétype de rôle) qui n'a rien d'intrinsèquement financier — seul le **paiement** associé est en euros.
- La règle no-cumul (§18 GAME_RULES, `sponsor_goal_completions.neutralized_stage_slugs`) est une règle de dédoublonnage transposable à un système XP (éviter double XP goal + XP base sur la même course).

**Intrinsèquement financier, à rejeter ou reconvertir** :
- `monthly_budget`, `bonus_gc`, `bonus_one_day`, `bonus_stage`, `bonus_monument`, `bonus_grand_tour` (tous `int`, unités = euros) : à remplacer par des valeurs XP si le mécanisme survit, pas de conversion automatique valable (barème à redéfinir, cf. GAME_RULES §2.5 qui évoque déjà un rééquilibrage GC 250→300 pts).
- `sponsor_bonuses.base_bonus / multiplier / final_bonus` (`20260402300000:140-153`) : entièrement financier, table à jeter.
- `sponsor_goal_completions.base_reward / multiplier / final_reward` : idem, colonnes à renommer/reconvertir en XP si la table survit.
- `treasury_log` type `sponsor_bonus` / `sponsor_bonus_revert` (`20260520000000_add_sponsor_bonus_revert_type.sql`) : disparaît avec le journal de trésorerie.
- `unlock_level` : lié au système de niveaux manager (déblocage progressif) — condamné avec les levels (ROADMAP_ET_REX §2.3 "Le déblocage progressif de coureurs").
- `has_explicit_prestige`, `monument_threshold`, `grand_tour_threshold` : logique de seuil financier (T5/T6), sans équivalent XP déjà pensé — à redéfinir de zéro si gardé.

**Verdict global sponsors** : ADAPTER (pas GARDER tel quel, pas JETER intégralement). Le squelette relationnel (`sponsors` catalogue + `team_sponsors` affectation + `sponsor_goal_completions` accomplissements) est un bon socle ; toutes les colonnes monétaires doivent être renommées/re-typées en XP et le calcul (`sponsor_bonus.py`, ~200+ lignes) réécrit. Coût M.

---

## 4. LIVRABLE CLÉ — schéma cible minimal classic-only

### Tables à GARDER (potentiellement adaptées)

| Table | Colonnes essentielles à garder | Colonnes à dropper si gardée |
|---|---|---|
| `users` | id, display_name, avatar_url | — (inchangée) |
| `leagues` | id, name, invite_code, commissioner_id, status, max_players, season_year | `mode` (plus besoin — un seul mode) |
| `teams` | id, user_id, league_id, name, treasury, cumulative_xp | `level`, `is_bankrupt`, `phase_confirmed_at`, `phase_confirmed_id` (à repenser en "phase courante" simple sans payday complexe), `pending_sponsor_id`, `underdog_eligible` |
| `league_members` | id, league_id, user_id, team_id | — |
| `riders` | id, pcs_slug, full_name, nationality, real_team, photo_url, specialty, pcs_points_1yr, pcs_rank, monthly_salary (renommer en "valeur d'enchère"), is_active_in_game, ever_in_pool | `team_type` (WorldTour/ProTeam, si non utilisé par classic — à vérifier), colonnes de gating par niveau si elles existent ailleurs |
| `contracts` | id, team_id, rider_id, locked_salary→locked_price, status, released_at, phase_recruited_id, available_from, league_id | `underdog_discount` (sauf si rôle Underdog gardé, cf. GAME_RULES §14/§19 pt "Underdog... reste un axe intéressant") |
| `auctions` / `auction_bids` / `draft_bids` / `round_validations` | Inchangées — moteur d'enchère mode-agnostique une fois `place_bid`/`validate_round` débranchés du manager | — |
| `rider_xp_daily` | id, team_id, rider_id, contract_id, date, raw_pcs_points, strategy_bonus→(supprimer si strategies jetées), xp_gained, role_mult, gt_classif_bonus, gt_distance_bonus, assist_bonus, underdog_mult (si rôle gardé), race_slug | — table déjà propre, mode-agnostique |
| `race_results`, `rider_season_rankings`, `race_startlists`, `rider_teams`, `rider_pcs_history`, `stage_profiles` | Inchangées — données PCS pures, aucun couplage manager | — |
| `gt_squad`, `gt_role_assignments`, `gt_daily_classifications`, `gt_final_classifications` | Inchangées, cap fixe à 10 (plus de branchement `underdog_eligible OR mode='classic'`, juste 10 partout) | — |
| `gt_tactic_activations`, `tactic_usage_limits` | Garder 4 tactiques (Call the Bus déjà exclu en classic) | Lignes `tactic_usage_limits` pour Call the Bus en classic si non utilisées |
| `gt_emergency_bids`, `gt_rescue_windows` | Inchangées (GT Rescue est mode-agnostique dans les faits, utilisé par classic aussi) | — |
| `team_ranking_daily` | Inchangée (snapshots classement) | — |
| `sponsors`, `team_sponsors`, `sponsor_goal_completions` | ADAPTÉES : colonnes € → XP (cf. §3) | `unlock_level`, `monthly_budget`, `bonus_*` en euros, `has_explicit_prestige`/`monument_threshold`/`grand_tour_threshold` (à redéfinir) |
| `underdog_eligibility` + `teams.underdog_eligible` | JETER la table d'éligibilité (concept manager) ; GARDER seulement le rôle `underdog`/"Wildcard" scoring s'il est retenu comme mécanique classic à part entière (déjà le cas en prod, `underdog_eligible` resterait alors une colonne toujours `false`, donc jetable aussi) | |

### Tables à DROPPER intégralement

- `treasury_log` (tout le journal — remplacé par un simple `treasury` plat sans historique, ou un log minimal 1 ligne/phase si l'UX veut un P&L)
- `sponsor_bonuses` (bonus financiers de résultat de course)
- `strategies` / `team_strategies` (ex-`policies`/`team_policies` — ROADMAP_ET_REX §2.3 : "Le reste des stratégies (sauf nationalité, à refaire)" — la table entière saute, la mécanique nationalité renaît ailleurs, probablement dans `sponsors`)
- `team_xp_adjustments` — GARDER en fait (admin tool `grant_xp`, mode-agnostique, sert à corriger des bugs de scoring quel que soit le mode) — **correction** : à garder, pas à dropper. Voir note ci-dessous.
- Colonnes `teams.level`, `teams.is_bankrupt`, `teams.pending_sponsor_id`, `teams.underdog_eligible` (si le rôle Underdog n'est pas gardé)
- Colonne `contracts.underdog_discount` (si Underdog non gardé)
- Colonne `leagues.mode` (un seul mode = pas besoin de discriminant)
- Colonne `leagues.max_players` reste (pas manager-only) ; `leagues.starting_level` (`20260404000000`) → JETER (levels condamnés)

**Note de cohérence** : `team_xp_adjustments` (créée `20260506100000`) est un outil d'audit XP générique (`grant_xp` RPC, §15 GAME_RULES), utilisé pour compenser des bugs de scoring — aucune dépendance au mode. Je le classe GARDER, pas DROPPER, correction par rapport à une première lecture trop rapide de son nom.

### Compte

- Tables actuelles (hors `_rollback`) : **35 tables créées, 2 droppées** (`remontada_boost_triggers`, `remontada_boosts`) + 2 renommées (`policies`→`strategies`, `team_policies`→`team_strategies`) = **33 tables vivantes**.
- Schéma cible classic-only : **~24-26 tables** selon le sort de sponsors (gardées adaptées) et Underdog (gardé ou non), soit une réduction d'environ **25-30 %** du nombre de tables — moins spectaculaire qu'attendu, parce que la majorité du schéma (riders, race_results, GT squad/tactics/rescue, rider_xp_daily, auctions) est **déjà mode-agnostique** ou déjà classic-compatible. Le vrai poids mort est concentré sur peu de tables mais volumineuses en complexité : `treasury_log` (18 types), `sponsor_bonuses`, `strategies`/`team_strategies`, `underdog_eligibility`.

---

## 5. Santé du schéma en soi

### Ce qui est sain
- **Nommage cohérent** : snake_case partout, FK suffixées `_id`, tables de jonction `team_x` bien identifiées. Le renommage `policies`→`strategies` (`20260406000000`) montre une discipline de refactor propre (rename table + colonnes + contrainte en un seul commit atomique, pas de trace de l'ancien nom qui traîne).
- **RLS quasi systématique** : `enable row level security` posé à la création de chaque table dans les extraits examinés, avec policies dédiées. Pattern `SECURITY DEFINER` pour les checks de membership (`is_league_member()`, ADR-004) — évite la récursion RLS, bonne pratique documentée.
- **Index posés dès l'origine** sur les FK à fort volume (`idx_teams_league_id`, `idx_contracts_team_id`, `idx_rider_xp_daily_team_date`, `idx_auction_bids_auction_rider`) et ajoutés au fil de l'eau pour les nouvelles tables (`idx_gt_squad_team_phase`, `idx_sponsor_bonuses_team_race_date`).
- **Contraintes CHECK expressives** : enum-like via `CHECK (x IN (...))` sur quasiment toutes les colonnes de statut/type (`leagues.status`, `contracts.status`, `treasury_log.type`, `sponsor_bonuses.result_type`), avec évolution tracée migration par migration plutôt que mutation silencieuse.
- **Logique métier centralisée en RPC SECURITY DEFINER** (ADR-015, 12+ RPCs) plutôt que dispersée en server actions TS — réduit la surface d'incohérence, aligné avec la règle CLAUDE.md "NEVER mettre de logique métier dans une server action TS".
- **Traçabilité fine** : `rider_xp_daily` porte 6+ colonnes de décomposition du scoring (`role_mult`, `gt_classif_bonus`, `gt_distance_bonus`, `assist_bonus`, `underdog_mult`) — utile pour débugger un score sans recalcul, signe d'une équipe qui a appris de ses incidents (le fichier MEMORY.md liste plusieurs post-mortems de scoring).

### Ce qui trahit un schéma sous pression (patché, pas reconstruit)
- **Migrations correctives nombreuses et nommées "fix_*"** : sur 186 fichiers, on compte des dizaines de `fix_*` (`fix_leagues_select_commissioner`, `fix_recursive_rls`, `fix_stale_levels`, `fix_contract_date_scoring`, `fix_treasury_rounding`, `fix_round2_treasury_double_count`, `fix_duplicate_sponsor_bonus_credits`, `fix_gt_squad_role_caps`, `fix_dixon_hormous_duplicate_bonus` — un fix nommé d'après un joueur précis, signe de patch en prod post-incident plutôt que de correction en amont) — c'est un schéma **qui a vécu**, pas un schéma dessiné à froid.
- **`treasury_log.type` réécrit 6 fois** (ajouts successifs de types au CHECK plutôt qu'un design initial complet) — chaque ajout de feature manager a fait grossir un enum déjà lourd, jamais purgé des types "deprecated, kept for existing data" explicitement commentés comme tels (`phase_economy.sql:71-77`). C'est un schéma qui documente sa propre dette (bon signe pour la lisibilité), mais qui ne l'a jamais nettoyée (mauvais signe pour la charge cognitive).
- **RPCs partagés avec branchement de mode inline** (`place_bid`, `validate_round`, `gt_add_to_squad`, `gt_assign_role`, `enforce_gt_squad_cap`) plutôt que deux fonctions distinctes ou un pattern strategy : chaque fonction dépasse 150-300 lignes PL/pgSQL avec des `IF v_league_mode = 'classic'` disséminés à 3-4 endroits différents dans le corps. C'est le point le plus concret pour l'axe 1 : **le couplage classic/manager n'est pas visible dans le schéma (qui est propre), il est caché dans la logique procédurale des RPCs**, invisible à un simple `\d` ou `list_tables`.
- **Colonnes mortes en usage réel mais vivantes en schéma** : `teams.level` reste à 8 constant pour toute league classic (33 leagues classic ≈ colonne inerte), `teams.underdog_eligible` reste `false` par construction en classic, `contracts.underdog_discount` n'est jamais consommé en classic. Le schéma ne peut pas exprimer "cette colonne ne s'applique qu'en mode X" — seul le code applicatif (RPC + TS) porte cette information, undocumented at the schema level (pas de commentaire `COMMENT ON COLUMN` pour la plupart, sauf exceptions notables comme `pending_sponsor_id`).
- **`race_startlists` sans `race_class`** (gotcha documenté dans MEMORY.md) et plusieurs backfills ad hoc (`fix_giro_stage4_race_date`, `fix-giro-stage5-date`, `fix-giro-stage6-date`, `backfill_rubio_arrieta_giro_xp`) montrent que le pipeline PCS→DB a nécessité plusieurs rattrapages manuels — pas un problème de schéma en soi, mais un signal de fragilité du pipeline d'ingestion qui déteint sur la confiance dans les données.
- **Deux tables de contrainte de cap parallèles** pour le squad (`gt_squad` cap 8/10 via trigger `enforce_gt_squad_cap`, ET `contracts` cap 10/12 via logique dans `place_bid`) : le roster (contracts) et le squad de course (gt_squad) sont deux couches avec des caps différents et des règles de cohérence qui ne sont pas garanties par une FK ou une contrainte déclarative — uniquement par la discipline des RPCs. En classic, GAME_RULES §19 dit explicitement "Single layer: 10 riders = the squad" — la distinction contracts/gt_squad est donc un **vestige manager qui persiste structurellement même en classic** (classic squad = contracts ET gt_squad doivent rester synchronisés à 10, deux tables pour un seul concept).

### Verdict santé

**Le schéma est sain en tant que schéma relationnel (normalisation correcte, RLS présente, index posés), mais il est un palimpseste procédural** : chaque feature manager a été ajoutée par extension de colonnes + branchement conditionnel dans des RPCs déjà existants plutôt que par des tables/fonctions dédiées au mode. Un **nettoyage** (DROP des tables/colonnes manager-only listées en §4) est mécaniquement simple et sans risque sur les tables pures (treasury_log, sponsor_bonuses, strategies, underdog_eligibility). Le vrai travail n'est pas le schéma, c'est la **récriture des 4-5 RPCs partagés** (`place_bid`, `validate_round`, `gt_add_to_squad`, `gt_assign_role`, `enforce_gt_squad_cap`) pour retirer les branches manager — travail de taille M à L selon qu'on les réécrit from scratch (recommandé, ce sont les fonctions les plus commentées "Manager mode is untouched" / "Classic mode:" dans le code, donc déjà spaghetti) ou qu'on se contente de retirer la branche morte.

**Un rewrite du schéma n'apporte pas grand-chose que le nettoyage n'apporterait pas** : la structure relationnelle de base (users/leagues/teams/contracts/riders/rider_xp_daily/auctions/gt_squad) est saine et directement réutilisable. Ce qu'un rewrite élimine que le refactor ne peut pas éliminer proprement, c'est la **dette procédurale des RPCs** — parce que "retirer la branche manager d'un `place_bid` de 300 lignes déjà réécrit 5 fois (`rpc_place_bid`, `place_bid_classic_cap`, `place_bid_late_joiner_gate`, `place_bid_increment_1000`, `classic_squad10_budget2m`)" est plus risqué et plus coûteux en tests de non-régression que d'écrire un `place_bid` classic-only de 100 lignes en partant du schéma nettoyé. Sur cet axe précis (RPC), rewrite > refactor. Sur le schéma de données pur, refactor (DROP TABLE / DROP COLUMN en migration) suffit.
