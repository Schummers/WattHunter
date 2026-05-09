# Phase Transition Payday — Design Spec

**Date:** 2026-05-09
**Status:** Approved (high-level)
**Author:** Jonathan + Claude

---

## Context

Le système économique de WattHunter possède une RPC `confirm_phase_setup` qui crédite le revenu sponsor et déduit les salaires actifs (le "payday" entre deux phases). Cette RPC fonctionne, mais **aucun composant ne la déclenche** :

- Le bouton UI qui l'appelait (`confirmPhaseSetup` server action) n'a jamais été câblé sur la page Market
- L'auto-trigger Python `run_payday()` qui tournait à la fin de Round 1 a été supprimé le 1er mai (commit `941bcbd`)
- Résultat : depuis le 5 avril (dernier payday Phase 3), **plus aucun payday ne s'exécute**. Le treasury ne reflète plus les phases qui passent. Les R2/R3 winners ne paient jamais leurs salaires (sauf via le bug de double comptage qu'on vient de fixer dans la migration `20260509120000`).

L'objectif de cette spec : remplacer ce trou par un déclencheur clair, automatique au bon moment, avec un override manuel pour le commissaire si nécessaire.

## Outcome attendu

- À la clôture définitive du Round 3 d'une phase, `confirm_phase_setup` tourne automatiquement pour les 8 équipes en cascade (sauf late joiners)
- Une équipe qui ne peut plus enchérir (PP < min_salary OU roster plein) est marquée auto-validée pour ne pas bloquer le consensus
- Un commissaire peut forcer la fermeture du round (existant pour R1/R2, à étendre pour R3)
- La transaction list affiche clairement les mouvements du payday pour chaque user (per-rider, pas en bulk)
- L'historique des phases passées (Phase 2, Phase 3) est rempli avec les bonnes entrées per-rider
- Aucun bug de double-comptage : la déduction R2/R3 supprimée dans le fix précédent reste supprimée — le payday est l'unique source de mutation treasury liée aux salaires

## Architecture cible

### Flow d'une phase (cible)

```
1. Phase N start (calendrier)              ← AUCTION_PHASES const
   ↓
2. Round 1 open                              ← auctions.status='open'
   • Drafts + sponsor/strategy pending changes
   • Auto-validation des teams "non actionables"
   ↓
3. Round 1 → Round 2 transition             ← all actionable teams validated OR commissioner force-resolve
   • forceResolveRound: bids → contracts
   • Round 2 auction.status='open'
   ↓
4. Round 2 → Round 3 transition             ← idem
   ↓
5. Round 3 close                            ← all actionable teams validated OR commissioner force-resolve
   • forceResolveRound: bids → contracts
   • DETECTION : nextAuction === null
   ↓
6. 🆕 PHASE PAYDAY (cascade)                 ← nouveau déclenchement
   • Pour chaque team de la league (skip late joiners):
     – confirm_phase_setup(team_id, phase_id, label)
   • Logging dans treasury_log (transparence)
   ↓
7. Racing phase                              ← plus d'auctions jusqu'à phase N+1
   • Sponsor bonuses créditent au fil des résultats PCS
   ↓
8. Phase N+1 start (calendrier)             ← loop
```

### Déclencheur du payday

