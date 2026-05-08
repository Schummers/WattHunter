# WattHunter — Architecture

> **Document vivant** — Mis a jour a chaque decision d'architecture.
> Derniere mise a jour : 2026-05-09

---

## Stack technique

| Couche | Technologie | Notes |
|--------|-------------|-------|
| Frontend | Next.js 16 App Router + React 19 | TypeScript strict |
| Style | Tailwind CSS v4 + Shadcn UI | Dark-first, Sky Blue Night (200° hue) + Tailwind Cyan accent |
| Icones | Lucide React (base) + @phosphor-icons/react (gamification) | |
| Police | Geist Sans (UI) + Geist Mono (tous les nombres) | package `geist` |
| Auth | Supabase Auth | Google OAuth + email/password |
| Database | Supabase Postgres | 83 migrations, 28 tables, RLS enforced |
| Realtime | Supabase Realtime | Prevu pour encheres live |
| Edge Functions | Supabase Edge Functions | Calculs XP, finances |
| Data pipeline | Python (local uniquement) | Sync procyclingstats via Playwright |
| Monorepo | Turborepo + pnpm workspaces | |

---

## Structure du projet

```
watthunter/
├── apps/web/                    # Next.js 16 App Router
│   ├── app/
│   │   ├── (auth)/              # Routes sans sidebar
│   │   │   ├── login/           # Connexion (Google + email)
│   │   │   ├── signup/          # Creation de compte (email)
│   │   │   ├── forgot-password/ # Demande de reset password
│   │   │   ├── reset-password/  # Formulaire de reset password
│   │   │   ├── onboarding/      # Ecran unique — Rejoindre (primary) / Creer (secondary)
│   │   │   └── league/
│   │   │       ├── create/      # Creer une ligue
│   │   │       ├── join/        # Rejoindre avec code ou URL ?code=XXXXXX
│   │   │       └── choose/      # League picker si l'utilisateur en a plusieurs
│   │   ├── (legal)/             # Pages légales
│   │   │   ├── privacy/         # Politique de confidentialité
│   │   │   └── terms/           # Conditions d'utilisation
│   │   ├── (game)/              # Routes avec sidebar + topbar (desktop) ou bottom-nav (mobile)
│   │   │   └── league/[leagueId]/
│   │   │       ├── page.tsx            # Home / Lobby
│   │   │       ├── layout.tsx          # Auth guard + responsive shell
│   │   │       ├── league-shell.tsx    # Sidebar + TopBar + Detail Rail layout
│   │   │       ├── lobby-view.tsx      # Lien d'invitation + code + liste membres
│   │   │       ├── home-feed.tsx       # Feed activite ligue
│   │   │       ├── levels/             # Page niveaux (timeline 8 niveaux WT)
│   │   │       ├── ranking/            # Classement ligue
│   │   │       │   └── team/[teamId]/  # Profil equipe adverse
│   │   │       ├── rider/[riderId]/    # Detail coureur (PCS + game stats, unifie)
│   │   │       ├── help/               # Regles du jeu + FAQ
│   │   │       ├── settings/           # Parametres equipe + ligue
│   │   │       ├── team/               # Sous-section equipe (layout avec sub-tabs)
│   │   │       │   ├── page.tsx        # My Team (roster actif)
│   │   │       │   ├── market/         # Recruts (marche des coureurs)
│   │   │       │   │   └── history/    # Historique encheres de l'equipe
│   │   │       │   ├── strategies/     # Strategies actives de l'equipe
│   │   │       │   ├── auctions/       # Draft bids + validation des rounds
│   │   │       │   │   └── rounds/     # Calendrier des rounds (commissioner)
│   │   │       │   └── gt/             # Grand Tour squad builder V2 (cap 8)
│   │   │       │       └── tactics/    # 5 tactiques in-race (Unleash, Overdrive, Nemesis x2, Call the Bus)
│   │   │       ├── budget/             # Finances (P&L, tresorerie)
│   │   │       │   ├── marketplace/    # Sponsor marketplace
│   │   │       │   └── transactions/   # Historique transactions
│   │   │       └── auction/            # Calendrier encheres global
│   │   │           ├── [auctionId]/    # Detail enchere
│   │   │           │   └── results/    # Resultats round 1/2/3
│   │   │           ├── status/         # Round status table + force-resolve button
│   │   │           ├── rounds/         # Round dates (commissioner)
│   │   │           ├── market/         # Recruts (redirect)
│   │   │           └── history/        # Historique encheres
│   │   ├── auth/callback/       # OAuth + email confirmation callback
│   │   └── page.tsx             # Smart redirect
│   ├── components/
│   │   ├── ui/                  # Shadcn UI (modifies: badge, button, progress, tabs, etc.)
│   │   ├── rider-card.tsx       # Card coureur (bid states, open slot, min-salary)
│   │   ├── metric-box.tsx       # Valeur Geist Mono + label, highlight accent
│   │   ├── pill.tsx             # Tag v3 (4 variants: default/highlighted/success/warning)
│   │   ├── segmented-control.tsx # Filter Chips v3 (container border, caption type)
│   │   ├── sponsor-bonus-card.tsx     # Card bonus sponsor (race result bonuses)
│   │   ├── sponsor-bonus-details.tsx  # Details bonus sponsor
│   │   ├── gt-goals-preview.tsx       # Sponsor GT goals display
│   │   ├── back-header.tsx      # ArrowLeft + label, router.back()
│   │   ├── phase-navigator.tsx  # Navigation entre phases WT
│   │   ├── filter-chips.tsx     # Composant chips de filtrage
│   │   ├── transaction-row.tsx  # Ligne de transaction treasury_log
│   │   ├── team-level-card.tsx  # Card niveau equipe (variant: home | default)
│   │   ├── sticky-bar.tsx       # Save bar (visible quand bids unsaved)
│   │   ├── sub-tabs.tsx         # Underline tabs avec hide-on-scroll
│   │   ├── config-cards.tsx     # Cards configuration ligue
│   │   ├── round-blocks.tsx     # Blocs visuels des rounds d'encheres
│   │   ├── draft-bid-card.tsx   # Card bid en cours de draft
│   │   ├── budget-summary.tsx   # Resume finances (sponsor + salaires)
│   │   ├── bid-adjust-card.tsx  # Ajustement montant d'encheres
│   │   ├── movement-tag.tsx     # Tag mouvement PCS ranking (+/-N)
│   │   ├── brand-card.tsx       # Card sponsor/marque
│   │   ├── info-card.tsx        # Card informationnelle generique
│   │   ├── game-guide-accordion.tsx  # Accordeon regles du jeu
│   │   ├── onboarding-cards.tsx # Cards onboarding (rejoindre/creer)
│   │   ├── form-field.tsx       # Champ de formulaire standardise
│   │   ├── release-confirm-modal.tsx  # Modal contextuel release (auction + rider detail)
│   │   ├── rider-lock-badge.tsx       # Indicateur Co-Unlock Rule (cadenas)
│   │   ├── rider-picker-sheet.tsx     # Picker coureur (GT squad, nemesis target)
│   │   ├── home-gt-banner.tsx         # Banner GT phase sur home
│   │   ├── nemesis-incoming-banner.tsx # Banner duel PvP entrant
│   │   ├── remontada-boost-banner.tsx # Banner Anti-Runaway boost actif
│   │   ├── tactic-card.tsx            # Card tactique GT (5 types)
│   │   ├── tactic-modal-shell.tsx     # Modal shell partage placement tactique
│   │   ├── tactic-boost-modal.tsx     # Modal Unleash/Overdrive/Call the Bus
│   │   ├── tactic-nemesis-modal.tsx   # Modal Nemesis 2-step (rival → stage)
│   │   ├── tactic-stage-list.tsx      # Stage picker placement tactique
│   │   ├── team-tactics-section.tsx   # Orchestrator tactiques sur GT Team page
│   │   ├── rail-link.tsx        # Lien de navigation vers detail rail
│   │   ├── rail-router.tsx      # Routeur du panneau detail rail
│   │   ├── detail-rail.tsx      # Panneau detail (desktop flex:2, min 380px)
│   │   ├── rail-pages/          # Contenu du detail rail par contexte
│   │   │   ├── rider-detail-rail.tsx
│   │   │   ├── levels-rail.tsx
│   │   │   └── strategies-rail.tsx
│   │   ├── sidebar.tsx          # Navigation desktop (180px, bg-subtle)
│   │   ├── topbar.tsx           # TopBar mobile (32px, logo + league chevron + avatar)
│   │   └── bottom-nav.tsx       # Navigation mobile (4 tabs, hide-on-scroll)
│   ├── hooks/
│   │   └── use-scroll-direction.ts  # Hook partagé hide-on-scroll
│   └── lib/
│       ├── supabase/
│       │   ├── browser.ts            # Client cote navigateur (anon key)
│       │   ├── server.ts             # Client cote serveur (cookies)
│       │   ├── admin.ts              # Service-role client (server-only, RPCs admin)
│       │   ├── middleware.ts         # Refresh session + protection routes
│       │   ├── get-user.ts           # Lookup user cache
│       │   ├── get-open-auction.ts   # Lookup auction state cache
│       │   └── database.types.ts     # Types Supabase generes
│       ├── levels.ts            # Source unique donnees niveaux + helpers
│       ├── format.ts            # countryCodeToFlag, formatEuro, formatThousands, smartCountdown
│       ├── boost.ts             # calculateBoost (4 types de strategies vs roster riders)
│       ├── budget.ts            # Calcul P&L budget
│       ├── calendar.ts          # Helpers calendrier WT
│       ├── co-unlock.ts         # Co-Unlock Rule eligibility checks
│       ├── gt-goals.ts          # Helpers sponsor GT goals
│       ├── gt-phases.ts         # Detection phase GT (Giro/Tour/Vuelta)
│       ├── gt-stages.ts         # Liste stages par GT
│       ├── phases.ts            # Helpers phases WT
│       ├── photo-url.ts         # Resolution URL photo coureur
│       ├── remontada.ts         # Helpers Remontada Boost
│       ├── rider-detail-data.ts # Fetcher unifie rider detail
│       ├── sponsors.ts          # Sponsor data + bonus calculation
│       ├── strategies.ts        # 4 strategy types + matching logic
│       ├── tactics.ts           # 5 GT tactics catalog + helpers
│       └── env.ts               # Validation env vars (Zod)
├── services/pcs-sync/           # Python — sync procyclingstats (local only)
│   ├── run_pipeline.py          # CLI entry point (5 pipelines: A/B/C/E + bonus)
│   ├── sync.py                  # Playwright + procyclingstats parser (top 600)
│   ├── sync_race.py             # Sync resultats de course post-race
│   ├── enrich.py                # Enrichissement profil coureur (Pipeline E)
│   ├── auction.py               # Resolution 3-round sealed-bid
│   ├── scoring.py               # XP quotidien
│   ├── sponsor_bonus.py         # Calcul bonus sponsors sur resultats de course
│   ├── validation.py            # Validation donnees PCS
│   ├── main.py                  # FastAPI app (endpoints secondaires)
│   ├── resolve_now.py           # Script resolution manuelle (dev)
│   ├── run_auction_resolve.py   # Resolution encheres
│   ├── run_daily_pipeline.py    # Pipeline quotidien
│   └── retry_failed.py          # Retry erreurs pipeline
├── supabase/
│   ├── migrations/              # 83 fichiers SQL appliques (28 tables)
│   ├── functions/               # Edge Functions (a venir)
│   └── seed/                    # Strategies + sponsors
├── docs/
│   ├── archive/                 # Specs/plans/reviews shippes (history)
│   │   ├── specs-completed/
│   │   ├── plans-completed/
│   │   ├── reviews-completed/
│   │   └── TODO_BACKLOG.md      # Ancien backlog centralise
│   ├── plans/                   # Plans actifs ou backlogs vivants
│   ├── superpowers/             # Specs/plans en cours (workflow superpowers)
│   ├── research/                # Notes de recherche technique
│   ├── watthunter-design-system-v3.md  # Source de verite UI/UX (v3.0)
│   ├── known-issues-pcs.md      # Bugs PCS sync sans fix automatise
│   ├── GAME_RULES.md            # Regles du jeu (living doc)
│   └── ARCHITECTURE.md          # Ce fichier
├── CLAUDE.md                    # Conventions pour Claude Code (Rule #1: lire design system)
└── PRD_*.md                     # PRDs d'origine (3 fichiers)
```

