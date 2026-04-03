# Deferred Items — Next Session

> Items reportés depuis `TODO_FOLLOWUP_AUCTIONS.md` le 2026-04-03.
> Traiter lors d'une prochaine session.

---

### 1. Auto-validation joueur inactif
- Si un joueur ne valide pas avant la deadline : roster actuel conservé, même sponsor/policy, 0 nouveaux bids.
- Si en déficit : auto-release du coureur le plus cher, en boucle jusqu'à l'équilibre.
- **Impl** : Supabase Edge Function ou cron job qui tourne à chaque deadline de round.

### 2. Résultats de round dans Auctions
- Après la résolution d'un round, afficher qui a gagné/perdu chaque coureur.
- Design à définir.

### 3. Treasury_log : phase economy pas implémentée
- Les types `payday_salary`, `release_fee`, `sponsor_payment` (récurrent) ne sont jamais insérés dans `treasury_log`.
- La page Budget > Transactions est vide pour toutes les phases.
- **Impl** : Créer un job (Edge Function ou cron) qui à chaque début de phase :
  1. Insère `sponsor_payment` (montant = `sponsors.monthly_budget`) pour chaque team
  2. Insère `payday_salary` (montant négatif = `contracts.locked_salary`) pour chaque contrat actif
  3. Met à jour `teams.treasury` en conséquence
- Les `sponsor_bonus` sont déjà gérés par le pipeline `post-race` (OK).
- **Priorité** : Bloquant pour que la page Budget ait du contenu réel.

### 4. Enrichissement riders 500-600
- Beaucoup de riders sans spécialité dans la tranche 500-600.
- Commande : `cd services/pcs-sync && python3 run_pipeline.py enrich-riders --start 501 --end 600`
- ~1h d'exécution, IP résidentielle requise.

### 5. Draft bids perdus lors de la navigation
- Les bids en draft (montants modifiés localement) se perdent quand on navigue vers Rider Detail et qu'on revient.
- À investiguer : est-ce que le save persiste bien en DB ou si c'est juste le state local ?
- Fix potentiel : `sessionStorage` ou s'assurer que le save DB est appelé avant navigation.
