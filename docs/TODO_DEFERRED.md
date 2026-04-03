# Deferred Items — Next Sessions

> Reportés le 2026-04-03 après le merge de la branche `feature/budget-sponsor-redesign`.

---

## Fonctionnel

### 1. Auto-validation joueur inactif ⏳ TODO
- Si un joueur ne valide pas avant la deadline : roster conservé, même sponsor/policy, 0 nouveaux bids.
- Si en déficit : auto-release du coureur le plus cher, en boucle jusqu'à l'équilibre.
- **Impl** : Supabase Edge Function ou cron job à chaque deadline de round.

### 2. Résultats de round dans Auctions ⏳ TODO
- Après résolution d'un round, afficher qui a gagné/perdu chaque coureur.
- Design à définir.

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

### 10. Home — Prochaines courses absentes en phase Classiques
- La section "Next Races" ne s'affiche pas quand on est dans la phase Classiques.
- Devrait afficher toutes les courses WT jusqu'au Giro inclus.
- Vérifier le filtre de dates / phase dans la query.

### 11. Policies — Changement pas immédiat en Round 1
- Quand on change une policy, elle est sauvegardée mais pas activée immédiatement.
- En Round 1, les changements de policy devraient avoir un effet immédiat (cf. règle produit).
- Vérifier la logique `pending` vs `active` : en Round 1, le changement doit être `active` directement.
- Question ouverte : faut-il une date de début ET une date de fin pour chaque round ?

### 12. Sticky bar (slots + budget) — Absente ou cassée hors Market
- La barre sticky avec le compteur de slots et le budget fonctionne correctement dans Market (Recruts).
- **Manquante ou non dynamique** dans Rider Detail et Auction.
- Doit être le même composant partout, avec mise à jour dynamique quand on ajoute/modifie un bid.

### 13. CTA "Draft Auction" — Comportement post-save incorrect
- Après avoir sauvegardé les bids, le bouton reste cliquable (couleur active) alors qu'il devrait repasser en `disabled`.
- Le compteur dans le bouton ne compte que les bids modifiés dans la session courante, pas ceux déjà en draft (sessions précédentes).
- **Comportement attendu** : après save → bouton disabled sans compteur, jusqu'à ce qu'un nouveau bid soit modifié (changement d'input).
- Questionner l'utilité du compteur dans le bouton : l'info est déjà dans la sticky bar (slots + budget juste à côté).

### 14. Rider Detail — Redesign du flow bid/draft/release
- **Bug actuel** : après avoir créé un draft, le champ input (+/-) disparaît et la barre d'action change complètement d'état. Comportement incohérent avec Market.
- **Comportement attendu** :
  - Le champ input (+/-) reste TOUJOURS visible (sous les 3 métriques), quel que soit l'état (no bid, draft, owned).
  - La sticky bar en bas est IDENTIQUE partout : slots + budget dynamique + CTA.
  - **CTA flow** :
    1. Pas de bid → "Draft Auction" (enabled dès qu'un montant est saisi)
    2. Après save → "Update Draft" (disabled) — redevient enabled si l'input change
    3. Si owned → "Update Draft" remplacé par même logique (ou disabled si pas d'auction en cours)
  - **Bouton secondaire** (rouge outline, au-dessus de la sticky bar, sous l'input) :
    - Si draft → "Cancel Draft"
    - Si owned → "Release Rider"
  - Ce bouton est SÉPARÉ de la sticky bar pour garder la barre d'action cohérente sur tous les écrans.

### 15. Auction History — Bouton mène vers des pages inexistantes
- Le bouton "History" dans l'onglet Auction (Team) renvoie vers des pages jamais designées/développées.
- **Fix** : réutiliser exactement le même parcours que le bouton History de Market (même pages, même navigation).
- Supprimer les pages fantômes créées pour Auction History.

### 16. Bouton "Edit dates" (commissioner) — Caché derrière la bottom nav
- Le bouton pour modifier les dates de round est masqué par la bottom navigation mobile.
- **Fix** : positionner en sticky au-dessus de la bottom nav.

### 17. GitHub Actions cron jobs — Mettre en pause
- L'utilisateur veut gérer manuellement les résolutions d'enchères pour l'instant.
- Désactiver ou mettre en pause les GitHub Actions avec cron jobs (ne pas supprimer).

### 18. Release rider — Action cassée
- La modale de release s'affiche mais le clic ne fait rien — le coureur n'est pas libéré.
- Bug fonctionnel bloquant à investiguer.

### 19. Release rider — Message incohérent entre pages
- Page Auction : dit "release gratuit, pas de fee".
- Page Rider Detail : dit "tu as déjà payé son salaire, tu vas le perdre".
- **Règle** : en Round 1 (= entre début de la phase d'enchère et fin du round 1), le release est gratuit.
- Harmoniser le message sur toutes les pages.
- Clarifier la définition exacte de "être en Round 1" (début = ouverture enchère, fin = deadline round 1).

### 20. Budget summary — Trop de rouge
- Actuellement tout le bloc summary utilise du rouge.
- **Fix** : labels (Sponsoring, Roster Salary, Draft Bids, Remaining) tous en blanc / couleur primaire.
- Seul le montant "Remaining" passe en rouge quand il est en déficit.

### 21. Auction sticky bar — CTA "Validate Round 1"
- Réutiliser le même système que Market : slots + budget dynamique dans la sticky bar.
- Le CTA = "Validate Round 1" (au lieu de "Draft Auction").
- **Modale de confirmation** au clic : expliquer que après la deadline du round 1, sponsor/policy/bids sont verrouillés et les coureurs seront attribués.
- **Re-validation** : même après avoir validé, le joueur peut modifier (sponsor, policy, bids) tant que la deadline n'est pas passée → le bouton repasse en enabled et il faut revalider.
- **Message si disabled** (texte blanc, pas rouge) :
  - Trop de coureurs → "Too many riders"
  - Déficit → "Budget deficit"
  - Les deux → afficher les deux messages

### 22. Pending Bids — Simplifier
- N'afficher que les coureurs en draft dans la section Pending Bids.
- Les coureurs gagnés après résolution vont directement dans le roster.
- Pour voir l'historique (qui a gagné quoi), aller dans la page History.
- Supprimer tout affichage de résultats won/lost dans Pending Bids.

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

### 23. Bid increment — Passer de 500 à 100
- Les enchères doivent être par multiples de **100 €** (pas 500).
- Les boutons +/- incrémentent/décrémentent de 100.
- La validation input doit vérifier `amount % 100 === 0`.
- **Impacte** : Market, Auction, Rider Detail — tous les champs input de bid.

---

## Documentation

### ~~6. Mettre à jour ARCHITECTURE.md~~ ✅ DONE (2026-04-03)
- Mis à jour avec stack, arbre fichiers, design system v3, navigation, pipeline PCS, ADRs.

### ~~7. Mettre à jour GAME_RULES.md~~ ✅ DONE (2026-04-03)
- Sponsor/policies Round 1 immédiat, release gratuit, commissioner round dates, tiers vérifiés.

### 8. Mettre à jour CLAUDE.md ⏳ TODO
- Vérifier que les commandes, la structure, et les règles critiques sont à jour
- Ajouter les nouveaux composants créés (config-cards, round-blocks, draft-bid-card, etc.)
- Ajouter la route commissioner `/team/auctions/rounds/`

### 9. Vérifier la documentation in-game ⏳ TODO
- Page d'aide (?) dans le topbar — vérifier que les règles affichées sont cohérentes avec les mécaniques implémentées.