---

## Design System v3.0

> **Source de verite :** `docs/watthunter-design-system-v3.md`
> **Rule #1 :** Lire ce fichier avant TOUT dev front.

### Philosophie

- **Palette :** Sky Blue Night (200° hue, ~18% saturation) + Tailwind Cyan accent
- **Theme :** Dark-first (pas de classe `.dark` requise)
- **Radius-as-affordance :** 6px = interactif (boutons, chips), 20px = decoratif (tags, badges)

### Tokens semantiques principaux

| Token | Usage |
|-------|-------|
| `--bg-app` | Background principal (`#0c1012`) |
| `--bg-subtle` | Sections secondaires, sidebar |
| `--bg-surface` | Cards, inputs, wells |
| `--bg-surface-hover` | Hover state des surfaces |
| `--text-high` | Titres, noms, chiffres (`#eaeff1`) |
| `--text-mid` | Descriptions, texte secondaire |
| `--text-low` | Labels, captions, metadata |
| `--text-ghost` | Placeholders, disabled (decoratif uniquement) |
| `--accent-default` | Cyan (interactions, focus, progress) |
| `--border-default` | Borders de composants |

### Typographie

- **Fonts :** Geist Sans (tout le texte UI) + Geist Mono (TOUS les nombres sans exception)
- **Scale :** px pairs uniquement (10/12/14/16/18/20/32), +2px a `md:`
- **Tokens :** TOUJOURS `text-[length:var(--type-*)]` — JAMAIS de pixels hardcodes (`text-[15px]`)

