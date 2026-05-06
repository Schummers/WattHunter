# WattHunter — CLAUDE.md

## Rule #1 — Design System First
Before ANY frontend work (new component, new page, styling change), READ `docs/watthunter-design-system-v3.md` first. Every decision (typography, colors, spacing, component patterns) must follow this file. If something is ambiguous or missing from the design system, ASK the user before inventing a solution.
- **Component patterns**: Use the design system components (Tags, Filter Chips, Underline Tabs) — do not invent new patterns.
- **Typography**: ALWAYS use `text-[length:var(--type-*)]` tokens. NEVER hardcode pixel sizes (`text-[15px]`, `text-[9px]`, etc.).
- **Colors**: ALWAYS use semantic tokens (`--text-high`, `--text-mid`, `--bg-surface`, `--accent-default`, etc.). NEVER hardcode hex colors.
- **Spacing**: Use Tailwind spacing utilities (`p-4`, `gap-3`) or `--space-*` tokens.
- **When in doubt**: ask the user rather than guessing.

## Rule #2 — Migrations Only for DB Changes
NEVER modify the database directly (no SQL via dashboard, no `supabase db query` to mutate data/schema). ALL schema and data changes must go through a migration file.

Workflow obligatoire :
1. Créer `supabase/migrations/<timestamp>_<description>.sql`
2. `supabase db push --linked` pour appliquer sur remote
3. Committer le fichier

Pourquoi : local et remote doivent toujours être identiques. Un `supabase db reset` doit pouvoir reconstruire la DB à l'identique. Toute modification hors migration casse cette garantie et désynchronise l'historique.

Exception autorisée : `supabase migration repair --status applied <version> --linked` pour resynchroniser une migration déjà appliquée manuellement (rattrapage uniquement, pas une habitude).

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

## Local Supabase (DB dev)
- **Runtime** : Colima + Docker CLI (`brew install colima docker`)
- **Démarrer** : `colima start --cpu 4 --memory 6` puis `supabase start --exclude vector,edge-runtime,logflare,imgproxy,studio,mailpit`
- **Arrêter** : `supabase stop` puis `colima stop`
- **Reset** : `supabase db reset` (applique toutes les migrations from scratch, pas de seed.sql pour le moment)
- **Accès DB** : `docker exec -i supabase_db_WattHunter psql -U postgres -d postgres`
- **Port Postgres** : 54322 (local) — connection string : `postgresql://postgres:postgres@127.0.0.1:54322/postgres`
- Pas de `psql` natif installé — passer par `docker exec` ou `supabase db query`
- `vector` et `edge-runtime` exclus car incompatibles avec Colima (socket Docker mount + JSR fetch)

## Sync PCS (données coureurs)
3 pipelines scraping procyclingstats.com, tous lancés manuellement via CLI.
- **Exécution locale uniquement** (IP résidentielle requise — Cloudflare bloque les IPs datacenter)
- Nécessite Python 3.9+, Playwright Chromium, fichier `.env` dans `services/pcs-sync/`
- Top 600 PCS global ranking

### Lancer les pipelines
```bash
cd services/pcs-sync

# Pipeline A — Init riders (1x/an) : sync top 600 PCS riders + season rankings 3 ans
python3 run_pipeline.py init-riders

# Pipeline B — Post-race : résultats + ranking global + scoring
python3 run_pipeline.py post-race --race "race/paris-nice/2026/stage-3"
python3 run_pipeline.py post-race --race "race/omloop-het-nieuwsblad/2026"

# Pipeline C — Startlists : programme prévisionnel
python3 run_pipeline.py startlists --race "race/paris-nice/2026"

# Pipeline D — Finance par phase : SUPPRIMÉ — remplacé par confirmPhaseSetup server action (in-app)

# Pipeline E — Enrichissement coureurs (1x/an) : photo, bio, spécialité, teams, résultats
python3 run_pipeline.py enrich-riders
python3 run_pipeline.py enrich-riders --start 401 --end 600
```
- Pipeline A : ~5 min (top 600 riders + 3 rankings)
- Pipeline B : ~30s (1 résultat + 1 ranking + scoring)
- Pipeline C : ~15s (1 page startlist)
- Pipeline D : SUPPRIMÉ (remplacé par server action confirmPhaseSetup)
- Pipeline E : ~1h (100 coureurs) / ~6h (600 coureurs, batch de 5 + 1min pause)
- Calendrier WT : `services/pcs-sync/wt_calendar_2026.json`

## Language rule
- ALL user-facing text in the app MUST be in English (UI labels, error messages, placeholders, button text, etc.)
- Code comments and variable names: English
- CLAUDE.md and docs can remain in French
- The user speaks French, but the app is English-only

