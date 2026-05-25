# Design System Migration — DESIGN.md format (Google Stitch)

**Date :** 2026-05-25
**Statut :** Draft à challenger (revue indépendante prévue avec deep search)
**Branche cible :** `feature/design-system-md-migration` (à créer depuis `main` après merge de `feature/navigation-redesign`)
**Auteur :** Jonathan Schummers + Claude Opus 4.7

---

## 0. TL;DR

Migrer le design system WattHunter d'un format **prose-first humain-centric** (`docs/watthunter-design-system-v3.md`, 1655 lignes) vers un format **agent-first machine-readable** (`DESIGN.md` à la racine, format Google Stitch open-source) + un **catalogue de composants auto-généré** (alternative au pattern `system.md` statique). Objectif mesurable : **drift visuel < 5%** (mesuré par count de valeurs hardcodées dans `apps/web/`) et **réutilisation des composants existants** par les agents IA dans 95% des cas où un composant adéquat existe déjà.

---

## 1. Contexte & need

### Problème observé (binary, mesurable)

| Symptôme | Mesure actuelle | Cible |
|----------|-----------------|-------|
| Valeurs px hardcodées dans le code | `grep -rE "text-\[\d+px\]" apps/web/ → ?? occurrences` (à mesurer) | 0 |
| Hex codes hardcodés hors `globals.css` | `grep -rE "#[0-9a-fA-F]{6}" apps/web/app/ apps/web/components/ → ?? occurrences` | 0 |
| Composants ré-inventés alors qu'ils existent | Anecdotique (mesure manuelle requise sur 5 derniers PRs) | < 5% des PRs frontend |
| Drift v1 vs v2 sur même type d'UI | Pas de métrique formelle | Sera mesuré post-migration |

### Pourquoi ça arrive

1. **`CLAUDE.md` Rule #1** dit "lis le DS avant tout front" — c'est une *recommandation*, pas une *contrainte*. L'agent peut rationaliser ("je connais cette section, pas besoin de relire") et hardcoder.
2. **`docs/watthunter-design-system-v3.md`** fait 1655 lignes de prose. L'agent ne charge pas tout, sélectionne des sections, manque des règles.
3. **Aucun mécanisme de découverte des composants existants** — l'agent ne sait pas que `<L2Tabs>`, `<TacticCard>`, `<XPCard>` existent. Il les recrée.
4. **Pas de gate de vérification** — l'agent peut claim "done" sans preuve visuelle ni preuve de conformité.

### Hypothèse de travail

> La qualité de l'output d'un agent est directement proportionnelle à la qualité de l'input. Un DS structuré machine-readable + un catalogue de composants à jour = code conforme dès le premier essai.

> **ASSUMPTION 1 :** Claude Code lit `DESIGN.md` à la racine **automatiquement** comme `CLAUDE.md`, sans invocation explicite. **À VALIDER** par deep search.

---

## 2. Goals & non-goals

### Goals

- **G1.** Encoder les tokens WattHunter dans le format DESIGN.md open-source de Google (YAML + Markdown prose).
- **G2.** Fournir aux agents IA un catalogue à jour des composants applicatifs existants (`apps/web/components/`) sans drift.
- **G3.** Renforcer `CLAUDE.md` avec des Iron Laws non-négociables (NEVER hardcode, NEVER reinvent).
- **G4.** Mettre en place un linting CI qui bloque les valeurs hardcodées (Vercel preview deployment failed si non-conforme).
- **G5.** Conserver `docs/watthunter-design-system-v3.md` comme **rationale détaillée** (référence prose riche pour les humains).

### Non-goals (explicites)