### 3 Patterns de composants

| Pattern | Composant | Usage |
|---------|-----------|-------|
| **Underline Tabs** | `ui/tabs.tsx` (variant="line") | Navigation entre sous-sections |
| **Filter Chips** | `segmented-control.tsx` | Filtres segmentes (container border) |
| **Tags** | `pill.tsx` / `ui/badge.tsx` | Labels non-interactifs (radius-pill) |

---

## Navigation responsive

### Mobile

```
┌─────────────────────────────────────┐
│  TopBar (32px) — logo + ligue + ava │  z-20
├─────────────────────────────────────┤
│                                     │
│  Contenu principal (scrollable)     │
│                                     │
├─────────────────────────────────────┤
│  BottomNav — 4 tabs, hide-on-scroll │  z-30
└─────────────────────────────────────┘
```

- **TopBar :** logo zap, selecteur ligue (chevron), avatar utilisateur
- **BottomNav :** 4 tabs principaux, se cache au scroll bas (hook `use-scroll-direction`)

### Desktop (`lg:`)

```
┌──────────┬────────────────────┬──────────────────┐
│ Sidebar  │ Contenu principal  │  Detail Rail     │
│ 180px    │ (flex:3)           │  (flex:2)        │
│ bg-subtle│ scrollable         │  min 380px       │
└──────────┴────────────────────┴──────────────────┘
```

