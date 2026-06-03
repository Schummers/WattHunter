# WattHunter — Architecture

> **Document vivant** — Mis a jour a chaque decision d'architecture.
> Derniere mise a jour : 2026-05-28

---

## Stack technique

| Couche | Technologie | Notes |
|--------|-------------|-------|
| Frontend | Next.js 16 App Router + React 19 | TypeScript strict |
| Style | Tailwind CSS v4 + Shadcn UI | Dark-first, Sky Blue Night (200° hue) + Tailwind Cyan accent |
| Icones | Lucide React (base) + @phosphor-icons/react (gamification) | |
| Police | Geist Sans (UI) + Geist Mono (tous les nombres) | package `geist` |
| Auth | Supabase Auth | Google OAuth + email/password |
| Database | Supabase Postgres | RLS enforced, schema in `supabase/migrations/` |
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
│   │   ├── (lobby)/             # Interface setup pour les ligues en attente (sans sidebar)
│   │   │   └── lobby/[leagueId]/
│   │   │       ├── page.tsx            # Redirects vers /league/[id] si ligue active ; sinon UI lobby
│   │   │       ├── layout.tsx          # Auth guard minimal (pas de sidebar)
│   │   │       └── actions.ts          # setStartingLevel(leagueId, level) → supabase.rpc("set_starting_level", …)
│   │   ├── (game)/              # Routes avec sidebar + topbar (desktop) ou bottom-nav (mobile)
│   │   │   └── league/[leagueId]/
│   │   │       ├── page.tsx            # Server redirect vers /lobby/[id] si status pending ; sinon Race Feed
│   │   │       ├── demo-layout.tsx     # Layout fork pour /league/demo (anon, sans auth)
│   │   │       ├── layout.tsx          # Auth guard + responsive shell
│   │   │       ├── league-shell.tsx    # Sidebar + TopBar + Detail Rail layout
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
│   │   │       │   ├── budget/          # Finances equipe (P&L, tresorerie)
│   │   │       │   └── gt/             # Grand Tour squad builder V2 (cap 8)
│   │   │       │       ├── tactics/    # 5 tactiques in-race (Unleash, Overdrive, Nemesis x2, Call the Bus)
│   │   │       │       └── rescue/     # GT Rescue (DNF refund/replace)
│   │   │       ├── achievements/       # Systeme d'achievements
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
│   │   ├── tactic-card.tsx            # Card tactique GT (5 types)
│   │   ├── tactic-modal-shell.tsx     # Modal shell partage placement tactique
│   │   ├── tactic-boost-modal.tsx     # Modal Unleash/Overdrive/Call the Bus
│   │   ├── tactic-nemesis-modal.tsx   # Modal Nemesis 2-step (rival → stage)
│   │   ├── tactic-stage-list.tsx      # Stage picker placement tactique
│   │   ├── team-tactics-section.tsx   # Orchestrator tactiques sur GT Team page
│   │   ├── scoring-doc-card.tsx       # Encart "How scoring works" sur Race Team (Spec A A8)
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
│       ├── gt-phases.ts         # Detection phase GT (Giro/Tour/Vuelta) ; `getGTSubTabLabel(date, { override })` — override-aware label pour sub-tab Race Team (Spec A A9)
│       ├── gt-stages.ts         # Liste stages par GT
│       ├── race-team-label.ts   # `resolveRaceTeamLabel(supabase, teamId, date?)` — resout le label dynamique du Race Team (GT actif → "Giro Team"/"Tour Team"/… ; hors saison → "Race Team") (Spec A A9)
│       ├── phases.ts            # Helpers phases WT
│       ├── photo-url.ts         # Resolution URL photo coureur
│       ├── rider-detail-data.ts # Fetcher unifie rider detail
│       ├── sponsors.ts          # Sponsor data + bonus calculation
│       ├── strategies.ts        # 4 strategy types + matching logic
│       ├── tactics.ts           # 5 GT tactics catalog + helpers
│       └── env.ts               # Validation env vars (Zod)
├── services/pcs-sync/           # Python — sync procyclingstats (local only)
│   ├── run_pipeline.py          # CLI entry point (5 pipelines: A/B/C/E + bonus) ; `_maybe_import_finals` — imports finals jerseys après import GC d'un GT complet (Spec A A2)
│   ├── sync.py                  # Playwright + procyclingstats parser (top 600)
│   ├── sync_race.py             # Sync resultats de course post-race ; `import_gc_results` retourne `has_points` (signal GT complet) ; `import_final_classifications` — importe classements finaux Points/KOM/Youth dans `gt_final_classifications` (Spec A A2)
│   ├── enrich.py                # Enrichissement profil coureur (Pipeline E)
│   ├── photo_storage.py         # Download photo PCS + upload bucket Supabase rider-photos
│   ├── backfill_photos.py       # One-shot : self-host photos top 300 (cmd backfill-photos)
│   ├── auction.py               # Resolution 3-round sealed-bid
│   ├── scoring.py               # XP quotidien
│   ├── sponsor_bonus.py         # Calcul bonus sponsors sur resultats de course
│   ├── validation.py            # Validation donnees PCS
│   ├── resolve_now.py           # Script resolution manuelle (dev)
│   ├── resolve_gt_rescue.py     # Resolution DNF rescue (refund/replace)
│   ├── goal_evaluator.py        # Evaluation sponsor goals — `evaluate_sponsor_goals(supabase, parent_slug)` (GT + 1-week via `_is_squad_race`); `evaluate_gt_goals` is a backward-compat alias. Goals mirror `apps/web/lib/gt-goals.ts` (`SPONSOR_GOAL_SETS`); idempotency on stable `goal_key`. Points/KOM/Youth final winners read from `gt_final_classifications`.
│   ├── reconcile_bonuses.py     # Read-only Giro reconciliation — `find_points_double_counts` + `reconcile_team_treasury`; no writes, safe to re-run.
│   ├── dnf_detection.py         # Detection DNF pendant GT
│   ├── tactics.py               # Resolution tactiques GT pre-scoring
│   ├── backfill_traceability.py # Backfill colonnes traceabilite
│   └── retry_failed.py          # Retry erreurs pipeline
├── supabase/
│   ├── migrations/              # Fichiers SQL (schema evolutif)
│   ├── functions/               # Edge Functions (a venir)
│   └── seed/                    # Strategies + sponsors
├── docs/
│   ├── archive/                 # Frozen artifacts (plans, specs, reviews, research, PRDs)
│   │   ├── plans/               # Plans termines
│   │   ├── specs/               # Specs terminees
│   │   ├── reviews/             # Code reviews archivees
│   │   ├── research/            # Notes de recherche technique
│   │   ├── prd-legacy/          # Anciens PRDs + wireframes
│   │   └── TODO_BACKLOG.md      # Ancien backlog centralise
│   ├── watthunter-design-system-v3.md  # Source de verite UI/UX (v3.1)
│   ├── known-issues-pcs.md      # Bugs PCS sync sans fix automatise
│   ├── GAME_RULES.md            # Regles du jeu (living doc — source unique pour constantes)
│   └── ARCHITECTURE.md          # Ce fichier
└── CLAUDE.md                    # Conventions pour Claude Code (Rules #1-4)
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
| `(lobby)` | Minimal (pas de sidebar), auth guard | Interface setup ligues pending (3 onglets : Lobby, Level & Pool, Rules) |
| `(game)` | Sidebar + TopBar (desktop) ou BottomNav (mobile) | Toutes les pages de jeu, y compris `/league/demo/*` (anon, layout fork sans auth) |

