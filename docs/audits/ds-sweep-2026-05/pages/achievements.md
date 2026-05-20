# Audit · /league/[id]/achievements
Generated: 2026-05-21
Files: achievements/page.tsx + achievements/achievements-client.tsx + components/achievement-card.tsx (usage quasi-exclusif ici)
States: filter=Monuments (active), filter=Grand Tour (active), filter=Budget/Roster (disabled chips), loading overlay (isPending), unlocked, locked, equipped

---

## Component tree rendu

```
page.tsx (RSC — auth guard + data fetching + achievement unlock logic)
└── AchievementsClient (achievements-client.tsx, "use client")
    ├── <h1> "Palmares"
    ├── <FilterChips> options=[Monuments, Grand Tour, Budget(disabled), Roster(disabled)] (shared — voir shared-components/filter-chips.md)
    ├── [activeFilter === 0] Monuments content
    │   └── renderGroup() × N
    │       ├── UPPERCASE group label (p inline)
    │       └── <AchievementCard> × N (components/achievement-card.tsx)
    │           ├── banner preview div (inline style)
    │           ├── <AchievementBadge> (components/achievement-badge.tsx)
    │           ├── name + condition text (inline style)
    │           └── <RightAction> (local function)
    │               ├── equipped: span "✓"
    │               ├── unlocked: button "Equip"
    │               ├── dynamic+locked: span "#N in league"
    │               └── locked: span tier label
    ├── [activeFilter === 1] Grand Tour content
    │   └── renderGroup("Giro d'Italia", "giro-") → AchievementCard × N
    └── [isPending] modal overlay
        └── div fixed inset-0 bg-black/30 (!) + spinner div
```

