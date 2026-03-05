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

## Sync PCS (données coureurs)
3 pipelines scraping procyclingstats.com, tous lancés manuellement via CLI.
- **Exécution locale uniquement** (IP résidentielle requise — Cloudflare bloque les IPs datacenter)
- Nécessite Python 3.9+, Playwright Chromium, fichier `.env` dans `services/pcs-sync/`
- Top 500 PCS global ranking

### Lancer les pipelines
```bash
cd services/pcs-sync

# Pipeline A — Init riders (1x/an) : sync top 500 PCS riders + season rankings 3 ans
python3 run_pipeline.py init-riders

# Pipeline B — Post-race : résultats + ranking global + scoring
python3 run_pipeline.py post-race --race "race/paris-nice/2026/stage-3"
python3 run_pipeline.py post-race --race "race/omloop-het-nieuwsblad/2026"

# Pipeline C — Startlists : programme prévisionnel
python3 run_pipeline.py startlists --race "race/paris-nice/2026"

# Pipeline D — Finances mensuelles (1x/mois, le 1er) : salaires + sponsor + bonus coureurs
python3 run_pipeline.py monthly-finance

# Pipeline E — Enrichissement coureurs (1x/an) : photo, bio, spécialité, teams, résultats
python3 run_pipeline.py enrich-riders
python3 run_pipeline.py enrich-riders --start 401 --end 500
```
- Pipeline A : ~5 min (top 500 riders + 3 rankings)
- Pipeline B : ~30s (1 résultat + 1 ranking + scoring)
- Pipeline C : ~15s (1 page startlist)
- Pipeline D : ~5s (calcul mensuel toutes ligues actives)
- Pipeline E : ~1h (100 coureurs) / ~5h (500 coureurs, batch de 5 + 1min pause)
- Calendrier WT : `services/pcs-sync/wt_calendar_2026.json`

## Règles critiques (NEVER DO)
- NEVER bypass le RLS. L'app web utilise toujours l'anon key.
- NEVER exposer la service_role key au browser/client.
- NEVER muter treasury_log directement — utiliser les fonctions helper.
- NEVER hardcoder CONVERSION_RATE — toujours lire depuis l'env.
- NEVER autoriser une enchère si treasury < total des enchères actives.
- NEVER skip la validation Zod sur les inputs d'API routes.
- NEVER libérer un coureur sans le préavis d'1 mois (sauf auto-release faillite).

## Constantes du jeu (calibrer avant le lancement alpha)
- Trésorerie départ : 200 000 €
- Sponsor par défaut : 200 000 €/mois (beta flat, sans tiers)
- Enchère = salaire mensuel récurrent (pas un achat unique)
- Salaire mensuel = pts_PCS × 2 000 / 12 (pas de plafond)
- Bonus coureur par course = max(0, pts_course × 1 500 - salaire_mensuel)
- Salaire plancher (enchère min) : 5 000 €/mois
- Taux de conversion bonus : 1 500 €/point PCS
- Incrément minimum d'enchère : 100 €
- Durée d'enchère : 72 heures
- Slots coureurs : 6 (Niveau 1) → 12 (Niveau 10)
- Politiques actives max : 0 (Niveau 1) → 3 (Niveau 10)
- Pool = Top 500 PCS global (12 mois glissants), gating par rang selon niveau
- XP Niveau 5 = 10 000 | XP Niveau 10 = 120 000
- Contrats sponsors : 2 mois

## Blockers ouverts (résoudre avant alpha)
- [ ] Simulation Excel : calibrer taux de conversion (€/point PCS)
- [x] Valider la tolérance au rate limit de procyclingstats → résolu : 15s pause entre équipes, fresh context par team
- [ ] Valider l'exactitude des données PCS pour le calcul des salaires
- [ ] Définir la stratégie de notifications in-app (pas d'emails)
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
