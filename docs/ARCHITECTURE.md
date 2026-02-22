# WattHunter — Architecture

> **Document vivant** — Mis a jour a chaque decision d'architecture.
> Derniere mise a jour : 2026-02-22

---

## Stack technique

| Couche | Technologie | Notes |
|--------|-------------|-------|
| Frontend | Next.js 16 App Router + React 19 | TypeScript strict |
| Style | Tailwind CSS v4 + Shadcn UI | Dark-first, Zinc + accent #34F6F2 |
| Icones | Solar Icons (linear) via @iconify/react | @iconify-json/solar |
| Police | Inter (@fontsource-variable/inter) | |
| Auth | Supabase Auth | Google OAuth + email/password |
| Database | Supabase Postgres | 15 tables, RLS enforced |
| Realtime | Supabase Realtime | Prevu pour encheres live |
| Edge Functions | Supabase Edge Functions | Calculs XP, finances |
| Data pipeline | Python FastAPI sur Railway | Sync procyclingstats |
| Monorepo | Turborepo + pnpm workspaces | |

---

## Structure du projet

```
watthunter/
├── apps/web/                    # Next.js 16
│   ├── app/
│   │   ├── (auth)/              # Routes sans sidebar
│   │   │   ├── login/           # Connexion (Google + email)
│   │   │   ├── signup/          # Creation de compte (email)
│   │   │   ├── onboarding/      # Ecran unique avec 3 cartes
│   │   │   └── league/
│   │   │       ├── create/      # Creer une ligue
│   │   │       └── join/        # Rejoindre avec code
│   │   ├── (game)/              # Routes avec sidebar + topbar
│   │   │   └── league/[leagueId]/
│   │   │       └── page.tsx     # Lobby (pending) ou Dashboard (active)
│   │   ├── auth/callback/       # OAuth + email confirmation callback
│   │   └── page.tsx             # Smart redirect
│   ├── components/
│   │   ├── ui/                  # Shadcn UI (modifies)
│   │   ├── sidebar.tsx          # Navigation 7 items
│   │   └── topbar.tsx           # Breadcrumb + avatar
│   └── lib/supabase/
│       ├── browser.ts           # Client cote navigateur
│       ├── server.ts            # Client cote serveur (cookies)
│       └── middleware.ts        # Refresh session + protection routes
├── services/pcs-sync/           # FastAPI Python
├── supabase/
│   ├── migrations/              # 7 fichiers SQL
│   └── functions/               # Edge Functions (a venir)
├── docs/
│   ├── plans/                   # Design docs + plans d'implementation
│   ├── GAME_RULES.md            # Regles du jeu (document vivant)
│   └── ARCHITECTURE.md          # Ce fichier
├── CLAUDE.md                    # Conventions pour Claude Code
└── PRD_*.md                     # PRDs d'origine (3 fichiers)
```

---

## Routing

### Groupes de routes

| Groupe | Layout | Usage |
|--------|--------|-------|
| `(auth)` | Centrer plein ecran, pas de sidebar | Login, signup, onboarding, create/join league |
| `(game)` | Sidebar 240px + TopBar + contenu scrollable | Toutes les pages de jeu |

### Protection des routes

Le middleware (`lib/supabase/middleware.ts`) protege toutes les routes sauf :
- `/` (smart redirect)
- `/login`
- `/signup`
- `/auth/*` (callback)
- `/join`

Les utilisateurs non authentifies sont rediriges vers `/login`.

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

1. Echange le code pour une session (si present — OAuth ou email confirmation)
2. Verifie si le profil `users` existe
3. Si non : cree le profil (display_name depuis metadata ou email)
4. Si `has_onboarded = false` → `/onboarding`
5. Sinon → `/`

### Pages separees

- `/login` — Connexion (Google + email/MDP)
- `/signup` — Creation de compte (Google + email + nom + MDP + confirmation)

---

## Base de donnees

### Schema (15 tables)

```
users ←──── league_members ────→ leagues
  │                │                  │
  └── teams ───────┘                  │
       │                              │
       ├── contracts → riders         │
       ├── team_policies → policies   │
       ├── team_sponsors → sponsors   │
       ├── rider_xp_daily             │
       └── treasury_log               │
                                      │
       auctions ──────────────────────┘
         └── auction_bids

       rider_pcs_history → riders
```

### RLS — Decisions d'architecture

**Probleme rencontre :** Recursion infinie dans les policies RLS.

`league_members_select` referençait `league_members` elle-meme, et `teams_select_league` referençait `league_members` dont la policy recursait.

**Solution :** Fonction `SECURITY DEFINER` qui bypass le RLS pour le check d'appartenance :

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

Utilisee par `league_members_select` et `teams_select_league`.

**Leagues en lecture publique :** Tout utilisateur authentifie peut lire les ligues. Le code d'invitation fait office de barriere d'acces. Les anciennes policies restrictives (`leagues_select_member`, `leagues_select_commissioner`) ont ete supprimees.

### Migrations appliquees

