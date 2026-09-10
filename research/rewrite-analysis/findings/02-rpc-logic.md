# Axe 2 — Couplage classic/manager dans les RPC Postgres

> Lecture read-only. 186 fichiers dans `supabase/migrations/`. Méthode : pour chaque
> fonction, `grep` de toutes ses redéfinitions (`CREATE OR REPLACE FUNCTION`), tri
> chronologique par nom de fichier (timestamp en préfixe), lecture de la **dernière**
> version uniquement (celle qui tourne en prod). Les numéros de ligne cités sont ceux
> du fichier de migration qui contient la dernière version.

## 0. Chiffres de cadrage

- 42 fonctions SQL distinctes définies dans `supabase/migrations/` (inventaire par
  `grep -ihoE "create (or replace )?function..."`, dédupliqué).
- 127 occurrences de `SECURITY DEFINER` réparties sur 76 fichiers de migration —
  chaque redéfinition recopie tout le corps de la fonction (`CREATE OR REPLACE`
  remplace tout, Postgres n'a pas de diff partiel).
- `place_bid` a été redéfinie **10 fois**, `validate_round` **9 fois**,
  `join_league_by_code` **7 fois**, `confirm_phase_setup` et `gt_assign_role` /
  `gt_add_to_squad` **6 fois** chacune.
- 14 fichiers de migration touchent explicitement `mode`/`classic` (grep
  `mode = 'classic'|v_league_mode|classic_`).
- **Zéro test pgTAP ou SQL** dans le repo (`find` sur `*pgtap*`/`*.pg.sql` : aucun
  résultat). Sur les 449 fichiers `*.test.ts`/`*.test.tsx` d'`apps/web`, seuls 11
  référencent un mock de RPC (`mockRpc`/`rpc:`) — et ce sont des mocks : la logique
  SQL elle-même n'est exécutée par aucune suite automatisée, ni Python ni TS.

## 1. Inventaire — classic-only / manager-only / branchée

### Branchées sur le mode (coupling réel, vérifié en lisant le corps)

| RPC | Dernière migration | Taille | Branchement |
|---|---|---|---|
| `place_bid` | `20260630130000_classic_squad10_budget2m.sql:306-531` | 226 lignes | slot cap (`v_max_slots = 10` si classic, sinon table par level) — **mais** exécute quand même tout le pool-gating et le co-unlock manager (voir §2) |
| `validate_round` | `20260820000100_validate_round_exact_squad.sql:20-179` | 160 lignes | 3-way `IF` sur le calcul de `purchasing_power` (classic / manager post-payday / manager pré-payday) + règle "squad exactement plein" classic-only |
| `auto_validate_unactionable_teams` | `20260820000000_team_slots_helpers_and_auto_validate_fix.sql:89-179` | 91 lignes | même 3-way `IF` **dupliqué** (copie quasi verbatim de celui de `validate_round`) |
| `submit_conforming_drafts` | `20260821000000_submit_conforming_drafts_phase_param.sql:22-129` | 108 lignes | même 3-way `IF` **dupliqué une 3e fois**, plus une règle "squad exactement plein" classic-only dupliquée |
| `join_league_by_code` | `20260703000200_join_league_classic_standard_join.sql:21-183` | 163 lignes | standard-join ET late-join ont chacun un `IF v_league.mode = 'classic'` séparé (4 branches au total) |
| `team_max_slots` | `20260820000000_...sql:29-62` | 34 lignes | `IF v_mode = 'classic' THEN RETURN 10` sinon table par level — bien isolé, c'est le seul point qui a été factorisé en helper partagé |
| `enforce_gt_squad_cap` (trigger) | `20260630130000_...sql:17-48` | 32 lignes | cap 10 si `underdog_eligible OR mode='classic'` |
| `gt_add_to_squad` | `20260630130000_...sql:53-170` | 118 lignes | rôle `underdog` autorisé si `v_team_eligible OR v_league_mode='classic'` |
| `gt_assign_role` | `20260630130000_...sql:175-301` | 127 lignes | même branchement que `gt_add_to_squad`, code du CASE de caps **dupliqué à l'identique** entre les deux fonctions |

### Classic-only (nées avec le mode, pas de logique manager à l'intérieur)

- `classic_phase_reset` — `20260819000100_fix_classic_phase_reset_null_guard.sql`
  (44 lignes). Pur : reset trésorerie à 2M, archive les contrats, marque la phase
  confirmée. Aucune branche manager à l'intérieur.

### Manager-only (aucune branche `mode`, appelées uniquement par le pipeline manager)

Vérifiées par lecture complète (pas de référence à `mode`/`classic` dans le corps) :

- `confirm_phase_setup` — `20260605000300_underdog_payday_discount.sql:9-159`
  (151 lignes). C'est le payday manager (sponsor income, salaires, remise
  underdog). Le mode classic utilise `classic_phase_reset` à la place — le
  routage se fait côté TS (`phaseResetRpcFor(mode)`, `docs/ARCHITECTURE.md:418`),
  pas dans le SQL.
