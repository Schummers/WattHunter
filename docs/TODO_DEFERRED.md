# Deferred Items — Next Sessions

> Reportés le 2026-04-03 après le merge de la branche `feature/budget-sponsor-redesign`.

---

## Fonctionnel

### 1. Auto-validation joueur inactif ⏳ DEFERRED
- Si un joueur ne valide pas avant la deadline : roster conservé, même sponsor/policy, 0 nouveaux bids.
- Si en déficit : auto-release du coureur le plus cher, en boucle jusqu'à l'équilibre.
- **Impl** : Supabase Edge Function ou cron job à chaque deadline de round.
- **Décision** : validation manuelle pour l'alpha, automation plus tard.

### ~~2. Résultats de round dans Auctions~~ ✅ DONE
- ~~Après résolution d'un round, afficher qui a gagné/perdu chaque coureur.~~
- Déjà disponible dans la page Market History (`/team/market/history`).

### ~~3. Treasury_log : phase economy pas implémentée~~ ✅ DÉJÀ IMPL
- `confirmPhaseSetup` existe dans `team/market/actions.ts` (L91-284)
- Auto-appelée quand un joueur place un bid sans phase confirmée (`auctions/[auctionId]/actions.ts` L57-72)
- Insère `sponsor_payment` + `payday_salary` + gère bankruptcy cascade
- Page Budget vide = normal tant qu'aucun bid n'a déclenché de payday

### 4. Enrichissement riders 500-600 ⏳ TODO (manuel)
- Beaucoup de riders sans spécialité dans la tranche 500-600.
- `cd services/pcs-sync && python3 run_pipeline.py enrich-riders --start 501 --end 600`
- ~1h d'exécution, IP résidentielle requise.

### ~~5. Draft bids perdus lors de la navigation~~ ✅ DONE (f189f57)
- ~~Les montants modifiés localement se perdent quand on navigue vers Rider Detail et qu'on revient.~~
- Fix: Market page fetch maintenant `rider_id + amount` (pas juste `rider_id`), montants réels restaurés au retour.

---

### ~~15. Sponsor card Budget ≠ Marketplace~~ ✅ DONE (73b7d10)
- Card sponsor dans Budget utilisait un ancien design (SponsorBonusDetails).
- Fix: composant partagé `sponsor-bonus-card.tsx`, même layout marketplace (chevron droite, bonus inline).

### ~~16. Draft bid league_id null~~ ✅ DONE (73b7d10)
- `addDraft` upsert manquait `league_id` → NOT NULL violation en prod.
- Fix: ajouté `league_id: leagueId` dans le payload upsert.

---

## Bugs (trouvés 2026-04-03)

### ~~10. Home — Prochaines courses absentes en phase Classiques~~ ✅ DONE (2bc31f5)
- Phase window étendue pour matcher getCurrentPhase boundary (next phase start - 1 day).

### ~~11. Policies — Changement pas immédiat en Round 1~~ ✅ DONE (2bc31f5)
- Remplacé `isLeagueFirstCycle` par query directe "Round 1" ouvert sur la ligue.

### ~~12. Sticky bar (slots + budget) — Absente ou cassée hors Market~~ ✅ DONE (ca2855b)
- StickyBar ajoutée dans Rider Detail + Auctions tab avec slots/budget dynamique.

### ~~13. CTA "Draft Auction" — Comportement post-save incorrect~~ ✅ DONE (2bc31f5)
- `savedDraftIds` mis à jour après save réussi → bouton disabled immédiatement.

### ~~14. Rider Detail — Redesign du flow bid/draft/release~~ ✅ DONE (ca2855b)
- Input bid toujours visible, StickyBar identique Market, CTA "Draft Auction"/"Update Draft".
- Bouton secondaire Cancel Draft / Release Rider sous l'input (pas dans la sticky bar).

### ~~15. Auction History — Bouton mène vers des pages inexistantes~~ ✅ DONE
- Redirigé vers `/team/market/history` (même page que Market).

### ~~16. Bouton "Edit dates" (commissioner) — Caché derrière la bottom nav~~ ✅ DONE (ca2855b)
- Sticky button offset dynamique au-dessus de la bottom nav mobile.

