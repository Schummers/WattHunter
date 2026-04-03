# Follow-up — Market & Auctions Redesign

> Créé le 2026-04-03 après le merge de `feat/market-auctions-redesign`.
> Mis à jour le 2026-04-03 : consolidation avec feedback Improvements.
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

### 3. Sponsor/Policy changeable pendant TOUTE la phase d'enchères
- **Problème** : `isEditable` dans `auctions-client.tsx` est gated à `activeRound === null || activeRound === 1` — bloque les changements après Round 1.
- **Spec** : Permettre de changer sponsor, policies, et release des riders pendant les 3 rounds (pas seulement avant Round 1). Ajouter un message expliquant que les changements sont possibles à chaque round.
- **Conséquence financière** : Release d'un rider déjà payé = pas de remboursement du salaire de la phase. Changement de sponsor = nouveau budget appliqué au prochain round.

### 4. Draft bids perdus lors de la navigation
- **Problème** : Les bids en draft sont stockés en state local (`useState`). Naviguer vers Rider Detail et revenir = perte de tous les drafts.
- **Fix** : Persister les drafts côté serveur (table `draft_bids`) OU utiliser `sessionStorage` / URL state pour survie entre navigations.

### 5. Auto-validation joueur inactif
- Si un joueur ne valide pas avant la deadline : roster actuel conservé, même sponsor/policy, 0 nouveaux bids.
- Si en déficit → auto-release du coureur le plus cher, en boucle jusqu'à l'équilibre.
- **Impl** : Supabase Edge Function ou cron job qui tourne à chaque deadline de round.

### 6. Policy boost = roster + drafts
- Actuellement le boost total affiché dans ConfigCards ne prend en compte que les riders du roster.
- Il devrait inclure aussi les riders en draft pour donner un aperçu du boost après validation.
- **Fix** : Dans `auctions/page.tsx`, inclure les draft riders dans le calcul `activePoliciesDisplay`.

### 7. DraftBidCard : saisie directe du montant
- L'input dans DraftBidCard (page Auctions) est `readOnly` — seuls les boutons +/- fonctionnent.
- Permettre la saisie directe au clavier (comme dans Market).

### 8. Release button : confirmation modale custom
- Actuellement utilise `confirm()` natif pour les rounds 2-3.
- Remplacer par une modale design system avec le message : "Release [name]? You already paid his €X salary for this phase. It will not be refunded."

### 9. Rider Detail depuis My Bids → mauvais état
- **Problème** : Cliquer sur un rider depuis l'onglet My Bids ouvre la vue "ranking" au lieu de la vue "bid" (pas de `?from=recruts` passé).
- **Fix** : Passer `?from=recruts` depuis les rider cards dans l'onglet My Bids.

### 10. Photo plus grande dans les rider cards
- **Problème** : Avatar `h-9 w-9` (36px) dans rider-card est petit.
- **Fix** : Passer à `h-11 w-11` ou `h-12 w-12` pour meilleure lisibilité.

### 11. Geist Mono uniquement sur les chiffres
- **Problème** : `font-mono` parfois appliqué sur des labels texte (ex: "XP", noms de section) en plus des valeurs numériques.
- **Règle** : `font-[family-name:var(--font-geist-mono)]` UNIQUEMENT sur les caractères numériques. Sur une même ligne, le label est en Geist Sans et la valeur en Geist Mono.

---

## P2 — Nice to have

### 12. iOS/Android : désactiver l'AutoFill bar au-dessus du clavier
- **Problème** : Sur iOS Safari, la barre AutoFill (clé, carte, localisation) s'affiche au-dessus du clavier sur tous les inputs, prend de la place inutilement.
- **Fix iOS** : `autoComplete="off"` sur les `<input>`, `inputMode="numeric"` pour les champs montant.
- **Fix Android** : `autoComplete="off"` fonctionne aussi sur Chrome Android. Ajouter `autocomplete="off"` (HTML natif) en complément.

### 13. Indicateur visuel "déjà en draft" dans Market
- Les riders déjà en draft depuis une session précédente montrent le `bidState="active"` mais leur montant n'est pas pré-rempli dans l'input du Market.
- Pré-remplir l'input avec le montant sauvé dans `draft_bids`.

### 14. My Bids vide : afficher le roster existant
- **Problème** : Quand My Bids est vide, affiche "No active bids. Browse the market..." avec un bouton inutile.
- **Spec** : Afficher le roster actuel (riders sous contrat) avec possibilité de release. Message : "No active bids. Browse the market to place your first bid." (texte seul, pas de bouton).

### 15. Résultats de round dans Auctions
- Après la résolution d'un round, afficher qui a gagné/perdu chaque coureur.
- Design à définir.

### 16. Treasury_log : phase economy pas implémentée
- **Problème** : Les types `payday_salary`, `release_fee`, `transfer_bonus`, `sponsor_payment` (récurrent) ne sont **jamais insérés** dans `treasury_log` — seul le 1er paiement sponsor (onboarding) et les `sponsor_bonus` (via pipeline post-race) sont créés.
- **Conséquence** : La page Budget > Transactions est vide pour toutes les phases (aucune donnée).
- **Impl nécessaire** : Créer un job (Edge Function ou cron) qui, à chaque début de phase :
  1. Insère `sponsor_payment` (montant = `sponsors.monthly_budget`) pour chaque team
  2. Insère `payday_salary` (montant négatif = `contracts.locked_salary`) pour chaque contrat actif
  3. Met à jour `teams.treasury` en conséquence