- **Sidebar :** 180px fixe, bg-subtle, items de navigation + sous-items (My Team / Recruts)
- **Detail Rail :** panneau contextuel (rider detail, levels, strategies) — flex:2, min 380px

---

## Routing

### Groupes de routes

| Groupe | Layout | Usage |
|--------|--------|-------|
| `(auth)` | Centrer plein ecran, pas de sidebar | Login, signup, onboarding, create/join league |
| `(game)` | Sidebar + TopBar (desktop) ou BottomNav (mobile) | Toutes les pages de jeu |

### Protection des routes

Le middleware (`lib/supabase/middleware.ts`) protege toutes les routes sauf :
- `/` (smart redirect)
- `/login`
- `/signup`
- `/auth/*` (callback)
- `/join`

### Smart redirect (`/`)

```
Pas d'utilisateur → /login
A une ligue → /league/[id]
Sinon → /onboarding
```

---

## Authentification

### Flux supportes

1. **Google OAuth** — Redirection vers Google, callback sur `/auth/callback`
2. **Email/mot de passe** — Inscription avec nom d'utilisateur + confirmation MDP, connexion directe

### Callback (`/auth/callback`)

1. Echange le code pour une session (OAuth ou email confirmation)
2. Verifie si le profil `users` existe
3. Si non : cree le profil (display_name depuis metadata ou email)
4. Si `has_onboarded = false` → `/onboarding`
5. Sinon → `/`

---

## Base de donnees

### Schema principal (28 tables)

