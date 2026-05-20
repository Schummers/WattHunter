# Audit · Error Pages
Generated: 2026-05-21
Files: app/error.tsx, app/(game)/league/[leagueId]/error.tsx
Note: app/not-found.tsx n'existe pas dans le projet.

---

## Component tree

**app/error.tsx** (GlobalError — Client Component)
- Wrapper `<html><body>` standalone (requis par Next.js pour les global errors)
- `<h2>` + `<p>` + `<button>` Try again

**app/(game)/league/[leagueId]/error.tsx** (LeagueError — Client Component)
- Layout `flex justify-center min-h-[60vh]`
- `<h2>` + `<p>` dynamic error message + 2 `<button>` (Try again / Back to leagues)

---

## A — Violations confirmées

### A-001 · app/error.tsx:20 · TOKEN_FANTÔME `--type-title` (classe A)
- **Rule** : utiliser uniquement des tokens définis dans `globals.css`. `--type-title` n'est PAS défini.
- **Current** : `<h2 className="text-[length:var(--type-title)] font-semibold">`
- **Token défini le plus proche** : `--type-page-title` (18px/20px) — sémantiquement correct pour un titre de page d'erreur
- **Proposed** : `text-[length:var(--type-page-title)]`
- **BLOCKED** : Non

### A-002 · app/(game)/league/[leagueId]/error.tsx:22 · TOKEN_FANTÔME `--type-title` (classe A)
- **Rule** : même que A-001
- **Current** : `<h2 className="text-[length:var(--type-title)] font-semibold">`
- **Proposed** : `text-[length:var(--type-page-title)]`
- **BLOCKED** : Non

---

## B — Faux positifs documentés

### FP-001 · app/error.tsx — `<button>` natif au lieu de `<Button>` Shadcn
- Les error pages utilisent un `<button>` HTML nu pour éviter toute dépendance sur le système de composants (contexte : GlobalError wrapping `<html>` ne peut pas utiliser les composants Next.js habituels). Pattern acceptable pour `app/error.tsx` (global error boundary).
- Pour `league/[leagueId]/error.tsx`, l'utilisation d'un `<button>` natif est discutable (le composant `<Button>` est disponible dans ce contexte), mais le styling manuel avec tokens DS est correct (`--radius-md`, `--accent-default`, `--bg-surface`, `--bg-surface-hover`, `--text-high`, `--text-mid`, `--type-body`). Pas une violation de tokens DS.
- Décision : documenter comme pattern à aligner ultérieurement, pas une violation bloquante.

---

## C — Tokens fantômes

| Token | Fichier | Statut |
|---|---|---|
| `--type-title` | app/error.tsx:20 | **FANTÔME** — non défini dans globals.css |
| `--type-title` | league/.../error.tsx:22 | **FANTÔME** — non défini dans globals.css |

Tous les autres tokens utilisés sont valides : `--bg-app`, `--text-high`, `--text-mid`, `--accent-default`, `--bg-surface`, `--bg-surface-hover`, `--radius-md`, `--type-body`.

---

## D — Composants inline

### D-001 · achievements-client.tsx:77 (hors scope direct mais mentionné)
- `text-[length:var(--type-title)]` également présent dans `app/(game)/league/[leagueId]/achievements/achievements-client.tsx` (repéré lors des recherches grep)
- Ce fichier est hors scope du présent audit (déjà audité dans pages/achievements.md) mais la violation `--type-title` doit y être corrigée aussi
- Proposed : `text-[length:var(--type-page-title)]`

---

## E — Résumé

| Fichier | Violations réelles | FP | BLOCKED | Notes |
|---|---|---|---|---|
| app/error.tsx | 1 | 1 | Non | A-001 : `--type-title` → `--type-page-title` |
| league/[id]/error.tsx | 1 | 1 | Non | A-002 : `--type-title` → `--type-page-title` |
| app/not-found.tsx | — | — | — | Fichier inexistant |

**Correction totale** : 2 occurrences de `--type-title` à remplacer par `--type-page-title`.
Fichier additionnel hors scope à corriger en même temps : `achievements-client.tsx:77`.