- **NG1.** Ne pas installer Storybook juste pour avoir le Component Manifest MCP (overkill solo dev).
- **NG2.** Ne pas adopter le workflow Lyse Plan-Ship-Analyze maintenant (évaluation Q3 2026 après nav redesign).
- **NG3.** Ne pas refactoriser `globals.css` (rester miroir manuel synchronisé avec `DESIGN.md`).
- **NG4.** Ne pas migrer vers Figma / Figma MCP (code-first reste la stratégie).
- **NG5.** Ne pas créer `system.md` statique (drift inéluctable — preuve : `ARCHITECTURE.md` qui dérive déjà malgré Rule #3).

---

## 3. Architecture proposée

### Vue d'ensemble — 4 artefacts

```
WattHunter/
├── CLAUDE.md                                    ← MODIFIÉ : Iron Laws explicites
├── apps/web/
│   ├── DESIGN.md                                ← NOUVEAU : tokens YAML + prose
│   ├── components-manifest.json                 ← NOUVEAU : auto-généré (gitignored ou commited?)
│   ├── app/globals.css                          ← INCHANGÉ (miroir des tokens DESIGN.md)
│   └── components/                              ← INCHANGÉ
├── scripts/
│   └── generate-components-manifest.ts          ← NOUVEAU : script de génération
└── docs/
    ├── watthunter-design-system-v3.md          ← CONSERVÉ : rationale détaillée
    └── superpowers/specs/
        └── 2026-05-25-design-system-md-migration-design.md   ← CE FICHIER
```

> **DÉCISION 1 — Emplacement de DESIGN.md :** `apps/web/DESIGN.md` (proximité du code qu'il décrit) plutôt que racine monorepo. **À VALIDER par deep search** (conventions communautaires).

> **DÉCISION 2 — components-manifest.json gitignored ou commited ?** Proposé : **commited**, généré sur pre-commit hook. Permet à un agent qui ouvre le repo sans avoir run le script de quand même accéder au manifest. **À CHALLENGER**.

### Composant 1 — `DESIGN.md`

**Format :** Google Stitch spec officielle (`version: alpha`, YAML front matter + Markdown prose, sections Overview/Colors/Typography/Layout/Elevation/Shapes/Components/Do's-Don'ts).

**Contenu YAML attendu (~250 lignes) :**
- `name`, `description` (paragraphe brand-narratif)
- `colors` : ~25 tokens sémantiques WattHunter (`bg-app`, `text-high`, `accent-default`, etc.) + aliases M3 (`primary`, `surface`) pour satisfaire le linter
- `typography` : 11 niveaux (`display`, `stat-lg`, `page-title`, `section`, `stat-md`, `emphasis`, `body-md`, `caption`, `label`, `nav`, `micro`)
- `rounded` : 6 niveaux (`sm: 4px`, `md: 6px`, `lg: 8px`, `compound: 10px`, `pill: 20px`, `full: 9999px`)
- `spacing` : 8 niveaux (`space-1` à `space-12`)
- `components` : ~17 entries avec variants (button-primary/secondary/ghost, card-standard, l2-tab-active/inactive, filter-pill-active/inactive, tag-default/highlighted/success/warning, compound-header, contextual-action-bar, nav-bottom, list-row, input-text, code-block)

**Contenu Markdown attendu (~400 lignes) :**
- `## Overview` (200 mots — brand & feel)
- `## Colors` (catalogue exhaustif token-par-token)
- `## Typography` (hiérarchie + principes)
- `## Layout` (grid + spacing strategy)
- `## Elevation & Depth` (shadows + glass + tonal layers)
- `## Shapes` (radius-as-affordance pattern)
- `## Components` (prose pour chaque composant YAML)
- `## Do's and Don'ts` (Iron Laws + guidelines)
- `## Responsive Behavior` (md: + lg: strategy — extension non-spec)
- `## Canonical Examples` (liens vers `apps/web/components/*` — extension)

> **DÉCISION 3 — Token naming hybride :** Garder les noms WattHunter (`bg-app`, `text-high`, `accent-default`...) + aliases M3 (`primary`, `surface`) pour satisfaire le linter `missing-primary`. **Alternative rejetée :** tout renommer en M3 (casse cohérence avec `globals.css`). **À CHALLENGER.**

> **DÉCISION 4 — Doc DS prose-heavy (v3 1655 lignes) :** Conservé en `docs/`, retitré "WattHunter Design System v3 — Rationale & Reference" pour clarifier que `DESIGN.md` est désormais l'autorité. **Risque :** double source de vérité, drift entre les deux. **Mitigation :** `DESIGN.md` est canonique pour les tokens, le doc v3 ne sert plus que pour les explications historiques. **À CHALLENGER.**

### Composant 2 — `components-manifest.json` (auto-généré)

**Objectif :** donner à l'agent un catalogue à jour des composants existants, **sans drift** parce que régénéré sur pre-commit.

**Format proposé (à valider) :**
```json
{
  "generated_at": "2026-05-25T10:00:00Z",
  "generator_version": "0.1.0",
  "components": [
    {
      "name": "L2Tabs",
      "path": "apps/web/components/l2-tabs.tsx",
      "type": "molecule",
      "description": "Sub-navigation tabs (8px chip radius, hide-on-scroll)",
      "props": [
        { "name": "tabs", "type": "Array<{id: string; label: string}>", "required": true },
        { "name": "activeTab", "type": "string", "required": true },
        { "name": "onChange", "type": "(id: string) => void", "required": true }
      ],
      "variants": [],
      "design_tokens_used": ["bg-surface-active", "border-hover", "text-high", "radius-lg"],
      "related_design_md_components": ["l2-tab-active", "l2-tab-inactive"]
    }
  ]
}
```

**Génération :**
```typescript
// scripts/generate-components-manifest.ts
// Utilise react-docgen-typescript pour parser apps/web/components/*.tsx
// Sortie : apps/web/components-manifest.json
// Hook : .husky/pre-commit
```

> **DÉCISION 5 — Pre-commit hook vs CI-only :** Proposé pre-commit (régénère à chaque commit touching `components/`). **Alternative :** GitHub Action qui régénère sur PR. **Trade-off :** pre-commit ralentit le dev local, GitHub Action peut être bypassé. **À CHALLENGER.**

> **QUESTION OUVERTE 1 :** react-docgen-typescript suffit-il, ou faut-il un parser AST plus poussé (ts-morph) pour capturer les variants CVA des composants shadcn ?

> **QUESTION OUVERTE 2 :** Comment référencer dans le manifest les composants qui sont des **wrappers de shadcn** (ex: notre `<Button>` étend `<button>` shadcn) ? Inclure les props héritées ou non ?

### Composant 3 — `CLAUDE.md` renforcé

**Ajout d'une section Iron Laws (non-négociable) :**

```markdown
## Iron Laws — Design System Conformity

These rules are NON-NEGOTIABLE. The build and CI enforce them.

### ❌ NEVER

- NEVER hardcode pixel values for text size, spacing, border-radius. Use `text-[length:var(--type-*)]` or Tailwind utilities mapped to tokens.
- NEVER hardcode hex colors in components. Use semantic tokens (`--text-*`, `--bg-*`, `--accent-*`) defined in `apps/web/DESIGN.md` and `globals.css`.
- NEVER reinvent a component. Before creating new UI, read `apps/web/components-manifest.json` and check if an existing component fits.
- NEVER claim "done" without: (a) `pnpm typecheck` exit 0, (b) `pnpm lint` exit 0 (which includes lint:tokens), (c) visual screenshot of the changed UI.

### ✅ ALWAYS

- ALWAYS read `apps/web/DESIGN.md` and `apps/web/components-manifest.json` at the start of any frontend task.
- ALWAYS use `--accent-default` (cyan-500) only for interactive elements. Use `--accent-highlight` (cyan-400) for max 1 hero stat per screen.
- ALWAYS reference existing components when their pattern matches the requested feature.

### Verification Gates

Before claiming any frontend work complete:

- [ ] Gate A : `pnpm typecheck && pnpm lint && pnpm lint:tokens` all exit 0
- [ ] Gate B : Screenshot of the change attached to the task report

"Looks right" / "should pass" / "I'm confident" are NOT acceptable.
```

> **DÉCISION 6 — Iron Laws placement :** Dans `CLAUDE.md` (lu automatiquement par Claude Code) plutôt que dans `DESIGN.md`. Rationale : `CLAUDE.md` = comportement, `DESIGN.md` = contrat. **À CHALLENGER**.

### Composant 4 — Linting CI (`lint:tokens`)

**Objectif :** transformer Iron Laws en contraintes mécaniques.

**Approche proposée :** ESLint plugin custom (ou règle ESLint existante si trouvée par deep search) :

- Détecter `text-\[\d+px\]` → erreur "Use a typography token"
- Détecter `#[0-9a-fA-F]{6}` ou `#[0-9a-fA-F]{3}` hors `globals.css` → erreur "Use a semantic color token"
- Détecter `bg-\[#[0-9a-f]{3,6}\]` → erreur "Use Tailwind v4 with semantic token"

**Intégration :**
- `pnpm lint:tokens` (script package.json)
- Run in `pnpm lint`
- Vercel CI : deployment failed si `pnpm lint` fail

> **QUESTION OUVERTE 3 :** Existe-t-il déjà un ESLint plugin Tailwind v4 qui catch ces patterns ? Sinon, complexité d'écrire un plugin custom (estimation : 2-4h ?).

> **DÉCISION 7 — Whitelist :** Certaines valeurs raw px sont légitimes (`globals.css`, animations keyframes, mesh gradients). Le linter doit avoir un mécanisme d'exclusion (commentaire `// eslint-disable-line ds/no-hardcoded-px` ou whitelist par path). **À PRÉCISER**.

---

## 4. Séquencement (8 phases, ~12-16h total)

| Phase | Description | Effort | Dépendances |
|-------|-------------|--------|-------------|
| **P1** | Mesurer la baseline : grep des hardcoded values, count par fichier | 30min | aucune |
| **P2** | Écrire `apps/web/DESIGN.md` (YAML + prose) | 3-4h | P1 (pour validation tokens) |
| **P3** | Lint `DESIGN.md` avec `npx @google/design.md lint` jusqu'à 0 errors | 30min | P2 |
| **P4** | Écrire `scripts/generate-components-manifest.ts` | 3-4h | P2 |
| **P5** | Génerer `components-manifest.json` initial + valider sur 5 composants | 1h | P4 |
| **P6** | Ajouter pre-commit hook `.husky/pre-commit` | 30min | P5 |
| **P7** | Écrire ESLint plugin custom `lint:tokens` | 2-3h | P1 (pour cibler les patterns observés) |
| **P8** | Update `CLAUDE.md` avec Iron Laws + verification gates | 30min | P2, P4, P7 |

> **DÉCISION 8 — Branche :** `feature/design-system-md-migration` créée depuis `main` après merge de `feature/navigation-redesign`. **Alternative rejetée :** travailler en parallèle (risque de conflit sur `globals.css` que la nav redesign modifie). **À CHALLENGER**.

---

## 5. Acceptance criteria

### Critères binaires

- [ ] `apps/web/DESIGN.md` existe et passe `npx @google/design.md lint` avec 0 errors, ≤ 2 warnings
- [ ] `apps/web/components-manifest.json` est généré et inclut les ≥ 30 composants principaux de `apps/web/components/`
- [ ] `scripts/generate-components-manifest.ts` régénère le manifest en < 5s
- [ ] `.husky/pre-commit` exécute la régénération automatiquement
- [ ] `pnpm lint:tokens` est défini et bloque les patterns hardcoded
- [ ] `pnpm lint:tokens` sur la baseline actuelle remonte ≥ N occurrences (N = baseline mesurée P1)
- [ ] `CLAUDE.md` contient une section "Iron Laws" avec au moins 4 NEVER + 3 ALWAYS + 2 Verification Gates
- [ ] La doc `docs/watthunter-design-system-v3.md` a été retitrée et un disclaimer pointe vers `DESIGN.md`

### Critères qualitatifs (validés en revue)

- [ ] Un agent qui reçoit "build a new auction filter" et qui lit DESIGN.md + manifest produit du code utilisant `<FilterPill>` (existant) plutôt qu'un nouveau composant
- [ ] Sur 5 PRs de test post-migration, 0 valeurs hardcodées
- [ ] `apps/web/DESIGN.md` est utilisable comme prompt context (< 3000 lignes total, fits in Claude Code context window without compression)

---

## 6. Risks & mitigations

| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| **R1.** `DESIGN.md` version `alpha` introduit breaking changes | Moyenne | Moyen | Pin la version du CLI (`@google/design.md@0.x`). Suivre le changelog. |
| **R2.** Claude Code ne lit pas DESIGN.md automatiquement comme espéré | Moyenne | **Élevé** | Si non auto-lu : ajouter référence explicite dans `CLAUDE.md` Rule #1 ("read apps/web/DESIGN.md before any frontend work") |
| **R3.** Script de génération du manifest casse à chaque évolution shadcn / TS | Faible | Moyen | Tests unitaires sur le script. CI qui vérifie qu'il run encore. |
| **R4.** ESLint plugin custom devient un fardeau de maintenance | Moyenne | Faible | Si trop lourd : se rabattre sur des regex grep dans un script Node simple (`scripts/check-tokens.ts`) |
| **R5.** Double source de vérité `DESIGN.md` vs `globals.css` → drift | **Élevée** | Moyen | Cycle court de vérification : `npx @google/design.md export --format css-tailwind` produit-il un diff propre vs `globals.css` ? À tester en P3. |
| **R6.** Le pre-commit hook ralentit dev local | Moyenne | Faible | Si régénération > 2s, déplacer en CI uniquement |

---

## 7. Open questions (à traiter en revue)

### Architecture
1. `DESIGN.md` à la racine `apps/web/` ou à la racine du monorepo ? Consensus communautaire ?
2. Le `components-manifest.json` doit-il être committed ou gitignored ?
3. Faut-il créer en plus un `AGENTS.md` pour la compatibilité multi-vendor (Cursor, Codex) ou `CLAUDE.md` suffit ?

### Tooling
4. Existe-t-il un ESLint plugin Tailwind v4 prêt qui catch `text-[Npx]` et hex hardcodés ?
5. react-docgen-typescript suffit-il pour parser des composants shadcn avec CVA variants ?
6. Le CLI `@google/design.md export --format css-tailwind` produit-il un `@theme` block compatible avec notre `globals.css` (qui mixe tokens + shadcn aliases + keyframes + mesh) ?

### Process
7. Faut-il ajouter une "Visual Gate" automatisée (Playwright screenshot + diff) ou la verification visuelle reste-t-elle manuelle ?
8. Comment mesurer empiriquement le drift post-migration ? (proposition : compteur hebdomadaire de `grep -E "text-\[\d+px\]" apps/web/`)

### Adoption
9. Le doc `watthunter-design-system-v3.md` (1655 lignes) — supprimer après migration, archiver, ou conserver comme rationale ?
10. Comment former mes futures sessions Claude Code à lire `components-manifest.json` automatiquement (pas juste `DESIGN.md`) ?

---

## 8. Alternatives considérées & rejetées

### A1. system.md statique (Surendar Selvaraj pattern)
**Rejeté car :** un seul auteur, pas de tooling, drift inéluctable. Notre expérience avec `ARCHITECTURE.md` (qui dérive malgré Rule #3) prouve que les catalogues markdown statiques ne tiennent pas.

### A2. Storybook + Component Manifest MCP (Storybook 10.3)
**Rejeté car :** WattHunter n'a pas Storybook. Setup = 1-2 jours pour 50+ composants à story-ifier. ROI faible pour solo dev. **À reconsidérer en Q3 2026** si la base de composants double.

### A3. AGENTS.md à la place de CLAUDE.md
**Rejeté car :** WattHunter utilise exclusivement Claude Code. Pas de besoin multi-vendor. CLAUDE.md déjà en place avec Rule #1-4 fonctionnelles. **Alternative :** ajouter un `AGENTS.md` qui pointe vers `CLAUDE.md` pour symbolique cross-vendor (faible effort).

### A4. Migration full vers Plan-Ship-Analyze (Lyse)
**Rejeté pour cette migration car :** scope explosif (refonte du workflow complet). DESIGN.md + manifest sont la **fondation** que Plan-Ship-Analyze consommerait de toute façon. **À évaluer en Q3 2026** après retour d'expérience sur la nav redesign.

### A5. Génération de tokens via DESIGN.md → globals.css (CLI export)
**Rejeté car :** notre `globals.css` mélange tokens sémantiques + shadcn aliases + keyframes + mesh gradients. Le CLI `@google/design.md export --format css-tailwind` ne produira qu'un sous-ensemble. Risque de casser la build. **Alternative pragmatique :** `DESIGN.md` et `globals.css` sont des miroirs synchronisés manuellement. La discipline humaine + un test CI qui compare les hex codes garantissent la cohérence.

---

## 9. Out of scope (explicite)

- Refonte de `globals.css` (resters miroir manuel)
- Migration des composants shadcn vers un wrapper custom unifié
- Création d'un MCP server custom pour servir DESIGN.md
- Storybook setup
- Workflow Plan-Ship-Analyze (Lyse) — décision Q3 2026
- Visual regression testing (Playwright + pixel-diff) — décision séparée
- Migration des autres apps du monorepo (`services/pcs-sync`, etc.)

---

## 10. Success metrics (mesurés à 4 semaines post-merge)

| Métrique | Baseline (P1) | Cible 4 semaines |
|----------|---------------|------------------|
| Occurrences `text-\[\d+px\]` dans `apps/web/` | ?? (à mesurer) | -80% |
| Occurrences hex codes hors `globals.css` | ?? | -90% |
| PRs frontend qui réinventent un composant existant | Anecdotique | < 5% |
| Temps moyen pour générer un composant conforme (subjectif) | ?? | -30% |
| `pnpm lint:tokens` exit code sur main | N/A | 0 |

---

## 11. Annexes

### Annexe A — Schema YAML DESIGN.md (extrait projeté)

```yaml
---
version: alpha
name: WattHunter
description: |
  Dense fantasy cycling app, Sky Blue Night dark canvas (200° hue, 18% sat),
  restrained Cyan accent guiding interactions. Geist Mono for all numbers.
  Brand reads as "data-app meets sports broadcast" — engineered density,
  minimal chrome, single chromatic event (cyan) per screen.

colors:
  # M3 spec aliases (linter compliance)
  primary: "#06b6d4"
  surface: "#151b1e"

  # WattHunter semantic tokens
  bg-app: "#0c1012"
  bg-subtle: "#111618"
  bg-surface: "#151b1e"
  bg-surface-hover: "#1a2226"
  bg-surface-active: "#1f292e"

  border-subtle: "#151b1e"
  border-default: "#273339"
  border-hover: "#334249"

  text-high: "#eaeff1"
  text-mid: "#89a1ad"
  text-low: "#74919f"
  text-ghost: "#334249"

  accent-default: "#06b6d4"
  accent-highlight: "#22d3ee"
  accent-hover: "#0891b2"
  accent-active: "#0e7490"
  accent-label: "#0ea5e9"

  bg-glass: "rgba(8, 14, 26, 0.80)"  # NOTE: not strict hex — to validate against linter
  border-glass: "rgba(255, 255, 255, 0.06)"

  success: "#10b981"
  danger: "#ef4444"
  warning: "#f59e0b"

typography:
  display:
    fontFamily: Geist Mono
    fontSize: 32px
    fontWeight: 900
  stat-lg:
    fontFamily: Geist Mono
    fontSize: 20px
    fontWeight: 800
  page-title:
    fontFamily: Geist
    fontSize: 18px
    fontWeight: 700
  # ... (8 more levels)

rounded:
  sm: 4px
  md: 6px
  lg: 8px
  compound: 10px
  pill: 20px
  full: 9999px

spacing:
  1: 4px
  2: 8px
  3: 12px
  4: 16px
  5: 20px
  6: 24px
  8: 32px
  12: 48px

components:
  button-primary:
    backgroundColor: "{colors.accent-default}"
    textColor: "{colors.bg-app}"  # cyan button with dark text — brand choice
    typography: "{typography.emphasis}"
    rounded: "{rounded.md}"
    padding: 8px 16px

  l2-tab-active:
    backgroundColor: "{colors.bg-surface-active}"
    textColor: "{colors.text-high}"
    typography: "{typography.emphasis}"
    rounded: "{rounded.lg}"
    padding: 6px 14px

  filter-pill-active:
    backgroundColor: "{colors.bg-surface-active}"
    textColor: "{colors.text-high}"
    typography: "{typography.caption}"
    rounded: "{rounded.pill}"
    padding: 5px 14px

  # ... (14 more components)
---

## Overview
[200 mots — brand & feel]

## Colors
[Prose catalogue exhaustif token-par-token]

[etc.]
```

### Annexe B — Liste préliminaire des composants à inclure dans le manifest

(À valider par scan `apps/web/components/` en P5)

**Atoms** : Button, Tag, Pill, Avatar, Icon, Input, Spinner
**Molecules** : FilterChip, L2Tab, FilterPill, CompoundHeaderBlock, ContextualActionBar, Card, ListRow
**Organisms** : TopBar, BottomNav, Sidebar, RaceFeed, RosterList, TacticCard, XPCard, AchievementCard
**Templates** : LeagueLayout, AuthLayout

### Annexe C — Liens externes

- Google design.md spec : https://github.com/google-labs-code/design.md
- VoltAgent awesome-design-md (exemples) : https://github.com/VoltAgent/awesome-design-md
- DESIGN.md Linear (référence) : https://github.com/VoltAgent/awesome-design-md/blob/main/design-md/linear.app/DESIGN.md
- DESIGN.md Supabase (référence) : https://github.com/VoltAgent/awesome-design-md/blob/main/design-md/supabase/DESIGN.md
- CLI : `npx @google/design.md lint DESIGN.md`

---

## 12. Statut & next steps

**Statut :** Draft — à challenger par revue indépendante avec deep search results.

**Next steps :**
1. Soumettre cette spec à une revue externe (autre agent / autre conversation avec contexte neuf + résultats deep search)
2. Itérer sur les questions ouvertes et décisions marquées "À CHALLENGER"
3. Une fois validée : créer la branche `feature/design-system-md-migration`, écrire le plan d'implémentation (`docs/superpowers/plans/`), exécuter
4. Mesurer la baseline (P1) avant tout changement de code
5. Itérer phase par phase avec verification gate à chaque livraison

---

*Spec rédigée par Jonathan Schummers + Claude Opus 4.7 — 2026-05-25*
*Branch d'origine : `feature/navigation-redesign` (spec elle-même committée ici)*