- `credit_sponsor_bonuses` — `20260521120100_credit_sponsor_bonuses_idempotent.sql`
  (97 lignes). Aucune ref `mode`. Le garde-fou "classic n'a pas de sponsors" vit
  **côté Python** (`services/pcs-sync/sponsor_bonus.py:25-27` définit
  `is_classic_league()` et `sponsor_bonus.py:319-335` filtre les leagues classic
  avant d'appeler la RPC) — pas dans la RPC elle-même.
- `recompute_underdog_eligibility` — `20260605000000_underdog_eligibility.sql:33-74`
  (42 lignes). **Aucun filtre de mode, ni dans la RPC ni dans son appelant Python**
  (`services/pcs-sync/underdog.py` — `grep classic|mode` : zéro résultat). Voir §2,
  finding le plus sérieux du rapport.
- `place_tactic` (v4) — `20260604010100_place_tactic_v4_ttt_itt.sql` (264 lignes).
  Aucune ref `mode`. "Call the Bus" est retiré du mode classic **uniquement côté
  UI** (`docs/ARCHITECTURE.md:419` — carte cachée dans `team-tactics-section.tsx`),
  pas dans `place_tactic` ni dans `tactic_usage_limits`
  (`20260604000100_tactic_usage_limits.sql:20-31`, qui seed toujours
  `call_the_bus` pour `gt` et `one_week`). Un appel RPC direct pourrait donc
  placer Call the Bus en classic. Impact probablement nul en pratique (classic
  n'a pas de couche "bench" distincte du squad — §19 GAME_RULES : "single layer,
  10 riders = the squad"), mais non vérifié par du code, seulement par
  l'absence structurelle de bench.
- `gt_claim_dnf_refund` / `gt_place_emergency_bid` —
  `20260521000000_gt_rescue_window_refinement.sql:169-285` et `:60-161`
  (~115 et ~100 lignes). Aucune ref `mode`, ni dans la RPC ni dans l'appelant TS
  (`apps/web/app/(game)/league/[leagueId]/team/gt/actions.ts` — `grep mode`
  vide). Voir §2, deuxième finding sérieux.
- `set_starting_level` — `20260528000002_rpc_set_starting_level.sql` (45 lignes).
  Aucune ref `mode`. Inoffensif en pratique : `join_league_by_code` hardcode
  `v_start_level := 8` pour classic sans lire `leagues.starting_level`
  (`20260703000200_...sql:91`), donc cette RPC est un paramètre mort pour
  classic — mais seulement parce qu'un autre fichier l'ignore, pas parce qu'elle
  se protège elle-même.

Non auditées en détail (present dans l'inventaire, comportement déduit du nom
uniquement, à vérifier avant tout chiffrage définitif) : `credit_goal_reward`,
`is_underdog_rank`, `flag_underdog_contract`, `compute_level`,
`open_due_auction`, `league_all_teams_complete`,
`close_remaining_rounds_if_complete`, `block_team_field_updates`,
`auto_cleanup_gt_squad_on_release`, `clear_role_on_squad_remove`,
`resolve_nemesis_for_stage`, `demo_league_id`, `is_league_member`,
`handle_new_user`, `set_updated_at`.

## 2. Le chemin classic traverse-t-il du code manager ? — les deux findings sérieux

**Finding A — `recompute_underdog_eligibility` n'a aucune garde de mode.**
`supabase/migrations/20260605000000_underdog_eligibility.sql:44-52` boucle sur
`SELECT DISTINCT league_id FROM public.teams` sans filtrer `leagues.mode`, et fait
`UPDATE teams SET underdog_eligible = (cumulative_xp < 0.75 × leader_xp)` pour
**toutes** les ligues, classic comprises. `services/pcs-sync/underdog.py` (qui
appelle cette RPC via `recompute_eligibility()`) ne filtre pas non plus sur le
mode. `docs/GAME_RULES.md:711` affirme "classic reuses the underdog role... but
`underdog_eligible` stays false" — cette invariante n'est garantie par **aucun
code**, ni SQL ni Python : elle tient uniquement parce que personne n'a encore
lancé `underdog-eligibility --phase N --year Y` alors qu'une ligue classic
traînante existe (ce qui est le cas aujourd'hui — Tour/Vuelta 2026 tournent en
classic, cf. MEMORY.md). Impact si le flag passe à `true` sur une équipe classic :
contenu, car `gt_add_to_squad`/`gt_assign_role` testent déjà `OR mode='classic'`
et `confirm_phase_setup` (qui lit ce flag pour la remise salariale) n'est jamais
appelé en classic — mais c'est une invariante silencieuse, pas une garantie
structurelle. **Incertitude : je n'ai pas vérifié en base si le flag est
effectivement passé à `true` sur une équipe classic existante** (accès DB hors
périmètre read-only-code de cette mission).

**Finding B — `gt_claim_dnf_refund` injecte de l'argent manager dans un budget
classic censé être plat.** `supabase/migrations/20260521000000_...sql:252-256` :
`UPDATE teams SET treasury = treasury + v_refund` (50 % du salaire verrouillé),
sans aucune condition de mode. Le Grand Tour (phases 4/6/8) est un identifiant de
phase **partagé** entre les deux modes (`docs/GAME_RULES.md:716` — Classics(3) →
Giro(4) → Tour(6) → Vuelta(8) sont aussi les phases classic). Or
`validate_round` calcule le budget classic comme `treasury - active_salaries`
(`20260820000100_...sql:108`), en présumant que `treasury` ne bouge jamais hors
de `classic_phase_reset` (2M fixe). Un DNF pendant un Grand Tour joué en classic
fait donc gonfler `treasury` au-dessus de 2M via un mécanisme financier conçu
pour le mode manager (remboursement de salaire récurrent), contredisant
directement la promesse de `docs/ARCHITECTURE.md:419` / GAME_RULES §19
("Persistent treasury / recurring salaries → Replace : 2M reset per phase" /
"No treasury carries over"). **Incertitude : je n'ai pas vérifié si un DNF
classic a déjà eu lieu en prod ni si son effet a été neutralisé ailleurs (pas de
grep trouvant un tel garde-fou côté TS ou SQL)** — c'est une lecture statique du
code, pas une confirmation d'incident vécu.

Ces deux findings répondent directement à la question posée : oui, le chemin
classic traverse du code manager, pas seulement au sens "code mort exécuté sans
effet" (ce qui est le cas de la majorité du couplage, voir §3), mais dans au
moins un cas (Finding B) au sens "mute un état que classic est censé garder
intact".

## 3. Dette de branchement mesurée — le reste du couplage est bénin mais coûteux à lire

Contrairement aux deux findings ci-dessus, la majorité du couplage dans
`place_bid` et `validate_round` est **fonctionnellement inerte** en classic mais
reste dans le chemin d'exécution :

- `place_bid:411-463` (étapes 6 "Level gating" et 8 "Co-unlock check") — en
  classic toutes les équipes sont level 8 (`GAME_RULES §19`), donc
  `v_required_level` ≤ 8 passe toujours et `v_qualifying_teams >= v_required_teams`
  est toujours vrai (toutes les équipes sont level 8 par construction). Le code
  fait quand même 2 `SELECT count(*)` sur `teams` à chaque enchère classic pour
  évaluer une condition qui ne peut jamais échouer. Ce n'est pas un bug, c'est
  du travail perdu et 50+ lignes de logique manager à lire/maintenir pour
  comprendre une fonction qui, en classic, n'a besoin que du solvency check et
  du slot cap.
- `validate_round:94-102` (étape 6, revenu sponsor) — toujours exécuté même en
  classic où `team_sponsors` est vide par construction (§19 : "No sponsors, no
  policies"), pour nourrir une variable (`v_sponsor_income`) qui n'est utilisée
  que dans la branche manager du calcul de purchasing power (ligne 114).

## 4. Qualité du code métier en SQL

**Duplication — le vrai problème, documenté par le projet lui-même.** La formule
de "purchasing power" (3-way `IF mode='classic' / phase_confirmed_id=current /
else`) existe en **trois copies quasi identiques** :
`validate_round:105-115`, `auto_validate_unactionable_teams:144-152`,
`submit_conforming_drafts:88-94`. Le commentaire de tête de
`20260820000000_team_slots_helpers_and_auto_validate_fix.sql:17-24` documente
explicitement que cette duplication a **causé** un bug ("It also carried the two
classic-mode holes fixed in validate_round yesterday... The cap and the 'is it
full' test are extracted here so that validate_round, this helper, and the
upcoming early-finish check all share one definition instead of each
re-deriving it, which is how they drifted apart in the first place"). Et le
correctif suivant, `20260821000000_submit_conforming_drafts_phase_param.sql:1-19`,
documente un **deuxième** bug dans la **troisième** copie de la même formule :
une comparaison tautologique (`v_team.phase_confirmed_id = (SELECT
phase_confirmed_id FROM teams WHERE id = v_team.id)`, toujours vraie) qui aurait
dû comparer à `p_current_phase_id`. Trois migrations de correctifs en trois
jours (19, 20, 21 août 2026) sur la même logique copiée-collée trois fois — seul
`team_max_slots` a été effectivement factorisé en helper partagé ; la formule de
purchasing power, qui est la partie la plus fragile, **ne l'a toujours pas été**
à la dernière migration lue.

Duplication secondaire : le `CASE p_role WHEN 'gc_leader' THEN 1 ...` de calcul
de cap par rôle est recopié à l'identique dans `gt_add_to_squad:136-144` et
`gt_assign_role:246-254` — les deux fonctions sont systématiquement redéfinies
ensemble à chaque migration touchant les rôles (6 migrations chacune, toujours
en paire), preuve que la duplication est *connue* et gérée par discipline
d'auteur (les redéfinir ensemble) plutôt que par extraction en helper.

**Taille.** Les plus grosses fonctions lues intégralement : `place_tactic`
(~230 lignes), `place_bid` (226), `join_league_by_code` (163), `validate_round`
(160), `confirm_phase_setup` (151), `gt_assign_role` (127), `gt_add_to_squad`
(118), `gt_claim_dnf_refund` (~115), `submit_conforming_drafts` (108),
`gt_place_emergency_bid` (~100). Dix fonctions SECURITY DEFINER de plus de 100
lignes de plpgsql, sans découpage en sous-fonctions (à l'exception du récent
`team_max_slots`/`team_is_complete`).

**Idempotence.** Bonne discipline défensive **visible** : `classic_phase_reset`
compare `phase_confirmed_id` avant d'agir (`20260819000100_...sql`, guard
"skipped" explicite) ; `validate_round` fait un `ON CONFLICT ... DO UPDATE` sur
`round_validations` ; `credit_sponsor_bonuses` a été durcie deux fois pour
l'idempotence (`20260520000003_harden...`, `20260521120100_...idempotent`) après
un incident de double-crédit documenté dans MEMORY.md (+400k€ sur 6 reruns,
2026-05-21). C'est-à-dire : l'idempotence est **ajoutée réactivement**, après
incident, migration par migration — pas une propriété structurelle du pattern
"RPC + migration". Le même style d'incident (goal_key idempotency,
`20260604050000` no-cumul rule) apparaît plusieurs fois dans MEMORY.md sur des
fonctions différentes, signe d'un problème de méthode plus que d'un bug isolé.

**Gestion d'erreur.** Cohérente : les RPC mutation-critiques retournent
`jsonb_build_object('error', ...)` plutôt que de `RAISE EXCEPTION` (permet au
TS de forwarder le message sans try/catch SQL), respectant le pattern documenté
dans `CLAUDE.md` ("NEVER mettre de logique métier dans une server action TS —
Zod → rpc() → error forwarding"). Discipline correctement suivie dans tous les
fichiers lus.

**Tests.** Zéro couverture directe. Le pattern de test vitest décrit dans
MEMORY.md ("RPC mocking pattern : `mockRpc = vi.fn()`") signifie que les tests
TS vérifient que le bon RPC est *appelé avec les bons arguments*, jamais que la
RPC elle-même produit le bon résultat SQL. Les bugs trouvés en §2 et les trois
migrations de correctifs de §4 n'auraient pas pu être attrapés par la suite de
tests existante : ils ont tous été trouvés par lecture de code humaine (ou,
possiblement, par un incident en prod pour certains).

## 5. Coût d'extraction du chemin classic pur — RPC par RPC

| RPC | Verdict | Coût extraction classic-pur | Justification |
|---|---|---|---|
| `place_bid` | ADAPTER | **M** | Retirer ~55 lignes de pool-gating/co-unlock (§3) + le slot-cap devient une constante ; le reste (solvency, cooldown, insert/update bid) est mode-agnostic et se garde tel quel |
| `validate_round` | ADAPTER | **S** | Le branchement est déjà isolé dans un seul bloc IF (§1) ; supprimer 2 branches sur 3 + la requête sponsor_income inutile |
| `auto_validate_unactionable_teams` | ADAPTER→fusionner | **S** | Même chose, mais l'occasion de le fusionner avec `validate_round`/`submit_conforming_drafts` autour d'une seule fonction de purchasing power (voir §4) au lieu de rester 3 copies |
| `submit_conforming_drafts` | ADAPTER→fusionner | **S** | Idem |
| `join_league_by_code` | ADAPTER | **S** | 4 branches déjà explicites par `IF mode='classic'` ; supprimer les branches manager, garder les branches classic telles quelles |
| `team_max_slots` / `team_is_complete` | GARDER (simplifié) | **S** | Retourner `10` en dur, supprimer le CASE par level |
| `enforce_gt_squad_cap` | GARDER (simplifié) | **S** | Cap 10 fixe, supprimer `underdog_eligible OR` |
| `gt_add_to_squad` / `gt_assign_role` | GARDER (simplifié) | **S** chacune | Supprimer la condition `OR v_league_mode='classic'`, le rôle underdog devient disponible par défaut |
| `classic_phase_reset` | GARDER | **S** (quasi zéro) | Déjà pur classic |
| `confirm_phase_setup` | JETER | **S** (suppression) | Aucun appelant classic |
| `credit_sponsor_bonuses` / `credit_goal_reward` | JETER | **S** (suppression) | Sponsors hors scope classic (roadmap §2.2 : à refaire XP-only plus tard, pas cette RPC) |
| `recompute_underdog_eligibility` / `is_underdog_rank` / `flag_underdog_contract` | JETER | **S** (suppression) | Mécanique anti-rattrapage manager ; le "rôle Underdog" classic (2 slots) est une réutilisation de nom, pas de cette RPC — déjà indépendant (§1) |
| `compute_level` | JETER (probable) | **S** | Classic hardcode level 8 partout ; non vérifié si réutilisé ailleurs (ex. achievements) — à confirmer avant suppression |
| `place_tactic` | ADAPTER | **M** | Mode-agnostic mais devra explicitement exclure `call_the_bus` en SQL (aujourd'hui filtré seulement côté UI, §1) pour rester cohérent une fois le manager supprimé |
| `gt_claim_dnf_refund` / `gt_place_emergency_bid` | ADAPTER | **L** | Nécessite une vraie décision produit avant tout code : dans un monde classic-only à budget plat, qu'est-ce qu'un "remboursement à la trésorerie" ? Le mécanisme doit être repensé (crédit dans l'enveloppe de phase ? nouveau slot gratuit ? rien ?), pas juste recopié — c'est un design manquant, pas un branchement à supprimer |
| `set_starting_level` / `launch_first_auction` | JETER ou ADAPTER trivial | **S** | Classic n'utilise pas `starting_level` (déjà mort, §1) |

**Estimation globale** (sur les fonctions inventoriées et auditées, hors la
quinzaine non auditée listée en §1) :
- **Survivent quasi telles quelles (GARDER, coût S)** : `classic_phase_reset`,
  `team_max_slots`, `team_is_complete`, `enforce_gt_squad_cap`,
  `gt_add_to_squad`, `gt_assign_role` — **6 RPC**.
- **À réécrire (ADAPTER, coût S/M)** : `place_bid`, `validate_round`,
  `auto_validate_unactionable_teams`, `submit_conforming_drafts`,
  `join_league_by_code`, `place_tactic` — **6 RPC**, dont 3 (`validate_round`,
  `auto_validate_unactionable_teams`, `submit_conforming_drafts`) devraient être
  fusionnées en une seule fonction de calcul de budget partagée plutôt que
  réécrites séparément trois fois.
- **À redesigner avant réécriture (ADAPTER, coût L)** : `gt_claim_dnf_refund`,
  `gt_place_emergency_bid` — **2 RPC**, bloquées sur une décision produit
  (Finding B, §2).
- **Disparaissent (JETER)** : `confirm_phase_setup`, `credit_sponsor_bonuses`,
  `credit_goal_reward`, `recompute_underdog_eligibility`, `is_underdog_rank`,
  `flag_underdog_contract`, `compute_level`, `set_starting_level`,
  `launch_first_auction` (probable, à confirmer) — **~9 RPC**, plus la
  quinzaine non auditée en §1 qui contient probablement d'autres candidats
  manager-only (`league_all_teams_complete`, `close_remaining_rounds_if_complete`
  semblent génériques au cycle d'enchères et donc à garder ; les autres non
  vérifiées).

Net sur le périmètre audité (24 RPC vérifiées en détail sur 42 recensées) :
**6 survivent, 6 se réécrivent (dont 3 fusionnables en 1), 2 attendent une
décision produit, ~9 disparaissent.** Ce n'est pas un rewrite complet de la
couche RPC — la moitié du périmètre audité est récupérable avec un coût S/M —
mais ce n'est pas non plus un simple `DELETE FROM` : les deux findings du §2
montrent que "classic" n'a jamais été isolé au sens sécurité/invariants, juste
au sens routage applicatif.

## 6. La logique métier en RPC SQL SECURITY DEFINER, avec le recul : bon choix ?

**Ce que le pattern a bien fait.** L'objectif énoncé dans ADR-015
(`docs/ARCHITECTURE.md:616-618` : "Atomicite + RLS bypass controle + audit
trail") est tenu. Chaque RPC lue respecte la discipline CLAUDE.md (Zod → rpc()
→ error forwarding), aucune n'a été trouvée avec de la logique métier fuyant
côté TS. Le garde-fou RLS (`is_league_member`, trigger `teams_protect_sensitive_fields`)
a empêché exactement la classe de bug qu'il visait — aucun cas trouvé de
mutation de `treasury`/`level`/`xp` hors RPC.

**Ce qui a mal vieilli, avec preuves de ce rapport, pas de principe général.**
1. **Pas de mécanisme de réutilisation de code autre que le copier-coller d'une
   fonction entière.** Le §4 montre une formule dupliquée 3 fois, documentée
   comme cause directe de 2 bugs distincts en 3 jours consécutifs
   (19-21 août 2026), et toujours pas unifiée à la dernière migration lue. En
   TypeScript, cette même formule serait une fonction importée une fois ; en
   SQL/migrations, chaque fonction qui en a besoin la réécrit, et `CREATE OR
   REPLACE FUNCTION` ne permet aucun diff partiel — chaque changement récrit
   100 à 230 lignes d'un coup (`place_bid` 10 fois, `validate_round` 9 fois),
   ce qui rend la revue de ces migrations largement une relecture intégrale
   plutôt qu'un vrai diff. Les auteurs le savent et compensent par des
   commentaires ad hoc ("Verbatim copy of X + that diff", ligne 2 de
   `20260605000300_underdog_payday_discount.sql`) — un palliatif manuel à un
   manque d'outillage, pas une solution.
2. **Aucun test n'exerce la logique SQL elle-même** (§0, §4) — sur un projet
   solo sans CI SQL (pas de pgTAP), la seule protection contre la régression
   est la relecture humaine des migrations, dans un langage (plpgsql) que les
   tests JS/Python du repo ne touchent jamais. Les deux bugs de §4 et les deux
   findings de §2 illustrent le même point : quand la garantie repose sur "il
   faut relire toute la fonction à chaque changement", elle finit par se
   fissurer, et c'est visible dans MEMORY.md comme un motif récurrent
   (double-crédit sponsor, pagination PostgREST, goal-key idempotency,
   tautologie de phase) sur plusieurs mois, pas un incident isolé.
3. **Le couplage classic/manager n'est PAS causé par SECURITY DEFINER en soi**
   — `validate_round` montre qu'un branchement de mode peut être propre et
   lisible en SQL (§1, un seul bloc IF bien commenté). Le problème est que le
   pattern rend un branchement propre dans une fonction **invisible** dans les
   fonctions voisines qui partagent la même invariante sans la partager en
   code (Finding A, B) — parce qu'il n'y a pas de "module classic" qu'on
   pourrait interroger, seulement des `grep`.

**Conclusion argumentée.** Pour les mutations vraiment sensibles (déplacer de
l'argent/XP, franchir un solde, verrouiller une ligne) SECURITY DEFINER reste
justifié dans un rewrite — l'alternative (logique côté client + RLS
permissive) est pire. Mais l'exécution ici, "toute la logique métier en SQL,
zéro test SQL, zéro helper partagé au-delà de `team_max_slots`", a un coût
récurrent mesurable (3 migrations de correctifs en 3 jours sur une seule
formule dupliquée, 2 invariantes non garanties par le code). Un rewrite
gagnerait à garder le principe (RPC atomiques pour les mutations d'argent/XP)
mais à sortir la logique *dérivée* (calcul de purchasing power, caps de rôle)
dans des fonctions SQL plus petites et réellement partagées (comme
`team_max_slots` l'a fait, seul exemple du genre trouvé dans tout le corpus),
et à ajouter au moins des tests d'intégration qui appellent la vraie RPC contre
une base de test au lieu de la mocker.