```
users ←──── league_members ────→ leagues
  │                │                  │
  └── teams ───────┘                  │
       │                              │
       ├── contracts → riders         │
       ├── team_strategies → strategies
       ├── team_sponsors → sponsors
       ├── treasury_log
       ├── rider_xp_daily              (avec role_mult, gt_classif_bonus, remontada_mult)
       ├── team_xp_adjustments         (audit trail grant_xp admin)
       └── team_ranking_daily          (snapshots quotidiens overtake detection)

       auctions → auction_bids
              → draft_bids
              → round_validations      (marker validation + audit force-resolve)

       riders → race_results
              → rider_season_rankings
              → rider_teams
              → rider_pcs_history
              → race_startlists

       sponsor_bonuses                 (paiements bonus par resultat)

       Anti-Runaway:
       remontada_boost_triggers        (1 trigger max par paire ordonnée A→B par GT)
       remontada_boosts                (boost actif : stages restantes, ×2 mult)

       Grand Tour Mode:
       gt_squad                        (cap 8 coureurs par phase)
       gt_role_assignments             (append-only role history, cutoff 11:00 CET)
       gt_daily_classifications        (cache GC/sprint/KOM par stage)
       gt_tactic_activations           (5 tactiques, 1 usage chacune par GT)
```

### Migrations appliquees (83)

| Fichier | Description |
|---------|-------------|
| `20260221000000_initial_schema.sql` | Schema initial + RLS + contraintes |
| `20260221150828_seed_policies_sponsors.sql` | 4 strategy types + 13 sponsors (6 tiers) |
| `20260222*` | Fixes RLS (recursion, leagues select, max_players) |
| `20260227000000_auction_rounds_and_scoring.sql` | auction_bids (round + status), rider_pcs_history |
| `20260228*` | Trigger new_user, policy teams_select_own, auctions commissioner |
| `20260305000000_race_results_and_rankings.sql` | Tables resultats de course + rankings |
| `20260305100000_beta_economy.sql` | Economie beta (taux conversion, salaires) |
| `20260305200000_top500_level_gating.sql` | Gating pool par niveau |
| `20260305210000_treasury_200k.sql` | Tresorerie depart 200 000€ |
| `20260306000000_enrich_riders.sql` | birthdate, birth_place, height_cm, weight_kg + rider_teams |
| `20260309*` | team_strategies unique, contracts select league |
| `20260311000000_sponsors_overhaul.sql` | Refonte sponsors (6 tiers, 13 sponsors) |
| `20260312-20260322*` | Fixes pcs_rank, contracts unique, XP decimal, RLS, scoring |
| `20260402000000_level_rework_8_levels.sql` | 8 niveaux alignes phases WT |
| `20260402300000_sponsors_rework.sql` | Bonus sponsors sur resultats de course |
| `20260402400000_phase_economy.sql` | Finance par phase (salaires + sponsor 1x/phase) |
| `20260403000000_auction_update_commissioner.sql` | Policy update encheres commissaire |
| `20260403100000_draft_bids_and_economy.sql` | Draft bids + mecanismes economiques |
| `20260424000000_anti_runaway_system.sql` | Remontada Boost tables + Level Curve Stretch seuils + Co-Unlock Rule |
| `20260503-20260505*` | Code review fixes : SECURITY DEFINER RPCs (release_rider, confirm_phase_setup, leave_league), trigger teams_protect_sensitive_fields, round constraint 1-8 |
| `20260506*` | Sponsor base bonuses rework (flat) + sponsor/strategy lock window |
| `20260507000000_join_league_late.sql` | Late join : init XP + treasury rounded |
| `20260508000000_round_lifecycle.sql` | Round lifecycle + force-resolve |
| `20260508010*-20260512000000` | GT Tactics (table gt_tactic_activations, RPC place_tactic, traceability columns), GT Squad Builder V2, grant_xp RPC, 7-day release cooldown |
| `20260508020000_round_validations_and_force_resolve.sql` | Table round_validations + auto-resolve consensus |
| `20260509100000_xp_traceability_columns.sql` | role_mult + gt_classif_bonus dans rider_xp_daily |
| `20260510000000_gt_squad_builder_v2.sql` | Flexible GT squad (cap 8, swaps libres pendant phase) |

### RLS — Architecture

**Probleme :** Recursion infinie dans les policies RLS auto-referentielles.

**Solution :** Fonction `SECURITY DEFINER` pour le check d'appartenance :

