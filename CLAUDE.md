# WattHunter — CLAUDE.md

## Stack
- Next.js 16 App Router, TypeScript strict mode
- Tailwind CSS v4 + Shadcn UI
- Supabase (Postgres + Auth + Realtime + Edge Functions)
- Python FastAPI microservice (Railway) pour le sync PCS
- Turborepo monorepo, pnpm workspaces

## Commands
- `pnpm dev` — démarre toutes les apps en mode dev
- `pnpm build` — build de production
- `pnpm lint` — ESLint sur tous les packages
- `pnpm typecheck` — tsc --noEmit sur tous les packages
- `supabase db push` — applique les migrations en attente
- `supabase functions serve` — Edge Functions en local
- `supabase db reset --linked` — reset + reseed (DESTRUCTIF)
- `cd services/pcs-sync && uvicorn main:app --reload` — service Python en local

## Règles critiques (NEVER DO)
- NEVER bypass le RLS. L'app web utilise toujours l'anon key.
- NEVER exposer la service_role key au browser/client.
- NEVER muter treasury_log directement — utiliser les fonctions helper.
- NEVER hardcoder CONVERSION_RATE — toujours lire depuis l'env.
- NEVER autoriser une enchère si treasury < total des enchères actives.
- NEVER skip la validation Zod sur les inputs d'API routes.
- NEVER libérer un coureur sans le préavis d'1 mois (sauf auto-release faillite).

## Constantes du jeu (calibrer avant le lancement alpha)
- Trésorerie départ : 500 000 €
- Salaire plancher : 5 000 €/mois | plafond : 300 000 €/mois
- Taux de conversion : 500 €/point PCS (PLACEHOLDER — simulation Excel obligatoire)
- Incrément minimum d'enchère : 100 €
- Durée d'enchère : 72 heures
- Slots coureurs : 6 (Niveau 1) → 12 (Niveau 10)
- Politiques actives max : 0 (Niveau 1) → 3 (Niveau 10)
- Contrats sponsors : 2 mois

## Blockers ouverts (résoudre avant alpha)
- [ ] Simulation Excel : calibrer taux de conversion (€/point PCS)
- [ ] Valider la tolérance au rate limit de procyclingstats (risque IP ban)
- [ ] Valider l'exactitude des données PCS pour le calcul des salaires
- [ ] Choisir le provider email (Supabase built-in vs Postmark)
- [ ] Définir la charte graphique / branding

## Références PRD
- PRD_01_OVERVIEW.md — vision, goals, personas, priorités features
- PRD_02_MECHANICS.md — économie, scoring, politiques, sponsors, enchères
- PRD_03_TECHNICAL.md — schéma DB, requirements, ordre d'implémentation

## Architecture
```
watthunter/
├── apps/web/          # Next.js 16 App Router
│   ├── app/(auth)/    # Login, onboarding
│   ├── app/(game)/    # Ligue, enchères, équipe, classement
│   ├── components/ui/ # Shadcn components
│   └── lib/supabase/  # Clients Supabase (browser + server)
├── services/pcs-sync/ # FastAPI Python — sync procyclingstats
├── supabase/
│   ├── migrations/    # 15 tables SQL
│   ├── functions/     # Edge Functions: calcul XP, finances mensuelles
│   └── seed/          # Politiques + sponsors
└── CLAUDE.md
```