**Couplé à `forceResolveRound`** : quand cette fonction détecte qu'aucun `nextAuction` scheduled n'existe pour la league (= on vient de clôturer le Round 3 et il n'y a plus rien après), elle appelle `confirm_phase_setup` en boucle pour chaque équipe de la league dans la même server action (transaction logique unique du point de vue UX).

C'est le **seul** déclencheur. Pas de bouton dédié, pas de cron, pas de Python. Le payday est une conséquence inévitable de la résolution du dernier round de la phase — le user n'a rien à cliquer en plus.

### Auto-validation des équipes "non actionables"

Une équipe est **non actionable** dans un round donné si elle ne peut placer aucun bid utile :

- Son PP courant (formule `validate_round` : `treasury + sponsor − active_salaries − draft_bids_total`) est inférieur à `min_salary` (5 000 €) — impossible de placer même le bid minimum
- OU il ne lui reste plus de slot libre (active contracts + active bids ≥ max_slots du level)

Si une équipe est non actionable → on insère une row `round_validations` pour elle. Pour distinguer dans l'UI, on ajoute une colonne `auto_validated boolean DEFAULT false` à `round_validations` (migration mineure). Le tableau Status affiche "Auto-validated — no actions possible" pour les rows avec `auto_validated=true`.

**Quand l'évaluation tourne** :
- À l'ouverture d'un round (transition R1→R2, R2→R3, et au début de R1 si la phase vient de démarrer) — passe initiale qui marque toutes les teams non actionables
- À chaque tentative de check consensus (juste avant `forceResolveRound` quand on évalue si tout le monde a validé) — re-évaluation pour rattraper les teams devenues non actionables en cours de round

Pas de re-évaluation à chaque `place_bid` (trop coûteux). C'est suffisant : si une team devient non actionable au milieu du round, elle sera marquée à la prochaine action d'une autre équipe.

### Override manuel commissaire

Le bouton "Resolve" sur la page Status existe déjà pour R1/R2 et appelle `forceResolveRound`. Il faut juste s'assurer qu'il est aussi visible/actif sur le Round 3, et que la logique de payday cascade s'enchaîne correctement après la résolution.

Pas de bouton "Confirm Phase Setup" séparé — c'est entièrement automatique en sortie de R3.

### Pas de bankruptcy cascade — `validate_round` est le garde-fou

Aucune logique de faillite n'est nécessaire au payday. La RPC `validate_round` empêche déjà toute équipe de se mettre en déficit :

```sql
v_purchasing_power := v_team.treasury + v_sponsor_income - v_active_salaries;
v_available := v_purchasing_power - v_drafts_total;
IF v_available < 0 THEN
  RETURN jsonb_build_object('error', 'Budget exceeded...');
END IF;
```

Conséquences :
- Une équipe ne peut jamais valider un round qui la mettrait sous 0
- Les salaires sont verrouillés à la création du contrat (`locked_salary`) — ils ne grossissent pas
- Le release réduit `active_salaries` → ne peut que faire monter le PP

Au payday, le calcul `treasury + sponsor − total_salaries` est donc **toujours ≥ 0** par construction. Le CHECK constraint `treasury >= 0` ne sera jamais déclenché par une cascade normale. Si jamais ça arrive (drift de data, modif manuelle), la RPC retourne une erreur sur cette équipe spécifique sans bloquer les autres — la cascade traite chaque team de façon isolée.

### Cas particulier : late joiners (équipes qui ont rejoint mid-phase)

GoudalEnergies a `phase_confirmed_id = NULL` parce qu'il a rejoint la ligue **après** le payday Phase 3. Il a reçu une treasury moyenne au join, recruté son roster, mais n'a jamais reçu de revenu sponsor (Phase 3 et 4 manqués).

**Règle** : le payday ne doit pas créditer rétroactivement les équipes qui n'étaient pas là au début de la phase. Sinon Goudal toucherait le sponsor Phase 4 alors qu'il n'a participé qu'à une partie de la phase.

**Implémentation** : la cascade payday vérifie pour chaque équipe `team.created_at < phase_start_date`. Si l'équipe a été créée après le début de la phase courante, on **skip** (ni sponsor crédité, ni salaires déduits, mais on marque `phase_confirmed_id = current_phase_id` pour que les paydays suivants la traitent normalement).

Ainsi Goudal sera ignoré au payday Phase 4 (à la clôture du R3) puis recevra son premier vrai payday à Phase 5 (Pre-Tour, juin).

## Composants modifiés

| Fichier | Modification |
|---|---|
| `apps/web/app/(game)/league/[leagueId]/auction/actions.ts` | `forceResolveRound` : à la fin, si `nextAuction === null`, appeler `confirm_phase_setup` pour chaque team de la league (boucle) en skippant les late joiners. Agréger les résultats dans le retour. |
| `supabase/migrations/<ts>_round_validations_auto_validated.sql` | Ajouter colonne `auto_validated boolean DEFAULT false` à `round_validations` |
| `supabase/migrations/<ts>_confirm_phase_setup_skip_late_joiners.sql` | Étendre `confirm_phase_setup` (CREATE OR REPLACE) avec le skip des late joiners (`team.created_at > phase_start`) |
| `supabase/migrations/<ts>_auto_validate_helper.sql` | Fonction SQL `auto_validate_unactionable_teams(p_auction_id, p_league_id)` appelée depuis `validate_round` et au round-open |
| `supabase/migrations/<ts>_validate_round_with_auto_validation.sql` | Mettre à jour `validate_round` pour invoquer le helper avant le check de consensus |
| `supabase/migrations/<ts>_backfill_phases_2_3.sql` | INSERT per-rider salaries Phase 2 (+ sponsor flat 200K), DELETE bulk Phase 3 + INSERT per-rider salaries Phase 3 |
| `apps/web/app/(game)/league/[leagueId]/auction/status/page.tsx` | Afficher l'état "Auto-validated (no actions possible)" pour les rows avec `auto_validated=true` |
| Tests TS | Couvrir la cascade payday après R3 + auto-validation logic + skip late joiners |
| Tests pytest | (optionnel) sanity check sur les nouveaux comportements RPC |

### Data repair : backfill des phases passées

Hérité de la research `2026-05-06-budget-transactions-fix-design.md` (Task 5 jamais shippée). L'objectif : que la page Budget affiche un historique cohérent et per-rider quelle que soit la phase consultée.

**État actuel par phase :**

| Phase | Période | sponsor_payment dans log | payday_salary dans log |
|---|---|---|---|
| 1 — Season Start | jan-mars 2026 | Aucun (pas de sponsor à l'époque) | Aucun |
| 2 — Classics Part 1 | mars 2026 | **Aucun** | **Aucun** |
| 3 — Classics Part 2 | avril 2026 | OK (8 entrées, une par team) | Bulk uniquement (1 entrée par team avec description "Payday salaries — N riders", sans `rider_id`) |
| 4 — Giro | mai 2026 | (à venir au prochain payday) | (à venir) |

**Plan de backfill :**

- **Phase 1** : aucun backfill (pas de sponsor à l'époque, comportement attendu)
- **Phase 2** : INSERT `sponsor_payment` (200K flat par team) + INSERT `payday_salary` per-rider depuis les contrats actifs au 2 mars 2026. `teams.treasury` non touché (déjà correct historiquement).
- **Phase 3** : DELETE les bulk `payday_salary` du 5 avril (descriptions "Payday salaries — N riders") + INSERT `payday_salary` per-rider depuis les contrats actifs au 2 avril 2026. `sponsor_payment` Phase 3 existants conservés. `teams.treasury` non touché.

**Critère "contrat actif pendant la phase X"** : `purchased_at < phase_start_date AND (released_at IS NULL OR released_at > phase_start_date)`. C'est le snapshot qu'avait le payday Python à l'époque.

**Idempotence** : la migration check qu'aucun `payday_salary` per-rider n'existe déjà pour la phase avant d'insérer (par exemple via filtre sur `rider_id IS NOT NULL` + range de date).

### Verrouillage cross-round (déjà en place)

Le user a soulevé une crainte légitime : *"si je gagne Jay Vine en R1 à 230k, je peux le supprimer en R3 et prendre un autre coureur sans avoir à le payer ?"*

Ce cas est **déjà bloqué** par la RPC `release_rider` :
```sql
IF v_contract.phase_recruited_id = p_current_phase_id THEN
  RETURN error 'Cannot release a rider recruited during the current phase';
END IF;
```

Donc une fois qu'un coureur est gagné dans une phase (n'importe quel round), son contrat est verrouillé jusqu'à la phase suivante. Aucun impact sur le design actuel — c'est mentionné ici juste pour être explicite.

## Hors scope (volontairement)

- **Bouton manuel "Confirm Phase Setup" séparé** : pas besoin, le déclenchement est automatique en sortie de R3
- **Notifications in-app du payday** : la simple présence des entries `treasury_log` per-rider suffit — design futur si besoin
- **Refund partiel sur release** : reste à 0% (design game)
- **Bankruptcy cascade** : pas nécessaire, `validate_round` est le garde-fou
- **Rattrapage payday Phase 4 pour Goudal** : volontairement skippé (late joiner mid-Phase 4)
- **Phase 1 backfill** : aucune entrée à créer (pas de sponsor à l'époque)

## Verification

1. **Tests automatisés**
   - Vitest : `forceResolveRound` déclenche la cascade payday quand `nextAuction === null`
   - Vitest : auto-validation marque correctement les teams non actionables (PP < 5000 ou slots pleins)
   - Vitest : la cascade skip les late joiners (`team.created_at > phase_start`)

2. **Smoke test manuel sur dev league**
   - Setup : 2 teams, R1+R2 résolus, R3 ouvert
   - Toutes les teams validate R3 → résolution → payday cascade observable :
     - `teams.treasury` mise à jour pour les 2 teams
     - `teams.phase_confirmed_id` = phase courante
     - `treasury_log` contient les sponsor_payment + payday_salary per-rider
   - Vérifier qu'une team avec PP < 5000 est auto-validated dès l'ouverture du round

3. **Backfill Phase 2 + Phase 3**
   - Après migration : naviguer sur la page Budget pour Phase 2 → toutes les équipes voient sponsor 200K + salaires per-rider
   - Phase 3 : sponsor existant intact + salaires per-rider (plus de bulk "7 riders")
   - Vérifier qu'aucune équipe n'a une treasury qui a bougé après le backfill

4. **Production smoke test**
   - Quand cette feature shippe et que le R3 Phase 4 sera clôturé : observer le payday cascade en live
   - Vérifier les treasury et logs des 7 équipes non-Goudal (Goudal skipped car late joiner)

## Critical files to modify

- [apps/web/app/(game)/league/[leagueId]/auction/actions.ts:558](apps/web/app/(game)/league/[leagueId]/auction/actions.ts:558) — fin de `forceResolveRound`, ajouter cascade payday
- [supabase/migrations/20260508100000_confirm_phase_setup_payday.sql](supabase/migrations/20260508100000_confirm_phase_setup_payday.sql) — base de référence pour l'extension skip late joiners
- [supabase/migrations/20260508020000_round_validations_and_force_resolve.sql](supabase/migrations/20260508020000_round_validations_and_force_resolve.sql) — base de référence pour la mise à jour de `validate_round` avec auto-validation

## Open questions for review

- (none — design fully validated by user)