```sql
create function public.is_league_member(p_league_id uuid)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.league_members
    where league_id = p_league_id and user_id = auth.uid()
  );
$$;
```

**Regles critiques :**
- NEVER bypasser le RLS — l'app web utilise toujours l'anon key
- NEVER exposer la service_role key au browser
- NEVER muter `treasury_log` directement — utiliser les fonctions helper
- NEVER liberer un coureur hors de la fenetre d'encheres

---

## Pipeline PCS (sync procyclingstats)

> **Execution locale uniquement** — Cloudflare bloque les IPs datacenter. IP residentielle requise.
> Librairie : `procyclingstats` v0.2.8 + Playwright headless Chromium.

### 5 pipelines (CLI via `run_pipeline.py`)

| Pipeline | Commande | Frequence | Duree |
|----------|----------|-----------|-------|
| **A — Init riders** | `init-riders` | 1x/an | ~5 min (top 600) |
| **B — Post-race** | `post-race --race <slug>` | Apres chaque course | ~30s |
| **C — Startlists** | `startlists --race <slug>` | Avant chaque course | ~15s |
| **E — Enrich riders** | `enrich-riders [--start N --end M]` | 1x/an | ~1h/100 coureurs |
| **Bonus** | Via `sponsor_bonus.py` | Apres chaque course | Automatique |

### Scoring pipeline (scoring.py)
- **Steps A–D** : calcul XP quotidien par rider (pts PCS × stratégie bonuses)
- **Step 5c — Détection d'overtake** : après chaque événement de scoring, le classement ligue est recalculé et comparé au snapshot précédent. Si un joueur hors-podium (rank 4+) dépasse un autre joueur et que la paire A→B n'a pas encore triggé dans ce GT, un `remontada_boost_trigger` est inséré et un `remontada_boost` actif est créé (ou refreshé) pour A.
- **Step 5d — Application du multiplicateur** : si un boost actif existe pour un joueur lors du scoring, `remontada_mult = 2.0` est enregistré dans `rider_xp_daily` et les XP du joueur sont doublés pour cet événement.

### Pool coureurs
- Top 600 PCS global (12 mois glissants)
- Gating par rang selon niveau d'equipe : Nv.1=#300 | Nv.2=#200 | Nv.3=#100 | ... | Nv.8=#1
- Rythme : fresh browser context par coureur + pauses (15s entre equipes) → 0 erreurs Cloudflare

### Donnees enrichies (Pipeline E)
- Photo, birthdate, birth_place, height_cm, weight_kg
- Specialite : max(GC, OneDay, TT, Sprint)
- Historique equipes (`rider_teams`)
- Season points + season results

---

## Mecaniques de jeu

### Economie
- Tresorerie depart : 200 000€
- Salaire mensuel = pts_PCS × 2 000 / 12 (plancher 5 000€/mois)
- Finance par phase : income sponsor + salaires deductés 1x par phase WT
- Release gratuit (salaire de la phase non rembourse)

### 8 niveaux alignes sur les 8 phases WT

| Nv. | Phase | XP requis | Slots | Strategies max | Pool min |
|-----|-------|-----------|-------|-------------|---------|
| 1 | Season Start | 0 | 6 | 1 | #300 |
| 2 | — | 25 | 7 | 1 | #200 |
| 3 | — | 150 | 8 | 2 | #100 |
| 4 | Giro | 350 | 9 | 2 | #30 |
| 5 | — | 600 | 10 | 2 | #20 |
| 6 | Tour | 1200 | 11 | 2 | #10 |
| 7 | — | 1800 | 12 | 3 | #4 |
| 8 | Vuelta | 2400 | 12 | 3 | #1 |

### Sponsors (6 tiers, 13 sponsors)
- 1 sponsor par equipe, gating par niveau uniquement
- T1=250k (Nv.1), T2=350k (Nv.2), T3=450k (Nv.3), T4=750k (Nv.4-5), T5=1M (Nv.6-7), T6=1.25M (Nv.8)
- Bonus sponsor = credites sur resultats de course
- Multiplicateurs : x2 Monument/Grand Tour, x1.25 nationalite (T1-T4)

### Politiques (4 types)
- Speciality (Nv.1), Nationality (Nv.3), Teams (Nv.5), Age (Nv.7)

---

