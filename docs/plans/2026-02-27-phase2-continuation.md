# Phase 2 — Plan de continuation : Tests & Push

> Derniere mise a jour : 2026-02-28

## Contexte

Phase 2 (PCS Pipeline & Auctions, US-07 a US-13) est **implementee, testee manuellement et mergee sur main** mais **pas encore pushee sur GitHub**. Toutes les migrations Supabase sont appliquees en distant.

---

## Etape 1 : Tests manuels frontend ✅ TERMINE

Tous les flows manuels valides lors de la session 2026-02-28 :

- [x] Page calendrier encheres (Active / A venir / Terminees)
- [x] Page detail enchere : treasury widget, rider table, filtres/tri/recherche
- [x] Dialog de mise : photo coureur, budget preview temps reel
- [x] Soumission de mise (placeBid) — bug ON CONFLICT corrige
- [x] Modification et annulation de mise
- [x] Page resultats : rounds 1/2/3, tous les joueurs visibles
- [x] Section invite lobby : URL + code avec boutons copie separés
- [x] Boutons onboarding : Rejoindre (brand) / Créer (ghost)
- [x] Creation d'enchère par commissaire — bug INSERT RLS corrigé
- [x] Resolution round 1 manuelle via resolve_now.py — 4 coureurs attribués

---

## Etape 2 : Corrections post-test ✅ TERMINE

Bugs corriges (session 2026-02-28) :

| Bug | Cause | Fix |
|-----|-------|-----|
| "Erreur lors de la creation de l'equipe" | FK violation (public.users manquant) + chicken-and-egg RLS | Trigger `handle_new_user` + policy `teams_select_own` |
| "Erreur lors de la création de l'enchère" | Pas de policy INSERT sur `auctions` | Migration `auctions_insert_commissioner` |
| ON CONFLICT sur placeBid | Index partiel (`WHERE status='active'`) incompatible avec upsert PostgREST | Remplacé par SELECT+INSERT ou UPDATE explicite |
| Resultats page : seulement ses propres coureurs | Policy SELECT trop restrictive pendant enchère ouverte | Migration `auction_bids_select_resolved` |
| Tudor slug invalide (404 PCS) | Mauvais slug `tudor-pro-cycling-2026` | Corrigé en `tudor-pro-cycling-team-2026` |
| seed_riders.py champ `pcs_id` invalide | Schema utilise `pcs_slug` et `real_team` | Champs corrigés |

---

## Etape 3 : Tests automatises 🔲 A FAIRE (prochaine session)

### 3.1 — Tests Python (services/pcs-sync/)
Fichier : `services/pcs-sync/tests/`
- [ ] `test_scoring.py` — calculate_daily_scores avec donnees mockees
- [ ] `test_auction.py` — resolve_current_round : cas nominal, tiebreak, round 3 close, no bids
- [ ] `test_email_notify.py` — send_round_recap avec RESEND_API_KEY absent (no-op)

Framework : pytest + unittest.mock (pas de Supabase reel ni Playwright reel)

### 3.2 — Tests TypeScript (apps/web/)
- [ ] `actions.test.ts` — placeBid validation Zod, budget check, cancelBid

Framework : vitest

### 3.3 — Verification finale
```bash
pnpm typecheck    # doit passer
pnpm lint         # doit passer
cd services/pcs-sync && pytest  # doit passer
```

---

## Etape 4 : Push + PR 🔲 A FAIRE (prochaine session)

Une fois tous les tests OK :
```bash
git push -u origin main
```

---

## Etape 5 : Deploiement Railway 🔲 PROCHAINE PRIORITE

**Etat :** Code Python pret, Dockerfile a mettre a jour.

Le Dockerfile actuel ne contient pas Playwright ni Chromium. Il faut :

1. Baser l'image sur `mcr.microsoft.com/playwright/python:v1.x-focal` (ou equivalent)
2. Ou installer manuellement dans le Dockerfile :
   ```dockerfile
   FROM python:3.11-slim
   RUN apt-get update && apt-get install -y chromium chromium-driver ...
   RUN pip install playwright && playwright install chromium
   ```
3. Variables d'env Railway : `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `CONVERSION_RATE`
4. Valider le rate limiting PCS avant d'activer le cron quotidien (risque IP ban)

**Reference Playwright Docker :** https://playwright.dev/docs/docker

---

## Scope de la prochaine session

Commencer par : **"Lis le plan docs/plans/2026-02-27-phase2-continuation.md et execute-le. On commence par l'etape 3 (tests automatises)."**

Ordre recommande :
1. Ecrire les tests pytest (test_auction.py en priorite — logique de resolution)
2. Ecrire tests vitest si le temps le permet
3. Push + PR
4. Dockerfile Railway (si tests passent)

---

## Fichiers de reference

| Fichier | Contenu |
|---------|---------|
| `docs/plans/2026-02-27-pcs-pipeline-and-auctions-implementation.md` | Plan d'implementation original (12 tasks) |
| `docs/plans/2026-02-27-pcs-pipeline-and-auctions-design.md` | Design doc technique |
| `docs/research/2026-02-27-pcs-data-access.md` | Recherche PCS data access + decision Playwright |
| `CLAUDE.md` | Regles critiques du projet |
| `docs/ARCHITECTURE.md` | ADR-007 a ADR-010 : decisions session 2026-02-28 |
