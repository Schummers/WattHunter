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

## Rule #3 — Architecture & Memory Are Single Sources of Truth
Avant tout travail non-trivial, lire dans cet ordre :
1. **`docs/ARCHITECTURE.md`** — arborescence détaillée, server actions, RPCs, composants. Mis à jour avec le code.
2. **`~/.claude/projects/-Users-jonathanschummers-Documents-WattHunter/memory/MEMORY.md`** — index features, gotchas DB, historique des décisions.

Ce CLAUDE.md ne duplique PAS ces fichiers (counts, listes de fichiers, historique) — il ne contient que des règles durables et des contraintes métier. Si une info manque ici, c'est qu'elle vit dans ARCHITECTURE.md ou MEMORY.md.

## Stack
- Next.js 16 App Router, TypeScript strict mode
- Tailwind CSS v4 + Shadcn UI
- Supabase (Postgres + Auth + Realtime + Edge Functions)
- Python CLI scripts pour le sync PCS (exécution **locale** uniquement — voir Sync PCS ci-dessous)
- Turborepo monorepo, pnpm workspaces

## Commands
- `pnpm dev` — démarre toutes les apps en mode dev
- `pnpm build` — build de production
- `pnpm lint` — ESLint sur tous les packages
- `pnpm typecheck` — tsc --noEmit sur tous les packages
- `pnpm test` — vitest (apps/web)
- `supabase db push` — applique les migrations en attente
- `supabase functions serve` — Edge Functions en local
- `supabase db reset --linked` — reset + reseed (DESTRUCTIF)

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
Pipelines de scraping procyclingstats.com lancés manuellement via CLI.
- **Exécution locale uniquement** (IP résidentielle requise — Cloudflare bloque les IPs datacenter)
- **Backend par défaut : nodriver** (depuis 2026-05-24, migration de Playwright). Playwright reste en fallback via `SCRAPER_BACKEND=playwright`. Shim : `services/pcs-sync/browser_session.py`.
- **Venv Python 3.12 obligatoire** (nodriver requiert >=3.10) : `services/pcs-sync/.venv/`. Toujours invoquer `.venv/bin/python`, jamais `python3` (système = 3.9 = nodriver incompat).
- Fichier `.env` dans `services/pcs-sync/` (Supabase URL + service role key).

### Commandes principales
```bash
cd services/pcs-sync

# (Setup one-shot — déjà fait) :
# /opt/homebrew/bin/python3.12 -m venv .venv && .venv/bin/pip install -r requirements.txt && .venv/bin/python -m playwright install chromium

# Init riders (1x/an) : sync top 600 PCS + season rankings 3 ans
.venv/bin/python run_pipeline.py init-riders

# Post-race : résultats + ranking + scoring
.venv/bin/python run_pipeline.py post-race --race "race/paris-nice/2026/stage-3"

# Startlists : programme prévisionnel
.venv/bin/python run_pipeline.py startlists --race "race/paris-nice/2026"

# Enrichissement coureurs (1x/an, ~1h/100 riders) : photo, bio, spécialité, teams
.venv/bin/python run_pipeline.py enrich-riders [--start N --end M]

# Backfill photos (one-shot) : self-host les photos du top 300 dans Supabase Storage
# (PCS bloque le hotlink direct via Cloudflare). Idempotent, re-lançable.
.venv/bin/python run_pipeline.py backfill-photos
```

**Photos coureurs self-hostées** : `riders.photo_url` du top 300 (`pcs_rank <= 300`, constante `TOP_PHOTO_RANK`) pointe vers le bucket public Supabase `rider-photos` (pas vers PCS — Cloudflare 403 sur tout `<img>` direct). Rangs 301-600 = `photo_url NULL` → fallback initiales. Le scraper télécharge l'image via un `fetch` in-page same-origin depuis l'onglet nodriver (cookie `cf_clearance`). Helper : `services/pcs-sync/photo_storage.py`. Front : `apps/web/lib/photo-url.ts` (URL absolue → telle quelle, sinon `undefined`).

### Variables d'environnement scraper
- `SCRAPER_BACKEND` : `nodriver` (default) | `playwright` (rollback)
- `SCRAPER_HEADLESS` : `0` (default — fenêtre visible) | `1` (tente headless, auto-fallback en visible si CF bloque)
- `PCS_CF_RESOLVE_TIMEOUT_S` : timeout warm-up Cloudflare (default 30s)

**Pourquoi visible par défaut** : Cloudflare flag les browsers headless même avec nodriver dans ce setup (IP/fingerprint). Une fenêtre Chromium s'ouvre 5-10s au début de chaque session (warm-up sur page rider neutre type `tadej-pogacar`), puis les fetches suivants passent via les cookies `cf_clearance`.

Autres scripts (auxiliaires, voir `run_pipeline.py --help` et `services/pcs-sync/`) : `resolve_gt_rescue`, `resolve_now`, `retry_failed`, `dnf_detection`, `sponsor_bonus`, `goal_evaluator`, `tactics`, `validation`, `backfill_traceability`.