| Fichier | Description |
|---------|-------------|
| `20260221000000_initial_schema.sql` | 15 tables + RLS + contraintes |
| `20260221150828_seed_policies_sponsors.sql` | 5 politiques + 10 sponsors |
| `20260222000000_add_has_onboarded.sql` | `users.has_onboarded` boolean |
| `20260222100000_fix_leagues_select_commissioner.sql` | Policy SELECT pour commissaire |
| `20260222110000_fix_recursive_rls.sql` | `is_league_member()` SECURITY DEFINER |
| `20260222120000_leagues_select_authenticated.sql` | Leagues lisibles par tout authentifie |
| `20260222130000_update_max_players_and_rules.sql` | max_players: default 20, range 1-20 |

---

## Design system

### Palette — Dark-first

| Token | Valeur |
|-------|--------|
| Background | Zinc 950 `#09090b` |
| Surface | Zinc 900 `#18181b` |
| Border | Zinc 800 `#27272a` |
| Text primary | Zinc 50 `#fafafa` |
| Text secondary | Zinc 400 `#a1a1aa` |
| **Accent** | **#34F6F2** |
| Accent muted | #34F6F2 a 15% |
| Destructive | Red 500/600 |

### Typographie

- Police : Inter
- Body : text-sm, Labels : text-xs, Headings : text-lg/xl
- Poids : 400 (texte), 500 (labels), 600 (headings)

### Espacement

- Grille 8px (gap-2, p-2)
- Minimum entre sections : gap-4
- Jamais 4px sauf micro-ajustements

### Composants modifies (Shadcn)

| Composant | Modification |
|-----------|-------------|
| Badge | `rounded-md` au lieu de `rounded-full` |
| Button | Variant `brand` ajoutee (bg-accent, font-semibold, shadow) |
| Progress | Track `bg-muted`, indicateur `bg-accent`, hauteur `h-1` |

### Layout shell

```
┌──────────┬─────────────────────────────────┐
│ Sidebar  │ TopBar (nom ligue + avatar)     │
│ 240px    ├─────────────────────────────────┤
│ fixe     │ Contenu principal (scrollable)  │
│          │ padding 32px (p-8)              │
└──────────┴─────────────────────────────────┘
```

---

## Pipeline de donnees (prevu)

```
08:00 UTC — Sync PCS complet (~923 coureurs, ~62 min)
08:30 UTC — Update coureurs actifs en jeu
09:00 UTC — Calcul XP quotidien
1er du mois 00:01 UTC — Finances mensuelles (salaires, sponsors, faillites)
```

Service : Python FastAPI (`services/pcs-sync/`) deploye sur Railway.
Librairie : `procyclingstats` (Python, gratuite).

---

## Decisions d'architecture (ADRs)

### ADR-001 : Pas de minimum de joueurs pour lancer une ligue
- **Contexte :** Le PRD prevoyait min 4 joueurs
- **Decision :** Le commissaire peut lancer quand il veut
- **Raison :** Simplifie les tests et donne plus de flexibilite

### ADR-002 : Max 20 joueurs par ligue (non configurable)
- **Contexte :** Le PRD prevoyait 6-12 configurable par le commissaire
- **Decision :** Max fixe a 20, pas de selecteur dans le formulaire
- **Raison :** Pas besoin de limiter artificiellement, le code invite suffit comme filtre

### ADR-003 : Leagues lisibles par tout utilisateur authentifie
- **Contexte :** Le PRD prevoyait un acces restreint aux membres
- **Decision :** Tout authentifie peut SELECT sur leagues
- **Raison :** Le code d'invitation est la vraie barriere. Necessaire pour le flow "join"

### ADR-004 : SECURITY DEFINER pour les checks d'appartenance
- **Contexte :** Recursion infinie dans les policies RLS auto-referentielles
- **Decision :** Fonction `is_league_member()` en SECURITY DEFINER
- **Raison :** Bypass RLS pour le check, evite la recursion. Pattern standard Supabase

### ADR-005 : Pages login et signup separees
- **Contexte :** Version initiale avait un toggle sur une seule page
- **Decision :** `/login` (connexion) et `/signup` (creation de compte) separes
- **Raison :** Pattern UX standard, signup a des champs supplementaires (nom, confirmation MDP)

### ADR-006 : Onboarding en un seul ecran
- **Contexte :** Version initiale avait un flow multi-step (2 ecrans + choix)
- **Decision :** Un seul ecran avec 3 cartes informatives + boutons create/join
- **Raison :** Moins de friction, l'information est concise

---

## Etat d'avancement

### Implemente (Phase 0 + Phase 1)
- [x] Design system (theme, layout, composants)
- [x] Auth (Google OAuth + email/password)
- [x] Onboarding (ecran unique 3 cartes)
- [x] Create league (nom uniquement, max 20)
- [x] Join league (code 6 caracteres)
- [x] Lobby (liste membres, copie code, lancement par commissaire)
- [x] 15 tables DB + RLS + seed

### A implementer (Phase 2+)
- [ ] Catalogue de coureurs + recherche/filtres
- [ ] Systeme d'encheres complet
- [ ] Gestion d'equipe (roster, liberation, faillite)
- [ ] Tresorerie (widget, log, projections)
- [ ] Moteur XP quotidien
- [ ] Politiques (activation, configuration)
- [ ] Sponsors (selection, paiements)
- [ ] Pipeline PCS (sync quotidien)
- [ ] Classement de la ligue
- [ ] Notifications email

### Blockers pre-alpha
- [ ] Calibrer taux de conversion (simulation Excel)
- [ ] Valider tolerance rate limit PCS
- [ ] Calibrer seuils XP par niveau
- [ ] Choisir provider email
