# Deferred Items — Next Sessions

> Reportés le 2026-04-03 après le merge de la branche `feature/budget-sponsor-redesign`.

---

## UI / UX

### RD-13. Rider Detail page — SegmentedControl incohérent ⏳ DEFERRED
- La page rider detail affiche ou non un SegmentedControl (onglets PCS + historique jeu) selon le point d'entrée (`?from=recruits|team|ranking`).
- Avec l'ajout des free agents dans le Rider Ranking, un 4ème état apparaît : `?from=ranking` sur un free agent (pas de contrat actif).
- **Objectif** : unifier l'affichage — toujours montrer les 2 onglets (PCS info + game history avec nom d'équipe par ligne), indépendamment du `?from`.
- **Effort estimé** : moyen (refactor de la logique conditionnelle dans `rider/[riderId]/page.tsx`).

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

### ~~3. Treasury_log : phase economy~~ ✅ DONE (93ceacb)
- Payday déplacé de `confirmPhaseSetup` vers le pipeline Python (`auction.py → run_payday()`)
- Se déclenche à la résolution du Round 1 uniquement (pas au premier bid)
- `confirmPhaseSetup` reste disponible mais plus auto-appelé

### ~~4. Enrichissement riders 500-600~~ ✅ DONE (lancé manuellement 2026-04-03)
- Pipeline lancé par l'utilisateur en local.

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

### ~~24. Phases — Trous entre les phases + enchères dans le vide~~ ✅ DONE (da7ab47)
- Phases contiguës, 0 trou. Enchères = premiers jours de chaque phase.
- `phases.ts` + `auction.py` + game-guide + GAME_RULES.md tous mis à jour.

### ~~25. Budget — Phase cards vides avant validation Round 1~~ ✅ DONE (décision produit)
- Avant le premier payday : rien à afficher, c'est normal. Pas de changement nécessaire.

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
