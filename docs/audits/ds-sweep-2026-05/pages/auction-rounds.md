# Audit · /league/[id]/auction/rounds
Generated: 2026-05-21
Files: auction/rounds/page.tsx + rounds-client.tsx
States: pre-auction (isCreating=true), round-1-active, round-1-closed, round-2-active, round-2-closed, round-3-active, all-finished

---

## Component tree rendu (1 niveau)

- `page.tsx` (Server Component — data fetch + auth guard)
  - `<RoundsClient>` (client, renders entire page UI)
    - `<BackHeader>` (shared) → voir `shared-components/back-header.md`
    - `<input type="date">` (native HTML — no shared component)
    - `<input type="time">` (native HTML — no shared component)
    - `<button>` CTA (inline — 2 instances: mobile sticky + desktop fixed)

## Composants partagés utilisés (déjà audités — violations NON dupliquées ici)

- `BackHeader` → voir `docs/audits/ds-sweep-2026-05/shared-components/back-header.md`
  - 1 violation résiduelle (C-001 `min-h-[40px]` → `min-h-10`) déjà documentée là-bas.

---

## Violations sur le code spécifique de la page

### A · Typographie (0)

Aucune violation.

- `text-[length:var(--type-page-title)]` ✓ — h1 du titre de la league
- `text-[length:var(--type-body)]` ✓ — paragraphe description, messages erreur/succès
- `text-[length:var(--type-caption)]` ✓ — label de round ("Round 1 — Closes")
- `text-[length:var(--type-emphasis)]` ✓ — label du bouton CTA
- `inputClass` (ligne 48-49) : utilise `text-[length:var(--type-body)]` ✓

---

### B · Couleurs (2) — HIGH PRIORITY

| ID | File:Line | Current | Proposed | Confidence | Rationale |
|---|---|---|---|---|---|
| B-001 | rounds-client.tsx:163 | `text-black` | `text-[var(--cta-text)]` | AUTO | Le bouton CTA mobile applique la classe utilitaire `.cta-gradient` qui projette `var(--cta-gradient)` en background. Le texte sur ce gradient doit utiliser `--cta-text` (`#020617`) — token conçu spécifiquement pour le contraste sur CTA gradient (défini dans globals.css ligne 147). `text-black` est un alias non-sémantique qui contourne le token et se cassera si `--cta-text` est redéfini. |
| B-002 | rounds-client.tsx:176 | `text-black` | `text-[var(--cta-text)]` | AUTO | Même violation, même bouton CTA, version desktop (bloc `hidden lg:block`). Substitution mécanique identique à B-001. |

**Note Jules :** Ces 2 violations avaient été identifiées comme HIGH dans le rapport Jules. Elles sont confirmées par `audit-ds`. Le token `--cta-text` est la correction sémantique correcte — `text-[var(--cta-text)]` est l'usage canonique sur tous les CTAs gradient de l'app.

**Analyse du risque :** `--cta-text` vaut actuellement `#020617` (quasi-noir). Visuellement identique à `text-black` (`#000000`) dans le dark theme actuel. Aucun impact visuel attendu au moment du fix — mais le token devient correct pour la cascade future.

---

### C · Spacing & Radius (0)

Aucune violation sur le code spécifique de cette page.

- `rounded-[var(--radius-md)]` ✓ — usage correct du token radius sur les inputs et CTA
- `px-3 py-2` ✓ — utilities Tailwind standards sur les inputs
- `px-4 py-3` ✓ — utilities Tailwind standards sur le conteneur sticky
- `px-4 py-2.5` ✓ — utilities Tailwind standards sur le bouton CTA
- `space-y-6`, `space-y-4`, `space-y-2` ✓ — utilities Tailwind standards
- `max-w-lg`, `pb-28`, `pt-4` ✓ — utilities Tailwind standards
- `gap-2` ✓ — utility Tailwind standard

---

### D · Patterns composants (0)

Aucune violation. Aucun pattern Pill/Badge/FilterChip inline détecté.

---

### E · Geist Mono numbers (0)

Aucune violation détectée. La page ne rend pas de valeurs numériques au sens métier (pas de XP, salary, treasury, bid amount). Les deux `<input type="date">` et `<input type="time">` utilisent `font-mono` via `inputClass` (ligne 48-49 : `font-mono text-[var(--text-high)]`) ✓.

---

## Cross-cutting issues

- **CTA dupliqué (mobile + desktop) :** Les lignes 160-168 (mobile) et 171-181 (desktop) contiennent exactement le même `<button>` avec le même `className` et le même contenu dynamique. La seule différence est la classe de visibilité responsive (`lg:hidden` / `hidden lg:block`) et l'offset `bottom`. Ce pattern est récurrent dans l'app (au moins 3 pages identifiées) — candidat pour une abstraction `<StickyCtaBar>` après le sweep. → Logger dans `follow-ups.md`.

---

## Statut final

| Classe | Violations | Severity |
|---|---|---|
| A · Typographie | 0 | — |
| B · Couleurs | **2** | HIGH |
| C · Spacing | 0 | — |
| D · Patterns | 0 | — |
| E · Mono numbers | 0 | — |
| **Total** | **2** | |

**BLOCKED :** aucun.

**False positives :** aucun (le détecteur audit-ds retourne 2 violations, toutes légitimes).

**Refs composants partagés :** `back-header.md` (1 violation C-001 à corriger par le repair agent back-header).

---

## Notes Phase 3 (pour le repair agent)

- **Fixes à appliquer :** B-001 et B-002 — substituer `text-black` par `text-[var(--cta-text)]` aux lignes 163 et 176 de `rounds-client.tsx`.
- **Impact visuel attendu :** quasi-nul (les deux valeurs sont quasi-identiques visuellement dans le thème actuel). Vérifier quand même le contraste sur screenshot after.
- **États à screenshoter :**
  - `isCreating=true` (pré-enchère — les 3 rounds avec dates pré-remplies)
  - `isCreating=false` avec rounds existants (édition)
  - Bouton en état `disabled` (isPending=true — pendant la soumission)
- **Accès :** page commissioner-only (redirect si non-commissioner). Les screenshots nécessitent un user authentifié commissioner. Si auth bloque : noter "screenshot skipped: auth required" et continuer.
- **`page.tsx` :** aucune modification requise (0 violation).
- **Ne pas toucher :** `BackHeader` (son fix C-001 est géré par le repair agent `back-header`).

---

## Checklist verification (à cocher par le repair agent)

- [ ] Screenshot before — état `isCreating=true` (mobile, 390px)
- [ ] Screenshot before — état `isCreating=false` avec rounds (mobile, 390px)
- [ ] Screenshot before — desktop (1440px)
- [ ] B-001 appliqué (`text-black` → `text-[var(--cta-text)]` ligne 163)
- [ ] B-002 appliqué (`text-black` → `text-[var(--cta-text)]` ligne 176)
- [ ] Screenshot after — mêmes états
- [ ] Diff visuel décrit : aucun changement visuel attendu (couleurs quasi-identiques)
- [ ] typecheck PASS
- [ ] lint PASS (0 warning ignoré)
- [ ] vitest PASS (pas de tests spécifiques à cette page actuellement — confirmer avec `pnpm test`)
- [ ] `pnpm audit-ds rounds-client.tsx` retourne 0 violations après fix