## Tests automatises

| Suite | Chemin | Nb tests | Couverture |
|-------|--------|----------|------------|
| pytest | `services/pcs-sync/tests/` | 22+ | scoring, auction, enrich, tactics |
| vitest | `apps/web/**/*.test.ts` | 157 (17 fichiers) | server actions, auction bids, GT tactics, round lifecycle, co-unlock, levels sync |
| Playwright e2e | `apps/web/e2e/` | smoke + GT tactics happy path (test.fixme) | golden path |

---

## Decisions d'architecture (ADRs)

### ADR-001 : Pas de minimum de joueurs pour lancer une ligue
- **Decision :** Le commissaire peut lancer quand il veut
- **Raison :** Simplifie les tests et donne plus de flexibilite

### ADR-002 : Max 20 joueurs par ligue
- **Decision :** Max fixe a 20, pas de selecteur dans le formulaire
- **Raison :** Le code invite suffit comme filtre

### ADR-003 : Leagues lisibles par tout utilisateur authentifie
- **Decision :** Tout authentifie peut SELECT sur leagues
- **Raison :** Le code d'invitation est la vraie barriere

### ADR-004 : SECURITY DEFINER pour les checks d'appartenance
- **Decision :** Fonction `is_league_member()` en SECURITY DEFINER
- **Raison :** Bypass RLS pour le check, evite la recursion. Pattern standard Supabase

### ADR-005 : Pages login et signup separees
- **Decision :** `/login` et `/signup` separes
- **Raison :** Pattern UX standard, signup a des champs supplementaires

### ADR-006 : Onboarding en un seul ecran
- **Decision :** Un seul ecran avec cartes informatives + boutons create/join
- **Raison :** Moins de friction

### ADR-007 : Trigger auth plutot qu'upsert dans le callback
- **Decision :** Trigger `handle_new_user` (SECURITY DEFINER) sur `auth.users` INSERT
- **Raison :** Belt-and-suspenders : garantit la coherence meme en cas d'anomalie OAuth

### ADR-008 : Policy `teams_select_own` pour corriger INSERT+RETURNING
- **Decision :** `auth.uid() = user_id` sans condition ligue
- **Raison :** Pattern PostgREST : RETURNING soumis aux policies SELECT

### ADR-009 : Pas d'upsert sur `auction_bids` (contrainte partielle)
- **Decision :** SELECT explicite puis INSERT ou UPDATE selon resultat
- **Raison :** PostgREST ne peut pas utiliser les index partiels pour ON CONFLICT

### ADR-010 : Playwright pour le scraping PCS
- **Decision :** Playwright headless Chromium + Chrome user agent
- **Raison :** Cloudflare bloque requests/httpx. ScrapFly en fallback

### ADR-011 : Execution pipeline PCS locale uniquement
- **Decision :** GitHub Actions workflows supprimes, execution manuelle locale
- **Raison :** Cloudflare bloque les IPs datacenter Azure. IP residentielle requise

### ADR-012 : Finance par phase (pas mensuelle)
- **Decision :** Salaires + income sponsor deduits 1x par phase WT (pas 1x/mois)
- **Raison :** Alignement sur le calendrier WT, simplifie la gestion

### ADR-013 : Pas d'emails
- **Decision :** Fonctionnalite email (recapitulatif encheres) supprimee definitivement
- **Raison :** Pas de provider email configure, notifications in-app suffisantes

### ADR-014 : Design System v3 — Sky Blue Night
- **Decision :** Migration de Zinc/Blue 220° vers Sky Blue Night (200°) + Lucide + Geist
- **Raison :** Cohesion visuelle avec le gradient brand, meilleurs contrastes (AAA sur texte-mid)

### ADR-015 : SECURITY DEFINER RPCs pour mutations critiques
- **Decision :** 12 mutations (place_bid, validate_round, release_rider, confirm_phase_setup, leave_league, join_league_by_code, grant_xp, gt_*, place_tactic) passent par RPCs Postgres atomiques
- **Raison :** Atomicite + RLS bypass controle + audit trail. Le code TS se limite a Zod validation + supabase.rpc(...)