### ~~17. GitHub Actions cron jobs — Mettre en pause~~ ✅ DONE
- Cron schedule commenté dans `resolve-auctions.yml`, `workflow_dispatch` conservé.

### ~~18. Release rider — Action cassée~~ ✅ DONE
- Cause : policy RLS UPDATE manquante sur `contracts`. L'update était silencieusement bloqué.
- Fix : migration `20260403300000_contracts_update_own.sql` + appliquée sur Supabase distant.

### ~~19. Release rider — Message incohérent entre pages~~ ✅ DONE (ca2855b)
- Message harmonisé partout : "Free release — phase salary not refunded".

### ~~20. Budget summary — Trop de rouge~~ ✅ DONE
- Labels salaires/bids passés en `text-mid` (neutre). Rouge conservé uniquement sur "Remaining" en déficit.

### ~~21. Auction sticky bar — CTA "Validate Round 1"~~ ✅ DONE (ca2855b)
- StickyBar avec "Validate Round X" / "Re-validate" (disabled après validation, re-enabled sur modification).
- Warning blanc "Too many riders", rouge "Budget deficit".

### ~~22. Pending Bids — Simplifier~~ ✓ DONE (2026-04-03)
- ~~N'afficher que les coureurs en draft dans la section Pending Bids.~~
- ~~Renamed "Pending Bids" → "Draft Bids"; removed outbid/won display; only active bids shown.~~

### 24. Phases — Trous entre les phases + enchères dans le vide
- Les dates dans `lib/phases.ts` ont des **trous de 2-3 jours** entre chaque phase.
- Ces trous correspondent aux `auctionDates` de la phase précédente → les enchères tombent entre deux phases.
- **Fix proposé** : les enchères d'une phase N appartiennent au **début** de la phase N+1.
  - Phase N finit le dernier jour de course.
  - Phase N+1 commence le premier jour d'enchère (= lendemain de la fin de phase N).
  - Les `auctionDates` sont les premiers jours de la nouvelle phase.
- Concrètement : `phase.startDay` = premier jour d'enchère, plus de trous.
- **En attente de validation utilisateur** sur cette approche.
- Vérifier aussi que les dates correspondent au calendrier WT 2026 réel.

### 25. Budget — Phase cards vides avant validation Round 1
- Les données treasury (sponsor income, salary deductions) ne sont créées qu'à l'appel de `confirmPhaseSetup()`.
- **Comportement attendu** : ne rien afficher dans les phase cards tant que le joueur n'a pas validé son premier round.
- Après validation Round 1 : afficher sponsor income − salaires roster − salaires nouveaux coureurs gagnés.
- Après chaque round suivant : mise à jour avec les nouveaux coureurs gagnés (salaire déduit immédiatement).
- Bonus sponsor : mis à jour après chaque course (résultats).
- **Pas d'historique sponsor par phase** : actuellement `team_sponsors` ne stocke que le sponsor actif → les phases passées montrent le sponsor actuel au lieu de celui qui était actif à l'époque. À corriger si on veut un historique fidèle.

### ~~23. Bid increment — Passer de 500 à 100~~ ✅ DONE (2bc31f5)
- Zod, inputs, bid-adjust-card, migration DB — tous passés à 100.

---

## Documentation

### ~~6. Mettre à jour ARCHITECTURE.md~~ ✅ DONE (2026-04-03)
- Mis à jour avec stack, arbre fichiers, design system v3, navigation, pipeline PCS, ADRs.

### ~~7. Mettre à jour GAME_RULES.md~~ ✅ DONE (2026-04-03)
- Sponsor/policies Round 1 immédiat, release gratuit, commissioner round dates, tiers vérifiés.

### ~~8. Mettre à jour CLAUDE.md~~ ✅ DONE (f905fba)
- Architecture, composants, game constants (bid 100), server actions documentés.

### ~~9. Vérifier la documentation in-game~~ ✅ DONE (0ef3df4)
- Page d'aide (?) dans le topbar — vérifier que les règles affichées sont cohérentes avec les mécaniques implémentées.
