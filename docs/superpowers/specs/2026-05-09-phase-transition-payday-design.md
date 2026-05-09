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

- À la clôture définitive du Round 3 d'une phase, `confirm_phase_setup` tourne automatiquement pour les 8 équipes en cascade
- Une équipe qui ne peut plus enchérir (budget < min_salary, ou pool vide, ou roster plein) est marquée auto-validée pour ne pas bloquer le consensus
- Un commissaire peut forcer la fermeture du round (existant pour R1/R2, à étendre pour R3)
- La transaction list affiche clairement les mouvements du payday pour chaque user
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
   • Pour chaque team de la league:
     – confirm_phase_setup(team_id, phase_id, label)
   • Logging dans treasury_log (transparence)
   • Gestion des bankruptcies (cf. section dédiée)
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

Une équipe est **non actionable** dans un round donné si **toutes** les conditions suivantes sont fausses (= elle ne peut rien faire) :

- Son PP courant (formule `validate_round` : `treasury + sponsor − active_salaries`, et la draft_bids_total <= PP) lui permet au moins un bid au `min_salary` (5 000 €)
- ET il lui reste au moins un slot libre (active contracts + active bids < max_slots du level)
- ET il existe au moins un coureur dans son pool gating (rank ≤ poolMin du level) qui n'a pas de contrat actif dans la league et hors cooldown

Si une équipe est non actionable → on insère une row `round_validations` pour elle. Pour distinguer dans l'UI, on ajoute une colonne `auto_validated boolean DEFAULT false` à `round_validations` (migration mineure). Le tableau Status affiche "Auto-validated — no actions possible" pour les rows avec `auto_validated=true`.

**Quand l'évaluation tourne** :
- À l'ouverture d'un round (transition R1→R2, R2→R3, et au début de R1 si la phase vient de démarrer) — passe initiale qui marque toutes les teams non actionables
- À chaque tentative de check consensus (juste avant `forceResolveRound` quand on évalue si tout le monde a validé) — re-évaluation pour rattraper les teams devenues non actionables en cours de round

Pas de re-évaluation à chaque `place_bid` (trop coûteux). C'est suffisant : si une team devient non actionable au milieu du round, elle sera marquée à la prochaine action d'une autre équipe.

### Override manuel commissaire

Le bouton "Resolve" sur la page Status existe déjà pour R1/R2 et appelle `forceResolveRound`. Il faut juste s'assurer qu'il est aussi visible/actif sur le Round 3, et que la logique de payday cascade s'enchaîne correctement après la résolution.

Pas de bouton "Confirm Phase Setup" séparé — c'est entièrement automatique en sortie de R3.

### Gestion de la faillite (bankruptcy)

Au payday, si `treasury + sponsor_income − total_active_salaries < 0` pour une équipe, le CHECK constraint `treasury >= 0` ferait échouer la transaction. La RPC `confirm_phase_setup` est donc étendue avec une cascade de bankruptcy :

1. Calculer le déficit projeté **avant** d'appliquer l'UPDATE treasury final
2. Si déficit > 0 : auto-release du coureur **le plus cher** (ordre desc par `locked_salary`)
   - `UPDATE contracts SET status='released', released_at=now(), available_from=now()+7d`
   - `INSERT treasury_log type='bankruptcy_release' amount=0 description='Auto-release [rider name] (Phase N bankruptcy)'`
3. Recalculer `total_active_salaries` (sans le coureur releasé) et redéterminer le déficit
4. Boucler tant que `déficit > 0 AND active_contracts > 0`
5. Si le roster devient vide et le déficit persiste → setter `treasury = 0` (avec entry `treasury_log` `bankruptcy_release` amount=0 description "Treasury floored at 0 due to insufficient sponsor — roster fully released")

Le résultat final : `treasury` est non-négatif, le roster a été allégé jusqu'à la solvabilité, chaque release est tracé. La logique existait dans l'ancien Python `run_payday()` avant sa suppression — on la réintègre côté RPC.

