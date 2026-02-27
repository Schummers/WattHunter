# Phase 2 — Plan de continuation : Tests & Push

## Contexte

Phase 2 (PCS Pipeline & Auctions, US-07 à US-13) est **implémentée et mergée sur main** mais **pas encore pushée sur GitHub**. La migration Supabase est appliquée en distant.

Ce plan couvre les étapes restantes avant le push + PR.

---

## Étape 1 : Tests manuels frontend (utilisateur)

Lancer `pnpm dev` et tester dans le browser :

### 1.1 — Page calendrier enchères
- URL : `/league/[leagueId]/auctions`
- [ ] La page s'affiche sans erreur
- [ ] Les onglets Active / À venir / Terminées fonctionnent
- [ ] Les badges de statut s'affichent correctement
- [ ] Le lien vers le détail d'une enchère fonctionne

### 1.2 — Page détail enchère
- URL : `/league/[leagueId]/auctions/[auctionId]`
- [ ] Treasury widget (barre sticky) affiche trésorerie, mises actives, budget dispo
- [ ] Rider table se charge avec les coureurs
- [ ] Recherche par nom fonctionne
- [ ] Filtres équipe et spécialité fonctionnent
- [ ] Tri par points PCS (défaut) fonctionne
- [ ] Badge "Sous contrat" visible sur les coureurs déjà engagés

### 1.3 — Dialog de mise (bidding)
- [ ] Clic sur un coureur ouvre le dialog
- [ ] Photo, nom, équipe, nationalité, âge affichés
- [ ] Infos spécialité, points PCS, classement, salaire minimum affichés
- [ ] Input montant avec step 100 et min = salaire
- [ ] Budget preview se met à jour en temps réel
- [ ] Budget preview passe en rouge si négatif
- [ ] Bouton "Confirmer la mise" désactivé si montant invalide ou budget insuffisant
- [ ] Soumission d'une mise fonctionne (vérifier dans Supabase)
- [ ] Modification d'une mise existante fonctionne
- [ ] Annulation d'une mise fonctionne
- [ ] Section "Mes mises" se met à jour après action

### 1.4 — Page résultats
- URL : `/league/[leagueId]/auctions/[auctionId]/results`
- [ ] Onglets Round 1/2/3 fonctionnent
- [ ] Tableau des coureurs attribués s'affiche
- [ ] Mes enchères gagnantes sont surlignées
- [ ] Stats résumé (coureurs attribués, montant total, mise moyenne) correctes
- [ ] État vide "Aucun coureur attribué" quand un round n'a pas de résultats

### Pré-requis pour tester
- Il faut des données en base : au moins 1 ligue, 1 enchère ouverte, des coureurs sync'd
- Si pas de données : créer manuellement via Supabase dashboard ou seed

---

## Étape 2 : Corrections post-test (Claude)

Après les retours utilisateur :
- Corriger les bugs visuels / fonctionnels identifiés
- Chaque fix = un commit séparé sur main
- Re-run `pnpm typecheck` + `pnpm lint` après chaque correction

---

## Étape 3 : Tests automatisés (Claude)

### 3.1 — Tests Python (services/pcs-sync/)
Fichier : `services/pcs-sync/tests/`
- [ ] `test_scoring.py` — calculate_daily_scores avec données mockées
- [ ] `test_auction.py` — resolve_current_round : cas nominal, tiebreak, round 3 close, no bids
- [ ] `test_email_notify.py` — send_round_recap avec RESEND_API_KEY absent (no-op)
- [ ] `test_sync.py` — calculate_monthly_salary formula, sync_race_results avec Supabase mocké

Framework : pytest + unittest.mock (pas de Supabase réel ni Playwright réel dans les tests)

### 3.2 — Tests TypeScript (apps/web/)
- [ ] `actions.test.ts` — placeBid validation Zod, budget check, cancelBid
- [ ] Vérifier que les server actions retournent les bonnes erreurs pour chaque cas edge

Framework : vitest (à installer si pas présent)

### 3.3 — Vérification finale
```bash
pnpm typecheck    # doit passer
pnpm lint         # doit passer
cd services/pcs-sync && pytest  # doit passer
```

---

## Étape 4 : Push + PR (Claude)

Une fois tous les tests OK :
```bash
git push -u origin main
```

Ou si on préfère une PR :
1. Créer une branche `phase2-pcs-auctions-final`
2. Push + `gh pr create`
3. Merge après review

---

## Fichiers de référence

| Fichier | Contenu |
|---------|---------|
| `docs/plans/2026-02-27-pcs-pipeline-and-auctions-implementation.md` | Plan d'implémentation original (12 tasks) |
| `docs/plans/2026-02-27-pcs-pipeline-and-auctions-design.md` | Design doc technique |
| `docs/research/2026-02-27-pcs-data-access.md` | Recherche PCS data access + décision Playwright |
| `CLAUDE.md` | Règles critiques du projet |

## Pour démarrer la prochaine session

Dire à Claude :
> Lis le plan `docs/plans/2026-02-27-phase2-continuation.md` et exécute-le. On commence par l'étape où on en est.