### ADR-016 : Anti-Runaway System (Remontada + Co-Unlock + Level Curve)
- **Decision :** 3 mecanismes toujours actifs (pas d'opt-in commissioner) pour limiter les ecarts structurels
- **Raison :** Eviter les snowball effects ou un leader devient injoignable, fenetres de come-back en GT

### ADR-017 : Auto-resolve consensus + force-resolve
- **Decision :** Round auto-resolve quand tous les joueurs ont valide ; n'importe quel joueur peut force-resolve via Status tab
- **Raison :** Supprime le besoin d'intervention commissioner, accelere le flow, fallback manuel disponible

### ADR-018 : 7-day release cooldown
- **Decision :** Coureur releasé ne peut pas etre re-encheri par personne pendant 7 jours
- **Raison :** Previent l'exploit buy → check_salary → release → rebid au minimum

### ADR-019 : GT Tactics — 5 tactiques in-race
- **Decision :** 5 tactiques (Unleash, Overdrive, Nemesis GC, Nemesis Sprint, Call the Bus), 1 usage chacune par GT
- **Raison :** Profondeur strategique pendant les Grands Tours, differenciation des decisions joueurs au-dela du roster

---

## Etat d'avancement

### Implemente

- [x] Auth (Google OAuth + email/password) + trigger auto-create user
- [x] Onboarding, create/join league, lobby
- [x] 40+ migrations DB + RLS
- [x] Design System v3 (Sky Blue Night + Cyan + Geist + Lucide + Phosphor)
- [x] Navigation responsive (BottomNav mobile + Sidebar desktop + Detail Rail)
- [x] 8 niveaux alignes phases WT (levels.ts, team-level-card, levels page)
- [x] My Team (roster, release rider)
- [x] Recruts / Market (rider cards, bid states)
- [x] Rider Detail (3 etats: recruts/team/ranking)
- [x] Auctions (calendrier, detail, dialog mise, resultats 3 rounds)
- [x] Team Auctions (draft bids, validation rounds, commissioner rounds calendar)
- [x] Budget P&L (tresorerie, sponsor income, salaires)
- [x] Sponsor Marketplace (selection sponsor, bonus cards)
- [x] Transaction history
- [x] Strategies (activation, configuration, 4 types)
- [x] Ranking ligue + profil equipe adverse
- [x] Settings (team name, leave league)
- [x] Pipeline PCS A (init-riders, top 600)
- [x] Pipeline PCS B (post-race, resultats + ranking + scoring)
- [x] Pipeline PCS C (startlists)
- [x] Pipeline PCS E (enrich-riders, photo + bio + teams)
- [x] Sponsor bonus (calcul sur resultats de course, multiplicateurs)
- [x] Resolution 3-round sealed-bid (auction.py)
- [x] XP quotidien (scoring.py)
- [x] Tests automatises (pytest 22+, vitest 157 / 17 fichiers)
- [x] Anti-Runaway System (Remontada Boost + Co-Unlock Rule + Level Curve Stretch)
- [x] Code review fixes (12 findings) : 12 RPCs SECURITY DEFINER + trigger teams_protect
- [x] Force-resolve round (status table + any-player resolve button)
- [x] Auto-resolve on consensus (tous valident → round auto-resolved)
- [x] Payday in confirm_phase_setup (sponsor income + salaires + bankruptcy cascade)
- [x] 7-day release cooldown (previent timing exploit)
- [x] GT Tactics (5 tactiques : Unleash, Overdrive, Nemesis GC/Sprint, Call the Bus)
- [x] GT Squad Builder V2 (cap 8, swaps libres pendant phase)
- [x] grant_xp RPC (admin XP adjustments avec traceability)
- [x] Late join (rejoindre une ligue active)
- [x] Sponsor base bonuses rework (flat) + GT-specific goals
- [x] Rider detail unifie (1 page pour tous les entry points)
- [x] Password reset flow (forgot + reset)
- [x] Pages legales (privacy + terms)
- [x] Status page (purchasing power + clickable team rows)

### A implementer (pre-alpha)

- [ ] Deploiement Railway : Dockerfile Playwright + Chromium (si besoin de scheduling)
- [ ] Notifications in-app (strategie a definir)
- [ ] Valider l'exactitude des donnees PCS pour le calcul des salaires
- [ ] Charte graphique / branding final

### Blockers pre-alpha

- [ ] Valider exactitude donnees PCS (salaires)
- [ ] Definir strategie notifications in-app
- [ ] Definir charte graphique / branding