### Protection des routes

Le middleware (`lib/supabase/middleware.ts`) protege toutes les routes sauf :
- `/` (smart redirect)
- `/login`
- `/signup`
- `/auth/*` (callback)
- `/join`
- `/league/demo/*` (visiteur anonyme — demo mode)

### Smart redirect (`/`)

```
Pas d'utilisateur → /login
A une ligue → /league/[id]
Sinon → /onboarding
```

---

## Authentification

### Flux supportes

1. **Combined signup** (par defaut depuis 2026-05) — `/league/create` et `/league/join` sont publics. Visiteur cree son compte + sa league/team en un seul flux 2-ecrans :
   - Ecran 1 : league name / team name / email (ou invite code + team name pour join), boutons "Next" + "Continue with Google".
   - Ecran 2 : password + confirm password, submit via server action `signupAndCreateLeague` / `signupAndJoinLeague`.
   - Google OAuth : avant `signInWithOAuth`, depose un cookie `signup_intent` (10 min, httpOnly, sameSite=lax) contenant les donnees du formulaire. Le callback lit ce cookie et termine la creation / le join.
2. **Google OAuth direct** (login classique) — `/login` → `signInWithOAuth` → `/auth/callback`.
3. **Email/mot de passe classique** — `/signup` simplifie (email + password seulement, plus de champ username — derive du prefix email).

