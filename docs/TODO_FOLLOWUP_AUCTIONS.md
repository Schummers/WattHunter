# Follow-up — Market & Auctions Redesign

> Créé le 2026-04-03 après le merge de `feat/market-auctions-redesign`.
> Items classés par priorité. Traiter dans l'ordre.

---

## P0 — Critique (prochaine session)

### 1. Budget Auctions affiche l'ancien sponsor
- **Problème** : Dans l'écran Auctions, le budget affiché est basé sur l'ancien sponsor (ex: 250k Lotto) alors que l'utilisateur a sélectionné un nouveau sponsor (ex: Movistar).
- **Cause probable** : Le `validateRound` et l'affichage lisent `team.sponsor_id` qui pointe vers l'ancien sponsor. Le changement de sponsor via "Change →" n'est pas encore persisté côté DB ou n'est pris en compte qu'après validation.
- **Fix** : Quand Round 1 est actif et que l'utilisateur change de sponsor, le budget preview dans Summary et la StickyBar doivent refléter le NOUVEAU sponsor, pas l'actuel. Options :
  - (a) Stocker le "pending sponsor" dans un state local et l'utiliser pour le calcul budget
  - (b) Persister le changement de sponsor immédiatement dans `team_sponsors` avec un flag `pending`
  - (c) Créer une table `pending_config` (sponsor_id, policies) qui est appliquée à la validation

### 2. Commissioner : éditer les dates de rounds
- **Problème** : Les dates de rounds sont affichées mais pas éditables par le commissioner.
- **Spec** : Le commissioner clique sur un bloc Round → modale avec date picker + time picker → sauvegarde.
- **Dates demandées par l'utilisateur** :
  - Round 1 : vendredi 3 avril, se termine à minuit (heure française)
  - Round 2 : samedi, minuit
  - Round 3 : dimanche, midi
- **Action** : Créer un `SetRoundDatesModal` component + server action `setRoundDates` (la base existe déjà dans phase-setup actions).

---

## P1 — Important

### 3. Auto-validation joueur inactif
- Si un joueur ne valide pas avant la deadline : roster actuel conservé, même sponsor/policy, 0 nouveaux bids.
- Si en déficit → auto-release du coureur le plus cher, en boucle jusqu'à l'équilibre.
- **Impl** : Supabase Edge Function ou cron job qui tourne à chaque deadline de round.

### 4. Policy boost = roster + drafts
- Actuellement le boost total affiché dans ConfigCards ne prend en compte que les riders du roster.
- Il devrait inclure aussi les riders en draft pour donner un aperçu du boost après validation.
- **Fix** : Dans `auctions/page.tsx`, inclure les draft riders dans le calcul `activePoliciesDisplay`.

### 5. DraftBidCard : saisie directe du montant
- L'input dans DraftBidCard (page Auctions) est `readOnly` — seuls les boutons +/- fonctionnent.
- Permettre la saisie directe au clavier (comme dans Market).

### 6. Release button : confirmation modale custom
- Actuellement utilise `confirm()` natif pour les rounds 2-3.
- Remplacer par une modale design system avec le message : "Release [name]? You already paid his €X salary for this phase. It will not be refunded."

---

## P2 — Nice to have

### 7. Indicateur visuel "déjà en draft" dans Market
- Les riders déjà en draft depuis une session précédente montrent le `bidState="active"` mais leur montant n'est pas pré-rempli dans l'input du Market.
- Pré-remplir l'input avec le montant sauvé dans `draft_bids`.

### 8. Résultats de round dans Auctions
- Après la résolution d'un round, afficher qui a gagné/perdu chaque coureur.
- Design à définir.

### 9. Treasury_log cleanup
- Les anciens types `release_fee` et `transfer_bonus` existent peut-être encore dans des logs historiques.
- Pas bloquant mais nettoyer si le schema a un CHECK constraint.

### 10. Enrichissement riders 500-600
- Beaucoup de riders sans spécialité dans la tranche 500-600.
- Commande : `cd services/pcs-sync && python3 run_pipeline.py enrich-riders --start 501 --end 600`
- ~1h d'exécution, IP résidentielle requise.

---

## Fait (référence)

- [x] 3 sub-tabs (My Team / Market / Auctions)
- [x] Market toujours accessible (no phase-setup gating)
- [x] Draft bid system (Add to Draft Auction)
- [x] Auctions page wireframe V7
- [x] Release gratuit (no fee, no refund)
- [x] Validation forcée à l'équilibre (budget ≥ 0)
- [x] StickyBar unifiée (3 pages)
- [x] Rider Detail : 3 états action bar
- [x] Pagination Market (100 + Load more)
- [x] Segment control full-width
- [x] Search bar transparent
- [x] Rank tags dans All tab
- [x] Photo+nom cliquables (pas toute la carte)
- [x] Slot counter inclut roster