Calendrier WT : `services/pcs-sync/wt_calendar_2026.json`.

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
- NEVER skip la validation Zod sur les inputs de server actions / API routes.
- NEVER libérer un coureur hors de la fenêtre d'enchères — le release prend effet au début de la phase suivante (sauf auto-release faillite/DNF rescue).
- NEVER autoriser une validation si treasury < total des salaires + bids actifs.
- NEVER autoriser une enchère sur un coureur releasé depuis moins de 7 jours (cooldown anti-exploit).
- NEVER mettre de logique métier dans une server action TS — pattern obligatoire : Zod validation → `supabase.rpc(...)` → error forwarding.

## Constantes du jeu
Source unique : **`docs/GAME_RULES.md` §11 — Game Constants**. Ne PAS dupliquer les valeurs ici.

Quand une constante change → mettre à jour GAME_RULES.md §11 (et le code). CLAUDE.md ne contient que les "anti-intuitions" ci-dessous (choses que Claude devinerait mal) :
- Enchère = salaire mensuel **récurrent** (pas un achat unique)
- Salaire = **pas de plafond** (formule : pts_PCS × 2 000 / 12)
- Incrément = **100 €** (pas 500, pas 1 000)
- Release = **gratuit** mais salaire phase non remboursé
- Finance = **1x par phase WT** (pas mensuel)


## Rule #4 — Update Living Docs After Every Feature
Après chaque feature shipped, mettre à jour **dans la même session** :
1. **`docs/GAME_RULES.md`** — si une règle, constante, ou mécanique a changé
2. **`docs/ARCHITECTURE.md`** — si une route, RPC, table, ou composant a été ajouté
3. **Déplacer** le plan/spec dans `docs/archive/plans/` ou `docs/archive/specs/`
4. **`MEMORY.md`** — ajouter une ligne dans l'index features si c'est un feature set majeur

Ne PAS sauter cette étape. L'absence de mise à jour est la première cause de drift documentaire.

## Features livrées (résumé)
Détails complets, plans et migrations dans MEMORY.md.
- **Sponsors v2** — 6 tiers, 13 sponsors, race result bonuses
- **Anti-Runaway** — Co-Unlock + Level Curve Stretch (Remontada Boost supprimé 2026-06-02)
- **Grand Tour** — V1a squad builder + V1b sponsor goal evaluation + payout
- **GT Tactics** — 5 tactiques (Unleash, Overdrive, Nemesis GC/Sprint, Call the Bus)
- **GT Rescue** — DNF refund/replace window avec auto-release sur refund claim
- **Achievements** — système d'achievements (voir `app/(game)/.../achievements/`)
- **Race Feed** — cards Home (past race, nemesis, rest day, GT goals)
- **Palmares** — page profil rider avec onglets Monuments / dynamiques + league rank

## Blockers ouverts (résoudre avant alpha)
- [x] Simulation Excel : calibrer taux de conversion → remplacé par bonus sponsor fixes
- [x] Valider la tolérance au rate limit de procyclingstats → résolu : 15s pause entre équipes, fresh context par team
- [x] Charte graphique / branding → Design System v3 (Sky Blue Night + Cyan)
- [ ] Valider l'exactitude des données PCS pour le calcul des salaires
- [ ] Définir la stratégie de notifications in-app (pas d'emails — décision actée)

## Gestion du contexte (compression)
- **Fichier de session** : `~/.claude/projects/-Users-jonathanschummers-Documents-WattHunter/memory/sessions/YYYY-MM-DD.md`
- **Avant compression** : sauvegarder proactivement dans le fichier session du jour : tâche en cours, décisions prises, items traités, prochaine action
- **Après compression** : relire le fichier session du jour pour reprendre le fil
- **Backlog centralisé** : `docs/archive/TODO_BACKLOG.md` — source unique pour le bug fixing et les tâches UI
- Prévenir l'utilisateur quand une sauvegarde de contexte est faite

## Design System (v3.0 + navigation tokens v3.1)
- Source of truth : `docs/watthunter-design-system-v3.md`
- Palette : Sky Blue Night (200° hue, ~18% sat) + Tailwind Cyan — tokens in `apps/web/app/globals.css`
- Font : Geist Sans (UI) + Geist Mono (ALL numbers) — package `geist`
- Icons : Lucide React (base) + @phosphor-icons/react (gamification)
- Theme : dark-first (no .dark class needed)
- Responsive : Sidebar 180px + Main (flex:3) + Detail Rail (flex:2, min 380px) at lg:
- **Radius-as-affordance** : 6px = interactive (buttons, chips), 20px = decorative (tags, badges)
- **3 component patterns** : Underline Tabs (`ui/tabs.tsx` line variant), Filter Chips (`segmented-control.tsx`), Tags (`pill.tsx` / `ui/badge.tsx`)
- Backlog : `docs/archive/TODO_BACKLOG.md`