**Composants partagés référencés (NE PAS ré-auditer) :**
- `FilterChips` → voir `shared-components/filter-chips.md`
- `AchievementBadge` → composant partagé (pas encore d'audit dédié — voir ranking.md note Phase 3)

---

## États audités

- [x] filter=Monuments, achievements unlocked (unlocked=true sur AchievementCard)
- [x] filter=Monuments, achievements locked (unlocked=false)
- [x] filter=Monuments, equipped=true (AchievementCard avec border accent)
- [x] filter=Grand Tour, Giro achievements
- [x] filter=Budget (disabled chip — setActiveFilter bloqué)
- [x] filter=Roster (disabled chip — setActiveFilter bloqué)
- [x] isPending=true (overlay modal visible)
- [x] dynamicRank défini (RightAction affiche "#N in league")
- [x] pas de team membership (myTeamId=null, early return AchievementsClient avec unlockedSlugs=[])

---

## Violations sur le code spécifique de la page

### A · Typographie (1 violation + 1 avertissement dans AchievementCard)

| ID | File:Line | Current | Proposed | Confidence | Rationale |
|---|---|---|---|---|---|
| A-001 | achievements-client.tsx:77 | `text-[length:var(--type-title)]` | `text-[length:var(--type-page-title)]` | AUTO | `--type-title` n'est PAS défini dans globals.css. Les tokens définis sont : `--type-display`, `--type-stat`, `--type-page-title`, `--type-section`, `--type-stat-small`, `--type-emphasis`, `--type-body`, `--type-caption`, `--type-label`, `--type-nav`, `--type-micro`. Le token `--type-title` est fantôme — en CSS, `var(--type-title)` résout à `undefined`, ce qui fait que `font-size: undefined` sera ignoré par le browser (la taille sera héritée du parent ou applique le défaut 16px). L'intent est clairement un titre de page. Le token correct est `--type-page-title` (18px mobile / 20px md:), identique à ce que ranking-client.tsx:123 utilise pour son propre `<h1>`. Fix : `text-[length:var(--type-page-title)]`. Note : le token `--type-title` est utilisé à 3 endroits dans la codebase (error.tsx × 2, achievements-client.tsx × 1) — tous trois sont des faux tokens. |

> **Note A-001** : grep global montre que `--type-title` est utilisé dans `apps/web/app/error.tsx:20` et `apps/web/app/(game)/league/[leagueId]/error.tsx:22` également. Ces fichiers sont hors périmètre de cet audit mais la même correction (`→ --type-page-title`) devrait leur être appliquée lors du sweep Phase 3.

**AchievementCard (achievement-card.tsx) — avertissement typo** :

Le composant `AchievementCard` utilise `style={{ fontSize: "var(--type-emphasis)" }}` (ligne 66) et `style={{ fontSize: "var(--type-caption)" }}` (ligne 75) via inline style. Ces tokens sont valides en tant que CSS custom properties mais ne suivent pas la convention Tailwind DS (`text-[length:var(--type-*)]`). Cependant, étant donné que `AchievementCard` utilise massivement les inline styles (c'est une pattern homogène dans tout le composant), ce n'est pas une violation isolée — c'est un pattern stylistique unifié. Non compté comme violation A dans ce rapport. Voir section AchievementCard ci-dessous.

---

### B · Couleurs (3 violations dans AchievementCard)

Les violations B sont dans `components/achievement-card.tsx`, qui est consommé quasi-exclusivement depuis cette page. Elles sont auditées ici.

| ID | File:Line | Current | Proposed | Confidence | Rationale |
|---|---|---|---|---|---|
| B-001 | achievement-card.tsx:31 | `"1px solid rgba(255,255,255,0.08)"` | `"1px solid var(--border-subtle)"` | MANUAL | Border de la card non-équipée. `rgba(255,255,255,0.08)` est un hardcode. `--border-subtle = var(--color-b1-3)` est le token sémantique pour les borders discrètes. Note MANUAL : la valeur exacte de `--color-b1-3` est à vérifier dans globals.css (teinte bleue vs white-8%). Si l'effet visuel doit rester un blanc très transparent, utiliser `border-white/[0.08]` (Tailwind opacity modifier) comme alternative plus propre que le rgba littéral. La recommandation première reste le token sémantique `--border-subtle`. |
| B-002 | achievement-card.tsx:51 | `"linear-gradient(to right, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.35) 60%, rgba(0,0,0,0.08) 100%)"` | voir rationale | MANUAL | Gradient overlay sur le banner preview. Ce gradient de lisibilité est intentionnel et sémantiquement distinct du token `--scrim` (rgba(0,0,0,0.50) uniforme). Il n'existe pas de token DS pour un gradient de banner. Confidence MANUAL : soit accepter ce gradient inline comme exception documentée (contexte banner-overlay specific), soit créer un token CSS `--gradient-banner-overlay`. Recommandation : BLOCKED/MISSING_TOKEN avec annotation commentaire `/* DS: banner legibility gradient, no token */`. |
| B-003 | achievement-card.tsx:128 | `"rgba(6,182,212,0.12)"` | `"var(--badge-bg)"` | AUTO | Background du span "✓" équipé dans RightAction. `rgba(6,182,212,0.12)` = cyan-500 à 12% opacité. Le token `--badge-bg = rgba(14, 165, 233, 0.10)` dans globals.css est à 10% opacité de sky-500. MANUAL pour la valeur exacte : `rgba(6,182,212,0.12)` (cyan-500 12%) ≠ `--badge-bg` (sky-500 10%). L'intent est "accent background at low opacity" — le token le plus proche est `--badge-bg`. Alternative : si cyan exact requis, utiliser `rgba(var(--color-cyan-500-rgb), 0.12)` si ce token existe, sinon créer `--accent-bg: rgba(6,182,212,0.12)` dans globals.css. Recommandation première : `var(--badge-bg)` ou BLOCKED si la différence cyan vs sky est intentionnelle. |

> **Violations B-001, B-003** : dans `achievement-card.tsx`, les valeurs `rgba(255,255,255,0.08)` apparaissent à 3 endroits (lignes 31, 178, 202) — toutes concernent les borders de l'état "locked". Fix uniforme avec remplacement global.

**achievements-client.tsx ligne 113 :**

| ID | File:Line | Current | Proposed | Confidence | Rationale |
|---|---|---|---|---|---|
| B-004 | achievements-client.tsx:113 | `bg-black/30` | `bg-[var(--scrim)]` | AUTO | Overlay du modal isPending. `bg-black/30` = rgba(0,0,0,0.30). Token DS `--scrim = rgba(0,0,0,0.50)` — valeur différente (30% vs 50%). Confidence AUTO pour l'existence d'un token scrim, MANUAL pour la valeur : si l'intent est un scrim de 30% (overlay light), soit ajuster le token `--scrim` à 0.30, soit créer `--scrim-light: rgba(0,0,0,0.30)`. Si l'intent est le scrim standard, corriger à `bg-[var(--scrim)]` (50%). Le commentaire dans globals.css ligne 137 dit explicitement : "use instead of bg-black/X". Ce flag Jules est confirmé — c'est une violation réelle. |

---

### C · Spacing & Radius (3 avertissements dans AchievementCard)

AchievementCard utilise des inline styles pour tous ses spacings (padding: "10px 12px", height: 56, marginTop: 2, etc.). Ces valeurs sont intentionnellement cohérentes dans le composant. Aucune ne correspond à un `--space-*` token DS existant.

| ID | File:Line | Current | Proposed | Confidence | Rationale |
|---|---|---|---|---|---|
| C-001 | achievement-card.tsx:37 | `height: 56` (inline style) | voir rationale | BLOCKED · missing token | Banner preview height 56px. Aucun token DS pour cette hauteur. Valeur intentionnelle (contrainte design carte achievement). BLOCKED — proposer à Jonathan de documenter comme exception ou créer `--achievement-banner-height: 56px`. |
| C-002 | achievement-card.tsx:27 | `borderRadius: 20` | `borderRadius: "var(--radius-pill)"` | AUTO | Card container radius 20px. `--radius-pill = 20px` — correspondance exacte. Correction : `borderRadius: "var(--radius-pill)"`. Conforme à la règle "radius-as-affordance = 20px décoratif". |
| C-003 | achievement-card.tsx:178, 202 | `borderRadius: 20` | `"var(--radius-pill)"` | AUTO | Locked chips (dynamic rank + tier label) dans RightAction. Même correction que C-002. |

---

### D · Patterns composants (1 observation)

| ID | File:Line | Current pattern | Proposed | Confidence | Rationale |
|---|---|---|---|---|---|
| D-001 | achievement-card.tsx:112–134 | span/button via inline style | voir rationale | MANUAL | `RightAction` rend 4 variantes (equipped, unlocked Equip button, dynamic rank chip, locked tier chip) via inline styles. Les "Equip" button (ligne 140–159) et le "✓" span (112–134) sont des éléments interactifs avec `borderRadius: 6` (`--radius-md`). Le locked chip (borderRadius: 20 = `--radius-pill`) est décoratif. L'usage du radius 6px pour les éléments interactifs est conforme DS (radius-as-affordance : 6px = interactif). Pattern cohérent, pas de migration vers composants partagés requise. MANUAL : vérifier si `borderRadius: 6` peut être remplacé par `"var(--radius-md)"`. |

**Conclusion D (achievements-client.tsx uniquement) : 0 violation.** Le `<FilterChips>` est utilisé correctement, le `renderGroup()` inline est propre.

---

### E · Geist Mono numbers (1 observation)

| ID | File:Line | Issue | Verdict |
|---|---|---|---|
| E-001 | achievement-card.tsx:181 | `#{dynamicRank} in league` rendu dans span sans `font-mono` | MANUAL — voir rationale |

Rationale E-001 : `dynamicRank` est un nombre. Dans le DS, tous les nombres doivent être en Geist Mono. Le span RightAction "dynamic rank" (ligne 168–185) n'a pas `fontFamily: "var(--font-mono)"` ou équivalent dans son style inline. Le composant entier utilise des inline styles sans `fontFamily` explicite — les nombres héritent de la font Geist Sans du parent. Correction : ajouter `fontFamily: "var(--font-geist-mono, monospace)"` ou passer par une className Tailwind `font-mono` sur ce span.

> **Recommandation E-001** : MANUAL car le span utilise exclusivement des inline styles. Options : A — ajouter `fontFamily: "var(--font-geist-mono, monospace)"` dans le style inline (cohérent avec le pattern du composant). B — refactoriser le span vers Tailwind className avec `font-mono` (introduit une incohérence de style dans un composant full-inline-styles). Option A recommandée.

---

## Notes sur page.tsx (0 violations)

Le RSC `achievements/page.tsx` est un data-fetching layer pur. 0 violation CSS/DS détectée.

---

## AchievementCard — récapitulatif violations

`components/achievement-card.tsx` est consommé depuis achievements-client.tsx et potentiellement depuis d'autres pages (ranking rows — non, ranking utilise `AchievementBadge`, pas `AchievementCard`). Il est quasi-exclusif à cette page. Ses violations sont auditées ici.

Pattern général du composant : inline styles JS pour tout le styling (pas de Tailwind). C'est un pattern homogène et intentionnel. Les violations à corriger sont les hardcodes de couleurs et radii qui ont des tokens DS équivalents.

---

## Cross-cutting issues

1. **Token fantôme `--type-title` (A-001)** — affecte aussi `error.tsx` × 2 hors périmètre. Lors du Phase 3, corriger les 3 occurrences en une seule passe : `achievements-client.tsx:77`, `app/error.tsx:20`, `league/[leagueId]/error.tsx:22`.

2. **`rgba(255,255,255,0.08)` pattern (B-001)** — répété 3× dans `achievement-card.tsx` (lignes 31, 178, 202). Si corrigé, remplacer les 3 occurrences en une passe.

3. **`borderRadius: 20` (C-002/C-003)** — répété 3× dans `achievement-card.tsx` (lignes 27, 178, 202). Remplacer par `"var(--radius-pill)"`.

4. **Inline styles vs Tailwind classes** — `achievement-card.tsx` est stylistiquement divergent du reste de la codebase (full inline styles). À moyen terme, une refactorisation vers Tailwind classes améliorerait la maintenabilité. Hors scope Phase 3.

---

## Résumé violations

| Classe | Count réel | False positives | Notes |
|---|---|---|---|
| A | 1 | 0 | `--type-title` fantôme dans achievements-client:77 |
| B | 4 | 0 | B-001 (rgba border ×3 occurrences, comptée 1) + B-002 (gradient overlay) + B-003 (rgba cyan bg) + B-004 (bg-black/30 scrim) |
| C | 3 | 0 | C-001 BLOCKED (height 56px) · C-002/C-003 AUTO (borderRadius 20 → radius-pill token) |
| D | 0 | 0 | FilterChips usage conforme, AchievementCard pattern inline cohérent |
| E | 1 | 0 | E-001 MANUAL — dynamicRank sans font-mono |
| **Total** | **9** | **0** | **9 violations nettes** |

---

## Blocked (à trancher avant Phase 3)

| ID | Issue | Options |
|---|---|---|
| B-002 | Gradient banner overlay `rgba(0,0,0,0.8/0.35/0.08)` — aucun token DS pour ce gradient de lisibilité | A: créer `--gradient-banner-overlay: linear-gradient(...)` dans globals.css · B: accepter comme exception documentée avec commentaire |
| B-003 | `rgba(6,182,212,0.12)` — cyan-500 12% ≠ `--badge-bg` (sky-500 10%) | A: utiliser `var(--badge-bg)` (diff mineure) · B: créer `--accent-bg: rgba(6,182,212,0.12)` · C: BLOCKED si diff intentionnelle |
| B-004 | `bg-black/30` (30%) vs `--scrim` (50%) — valeur différente | A: remplacer par `bg-[var(--scrim)]` (accept 50%) · B: créer `--scrim-light: rgba(0,0,0,0.30)` · C: modifier `--scrim` à 0.30 (breaking autres usages) |
| C-001 | `height: 56` banner preview — missing token | A: créer `--achievement-banner-height: 56px` · B: exception documentée |

---

## Notes Phase 3

- **Flag Jules confirmé** (B-004, achievements-client.tsx:113) : `bg-black/30` → violation réelle, correction `bg-[var(--scrim)]` ou `--scrim-light`. Priorité HIGH — explicitement mentionné dans le briefing de cet audit.
- **`--type-title` fantôme** (A-001) : token le plus critique car il rend le titre "Palmares" sans taille définie (browser défaut). Priorité HIGH.
- **3 borderRadius: 20 → var(--radius-pill)** (C-002/C-003) : fix trivial, priorité MEDIUM.
- **AchievementBadge** : non audité en shared-component. Les hex hardcodés `#fbbf24`, `#f59e0b`, `#22d3ee` dans RING_STYLES correspondent à Tailwind amber-400, amber-500, cyan-400. Token `--color-cyan-400 = #22d3ee` existe dans globals.css mais n'est pas utilisé. À traiter lors d'un audit `shared-components/achievement-badge.md`.
- **`borderRadius: 6` dans RightAction** (D-001) : remplacer par `"var(--radius-md)"` lors du Phase 3 (trivial, conforme radius-as-affordance).

---

## Checklist verification (à cocher par le repair agent — Phase 3)

- [ ] Screenshot before captured (états : filter=monuments, filter=gt, équipé, locked, isPending overlay)
- [ ] Screenshot after captured
- [ ] Diff visuel attendu :
  - A-001 : titre "Palmares" — taille potentiellement modifiée (de browser-default vers 18/20px). Capture obligatoire.
  - B-004 : overlay isPending — de rgba(0,0,0,0.30) vers rgba(0,0,0,0.50) si `--scrim` retenu. Plus opaque.
  - C-002/C-003 : borderRadius 20 → var(--radius-pill) — aucun diff visuel (valeur identique).
- [ ] typecheck PASS
- [ ] lint PASS
- [ ] vitest PASS

---

## Repair log (à compléter par le repair agent — Phase 3)

_Section vide — à remplir par le Réparateur._