## Règles critiques (NEVER DO)
- NEVER bypass le RLS. L'app web utilise toujours l'anon key.
- NEVER exposer la service_role key au browser/client.
- NEVER muter treasury_log directement — utiliser les fonctions helper.
- NEVER modifier les montants de bonus sponsor directement — ils sont définis dans la table `sponsors`.
- NEVER autoriser une enchère si treasury < total des enchères actives.
- NEVER skip la validation Zod sur les inputs d'API routes.
- NEVER libérer un coureur hors de la fenêtre d'enchères — le release prend effet au début de la phase suivante (sauf auto-release faillite).
- NEVER autoriser une validation si treasury < total des salaires + bids actifs.

## Constantes du jeu (calibrer avant le lancement alpha)
- Trésorerie départ : 200 000 €
- 1 sponsor par équipe, gating par niveau uniquement (pas de conditions d'éligibilité)
- Sponsor par défaut (Lotto T1) : 250 000 € / phase (fixe)
- 6 tiers sponsors : T1(Nv.1) T2(Nv.2) T3(Nv.3) T4(Nv.4) T5(Nv.6) T6(Nv.8)
- Bonus sponsor = crédités sur résultats de course (voir design spec)
- Multiplicateurs : ×2 Monument/Grand Tour, ×1.25 nationalité (T1-T4)
- Finance par phase : income sponsor + salaires déductés 1x par phase WT
- Enchère = salaire mensuel récurrent (pas un achat unique)
- Salaire mensuel = pts_PCS × 2 000 / 12 (pas de plafond)
- Salaire plancher (enchère min) : 5 000 €/mois
- Incrément d'enchère : 100 €/mois (pas 500)
- Release = gratuit (salaire de la phase non remboursé)
- Durée d'enchère : chaque round dure de sa date jusqu'à la date du round suivant (dernier round = fin de journée)
- 8 niveaux alignés sur les 8 phases WT (Season Start → Vuelta)
- Slots coureurs : 6 (Nv.1) → 7 → 8 → 9 → 10 → 11 → 12 (Nv.7-8)
- Stratégies actives max : 1 (Nv.1-2) → 2 (Nv.3-6) → 3 (Nv.7-8)
- 4 types de strategies : Speciality (Nv.1) → Nationality (Nv.3) → Teams (Nv.5) → Age (Nv.7)
- Pool = Top 600 PCS global (12 mois glissants), gating par rang selon niveau
- Pool min : Nv.1=#300 | Nv.2=#200 | Nv.3=#100 | Nv.4=#30 | Nv.5=#20 | Nv.6=#10 | Nv.7=#4 | Nv.8=#1
- XP : Nv.2=25 | Nv.3=150 | Nv.4=350 | Nv.5=600 | Nv.6=1200 | Nv.7=1800 | Nv.8=2400


## Blockers ouverts (résoudre avant alpha)
- [x] Simulation Excel : calibrer taux de conversion → remplacé par bonus sponsor fixes (voir design spec)
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
├── apps/web/                    # Next.js 16 App Router
│   ├── app/(auth)/              # Login, signup, onboarding, league create/join
│   ├── app/(game)/league/[leagueId]/  # Main game shell (auth guard + responsive layout)
│   │   ├── page.tsx             # Home / Lobby
│   │   ├── team/                # My Team
│   │   │   ├── auctions/        # Draft bids tab
│   │   │   │   └── rounds/      # Round validation
│   │   │   ├── market/          # Recruits tab
│   │   │   │   └── history/     # Auction history
│   │   │   └── strategies/       # Strategies tab
│   │   ├── budget/              # Budget P&L
│   │   │   ├── marketplace/     # Sponsor marketplace
│   │   │   └── transactions/    # Transaction log
│   │   ├── rider/[riderId]/     # Rider Detail (PCS + Game stats)
│   │   ├── auctions/            # Auction calendar
│   │   │   └── [auctionId]/     # Auction detail + results
│   │   ├── ranking/             # League ranking
│   │   ├── levels/              # Level progression
│   │   ├── help/                # Game guide
│   │   └── settings/            # Settings page
│   ├── components/              # App components
│   │   ├── rider-card.tsx       # Roster card, bid states, open slot
│   │   ├── metric-box.tsx       # Geist Mono values, accent highlight
│   │   ├── pill.tsx             # Tag v3 (4 variants, non-interactive)
│   │   ├── segmented-control.tsx # Filter Chips v3
│   │   ├── sub-tabs.tsx         # Underline sub-tabs, hide-on-scroll
│   │   ├── sticky-bar.tsx       # Save bar (unsaved bids)
│   │   ├── back-header.tsx      # ArrowLeft + label
│   │   ├── team-level-card.tsx  # Level card (home + default variants)
│   │   ├── phase-navigator.tsx  # Phase selector
│   │   ├── sponsor-bonus-card.tsx
│   │   ├── sponsor-bonus-details.tsx
│   │   ├── config-cards.tsx     # Commissioner config cards
│   │   ├── round-blocks.tsx     # Auction round timeline blocks
│   │   ├── draft-bid-card.tsx   # Draft bid entry card
│   │   ├── bid-adjust-card.tsx  # Bid adjustment card
│   │   ├── budget-summary.tsx   # Budget P&L summary header
│   │   ├── movement-tag.tsx     # +/- movement indicator tag
│   │   ├── brand-card.tsx       # Sponsor brand card (marketplace)
│   │   ├── info-card.tsx        # Generic info/stat card
│   │   ├── game-guide-accordion.tsx
│   │   ├── onboarding-cards.tsx
│   │   ├── form-field.tsx       # Form field wrapper
│   │   ├── transaction-row.tsx  # Transaction log row
│   │   ├── filter-chips.tsx     # Filter chip group
│   │   ├── detail-rail.tsx      # Desktop detail rail container
│   │   ├── rail-link.tsx        # Rail navigation link
│   │   ├── rail-router.tsx      # Rail routing logic
│   │   ├── rail-pages/          # Rail page components
│   │   │   ├── rider-detail-rail.tsx
│   │   │   ├── strategies-rail.tsx
│   │   │   └── levels-rail.tsx
│   │   ├── bottom-nav.tsx
│   │   ├── topbar.tsx
│   │   └── sidebar.tsx
│   ├── components/ui/           # Shadcn components (button, badge, avatar, etc.)
│   ├── hooks/                   # Shared hooks (use-scroll-direction)
│   └── lib/supabase/            # Clients Supabase (browser + server)
├── services/pcs-sync/           # Python — sync procyclingstats
├── supabase/
│   ├── migrations/              # 15+ tables SQL
│   ├── functions/               # Edge Functions
│   └── seed/                    # Stratégies + sponsors
├── docs/plans/                  # Design docs + implementation plans
├── docs/research/               # Design system research
└── CLAUDE.md
```

### SECURITY DEFINER RPCs (mutations critiques)
Les 5 mutations économiques passent par des RPCs atomiques (`SECURITY DEFINER`) dans Postgres.
Le code TS se limite à : Zod validation → `supabase.rpc(...)` → error forwarding.
- `place_bid` — enchère avec 11 validations (budget cross-round, level gating, slots)
- `validate_round` — conversion draft_bids → auction_bids (budget + slots check)
- `release_rider` — libération coureur avec phase lock
- `confirm_phase_setup` — confirmation phase (sponsor + strategies activation)
- `leave_league` — quitter ligue avec cascade cleanup
- Trigger `teams_protect_sensitive_fields` — bloque UPDATE direct sur level/treasury/xp/user_id/league_id (sauf service_role)
- Migrations : `supabase/migrations/2026050[3-5]*.sql` + rollbacks dans `_rollback/`

### Server Actions (TS — lectures + drafts)
- `app/(game)/league/[leagueId]/auction/[auctionId]/actions.ts` — placeBid (→ RPC), cancelBid, draft bids CRUD
- `app/(game)/league/[leagueId]/auction/actions.ts` — validateRound (→ RPC), addDraft, removeDraft
- `app/(game)/league/[leagueId]/auction/market/actions.ts` — confirmPhaseSetup (→ RPC)
- `app/(game)/league/[leagueId]/rider/[riderId]/actions.ts` — releaseRider (→ RPC)
- `app/(game)/league/[leagueId]/settings/actions.ts` — updateTeamName, leaveLeague (→ RPC), updateLeagueName
- `app/(game)/league/[leagueId]/team/strategies/actions.ts` — strategy management

## Gestion du contexte (compression)
- **Fichier de session** : `~/.claude/projects/-Users-jonathanschummers-Documents-WattHunter/memory/sessions/YYYY-MM-DD.md`
- **Avant compression** : sauvegarder proactivement dans le fichier session du jour : tâche en cours, décisions prises, items traités, prochaine action
- **Après compression** : relire le fichier session du jour pour reprendre le fil
- **Backlog centralisé** : `docs/TODO_BACKLOG.md` — source unique pour le bug fixing et les tâches UI
- Prévenir l'utilisateur quand une sauvegarde de contexte est faite

## Design System (v3.0 — 2026-03-09)
- Source of truth : `docs/watthunter-design-system-v3.md`
- Palette : Sky Blue Night (200° hue, ~18% sat) + Tailwind Cyan — tokens in `apps/web/app/globals.css`
- Font : Geist Sans (UI) + Geist Mono (ALL numbers) — package `geist`
- Icons : Lucide React (base) + @phosphor-icons/react (gamification)
- Theme : dark-first (no .dark class needed)
- Responsive : Sidebar 180px + Main (flex:3) + Detail Rail (flex:2, min 380px) at lg:
- **Radius-as-affordance** : 6px = interactive (buttons, chips), 20px = decorative (tags, badges)
- **3 component patterns** : Underline Tabs (`ui/tabs.tsx` line variant), Filter Chips (`segmented-control.tsx`), Tags (`pill.tsx` / `ui/badge.tsx`)
- Backlog : `docs/TODO_BACKLOG.md`