Email confirmation Supabase **desactivee** (Dashboard → Auth → Email → "Confirm email" = OFF). `auth.signUp()` retourne une session immediatement. Le composant `EmailConfirmationBanner` (monte dans le layout `(game)/league/[leagueId]/layout.tsx`) propose au user de confirmer son email pour recovery, dismissable.

### Server actions

- `apps/web/app/(auth)/league/create/actions.ts` — exporte `createLeague` (legacy, user auth requise) et `signupAndCreateLeague` (combined signup pour visiteurs).
- `apps/web/app/(auth)/league/join/actions.ts` — exporte `signupAndJoinLeague` (remplace l'ancien `joinLeague`). RPC `join_league_by_code(p_code, p_team_name)` etendu pour accepter le nom d'equipe (migration `20260527000000`).
- Helper partage : `apps/web/lib/league-creation.ts` exporte `generateInviteCode()`.
- `apps/web/app/(lobby)/lobby/[leagueId]/actions.ts` — exporte `setStartingLevel(leagueId, level)` → `supabase.rpc("set_starting_level", …)`.

### RPCs lobby (Chantier D — migration `20260528000001` et `20260528000002`)

- `launch_first_auction(p_league_id uuid) → jsonb` — SECURITY DEFINER. Commissioner uniquement. Insere 3 auctions (Round 1 `open`, Rounds 2-3 `scheduled`) avec dates auto-planifiees Europe/Paris, passe la ligue en `active`. Migration `20260528000001`. Remplace l'ancien calcul de dates cote TS.
- `set_starting_level(p_league_id uuid, p_level integer) → jsonb` — SECURITY DEFINER. Commissioner uniquement, ligues pending seulement, level 1..8. Migration `20260528000002`.

### Cookie helper

- `apps/web/app/auth/callback/oauth-intent.ts` — `setSignupIntentCookie / readSignupIntentCookie / clearSignupIntentCookie` + type `SignupIntent`.

### Callback (`/auth/callback`)

1. Echange le code pour une session (OAuth ou email confirmation).
2. Verifie si le profil `users` existe, le cree au besoin.
3. **Si cookie `signup_intent` present** : termine le flux create/join (insert league + team + sponsor + league_member, ou appelle `join_league_by_code`), efface le cookie, redirect vers `/league/[id]`.
4. Si `type=recovery` → `/reset-password`.
5. Sinon : redirect vers `next` (si valide) ou premiere league du user ou `/league/choose`.

### Middleware

`apps/web/lib/supabase/middleware.ts` declare `/league/create`, `/league/join`, `/league/choose` comme routes publiques (en plus de `/login`, `/signup`, `/auth`, etc.).

---

## Base de donnees

### Schema principal

```
users ←──── league_members ────→ leagues
  │                │                  │
  └── teams ───────┘                  │
       │                              │
       ├── contracts → riders         │
       ├── team_strategies → strategies
       ├── team_sponsors → sponsors
       ├── treasury_log                 (types: sponsor_bonus, sponsor_bonus_revert, payday_salary, gt_dnf_refund, gt_goal_bonus, …)
       ├── rider_xp_daily              (avec role_mult, gt_classif_bonus, gt_distance_bonus NUMERIC(5,1) — stage-hunter breakaway additive bonus, Spec A A3)
       ├── team_xp_adjustments         (audit trail grant_xp admin)
       └── team_ranking_daily          (snapshots quotidiens overtake detection)

       auctions → auction_bids
              → draft_bids
              → round_validations      (marker validation + audit force-resolve)

       riders → race_results              (cols: breakaway_kms numeric — km en breakaway, NULL si inconnu ; profile_icon text — profil PCS p0-p5, NULL sur résultats GC)
              → rider_season_rankings
              → rider_teams
              → rider_pcs_history
              → race_startlists
              → stage_profiles            (race_slug PK, profile_icon p0-p5, race_date ; pre-race source du profil pour le gating Nemesis dans place_tactic — Spec A A7, peuplée par services/pcs-sync/sync_race.py:import_stage_profiles via le pipeline startlists)

       sponsor_bonuses                 (paiements bonus par resultat)

       Grand Tour Mode + 1-week Race Team (Spec A A9):
       gt_squad                        (cap 8 coureurs par phase ; +race_slug TEXT nullable — Spec A A9 P3b ; partial unique indexes (team_id, race_slug) par rôle mirror celles sur phase_id ; Giro 2026 legacy → race_slug=NULL, Tour+Vuelta backfillés)
       gt_role_assignments             (append-only role history, cutoff 11:00 CET ; +race_slug TEXT nullable — Spec A A9 P3b ; idx_gt_role_team_race_slug)
       gt_daily_classifications        (cache GC/sprint/KOM/youth par stage — classification_type accepte désormais 'youth' en plus de gc/points/kom)
       gt_final_classifications        (final Points/KOM/Youth jersey standings — rank-only, Spec A A2 ; dédié scoring uniquement, hors race_results pour éviter pollution sponsor_bonus/goal_evaluator/UI ; migration 20260602130100)
       gt_tactic_activations           (5 tactiques ; +race_slug TEXT nullable — Spec A A9 P3b ; nouvel unique index idx_gt_tactic_activations_by_slug sur (team_id, race_slug, stage_slug))
       tactic_usage_limits             (race_kind ∈ {gt, one_week} × 5 tactics, max_per_race — source of truth du trigger enforce_tactic_usage_limit ; Spec A A9 P3b)
       gt_emergency_bids               (DNF replacement bids during GT)
       gt_rescue_windows               (replace window cutoff per (gt_identifier, gt_year))
       sponsor_goal_completions        (one-time sponsor goal payout tracking ; +`goal_key` TEXT column + unique index `idx_goal_completions_key` on (team_id, sponsor_id, goal_key, race_slug) — Spec C idempotency)
```

### Migrations

Les migrations vivent dans `supabase/migrations/`. Ne pas lister les counts ici — consulter le dossier directement.

Jalons majeurs (par date) :
- **2026-02** : Schema initial, RLS, auth trigger, sponsors, auction system
- **2026-03** : Race results, rankings, economy beta, level gating, enrich riders, design system v3
- **2026-04** : 8 levels WT, sponsors rework (race bonuses), phase economy, draft bids, Anti-Runaway (Co-Unlock + Level Curve), code review fixes (12 SECURITY DEFINER RPCs)
- **2026-05** : Late join, round lifecycle, GT Tactics (5 tactiques), GT Squad V2, auto-resolve consensus, 7-day release cooldown, sponsor GT goals, GT Rescue (DNF window), achievements
- **2026-06** : `20260602100000_spec_a_level_curve_l7_l8.sql` — L7 1800→2600, L8 2400→5000 ; `20260602100100_race_results_breakaway_profile.sql` — ajout `breakaway_kms`, `profile_icon` sur `race_results` ; `20260602100200_daily_classif_allow_youth.sql` — classification_type accepte 'youth' ; `20260602120000_drop_remontada.sql` — suppression définitive remontada ; `20260602130000_rider_xp_daily_distance_bonus.sql` — ajout `gt_distance_bonus` NUMERIC(5,1) sur `rider_xp_daily` (Spec A A3) ; `20260602130100_gt_final_classifications.sql` — nouvelle table `gt_final_classifications` pour classements finaux Points/KOM/Youth (Spec A A2) ; `20260603000100_place_tactic_profile_gating.sql` — RPC `place_tactic` v2 (Spec A A7) : Nemesis Sprint requiert profile p1/p2/p3, Nemesis GC requiert p3/p4/p5 (lookup dans `stage_profiles`) ; **Spec A A9 P3b — Race Team 1-week** : `20260604000000` ajoute `race_slug TEXT` nullable sur `gt_squad` / `gt_role_assignments` / `gt_tactic_activations` (+ partial unique indexes par rôle et `idx_gt_tactic_activations_by_slug`, backfill deterministe Tour+Vuelta, Giro 2026 reste NULL forward-only) ; `20260604000100` crée la table `tactic_usage_limits` + seed 10 rows + trigger `enforce_tactic_usage_limit` ; `20260604000200` ajoute RPC `place_tactic` v3 — 8 args avec `p_race_slug TEXT DEFAULT NULL` trailing, dérive `race_kind` via `infer_race_kind(slug)`, accepte 1-week stage races (`^race/[^/]+/\d{4}/stage-\d+$`), remplace le hard `phase_id IN (4,6,8)` ; le bloc de profile-gating Nemesis P3a est préservé verbatim ; `20260604000300` ajoute RPCs `gt_add_to_squad` / `gt_remove_from_squad` / `gt_swap_slot` / `gt_assign_role` v2 — trailing `p_race_slug text DEFAULT NULL` ; scope race_slug quand fourni, fallback `(phase_id, year)` quand NULL.

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

## Demo mode (Chantier B)

Visiteur anonyme explorant `/league/demo/*` via une copie anonymisee d'une vraie ligue.

### Constants
- `DEMO_LEAGUE_SLUG = "demo"` (segment URL), `DEMO_LEAGUE_ID` UUID (DB FK).
- 8 ghost `auth.users` + `public.users` (UUIDs stables, emails `demo-team-N@watthunter.demo`).
- `DEMO_VISITOR_TEAM_ID = DEMO_TEAM_IDS[1]` — equipe rank-2 par cumulative_xp.
- Sources de verite : `apps/web/lib/demo-constants.ts` + `services/pcs-sync/demo_constants.py` (parite testee des deux cotes).

### RLS — anon SELECT scope
Fonction `public.demo_league_id() RETURNS uuid STABLE`. 33 policies `FOR SELECT TO anon` :
- **Tier A** (direct `league_id`) : `leagues`, `league_members`, `teams`, `auctions`, `contracts`, `draft_bids`, `gt_emergency_bids`.
- **Tier B** (via `EXISTS teams`) : `auction_bids`, `gt_squad`, `gt_role_assignments`, `gt_tactic_activations`, `rider_xp_daily`, `sponsor_bonuses`, `sponsor_goal_completions`, `team_ranking_daily`, `team_sponsors`, `team_strategies`, `team_xp_adjustments`, `treasury_log`, `round_validations`.
- **Tier C** : `public.users` restreint aux 8 ghost demo accounts (`id IN demo league_members`).
- **Tier D** (reference publique) : `riders`, `race_results`, `rider_season_rankings`, `race_startlists`, `rider_teams`, `rider_pcs_history`, `gt_daily_classifications`, `gt_rescue_windows`, `sponsors`, `strategies` (`USING (true)`).

### Mutations bloquees
Le visiteur ne peut rien muter — les RPCs rejettent via `auth.uid() IS NULL`. Cote UI : chaque server-action mutation est wrappee par `useDemoSafeAction` (`apps/web/contexts/demo-context.tsx`) qui fait pulser la banniere cyan au lieu d'appeler la mutation. Banner + bottom CTA dans `apps/web/components/demo/`.

### Refresh
`python3 services/pcs-sync/refresh_demo_league.py --source-league-id <uuid>` :
1. Verifie `is_demo = true` sur la cible.
2. Wipe les donnees demo en ordre FK (children → parents).
3. Reinsere une copie anonymisee du source league (teams renommees, user_ids re-mappes sur les 8 ghost users).
4. Visiteur = source team rank-2 → `DEMO_TEAM_IDS[1]`.
5. POST `${WATTHUNTER_HOST}/api/admin/revalidate-demo` (Bearer `REVALIDATE_SECRET`) → `revalidateTag("demo-league")`. No-op tant que Cache Components n'est pas active.

### Migrations
- `20260529000001_demo_seed_ghost_users.sql` — `demo_league_id()`, `is_demo`, 8 ghost users, placeholder league.
- `20260529000002_demo_anon_select_policies.sql` — 33 RLS policies anon.
- `20260529000003_join_rejects_demo.sql` — `join_league_by_code` refuse une ligue `is_demo = true`.

### Securite
- Aucune reference a `SUPABASE_SERVICE_ROLE_KEY` sous `apps/web/{app,components,contexts,lib,hooks}` (audit : seul `lib/supabase/admin.ts`, protege par `import "server-only"`).
- `REVALIDATE_SECRET` provisionne cote Vercel (production + preview) — a valider avant deploy.
- PII audit : `python3 services/pcs-sync/scripts/audit_demo_pii.py` exit 0.

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
- **Spec A P2 (2026-06-02)** : `_role_multiplier` prend `breakaway_kms`/`profile_icon` ; `_classif_bonus` V2 (matched roles only, ×2/×1.5) ; `_breakaway_distance_bonus` (+1 XP/10 km, additive, stage_hunter uniquement) ; `_final_secondary_bonus` (scale 80/20/10 GT × role mult) ; 3e pass lit `gt_final_classifications` pour les jerseys finaux Points/KOM/Youth.

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

> **Source unique des regles et constantes : `docs/GAME_RULES.md`**
> Cette section ne contient qu'un resume — toute modification de regle doit aller dans GAME_RULES.md.

- 8 niveaux alignes sur 9 phases WT (Season Start → End of Season)
- Economie par phase : sponsor income + salaires deduits 1x/phase
- 6 tiers sponsors (13 sponsors), 4 types de strategies, encheres sealed-bid 3 rounds
- Anti-Runaway : Co-Unlock Rule + Level Curve Stretch
- GT Tactics : 5 tactiques in-race (Unleash, Overdrive, Nemesis GC/Sprint, Call the Bus)
- GT Rescue : DNF refund/replace window pendant les Grands Tours

---

## Tests automatises

| Suite | Chemin | Commande | Couverture |
|-------|--------|----------|------------|
| pytest | `services/pcs-sync/tests/` | `pytest` | scoring, auction, enrich, tactics, rescue |
| vitest | `apps/web/**/*.test.ts(x)` | `pnpm test` | server actions, auction bids, GT tactics, round lifecycle, co-unlock, levels sync |
| Playwright e2e | `apps/web/e2e/` | `pnpm exec playwright test` | smoke + GT tactics happy path (test.fixme until seed data) |

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

### ADR-016 : Anti-Runaway System (Co-Unlock + Level Curve)
- **Decision :** 2 mecanismes toujours actifs (pas d'opt-in commissioner) pour limiter les ecarts structurels. Un 3e mécanisme (boost anti-rattrapage) a été supprimé le 2026-06-02 (fragile aux recalculs rétroactifs), remplacé à terme par Spec B (Underdog).
- **Raison :** Eviter les snowball effects ou un leader devient injoignable

### ADR-017 : Auto-resolve consensus + force-resolve
- **Decision :** Round auto-resolve quand tous les joueurs ont valide ; n'importe quel joueur peut force-resolve via Status tab
- **Raison :** Supprime le besoin d'intervention commissioner, accelere le flow, fallback manuel disponible

### ADR-018 : 7-day release cooldown
- **Decision :** Coureur releasé ne peut pas etre re-encheri par personne pendant 7 jours
- **Raison :** Previent l'exploit buy → check_salary → release → rebid au minimum

### ADR-019 : GT Tactics — 5 tactiques in-race (GT + 1-week)
- **Decision :** 5 tactiques (Unleash, Overdrive, Nemesis GC, Nemesis Sprint, Call the Bus). Budget d'activations par `(team, race)` paramétrable par `race_kind` via `tactic_usage_limits` — GT = limites historiques (1-3 selon tactique), 1-week = limites réduites (1-2). Spec A A9 P3b (2026-06-02) étend les tactiques aux 1-week stage races (Race Team).
- **Raison :** Profondeur strategique pendant les Grands Tours **et** les 1-week races, differenciation des decisions joueurs au-dela du roster

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
- [x] Tests automatises (pytest + vitest + Playwright e2e)
- [x] Anti-Runaway System (Co-Unlock Rule + Level Curve Stretch)
- [x] Code review fixes (12 findings) : 12 RPCs SECURITY DEFINER + trigger teams_protect
- [x] Force-resolve round (status table + any-player resolve button)
- [x] Auto-resolve on consensus (tous valident → round auto-resolved)
- [x] Payday in confirm_phase_setup (sponsor income + salaires + bankruptcy cascade)
- [x] 7-day release cooldown (previent timing exploit)
- [x] GT Tactics (5 tactiques : Unleash, Overdrive, Nemesis GC/Sprint, Call the Bus)
- [x] GT Squad Builder V2 (cap 8, swaps libres pendant phase)
- [x] grant_xp RPC (admin XP adjustments avec traceability)
- [x] Late join (rejoindre une ligue active)
- [x] Sponsor base bonuses rework (flat) + GT-specific goals + V1b goal evaluation/payout
- [x] Rider detail unifie (1 page pour tous les entry points)
- [x] Password reset flow (forgot + reset)
- [x] Pages legales (privacy + terms)
- [x] Status page (purchasing power + clickable team rows)
- [x] GT Rescue (DNF refund/replace window, auto-release on refund claim)
- [x] Achievements (systeme d'achievements equipe)
- [x] Lobby redesign (Chantier D) — route group `(lobby)/lobby/[leagueId]` dedie aux ligues pending, 3 tabs (Lobby / Level & Pool / Rules), `launch_first_auction` RPC, `set_starting_level` RPC
- [x] Demo mode (Chantier B) — route `/league/demo`, RLS anon SELECT (33 policies), ghost users, refresh script Python, banner pulse pattern
- [x] Race Feed (cards Home : past race, nemesis, rest day, GT goals)
- [x] Palmares (profil rider avec onglets Monuments / dynamiques + league rank)
- [x] Design System v3.1 (navigation tokens)
- [x] Spec A P2 — Scoring Refonte : classif V2 ×2 (youth ×1.5), GC final ×1.0, sprinter profile p1/p2/p3, stage_hunter breakaway 30 km + distance bonus, Overdrive breakaway-gated, final Points/KOM/Youth jerseys via `gt_final_classifications` (scale 80/20/10)

### A implementer (pre-alpha)

- [ ] Notifications in-app (strategie a definir — pas d'emails, decision actee)
- [ ] Valider l'exactitude des donnees PCS pour le calcul des salaires
