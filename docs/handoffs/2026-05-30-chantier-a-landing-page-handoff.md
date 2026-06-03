# Handoff — Chantier A (Landing Page + vidéo de présentation)

> **Type** : document de reprise (handoff) auto-suffisant
> **Date** : 2026-05-30
> **Auteur** : session Claude Code (sur demande de Jonathan)
> **But** : permettre de reprendre le **Chantier A** depuis une session/outil **vierge**, sans contexte préalable.
> **Statut** : à démarrer (0% codé). Décisions partiellement prises (voir §5).

---

## 0. TL;DR (à lire en premier)

Le projet **WattHunter** (fantasy cycling auction game) avait un design en 4 chantiers
([spec d'origine](../archive/specs/2026-05-12-try-before-signup-design.md)) :

| Chantier | Sujet | Statut |
|----------|-------|--------|
| **A** | **Landing Page (vidéo de présentation + CTAs)** | ❌ **JAMAIS FAIT** — objet de ce handoff |
| B | Demo Mode (`/league/demo/*`) | ✅ Livré (~30 commits, PR #41/#42) |
| C | Combined Signup + League Creation | ✅ Livré |
| D | Lobby Redesign (pending league) | ✅ Livré |

**Le Chantier A est le seul des 4 jamais implémenté.** Aujourd'hui `apps/web/app/page.tsx`
redirige encore les visiteurs non authentifiés vers l'ancienne page statique `/onboarding` —
exactement le comportement que le Chantier A devait remplacer.

**Point important sur "Remotion"** : Remotion n'apparaît **nulle part** dans le repo ni dans le
spec d'origine. Le spec prévoyait une vidéo produite dans un **outil externe** (Figma / After
Effects / ScreenStudio), le code ne livrant que le `<video>` + le fade. L'idée d'utiliser
**Remotion** (vidéo générée en code React) est une nouvelle piste de Jonathan, **pas** une
régression sur un travail planifié. Le choix de l'outil vidéo est **reporté** (voir §5).

---

## 1. Contexte projet (pour une session vierge)

- **WattHunter** : `~/Documents/WattHunter`. Fantasy cycling auction game. Next.js 16 App Router,
  TypeScript strict, Tailwind v4 + Shadcn, Supabase (Postgres + Auth + Realtime), Turborepo + pnpm.
- **App web** : `apps/web/`.
- **À lire avant tout dev** :
  1. `CLAUDE.md` (racine) — règles dures. **Rule #1 : lire `docs/watthunter-design-system-v3.md`
     avant tout travail front. NEVER hardcode px/hex, utiliser les tokens.**
  2. `docs/ARCHITECTURE.md` — arborescence, routes, RPCs, composants.
  3. `~/.claude/projects/-Users-jonathanschummers-Documents-WattHunter/memory/MEMORY.md` — index features, gotchas.
- **Langue** : tout texte user-facing de l'app **en anglais**. Docs/commentaires/CLAUDE.md en français OK.
- **Branche actuelle** : `main` (HEAD `9ccecf2`). La branche `feature/try-before-signup` est **mergée et supprimée** (PR #41).

---

## 2. Le spec d'origine — Chantier A

Source complète : [`docs/archive/specs/2026-05-12-try-before-signup-design.md`](../archive/specs/2026-05-12-try-before-signup-design.md), **section 3**.

Résumé de ce que le Chantier A doit livrer :

### 3.1 Layout
- **Container vidéo** plein écran, `autoPlay muted playsInline`, lazy-loaded (MP4 ou WebM).
- **Sous la vidéo, 2 CTAs côte à côte** :
  - Gauche : **"Log in"** (secondaire) → `/login`
  - Droite : **"Get Started"** (primaire) → flux Create/Join chooser
- La vidéo est une **dépendance externe** dans le spec original ; le code ne livre que le container + fade.

### 3.2 Transition vidéo → démo
- À la fin de la vidéo (ou au scroll) : la vidéo fade out, le **mode démo** se révèle dessous.
- **Prefetch des données démo pendant la lecture** pour une transition instantanée.
- Si l'utilisateur clique "Get Started" avant la fin → va directement au flux Create/Join (skip démo).

### 3.3 Notes techniques (du spec)
- Réécriture de `app/page.tsx` (ou nouveau route group `(public)`).
- `<video autoPlay muted playsInline>`.
- Prefetch des données démo dans un cache client pendant la lecture.
- Les utilisateurs authentifiés ne voient jamais cette page (la logique de redirect existe déjà).

### Hors scope du spec d'origine (section 8)
- Création de la vidéo elle-même (dépendance externe).
- ⚠️ C'est exactement le point rouvert par Jonathan avec l'idée Remotion → voir §5.

---

## 3. État réel du code aujourd'hui (vérifié le 2026-05-30)

### Ce qui bloque / l'ancien comportement à remplacer
- **`apps/web/app/page.tsx`** : pour un visiteur non authentifié, fait `redirect("/onboarding")`.
  C'est le point d'entrée à réécrire (landing page).
- **`apps/web/app/(auth)/onboarding/page.tsx`** : ancienne page statique (3 cards `InfoCard` +
  boutons). Le spec prévoit qu'elle soit **remplacée** par la landing page. Mesh gradient cyan + logo.
- **`apps/web/lib/supabase/middleware.ts`** (ligne ~34-46) : gère les chemins publics. Le fallback
  d'auth renvoie vers `/onboarding` (ligne 46). À ajuster si la landing devient la nouvelle racine publique.
  - `publicPaths` inclut déjà `/onboarding`, `/login`, `/signup`, `/auth`, etc.
  - `publicPrefixPaths = ["/league/demo"]` → **la démo est déjà publique** (bon pour la transition).

### L'infrastructure démo déjà livrée (Chantier B) — à brancher dessus
Le périmètre retenu (§5) inclut le **branchement de la transition sur le mode démo existant**. Tout est déjà là :

- **`apps/web/lib/demo-constants.ts`** :
  - `DEMO_LEAGUE_SLUG = "demo"`, `DEMO_LEAGUE_ID = "00000000-0000-4000-8000-d3110d3110d3"`
  - `DEMO_VISITOR_TEAM_INDEX = 1` (le visiteur est l'équipe classée 2e — cf. spec §4.3)
  - `isDemoLeague(idOrSlug)` helper.
- **`apps/web/app/(game)/league/[leagueId]/layout.tsx`** (ligne 22) : `if (leagueId === DEMO_LEAGUE_SLUG)` → monte `DemoLeagueLayout`.
- **`apps/web/app/(game)/league/[leagueId]/demo-layout.tsx`** : layout forké (skip auth, monte DemoProvider + banner).
- **`apps/web/contexts/demo-context.tsx`** : `DemoProvider`, flag `isDemo`, `useDemoSafeAction` (intercepte les mutations).
- **`apps/web/components/demo/`** : `demo-banner.tsx`, `demo-bottom-cta.tsx`.
- **URL démo cible de la transition** : `/league/demo` (Home du mode démo).

→ **Pour le Chantier A, la transition "vidéo finie → révèle la démo" pointe vers `/league/demo`**,
qui est déjà fonctionnel et public. Le prefetch (§3.2 du spec) peut précharger cette route.

---

## 4. Ce qui a été investigué dans la discussion d'origine (2026-05-30)

Pour la traçabilité, voici le fil de la conversation qui a mené à ce handoff :

1. Jonathan : "je pense qu'on n'a pas fait le Chantier A de l'ancienne branche try-before-signup,
   la vidéo de présentation en Remotion".
2. Investigation :
   - Confirmé que **Chantier A jamais fait** (`page.tsx` redirige toujours vers `/onboarding`).
   - Confirmé que **Remotion = 0 occurrence** dans tout le repo (code, package.json, docs).
   - Confirmé que le spec prévoyait une vidéo **externe**, pas Remotion (challenge soulevé).
   - Confirmé que les Chantiers B, C, D sont livrés.
3. Décisions prises par Jonathan via questions structurées (voir §5).

---

## 5. Décisions prises (2026-05-30)

| Sujet | Décision | Conséquence |
|-------|----------|-------------|
| **Outil de production vidéo** | ⏸️ **À décider plus tard** | Le handoff documente les 2 options (Remotion vs externe). Un **brainstorming dédié** doit trancher avant de coder la partie vidéo. **Ne pas présupposer Remotion.** |
| **Périmètre du Chantier A** | **Landing page + branchement `/league/demo`** | Livrer : container vidéo (placeholder au début) + 2 CTAs + transition fade + prefetch + **révélation du mode démo existant**. La production de la vraie vidéo est un sous-chantier distinct, traité après la décision d'outil. |

### Les 2 options vidéo à arbitrer (pour le futur brainstorming)
- **Option 1 — Remotion** (vidéo en code React) : versionnable, éditable en code, "single source of
  truth" dans le repo. **Coût** : nouveau(x) package(s) `@remotion/*`, composition React, pipeline de
  rendu MP4, intégration dans le monorepo Turborepo/Next 16 (probablement un package séparé
  `packages/video-*` ou app dédiée). Non trivial.
- **Option 2 — Outil externe + `<video>`** (conforme spec d'origine) : Jonathan produit le MP4
  (Figma/AE/ScreenStudio), le code ne livre que le lecteur + fade. Simple, rapide, mais la vidéo
  n'est pas versionnée/éditable en code.

---

## 6. Plan de reprise recommandé (pour la session vierge)

> ⚠️ **Avant de coder le front** : lire `docs/watthunter-design-system-v3.md` (Rule #1 du CLAUDE.md).
> Utiliser les tokens (`--text-*`, `--bg-*`, `--accent-*`, `text-[length:var(--type-*)]`), jamais de px/hex hardcodés.

1. **Brainstorming (skill `superpowers:brainstorming`)** — c'est du travail créatif, donc obligatoire avant implémentation.
   Sujets à clarifier :
   - Trancher l'outil vidéo (Option 1 Remotion vs Option 2 externe) — décision §5 reportée.
   - Route : réécrire `app/page.tsx` ou créer un route group `(public)` ? (le spec §3.3 laisse le choix).
   - Mécanique exacte du prefetch démo (cache client, prefetch de `/league/demo`).
   - Déclencheur de la transition : fin de vidéo `onEnded` et/ou scroll.
   - Quid de `/onboarding` : suppression pure ou conservation en fallback ?
2. **Écrire un plan** (skill `superpowers:writing-plans`) une fois les décisions prises.
3. **Implémenter** en TDD quand pertinent (vitest dans `apps/web`).
4. **Créer une branche** : `feature/landing-page-chantier-a` (convention `feature/<desc>`).

### Fichiers probablement touchés (estimation, à confirmer au plan)
| Fichier | Changement attendu |
|---------|--------------------|
| `apps/web/app/page.tsx` | Réécriture : non-auth → landing page (au lieu de `redirect("/onboarding")`) |
| `apps/web/app/(public)/...` *(éventuel)* | Nouveau route group pour la landing |
| `apps/web/lib/supabase/middleware.ts` | Ajuster le fallback / chemins publics si la racine devient publique |
| `apps/web/app/(auth)/onboarding/page.tsx` | Remplacée ou retirée |
| Nouveau composant landing | Container `<video>` + 2 CTAs + fade + prefetch démo |
| *(si Remotion retenu)* `packages/` ou app vidéo dédiée | Composition Remotion + pipeline de rendu |

---

## 7. Après livraison — mettre à jour les living docs (Rule #4 du CLAUDE.md)
1. `docs/ARCHITECTURE.md` — nouvelle route landing, composants, suppression `/onboarding`.
2. `MEMORY.md` — ligne dans l'index features ("Chantier A — Landing Page livré").
3. Déplacer ce handoff + le plan dans `docs/archive/`.
4. `docs/GAME_RULES.md` — a priori non concerné (pas de règle de jeu).

---

## 8. Références rapides
- Spec d'origine (4 chantiers) : `docs/archive/specs/2026-05-12-try-before-signup-design.md`
- Plan Combined Signup (Chantier C, livré) : `docs/superpowers/plans/2026-05-12-combined-signup-implementation.md`
- Plan Lobby Redesign (Chantier D, livré) : `docs/archive/plans/2026-05-28-lobby-redesign-implementation.md`
- Spec Demo Mode (Chantier B, livré) : `docs/archive/specs/2026-05-29-demo-mode-implementation-spec.md`
- Design System (lire avant tout front) : `docs/watthunter-design-system-v3.md`
- Constantes démo : `apps/web/lib/demo-constants.ts`