### Cas particulier : team avec `phase_confirmed_id = NULL` (late join)

GoudalEnergies a `phase_confirmed_id = NULL` (jamais payday). Quand le payday cascade tournera pour Phase 4, il marchera comme prévu pour eux (la guard d'idempotence ne se déclenche que si `phase_confirmed_id = current_phase_id`). Aucun traitement spécial requis.

## Composants modifiés

| Fichier | Modification |
|---|---|
| `apps/web/app/(game)/league/[leagueId]/auction/actions.ts` | `forceResolveRound` : à la fin, si `nextAuction === null`, appeler `confirm_phase_setup` pour chaque team de la league (boucle) + agréger les résultats dans le retour |
| `supabase/migrations/<ts>_round_validations_auto_validated.sql` | Ajouter colonne `auto_validated boolean DEFAULT false` à `round_validations` |
| `supabase/migrations/<ts>_payday_bankruptcy_cascade.sql` | Étendre `confirm_phase_setup` (CREATE OR REPLACE) avec la logique de bankruptcy auto-release |
| `supabase/migrations/<ts>_auto_validate_helper.sql` | Fonction SQL `auto_validate_unactionable_teams(p_auction_id, p_league_id)` appelée depuis `validate_round` et `forceResolveRound` |
| `supabase/migrations/<ts>_validate_round_with_auto_validation.sql` | Mettre à jour `validate_round` pour invoquer le helper avant le check de consensus |
| `apps/web/app/(game)/league/[leagueId]/auction/status/page.tsx` | Afficher l'état "Auto-validated (no actions possible)" pour les rows avec `auto_validated=true` |
| Tests TS | Couvrir la cascade payday après R3 + auto-validation logic + bankruptcy |
| Tests pytest | Sanity check sur la nouvelle logique RPC bankruptcy |

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

- **Bouton manuel "Confirm Phase Setup" séparé** : pas besoin, le déclenchement est automatique
- **Notifications in-app du payday** : la simple présence des entries `treasury_log` suffit pour la transparence — design futur si besoin
- **Réparation des phases passées non confirmées** : Phase 4 sera la première phase avec ce nouveau système. Les phases 1-3 restent dans leur état actuel (Phase 3 confirmée, autres phases incluses dans la "racing phase" précédente)
- **Refund partiel sur release** : reste à 0% (design game)

## Verification

1. **Tests automatisés**
   - Vitest : forceResolveRound doit déclencher la cascade payday quand `nextAuction === null`
   - Vitest : auto-validation marque correctement les teams non actionables
   - Pytest : confirm_phase_setup avec roster surfacturé déclenche le bankruptcy cascade

2. **Smoke test manuel sur dev league**
   - Setup : 2 teams, R1+R2 résolus, R3 ouvert
   - Toutes les teams validate R3 → résolution → payday cascade observable :
     - `teams.treasury` mise à jour pour les 2 teams
     - `teams.phase_confirmed_id` = phase courante
     - `treasury_log` contient les sponsor_payment + payday_salary
   - Vérifier qu'une team avec PP négatif post-payday subit l'auto-release du coureur le plus cher

3. **Production smoke test**
   - Quand cette feature shippe, observer le prochain payday Phase 5 (ou rattrapage Phase 4 si commissaire force-resolve)
   - Vérifier les treasury et logs de toutes les 8 équipes

## Critical files to modify

- [apps/web/app/(game)/league/[leagueId]/auction/actions.ts:558](apps/web/app/(game)/league/[leagueId]/auction/actions.ts:558) — fin de `forceResolveRound`, ajouter cascade payday
- [supabase/migrations/20260508100000_confirm_phase_setup_payday.sql:35-130](supabase/migrations/20260508100000_confirm_phase_setup_payday.sql:35-130) — étendre avec bankruptcy
- Nouvelle migration : auto-validation logic (table function ou trigger)

## Open questions for review

- (none — design fully validated by user)