- Les `sponsor_bonus` sont déjà gérés par le pipeline `post-race` (OK).
- Les `release_fee` sont à insérer dans la server action `releaseRider` (montant = 0, trace seulement).
- **Priorité** : Bloquant pour que la page Budget ait du contenu réel.

### 17. Enrichissement riders 500-600
- Beaucoup de riders sans spécialité dans la tranche 500-600.
- Commande : `cd services/pcs-sync && python3 run_pipeline.py enrich-riders --start 501 --end 600`
- ~1h d'exécution, IP résidentielle requise.

### 18. Back navigation depuis sponsor/policy → Market
- **Problème** : Le bouton retour depuis la page sponsor ou policy redirige vers Budget au lieu de Market.
- **Fix** : Passer un `?from=market` param et ajuster `back-header.tsx` pour rediriger vers la bonne page.

### 19. Sticky bar trop longue sur mobile
- **Problème** : "Add 1 to Draft Auction" + slots + budget wrappent sur 2 lignes sur petit écran.
- **Fix** : CTA raccourci à `+ Draft Auction` + supprimer l'info slots de la sticky bar (déjà visible dans le header "X AVAILABLE · 6/8 SLOTS"). Ne garder que le budget + le CTA.

### 20. Race Programme : noms de courses en font-weight regular + blanc
- **Problème** : Dans Rider Detail > Race Programme, les noms de courses (Paris-Nice, Amstel Gold Race, etc.) sont en font-weight medium/semibold.
- **Fix** : Passer les noms de courses en `font-normal text-[var(--text-high)]` (regular weight, blanc).

### 21. Sponsor card : "Change" redirige vers Settings au lieu de la page sponsors
- **Problème** : Cliquer "Change" sur le sponsor dans ConfigCards redirige vers `/settings` au lieu de `/budget/marketplace`.
- **Fix** : Corriger le lien href dans ConfigCards pour pointer vers la page sponsor marketplace.

### 22. Sponsor/Policy cards : toute la carte cliquable + hover desktop
- **Problème** : Seul le lien "Change →" est cliquable. La carte entière devrait être cliquable.
- **Fix** : Wrapper la carte dans un `Link` ou `button`, ajouter `hover:bg-[var(--bg-surface-hover)]` pour le desktop.

### 23. Policy save ne fonctionne pas
- **Problème** : Modifier une policy et cliquer Save ne persiste pas le changement. Peut-être lié à l'absence de round actif au moment du test.
- **À investiguer** : Vérifier si le save est conditionné par un round actif, et corriger si nécessaire.

### 24. ConfigCards policies : trop long sur mobile, utiliser des icônes
- **Problème** : "Nationality +10%" et "Speciality +20%" prennent trop de place horizontalement sur petit écran.
- **Fix** : Afficher icône (drapeau pour Nationality, étoile pour Speciality) + tag boost (`+10%`). Enlever le texte "Nationality" / "Speciality".

### 25. Tailles de police trop petites dans ConfigCards
- **Problème** : Certains labels (ex: "450k/phase" pour Movistar) utilisent des tailles non accessibles, probablement sous `--type-micro` (10px).
- **Fix** : Auditer ConfigCards et s'assurer que toutes les tailles respectent le design system (minimum `--type-caption` = 12px pour les infos secondaires).

### 26. Roster cards dans Auctions : uniformiser avec Market/Draft
- **Chevron** : Le déplacer juste après le nom du coureur (comme Market), pas tout à droite.
- **Release button** : Remplacer "Release" texte par une icône `X` (croix) — même taille que l'icône poubelle des drafts. Ça libère de l'espace sur mobile.
- **Espacement** : Ajouter ~4-8px entre le salaire et le bouton release.
- **Hover** : La ligne entière change de couleur au survol (pas le nom en bleu). Seul le chevron peut passer en accent au hover.

### 27. Hover uniforme sur toutes les rider cards (Market, Roster, Draft)
- **Problème** : Dans Market, le nom passe en bleu au hover — il faudrait que toute la ligne change de bg au hover.
- **Fix** : `hover:bg-[var(--bg-surface-hover)]` sur la row, chevron passe en accent, texte reste inchangé.

### 28. Input focus : stroke change de couleur au focus
- **Problème** : Quand on clique dans un input (bid amount), le contour ne change pas — seul le texte tapé change de couleur.
- **Fix** : Ajouter `focus:border-[var(--accent-default)]` ou `focus-within:border-[var(--accent-default)]` sur les inputs de montant.

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
- [x] Search bar transparent (bg-transparent, border only)
- [x] Rank tags dans All tab
- [x] Photo+nom cliquables (pas toute la carte)
- [x] Slot counter inclut roster
- [x] Search placeholder "Search rider or team..." (pas country)
- [x] Horizontal scrollbar masquée (scrollbar-none)
- [x] ConfigCards : section titles design system (Sponsor, Policies, Roster)
- [x] History link visible dans Market (les 2 états)
- [x] Deficit alert message dans StickyBar
- [x] Min salary affiché sous le champ input
- [x] Cyan left bar supprimée des rider cards
- [x] Segment control full-width dans Rider Detail
- [x] Release button en rouge destructif
