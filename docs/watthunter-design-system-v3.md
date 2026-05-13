# WattHunter — Design System v3.0

> **Philosophy:** Restrained Cyan on Sky Blue Night Dark.
> Le fond a du caractère mais reste silencieux. Le blanc structure. Le cyan guide l'œil.
> **v3.0:** Component system formalized — 3 distinct interaction patterns (Underline Tabs, Filter Chips, Tags) with clear radius-as-affordance signal.

---

## Architecture 4 couches

| Couche | Source | Rôle | Surface |
|--------|--------|------|---------|
| **1. Neutral** | Sky Blue Night dark (200°) | Backgrounds, surfaces, texte, dividers | ~80% |
| **2. Accent** | Tailwind Cyan + Sky-500 | Interactions, gradients décoratifs, badges | ~15% |
| **3. CTA Gradient** | Cyan-500 → Cyan-400 | Boutons d'action primaires | ~5% |
| **4. Mesh Gradient** | 5 couleurs brand (animé) | Hero sections, marketing, onboarding | Web only |

---

## Layer 1 — Neutral Sky Blue Night (200°)

**Remplace le Blue Night 220° (v2.0).** Hue ~200° (sky blue), saturation ~18%. Inspiré des defaults de makegradient.com — un compromis entre le teal (195°, trop proche du cyan) et le bleu pur (220°, trop froid). Le résultat : des backgrounds qui appartiennent à la même famille que le gradient animé.

### Pourquoi Sky Blue Night ?

Après itération (Slate → Teal 195° → Blue 220°), le hue 200° est le sweet spot :

- **12° d'écart** avec le Cyan accent (188°) — assez pour ne pas être un camaïeu, assez proche pour une cohérence naturelle
- Même famille de hue que les **darks du gradient animé** (site makegradient = ~200-220°) → unité visuelle entre l'app et le branding
- Feeling **sky blue night** — plus chaleureux que le bleu pur 220°, plus caractériel que le teal 195°

### Backgrounds

| Token | Hex | Ancien (Blue 220°) | Contrast vs précédent | Usage |
|-------|-----|---------------------|----------------------|-------|
| `--bg-app` | `#0c1012` | `#0c0e13` | Hue shift 220° → 200° | Background principal de l'app |
| `--bg-subtle` | `#111618` | `#10131a` | +sky blue tint | Background alterné, sections secondaires |
| `--bg-surface` | `#151b1e` | `#141820` | Plus sky blue | Cards, inputs, wells |
| `--bg-surface-hover` | `#1a2226` | `#191e28` | — | Hover state des surfaces |
| `--bg-surface-active` | `#1f292e` | `#1e2430` | — | Pressed/selected state |

### Borders & Dividers

| Token | Hex | Ancien (Blue 220°) | Usage |
|-------|-----|---------------------|-------|
| `--border-subtle` | `#151b1e` | `#141820` | Dividers entre sections |
| `--border-default` | `#273339` | `#252d3c` | Borders de composants |
| `--border-hover` | `#334249` | `#313a4c` | Borders au hover |

### Texte

| Token | Hex | Ancien (Blue 220°) | Contrast vs bg-app | Usage |
|-------|-----|---------------------|---------------------|-------|
| `--text-high` | `#eaeff1` | `#ecedf0` | 16.49:1 ✅ AAA | Titres, noms, chiffres |
| `--text-mid` | `#89a1ad` | `#8e96a8` | 7.07:1 ✅ AAA | Descriptions, texte secondaire |
| `--text-low` | `#74919f` | `#7482a0` | 5.73:1 ✅ AA | Labels, captions, metadata |
| `--text-ghost` | `#334249` | `#313a4c` | 1.84:1 | Placeholders, disabled (décoratif uniquement) |

> **`--text-low` :** 5.73:1 AA sur `--bg-app` (meilleur que v2.0). Passe AA sur toutes les surfaces jusqu'à `--bg-surface-hover` (4.84:1). AA-large sur `--bg-surface-active` (4.45:1).
>
> **`--text-mid` :** 7.07:1 AAA sur `--bg-app` — amélioration significative vs v2.0 (6.51:1).
>
> **`--text-ghost` :** réservé aux éléments **purement décoratifs** (placeholders, texte disabled).
> Ne porte jamais d'information critique — toujours doublé d'un autre indicateur visuel.

### Échelle complète (12 steps, Radix-like)

| Step | Hex | Sat | Usage type |
|------|-----|-----|------------|
| 1 | `#0c1012` | ~18% | bg-app |
| 2 | `#111618` | ~18% | bg-subtle |
| 3 | `#151b1e` | ~18% | bg-surface |
| 4 | `#1a2226` | ~18% | surface-hover |
| 5 | `#1f292e` | ~18% | surface-active |
| 6 | `#273339` | ~18% | border-default |
| 7 | `#334249` | ~18% | border-hover / text-ghost |
| 8 | `#40535d` | ~18% | — réservé — |
| 9 | `#597380` | ~18% | — réservé — |
| 10 | `#74919f` | ~18% | text-low |
| 11 | `#89a1ad` | ~18% | text-mid |
| 12 | `#eaeff1` | ~18% | text-high |

---

## Layer 2 — Accent (Tailwind Cyan + Sky-500)

Le Sky Blue Night (200°) et le Cyan (188°) sont proches en hue (12° d'écart) mais distincts — le fond est plus froid, l'accent plus chaud. Résultat : cohérence naturelle sans camaïeu.

**v2.2 : ajout de Sky-500** comme couleur texte non-interactive pour les labels d'emphasis. Comble le gap entre Cyan-500 (interactif) et text-low (neutre).

### Scale Cyan

| Token | Hex | Usage |
|-------|-----|-------|
| `--cyan-950` | `#083344` | Background teinté très subtil (rare) |
| `--cyan-900` | `#164e63` | — réservé — |
| `--cyan-800` | `#155e75` | Progress bar start |
| `--cyan-700` | `#0e7490` | Active state accent |
| `--cyan-600` | `#0891b2` | Hover state accent |
| `--cyan-500` | `#06b6d4` | **PRIMARY** — interactions, toggles, links |
| `--cyan-400` | `#22d3ee` | **HERO STAT** — le seul chiffre coloré par écran |
| `--cyan-300` | `#67e8f9` | Glow effects, focus rings |

### Sky-500 — Couleur brand restreinte

| Token | Hex | Hue | Contrast vs bg-app | Contrast vs bg-surface |
|-------|-----|-----|---------------------|------------------------|
| `--sky-500` | `#0ea5e9` | 199° | 6.90:1 AA | 6.28:1 AA |

> **Sky-500 partage le hue ~200° des backgrounds neutres** — c'est le pont entre la palette neutral (200°, ~18% sat) et le cyan accent (188°). Cette parenté de hue crée une cohérence organique dans toute l'app.

#### Usages autorisés de Sky-500 (v2.4 — règle stricte)

Sky-500 est utilisé dans **3 contextes uniquement** :

| Usage | Exemples | Token |
|-------|----------|-------|
| **Gradients décoratifs** | Branded card mesh, border beam animation, progress bar fill | `--accent-label` |
| **Badge background** | `rgba(14, 165, 233, 0.10)` — fond des badges boost/strategy | `--badge-bg` |
| **Badge text** | Texte dans les badges boost "+12%", labels de type strategy | `--accent-label` |

> **Ce qui n'est PAS sky-500 :** les hero stats (= `--cyan-400`), les labels de section (= `--text-low`), les noms/data (= `--text-high`). Seuls les gradients et badges utilisent sky.

#### Hiérarchie complète des couleurs accent

| Couleur | Token fonctionnel | Ratio vs bg-app | Rôle | Interactif ? |
|---------|-------------------|-----------------|------|-------------|
| `--cyan-400` | `--accent-highlight` | 10.58:1 AAA | Hero stat — ex: Total XP, balance. Utiliser si pertinent. | Non |
| `--cyan-500` | `--accent-default` | 7.87:1 AAA | Links, toggles, interactions, tab underline | **Oui** |
| `--sky-500` | `--accent-label` | 6.90:1 AA | Badge text, gradient fills, decorative only | Non |
| `--text-high` | — | 16.49:1 AAA | Data values, names, ranking | Non |
| `--text-low` | — | 5.73:1 AA | Labels, captions, metadata | Non |

### Tokens fonctionnels

| Token | Valeur | Usage |
|-------|--------|-------|
| `--accent-default` | `--cyan-500` | État par défaut (interactif) |
| `--accent-hover` | `--cyan-600` | Hover |
| `--accent-active` | `--cyan-700` | Pressed |
| `--accent-highlight` | `--cyan-400` | Hero stat — utiliser quand pertinent pour mettre en valeur un chiffre clé |
| `--accent-subtle-bg` | `--cyan-950` @ 50% | Background teinté exceptionnel |
| `--accent-label` | `--sky-500` | Badge text, gradient fills, progress bar fill |
| `--badge-bg` | `rgba(14,165,233,0.10)` | Badge/tag background (sky @ 10%) |
| `--accent-focus-ring` | `--cyan-300` @ 40% | Focus visible accessibility |

---

## Layer 3 — CTA Gradient fixe

**Inchangé.**

```css
--cta-gradient: linear-gradient(135deg, #06b6d4, #22d3ee);
--cta-gradient-hover: linear-gradient(135deg, #0891b2, #06b6d4);
--cta-gradient-active: linear-gradient(135deg, #155e75, #0891b2);
--cta-text: #020617;
--cta-shadow: 0 4px 24px rgba(6, 182, 212, 0.25);
```

Règle : 1 CTA gradient max par écran.

---

## Layer 4 — Mesh Gradient animé (Web only)

Gradient WebGL animé avec noise pour les contextes marketing et atmosphériques. 100% couleurs brand.

**v2.1 : les dark slots utilisent les couleurs Sky Blue Night (200°)** et le slot 5 passe de Blue-500 à **Sky-500** (#0ea5e9), inspiré des defaults de makegradient.com. Le gradient combine : sky blue profond + cyan + sky blue vif.

### Les 5 couleurs

| Slot | Hex | Source | Rôle |
|------|-----|--------|------|
| uColor1 | `#040607` | Deep sky (sous bg-app) | Centre — ancre sombre profonde |
| uColor2 | `#0c1012` | `--bg-app` | Mid-dark — continuité avec l'app |
| uColor3 | `#1f292e` | `--bg-surface-active` | Mid-tone — relief sky blue subtil |
| uColor4 | `#06b6d4` | TW Cyan-500 | Accent lumineux — brand primary |
| uColor5 | `#0ea5e9` | TW Sky-500 | Accent sky blue — pont entre fond et cyan |

> **Pourquoi Sky-500 ?** Inspiré de makegradient.com (stops 04+05 = #0ea5e9 + #22d3ee). Sky-500 (199°) est un pont naturel entre les backgrounds (200°) et le cyan (188°). Ça crée un gradient qui va du sombre au lumineux dans une **même famille de hue** — plus organique que le tricolore blue+cyan de la v2.0.

### Implémentation animée (makegradient.com)

```html
<script src="https://makegradient.com/embed.js"></script>
<div
  data-lumina-gradient
  data-colors='["#040607","#0c1012","#1f292e","#06b6d4","#0ea5e9"]'
  data-mode="mesh"
  data-noise="0.05"
  data-speed="1"
  style="width: 100%; height: 100%; position: absolute; inset: 0;"
></div>
```

### CSS fallback statique (sans JS)

```css
.mesh-gradient-fallback {
  background-color: #040607;
  background-image:
    radial-gradient(circle at 20% 20%, #0c1012 0%, transparent 55%),
    radial-gradient(circle at 70% 25%, #1f292e 0%, transparent 50%),
    radial-gradient(circle at 30% 75%, rgba(6, 182, 212, 0.25) 0%, transparent 50%),
    radial-gradient(circle at 80% 70%, rgba(14, 165, 233, 0.20) 0%, transparent 45%);
}
```

### WebGL uniforms (OGL)

```js
uColor1: new Vec3(0.016, 0.024, 0.027)  // #040607
uColor2: new Vec3(0.047, 0.063, 0.071)  // #0c1012
uColor3: new Vec3(0.122, 0.161, 0.180)  // #1f292e
uColor4: new Vec3(0.024, 0.714, 0.831)  // #06b6d4
uColor5: new Vec3(0.055, 0.647, 0.914)  // #0ea5e9
uNoiseStrength: 0.05
uMode: 0  // 0=Mesh
```

### Où l'utiliser

| Contexte | OK ? | Notes |
|----------|------|-------|
| Hero section site web | ✅ | Animé plein écran, texte en overlay avec shadow |
| Écran d'onboarding | ✅ | Animé, texte centré sur zones sombres |
| Open Graph / Social cards | ✅ | Statique (fallback CSS) |
| Splash screen app | ✅ | Animé 2-3 secondes, logo uniquement |
| Bannières marketing | ✅ | Statique ou animé |
| Background app | ❌ | Trop chargé pour de la data |
| Derrière du texte dense | ❌ | Lisibilité dégradée |
| Cards / Panels UI | ❌ | Le gradient est atmosphérique, pas structurel |

> **Le mesh gradient est réservé aux contextes où l'atmosphère prime sur la lisibilité.** Dès qu'il y a de la data → fond flat `--bg-app`. Les deux mondes ne se mélangent pas.

---

## Couleurs sémantiques

| Sémantique | Hex | Usage |
|------------|-----|-------|
| Success | `#10b981` (Emerald-500) | Gain de points, hausse classement |
| Danger | `#ef4444` (Red-500) | Perte, budget dépassé, deadline |
| Warning | `#f59e0b` (Amber-500) | Blessure coureur, risque |
| Info | `#06b6d4` (Cyan-500) | = accent (pas de doublon) |

> Couleurs sémantiques sur **texte + icône uniquement**. Pas de background coloré.

---

## Typographie

### Fonts

| Famille | Usage | Fallback |
|---------|-------|----------|
| **Geist Sans** | Tout le texte UI | `system-ui, -apple-system, sans-serif` |
| **Geist Mono** | Tous les chiffres (stats, scores, budgets, classements) | `'SF Mono', 'Cascadia Code', monospace` |

> **Règle : tous les chiffres en Geist Mono** avec `font-variant-numeric: tabular-nums`. Ça garantit l'alignement vertical des colonnes et renforce le côté "data dashboard" de l'app.

### Type Scale — 11 niveaux (even px only)

| Niveau | Mobile | Desktop (md:) | Weight | Font | Cas d'usage |
|--------|--------|---------------|--------|------|-------------|
| **display** | 32px | 34px | 900 | Mono | Hero stat unique (Total XP) |
| **stat** | 20px | 22px | 800 | Mono | Stats, ranking, metric values |
| **page-title** | 18px | 20px | 700 | Sans | Page titles, tabs, rider name (detail) |
| **section** | 16px | 18px | 600 | Sans | Section titles (Roster, Pending Bids) |
| **stat-small** | 16px | 18px | 700 | Mono | Stats inline, XP in cards |
| **emphasis** | 14px | 16px | 600 | Sans | Rider names (cards), back header, links |
| **body** | 14px | 16px | 400 | Sans | Body text, descriptions |
| **caption** | 12px | 14px | 500 | Sans | Hints, secondary text, info badges |
| **label** | 12px | 14px | 700 | Sans | Labels UPPERCASE + tracking |
| **nav** | 10px | 12px | 500 | Sans | Bottom navigation |
| **micro** | 10px | 12px | 600 | Sans | PCS rank, badges, euro suffix |

> Scale uses only even pixel values: 10/12/14/16/18/20/32. All sizes +2px at `md:` breakpoint.

### Rem et base font-size

> **Convention : `html { font-size: 16px }` → 1rem = 16px.**
> Body text = 14px = 0.875rem. C'est un choix délibéré : sur mobile, 14px est le sweet spot (16px est trop grand pour une app data-dense).
> Quand on dit "body = 1rem" c'est une convention Tailwind/web (prose), pas une obligation. Pour une app, 0.875rem body est standard.

### Tokens sémantiques typographiques

| Token | Mobile | Desktop (md:) | Weight | Font | Contexte |
|-------|--------|---------------|--------|------|----------|
| `--type-display` | 32px | 34px | 900 | Geist Mono | Hero stat unique (Total XP) |
| `--type-stat` | 20px | 22px | 800 | Geist Mono | Stats, ranking, metric values |
| `--type-page-title` | 18px | 20px | 700 | Geist Sans | Page titles, tabs, rider name (detail) |
| `--type-section` | 16px | 18px | 600 | Geist Sans | Section titles (Roster, Pending Bids) |
| `--type-stat-small` | 16px | 18px | 700 | Geist Mono | Stats inline, XP in cards |
| `--type-emphasis` | 14px | 16px | 600 | Geist Sans | Rider names (cards), back header, links |
| `--type-body` | 14px | 16px | 400 | Geist Sans | Body text, descriptions |
| `--type-caption` | 12px | 14px | 500 | Geist Sans | Hints, secondary text, info badges |
| `--type-label` | 12px | 14px | 700 | Geist Sans | Labels UPPERCASE + tracking |
| `--type-nav` | 10px | 12px | 500 | Geist Sans | Bottom navigation |
| `--type-micro` | 10px | 12px | 600 | Geist Sans | PCS rank, badges, euro suffix |

> **Responsive:** all sizes +2px at `md:` (768px+) via CSS custom properties in `@media (min-width: 768px)`.
> **Removed tokens:** `--type-heading` (was 15px), `--type-heading-sm` (was 13px) — replaced by `--type-page-title`, `--type-section`, `--type-emphasis`.

### Règles typographiques

1. **UPPERCASE réservé aux labels structurels** : "TOTAL XP", "SEASON", "ROSTER", "PENDING BIDS". Jamais pour la bottom nav, jamais pour les boutons d'action.
2. **Geist Mono pour TOUT ce qui est numérique** : scores, positions, budgets, pourcentages, dates numériques, timer. Toujours avec `tabular-nums`.
3. **Hiérarchie par size + weight, pas par couleur** : en dark mode, on ne peut pas se reposer sur des variations de gris subtiles. La taille et le poids font le travail.
4. **Display (32px/900) et `--accent-highlight` (cyan-400)** : réservés aux chiffres clés qu'on veut mettre en valeur. Pas de limite stricte par écran — utiliser si c'est pertinent et que ça renforce la hiérarchie.

---

## Application par composant

### Header / App Bar

| Élément | Token | Spec |
|---------|-------|------|
| Logo "WattHunter" | `--type-emphasis` | 14px/600, `--text-high` |
| Subtitle (ex: "Fantasy Cycling") | `--type-caption` | 12px/500, `--text-low` |
| Back button text | `--type-emphasis` | 14px/600, `--text-mid` |
| Back arrow icon | — | 18px, `--text-mid` |

### Hero Stats

| Élément | Token | Spec |
|---------|-------|------|
| Hero number | `--type-display` | 32px/900 Mono, `--cyan-400` |
| Hero label | `--type-label` | 12px/700 UC, `--text-low` |
| Secondary stat value | `--type-stat` | 20px/800 Mono, `--text-high` |
| Secondary stat label | `--type-label` | 12px/700 UC, `--text-low` |

### Navigation & Filtering

> See dedicated component docs: **Underline Tabs**, **Filter Chips**, **Tags** (below).
> These 3 components replace the old generic "Segmented Control / Tabs" pattern.

### Lists (Roster, Bids, Results)

| Élément | Token | Spec |
|---------|-------|------|
| Section header | `--type-label` | 12px/700 UC + tracking, `--text-low` |
| Rider name | `--type-emphasis` | 14px/600, `--text-high` |
| Rider team / subtitle | `--type-caption` | 12px/500, `--text-mid` |
| Stat value inline | `--type-stat-small` | 16px/700 Mono, `--text-high` |
| Hint / metadata | `--type-caption` | 12px/400, `--text-low` |

### Bottom Navigation

| Élément | Token | Spec |
|---------|-------|------|
| Nav label (inactive) | `--type-nav` | 10px/500, `--text-low` |
| Nav label (active) | `--type-nav` | 10px/600, `--text-high` ou `--cyan-500` |
| Nav icon | — | 20px |

> **Normal case.** Pas d'uppercase en bottom nav — c'est plus lisible et plus clean à cette taille.

### Buttons

| Élément | Token | Spec |
|---------|-------|------|
| CTA Primary text | `--type-body` | 14px/600, `--cta-text` (#020617) |
| CTA Secondary text | `--type-body` | 14px/600, `--cyan-500` |
| Small action button | `--type-caption` | 12px/600, `--cyan-500` |

---

## Layout Patterns

Deux patterns de contenu coexistent dans l'app. Ils se comportent différemment en responsive.

### Pattern A — List Row (dividers)

Contenu tabulaire séparé par des dividers horizontaux. Utilisé pour : Transactions, Roster, Bids, Results, Leaderboard — toute liste scrollable d'items.

**Comportement :** le contenu s'organise comme un tableau — infos à gauche (avatar + texte), valeurs à droite (montant, date, stat). Les dividers s'étendent sur toute la largeur du container.

```
Mobile (< 768px)               Desktop (md:)
┌────────────────────┐         ┌──────────────────────────┐
│ [AV] Name          +€48,000│         │    [AV] Name          +€48,000│
│      Subtitle       Apr 12│         │         Subtitle       Apr 12│
│────────────────────│         │──────────────────────────│
│ [AV] Name        +€550,000│         │    [AV] Name        +€550,000│
│      Subtitle       Mar 1│         │         Subtitle       Mar 1│
└────────────────────┘         └──────────────────────────┘
         100%                        max-width: 600px centré
```

#### Spec

| Propriété | Valeur |
|-----------|--------|
| Layout row | `display: flex; align-items: center; justify-content: space-between` |
| Padding row | `var(--space-4)` vertical, `var(--space-4)` horizontal |
| Max-width contenu | `600px` centré sur desktop (`margin-inline: auto`) |
| Divider | `1px solid var(--border-subtle)` full-width du container |
| Avatar/icon | Aligné à gauche, `--space-3` gap avec le texte |
| Valeurs (montants) | Aligné à droite, `--type-stat-small` ou `--type-emphasis`, `font-variant-numeric: tabular-nums` |
| Dates / metadata | Sous la valeur à droite, `--type-caption`, `--text-low` |

#### Tokens

| Catégorie | Token |
|-----------|-------|
| Divider | `--border-subtle` (#151b1e) |
| Background | `--bg-app` (transparent, pas de surface) |
| Padding | `--space-4` (16px) |
| Gap avatar-text | `--space-3` (12px) |

#### Do's and Don'ts

| Do | Don't |
|------|---------|
| Dividers full-width du container | Dividers qui s'arrêtent avant le bord |
| Valeurs alignées à droite avec `tabular-nums` | Montants en body text sans alignement mono |
| Max-width 600px sur desktop | Laisser le contenu s'étirer sur toute la largeur |
| Garder avatar + texte proches de la valeur | Laisser un gap > 400px entre left et right |

---

### Pattern B — Card Grid

Cards avec background, disposées verticalement en mobile et en grille horizontale sur desktop. Utilisé pour : Sponsors, Riders (market), Teams — tout contenu qui vit dans des cards individuelles.

**Comportement :** en mobile, les cards sont empilées verticalement en full-width. Sur desktop, elles passent en grille auto-fit avec une largeur minimum par card.

```
Mobile (< 768px)               Desktop (md:, 600px container)
┌────────────────────┐         ┌────────────┐ ┌────────────┐
│ ┌────────────────┐ │         │ ┌────────┐ │ │ ┌────────┐ │
│ │  Sponsor Card  │ │         │ │ Card 1 │ │ │ │ Card 2 │ │
│ │  SQS  €550k   │ │         │ │ SQS    │ │ │ │ GRP    │ │
│ │  [tags]        │ │         │ │ €550k  │ │ │ │ €350k  │ │
│ └────────────────┘ │         │ └────────┘ │ │ └────────┘ │
│ ┌────────────────┐ │         └────────────┘ └────────────┘
│ │  Sponsor Card  │ │              auto-fit, min 260px
│ │  GRP  €350k   │ │
│ └────────────────┘ │
└────────────────────┘
     1 colonne stack
```

#### Spec

| Propriété | Valeur |
|-----------|--------|
| Layout mobile | Stack vertical, `gap: var(--space-4)` |
| Layout desktop (md:) | `display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr))` |
| Gap grille | `var(--space-4)` (16px) |
| Max-width grille | `600px` centré (hérite du `.app-container`) |
| Card individuelle | Component Card (Standard) — voir spec ci-dessous |

#### Breakpoints comportement

| Largeur container | Colonnes | Résultat |
|-------------------|----------|----------|
| < 540px | 1 | Stack vertical (mobile) |
| 540px — 600px | 2 | 2 cards côte à côte (~270px chacune) |
| Detail panel (360px+) | 1 | Stack vertical dans le panel |

> **Dans le detail panel (lg:)** le container est trop étroit pour 2 colonnes → retour en stack vertical. Le grid auto-fit gère ça automatiquement grâce au `minmax(260px, 1fr)`.

#### Implémentation

```css
.card-grid {
  display: grid;
  grid-template-columns: 1fr; /* mobile: 1 col */
  gap: var(--space-4);
}

@media (min-width: 768px) {
  .card-grid {
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  }
}
```

#### Do's and Don'ts

| Do | Don't |
|------|---------|
| `auto-fit` avec `minmax` pour que le grid s'adapte | Forcer 2 colonnes en dur (`grid-template-columns: 1fr 1fr`) |
| Laisser les cards prendre toute la largeur en mobile | Ajouter des marges latérales sur les cards en mobile |
| Même hauteur de card dans une row (le grid le fait) | Cards de hauteurs différentes dans la même row |

---

## Component: Card (Standard)

### Description

Surface conteneur pour les listes, stats, et contenus groupés. C'est le composant le plus utilisé de l'app — tous les riders, bids, résultats, stats secondaires vivent dans des cards.

### Spec

```css
.card {
  background: var(--bg-surface);         /* #151b1e */
  border: 1px solid var(--border-default); /* #273339 */
  border-radius: var(--radius-lg);       /* 8px */
  padding: var(--space-4);               /* 16px */
}
```

### States

| State | Visuel | Comportement |
|-------|--------|--------------|
| Default | `--bg-surface` + `--border-default` | — |
| Hover | `--bg-surface-hover` + `--border-hover` | `transition: var(--duration-fast)` |
| Pressed | `--bg-surface-active` + `--border-hover` | `transform: scale(0.98)` |
| Selected | `--bg-surface-active` + `--border-hover` | Persistant (ex: coureur sélectionné) |
| Disabled | `opacity: 0.4` | `pointer-events: none` |

### Tokens utilisés

| Catégorie | Tokens |
|-----------|--------|
| Colors | `--bg-surface`, `--bg-surface-hover`, `--bg-surface-active` |
| Border | `--border-default`, `--border-hover` |
| Radius | `--radius-lg` (8px) |
| Spacing | `--space-4` padding (16px), `--space-2` gap interne (8px) |
| Motion | `--duration-fast` (100ms), `--easing-default` |

### Do's and Don'ts

| Do | Don't |
|------|---------|
| Toujours inclure `--border-default` | Card sans border (invisible sur `--bg-app`) |
| Utiliser `--bg-surface` flat | Mettre un gradient ou une couleur custom |
| Padding `--space-4` minimum | Padding en valeur arbitraire |
| `--radius-lg` (8px) | Radius différent par card |

---

## Component: Brand Card (XP Progression)

### Description

Card emphasis unique pour la progression d'équipe (XP). Se distingue des cards normales par un **frosted glass** (gradient directionnel + noise SVG) et un **border beam animé** au hover/clic. C'est le seul composant qui combine ces techniques — **1 seule par écran max.**

### Variants

| Variant | Quand l'utiliser |
|---------|-----------------|
| `default` | La card de progression XP dans la vue "Mon équipe" |
| *(pas d'autre variant)* | Composant unique, pas de variante — si besoin d'emphasis sur un autre contexte, utiliser le pattern mais avec validation design |

### Architecture des layers

| # | Layer | Pseudo / Élément | Z-index | Description |
|---|-------|-------------------|---------|-------------|
| 1 | Outer glow | `.xp-card::after` | 0 | Halo Cyan-500 @ 6%, hover only |
| 2 | Border beam | `.xp-card::before` | 2 | `conic-gradient` rotatif masqué border-only |
| 3 | Card body | `.xp-card-body` | 1 | Frosted glass (gradient + noise) |
| 4 | SVG noise | `.xp-card-body::after` | 0 (interne) | feTurbulence overlay 35% |
| 5 | Content | `.xp-content` | 1 (interne) | Texte, XP, progress bar, stats |

### Frosted Glass Background

```css
.xp-card-body {
  background:
    linear-gradient(
      155deg,
      rgba(14, 165, 233, 0.055) 0%,     /* Sky-500 @ 5.5% */
      rgba(14, 165, 233, 0.025) 25%,     /* Sky-500 @ 2.5% */
      rgba(6, 182, 212, 0.015) 50%,      /* Cyan-500 @ 1.5% */
      transparent 70%,
      rgba(6, 182, 212, 0.02) 100%       /* Cyan-500 @ 2% */
    ),
    var(--bg-surface);
  border: 1px solid var(--border-default); /* aligné avec les cards normales */
  border-radius: 16px;
}
```

5 stops ultra diffus (opacités < 6%) — aucune démarcation visible. Direction 155° : lumière top-left.

### SVG Noise Overlay

```css
.xp-card-body::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  opacity: 0.35;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  background-size: 200px;
  pointer-events: none;
  mix-blend-mode: overlay;
}
```

### Border Beam (Hover)

```css
@property --beam-angle {
  syntax: '<angle>';
  initial-value: 0deg;
  inherits: false;
}

.xp-card::before {
  content: '';
  position: absolute;
  inset: -1px;
  border-radius: inherit;
  padding: 1px;
  background: conic-gradient(
    from var(--beam-angle),
    transparent 0%, transparent 65%,
    rgba(14, 165, 233, 0.15) 72%,   /* Sky-500 */
    rgba(6, 182, 212, 0.5) 80%,     /* Cyan-500 */
    rgba(34, 211, 238, 0.8) 85%,    /* Cyan-400 */
    rgba(103, 232, 249, 1) 88%,     /* Cyan-300 PEAK */
    rgba(34, 211, 238, 0.8) 91%,
    rgba(6, 182, 212, 0.5) 95%,
    rgba(14, 165, 233, 0.15) 98%,
    transparent 100%
  );
  -webkit-mask:
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  opacity: 0;
  transition: opacity 0.4s ease;
}
```

### States

| State | Visuel | Animation |
|-------|--------|-----------|
| Default | Frosted glass + `--border-default` | — |
| Hover | Border cyan @ 20% + beam | `beam-rotate 3s linear infinite`, fade-in 0.4s |
| Click | Beam burst + glow flash | `beam-burst 0.6s ease-out` (2 tours, 720deg) |
| Mobile | Frosted glass only, pas de beam | `@media (hover: hover)` conditionne l'animation |

```css
/* Hover */
.xp-card:hover::before { opacity: 1; animation: beam-rotate 3s linear infinite; }
.xp-card:hover .xp-card-body { border-color: rgba(6, 182, 212, 0.20); }

/* Click */
.xp-card.clicked::before { opacity: 1; animation: beam-burst 0.6s ease-out forwards; }

/* Mobile guard */
@media (hover: hover) {
  .xp-card:hover::before { opacity: 1; animation: beam-rotate 3s linear infinite; }
  .xp-card:hover::after { opacity: 1; }
}

@keyframes beam-rotate { from { --beam-angle: 0deg; } to { --beam-angle: 360deg; } }
@keyframes beam-burst { 0% { --beam-angle: 0deg; opacity: 1; } 100% { --beam-angle: 720deg; opacity: 0.3; } }
```

### Outer Glow (hover only)

```css
.xp-card::after {
  content: '';
  position: absolute;
  inset: -6px;
  border-radius: 20px;
  background: radial-gradient(ellipse at center, rgba(6,182,212,0.06) 0%, transparent 70%);
  opacity: 0;
  transition: opacity 0.5s ease;
}
.xp-card:hover::after { opacity: 1; }
```

### Tokens utilisés

| Token | Hex | Rôle dans cette card |
|-------|-----|-----------------------|
| `--bg-surface` | `#151b1e` | Background base (sous le gradient) |
| `--border-default` | `#273339` | Border au repos (aligné normal cards) |
| `--accent-label` | `#0ea5e9` | Card label text, gradient tint, beam edges |
| `--cyan-500` | `#06b6d4` | Gradient tint, beam mid, outer glow |
| `--cyan-400` | `#22d3ee` | XP number, rank badge, beam bright |
| `--cyan-300` | `#67e8f9` | Beam peak |
| `--cyan-700` | `#0e7490` | Progress bar gradient start |

### Différences vs Card Standard

| Aspect | Card Standard | Brand Card |
|--------|--------------|------------|
| Background | `--bg-surface` flat | Frosted gradient + noise overlay |
| Border repos | `--border-default` | `--border-default` (aligné) |
| Border hover | `--border-hover` | Cyan-500 @ 20% + beam rotatif |
| Border active | — | Burst 2 tours rapides |
| Outer glow | Non | Oui, Cyan-500 @ 6% |
| Noise | Non | SVG feTurbulence 35% overlay |
| Radius | 8px (`--radius-lg`) | 16px (emphasis, plus arrondi) |
| Quantité | Illimité | **1 max par écran** |

### Compatibilité & Fallbacks

| Feature | Fallback si non supporté |
|---------|--------------------------|
| `@property --beam-angle` | Beam statique (pas de rotation) — border teintée au hover |
| `mask-composite` | Préfixé `-webkit-mask-composite: xor` |
| `mix-blend-mode: overlay` | Gradient pur sans noise — toujours clean |
| `conic-gradient` | Border `rgba(6,182,212, 0.20)` solid au hover |

### Structure HTML

```html
<div class="xp-card">
  <!-- ::before = beam border, ::after = outer glow -->
  <div class="xp-card-body">
    <!-- background = frosted gradient, ::after = SVG noise -->
    <div class="xp-content">
      <!-- Contenu card: header, XP, progress, stats -->
    </div>
  </div>
</div>
```

### Règles d'usage

1. **1 seule Brand Card par écran** — composant emphasis, pas un pattern répétable
2. **Border alignée avec les cards normales** au repos — la différenciation vient du frosted bg + noise
3. **Pas de beam sur mobile** — `@media (hover: hover)` obligatoire
4. **Le clic beam est optionnel** — retirer le JS handler si la card ne mène nulle part

---

## Component: Underline Tabs (Page Navigation)

### Description

Primary page-level navigation. Used to switch between top-level views within a page (e.g., My Team / Recruits). **NOT for filtering within a section** — use Filter Chips for that.

### When to use

| Use Underline Tabs | Use Filter Chips instead |
|---------------------|--------------------------|
| Switching between page-level views | Filtering content within a single view |
| Each tab loads different content structure | Each option shows same structure, different data |
| 2–4 top-level destinations | 2–5+ filter options |
| Below app bar, above page content | Inside a section, above a list or grid |

### Spec

```css
.tab-bar {
  display: flex;
  gap: 0;
  border-bottom: 1px solid var(--border-subtle);
}

.tab {
  flex: 1;
  padding: var(--space-3) var(--space-4);    /* 12px 16px */
  font: 600 var(--type-section) var(--font-sans); /* 16px/600 */
  color: var(--text-mid);
  text-align: center;
  border-bottom: 2px solid transparent;
  transition: color var(--duration-fast), border-color var(--duration-fast);
  cursor: pointer;
}

.tab.active {
  color: var(--text-high);
  border-bottom-color: var(--accent-default); /* cyan-500 */
}

.tab:hover:not(.active) {
  color: var(--text-high);
}
```

### States

| State | Text color | Underline | Behavior |
|-------|-----------|-----------|----------|
| **Inactive** | `--text-mid` | transparent | Tappable |
| **Active** | `--text-high` | `--accent-default` (cyan-500), 2px | Current view |
| **Hover** | `--text-high` | transparent | Desktop only (`@media (hover: hover)`) |
| **Focused** | `--text-high` | `--accent-focus-ring` | Keyboard nav |

### Tokens

| Category | Token |
|----------|-------|
| Typography | `--type-section` (16px/600 Geist Sans) |
| Colors | `--text-mid` (inactive), `--text-high` (active), `--accent-default` (underline) |
| Spacing | `--space-3` vertical, `--space-4` horizontal padding |
| Border | `--border-subtle` (bar bottom), 2px underline |
| Motion | `--duration-fast` (100ms) |

### Accessibility

- **Role:** `role="tablist"` on container, `role="tab"` on each tab, `role="tabpanel"` on content
- **Keyboard:** `Tab` to focus tab bar, `Arrow Left/Right` to navigate tabs, `Enter/Space` to activate
- **ARIA:** `aria-selected="true"` on active tab, `aria-controls` linking tab to panel
- **Contrast:** text-mid on bg-app = 7.07:1 AAA ✅

### Usage in app

| Page | Tabs |
|------|------|
| My Team | My Team / Recruits |
| Budget | Budget / Marketplace / Transactions |

### Do's and Don'ts

| ✅ Do | ❌ Don't |
|------|---------|
| Max 4 tabs per bar | Use for 5+ options (use Filter Chips) |
| Equal width tabs (`flex: 1`) | Variable width tabs |
| Place directly below app bar | Nest inside a card or section |
| `--accent-default` (cyan-500) underline only | Use sky-500 or other colors for underline |
| Normal case labels | UPPERCASE tab labels |

---

## Component: Filter Chips

### Description

In-section filtering control. Used to toggle between data subsets within a section without changing the page structure.
Il existe **deux patterns validés** selon le contexte :

1. **Option B: Free Chips** — Chips individuels avec bordure, sans conteneur global. Utilisé pour naviguer dans des grosses listes (Market, Transatcions).
2. **Option C: Contained Light** — Chips regroupés dans un outline neutre. Utilisé comme local toggle dans une zone définie (Stat toggles sur PRD).

---

### Option B: Free Chips (Pattern par défaut pour les data lists)

Pattern flexible et aéré, qui permet l'overflow scroll horizontal sur mobile. Accepte des chips avec `variant="accent"` (ex: "My Bids").

#### Spec Option B

```css
/* Container */
.filter-free-container {
  display: flex;
  gap: 8px; /* Tailwind: gap-2 */
  overflow-x: auto;
  /* Masquer la scrollbar : tailwind-scrollbar-hide */
}

/* Individual chip */
.filter-chip-free {
  padding: 6px 14px;
  font: 500 13px var(--font-sans);
  color: var(--text-low);
  background: transparent;
  border: 1px solid var(--border-default);
  border-radius: 6px;  /* Interactive affordance */
  cursor: pointer;
  transition: all var(--duration-fast);
  white-space: nowrap;
}

/* Active state (Default) */
.filter-chip-free.active {
  background: var(--bg-surface-active);
  border-color: var(--border-hover);
  color: var(--text-high);
  font-weight: 600;
}

/* Active state (Accent / Cyan) */
.filter-chip-free.active.accent {
  background: var(--badge-bg); /* rgba(14,165,233,0.10) */
  border-color: var(--accent-default); /* cyan-500 */
  color: var(--accent-default);
  font-weight: 600;
}

/* Hover (desktop only) */
@media (hover: hover) {
  .filter-chip-free:hover:not(.active) {
    color: var(--text-mid);
    border-color: var(--border-hover);
  }
}
```

---

### Option C: Contained Light (Local toggles)

Groups 2–5 chips inside a light container (border only, no background fill). Utilisé pour des choix fermés (ex: PCS Stats / Game Stats).

#### Spec Option C

```css
/* Container */
.filter-contained {
  display: flex;
  gap: 6px;
  padding: 3px;
  background: transparent;
  border: 1px solid var(--border-default);  /* #273339 */
  border-radius: var(--radius-lg);          /* 8px */
  width: fit-content;
}

/* Individual chip */
.filter-chip-contained {
  padding: 6px 14px;
  font: 500 var(--type-caption) var(--font-sans); /* 12px/500 */
  color: var(--text-low);
  background: transparent;
  border: none;
  border-radius: var(--radius-md);          /* 6px — interactive signal */
  cursor: pointer;
  transition: all var(--duration-fast);
  white-space: nowrap;
}

/* Active state */
.filter-chip-contained.active {
  background: var(--bg-surface-active);     /* #1f292e */
  color: var(--text-high);                  /* #eaeff1 */
  font-weight: 600;
}

/* Hover (desktop only) */
@media (hover: hover) {
  .filter-chip-contained:hover:not(.active) {
    color: var(--text-mid);
    background: rgba(255, 255, 255, 0.03);
  }
}
```

### Key design decisions (Filter Chips Global)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Chip radius | `6px` | **Interactive affordance** — squared = tappable (vs pill 20px = statique) |
| Active indicator (Def) | `bg-surface-active` + `text-high` | No cyan — avoids hierarchy collision with page-level tabs |
| Active weight | 600 (semibold) | Reinforces selection without needing color |
| Accent Variant | `--accent-default` bordure/texte | Permet de faire ressortir une option clé (ex: "My Bids") |

### States

| State | Background | Text | Border | Interaction |
|-------|-----------|------|--------|-------------|
| **Inactive** | transparent | `--text-low` | `border-default` (ou none) | Tappable |
| **Active** | `--bg-surface-active` | `--text-high`, weight 600 | `border-hover` (ou none) | Current filter |
| **Hover** | transparent (ou 3% white) | `--text-mid` | `border-hover` | Desktop only |
| **Focused** | — | — | `--accent-focus-ring` | Keyboard nav |

### Variants by option count

| Count | Example | Layout Pattern | Notes |
|-------|---------|-----------------|-------|
| **2 options** | PCS Stats / Game Stats | Option C: Contained | Works as binary toggle |
| **3 options** | Phase 1 / Phase 2 / Phase 3 | Option B ou C | Standard grouping |
| **5+ options** | Market specs | Option B: Free Chips | Scroll horizontal natif `overflow-x-auto` |

### Tokens Global

| Category | Token |
|----------|-------|
| Typography | 13px/500 ou `--type-caption` (12px), Geist Sans |
| Colors | `--text-low` (inactive), `--text-high` (active), `--text-mid` (hover) |
| Focus | `--bg-surface-active` (active chip), `--badge-bg` (accent chip) |
| Border | `--border-default` (inactif), `--border-hover` (actif natif), `--accent-default` (actif accent) |

### Accessibility

- **Role:** `role="tablist"` on container, `role="tab"` on each chip
- **Keyboard:** `Tab` to focus, `Arrow Left/Right` to navigate, `Enter/Space` to select
- **ARIA:** `aria-selected="true"` on active chip

### Usage in app

| Page | Section | Pattern |
|------|---------|---------|
| Market | All / Climber / Sprinter... / My Bids | **Option B: Free Chips** (w/ Accent) |
| Budget | All / Income / Expenses / Transfers | **Option B: Free Chips** |
| Rider Detail | Stats toggle (PCS vs Game) | **Option C: Contained Light** |

### Do's and Don'ts

| ✅ Do | ❌ Don't |
|------|---------|
| Use `6px` radius for chips | Use pill radius (20px) — that's for tags |
| Active = `bg-surface-active` + `text-high` | Use cyan for default active chips |
| `overflow-x-auto` pour les Option B (Free Chips) | Tronquer les labels sur mobile |
| Un seul composant `FilterChips` avec prop variant | Dupliquer le code pour chaque style |
| Single selection only | Multi-select (use checkboxes instead) |

---

## Component: Tags (Non-Interactive)

### Description

Read-only metadata indicators. Used to display status, category, or classification information. Tags are **never interactive** — they display information only. The pill shape (20px radius) signals "this is decorative, not tappable."

### When to use

| Use Tags | Use Filter Chips instead |
|----------|--------------------------|
| Displaying status or metadata | Filtering content |
| Read-only information | Interactive selection |
| Inside list rows, cards, headers | Standalone filter groups |
| Pill shape (20px radius) | Squared shape (6px radius) |

### Variants

| Variant | Background | Text color | Border | Usage |
|---------|-----------|-----------|--------|-------|
| **default** | transparent | `--text-low` | `--border-default` (1px) | Neutral metadata: team name, round number, generic info |
| **highlighted** | `--badge-bg` (sky@10%) | `--accent-label` (sky-500) | transparent | Emphasis metadata: boost %, strategy type, XP badge |
| **success** | `rgba(16,185,129,0.10)` | `--success` (#10b981) | transparent | Positive state: completed, gained, won |
| **warning** | `rgba(245,158,11,0.08)` | `--warning` (#f59e0b) | transparent | Attention state: pending, expiring, at risk |

### Spec

```css
/* Base tag */
.tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;                                  /* --space-1 */
  font: 500 var(--type-caption) var(--font-sans); /* 12px/500 */
  padding: 3px 10px;
  border-radius: var(--radius-pill);          /* 20px — decorative signal */
  white-space: nowrap;
  user-select: none;
}

/* Variant: default */
.tag-default {
  color: var(--text-low);
  background: transparent;
  border: 1px solid var(--border-default);
}

/* Variant: highlighted (sky) */
.tag-highlight {
  color: var(--accent-label);                /* sky-500 */
  background: var(--badge-bg);               /* rgba(14,165,233,0.10) */
  border: 1px solid transparent;
}

/* Variant: success */
.tag-success {
  color: var(--success);                     /* #10b981 */
  background: rgba(16, 185, 129, 0.10);
  border: 1px solid transparent;
}

/* Variant: warning */
.tag-warning {
  color: var(--warning);                     /* #f59e0b */
  background: rgba(245, 158, 11, 0.08);
  border: 1px solid transparent;
}
```

### Tag with icon/emoji

Tags can include a leading emoji or icon (12px). The `gap: 4px` handles spacing.

```html
<span class="tag tag-highlight">⛰️ Climber</span>
<span class="tag tag-success">✓ Completed</span>
<span class="tag tag-warning">⏳ Pending</span>
<span class="tag tag-default">Round 3</span>
```

### Locked state

Locked is **NOT a tag variant** — it's a row-level treatment applied to the entire row containing the tag.

```css
.row-locked {
  opacity: 0.4;
  pointer-events: none;
}
```

A locked row may contain a default tag with lock icon: `<span class="tag tag-default">🔒 Lv.5</span>`

### Tokens

| Category | Token |
|----------|-------|
| Typography | `--type-caption` (12px/500 Geist Sans) |
| Colors | `--text-low` (default), `--accent-label` (highlighted), `--success`, `--warning` |
| Backgrounds | transparent (default), `--badge-bg` (highlighted), semantic @10% (success/warning) |
| Border | `--border-default` (default variant only) |
| Radius | `--radius-pill` (20px) |
| Spacing | 3px 10px padding, 4px gap (icon+text) |

### Accessibility

- **Role:** No interactive role needed — tags are presentational
- **Screen reader:** Content is read as text naturally. Add `aria-label` if emoji-only.
- **Contrast:** All variants meet AA minimum on `--bg-app` and `--bg-surface`

### Usage in app

| Context | Variant | Example |
|---------|---------|---------|
| Roster — boost badge | highlighted | `+12%` |
| My Team — strategy slot | highlighted | `⛰️ +5%` |
| Progression — completed | success | `✓ Completed` |
| Strategies — pending | warning | `⏳ Pending` |
| Rider detail — team | default | `Ineos Grenadiers` |
| Strategies — locked type | default (in locked row) | `🔒 Lv.5` |
| Transactions — type | default | `Salary` |

### Do's and Don'ts

| ✅ Do | ❌ Don't |
|------|---------|
| Use `--radius-pill` (20px) for tags | Use 6px radius — that's for filter chips |
| Keep tags non-interactive | Add click handlers to tags |
| Max 1 highlighted tag per row | Multiple sky-colored tags competing |
| Use the 4 defined variants only | Invent new color combinations |
| 12px/500 text size | Vary font size per tag instance |
| Leading emoji/icon for extra semantics | Icon-only tags without `aria-label` |

---

## Component Decision Matrix

Quick reference for choosing the right component:

| Question | → L2 Tabs | → Underline Tabs | → Filter Pills | → Filter Chips | → Tags |
|----------|-----------|-----------------|----------------|----------------|--------|
| **Is it interactive?** | Yes (sub-nav) | Yes (navigation) | Yes (filtering) | Yes (filtering) | **No** (read-only) |
| **What does it control?** | Sub-views within a section | Top-level page views (legacy) | Data subsets in nav redesign screens | In-section data subsets | Nothing — displays info |
| **Border radius** | 8px active chip | None (underline) | 20px (pill) | 6px (squared) | 20px (pill) |
| **Position in page** | Sticky below TopBar | Below app bar | Inside a section (Auction, Market) | Inside a section | Inline in rows/cards |
| **Active indicator** | bg-surface-active + border `--radius-lg` chip | Cyan-500 underline | border-default outline (always visible) | bg-surface-active + text-high | N/A |
| **Typography** | 14px/500–600 (emphasis) | 16px/600 (section) | 12px/500–600 (caption) | 12px/500–600 (caption) | 12px/500 (caption) |
| **Max per page** | 1 tab bar per section | 1 tab bar | 1 group per section | Multiple chip groups | Unlimited |

> **Key visual distinction:** L2 Tabs (8px chip) vs Filter Pills (20px pill) is intentional — despite both being interactive, the radius difference creates immediate hierarchy. L2 Tabs = navigation choice (changes content structure). Filter Pills = filtering (same structure, different data subset).

---

## Spacing

Base 4px. Scale harmonique pour mobile-first, dense data UI.

| Token | Value | Usage |
|-------|-------|-------|
| `--space-1` | 4px | Micro gaps (icon-to-label, tag padding inline) |
| `--space-2` | 8px | Intra-component (entre label et valeur, entre items d'une même row) |
| `--space-3` | 12px | Padding composants compacts (tags, pills, small buttons) |
| `--space-4` | 16px | Inter-sections, padding standard des cards et surfaces |
| `--space-5` | 20px | Gap entre groupes de contenu |
| `--space-6` | 24px | Sections majeures, padding des bottom sheets |
| `--space-8` | 32px | Sections de page, gap entre blocs hero |
| `--space-12` | 48px | Top-level page padding, spacing entre zones |

> **Règle : aucune valeur arbitraire.** Tout spacing doit utiliser un token de cette scale. 12px et 20px comblent les trous entre les multiples de 8 pour la data dense.

---

## Borders & Radius

| Token | Value | Usage | Affordance signal |
|-------|-------|-------|-------------------|
| `--radius-sm` | 4px | Small inner elements | — |
| `--radius-md` | 6px | Filter chips (interactive), buttons, inputs | **Interactive** — squared = tappable |
| `--radius-lg` | 8px | Cards, L2 tab active chip, filter chip containers | Structural / sub-nav chip |
| `--radius-compound` | 10px | CompoundHeaderBlock container | Composite block |
| `--radius-pill` | 20px | Tags (non-interactive), badges, Filter Pills | **Decorative** pill — or interactive filter (see decision matrix) |
| `--radius-full` | 9999px | Avatars, notification dots, toggle thumbs | Circular element |

> **Radius = affordance signal (v3.1 update):** `--radius-md` (6px) = tappable control. `--radius-lg` (8px) = L2 tab chip. `--radius-pill` (20px) = decorative OR filter pill (context disambiguates). The introduction of L2 Tabs (8px active chip) adds a new layer to the hierarchy: 6px filters in-section data, 8px navigates sub-sections.

| Token | Value | Usage |
|-------|-------|-------|
| `--border-width-default` | 1px | Dividers, composants |
| `--border-width-focus` | 2px | Focus ring offset |

---

## Shadows (Elevation)

Dark mode = shadows subtils. On s'appuie plus sur les différences de luminosité entre surfaces que sur les ombres.

| Token | Value | Usage |
|-------|-------|-------|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.3)` | Buttons, FAB au repos |
| `--shadow-md` | `0 4px 12px rgba(0,0,0,0.4)` | Cards elevated, dropdowns |
| `--shadow-lg` | `0 8px 32px rgba(0,0,0,0.5)` | Bottom sheets, modals |
| `--shadow-glow` | `0 0 20px rgba(6,182,212,0.15)` | CTA hover, focus accent |

---

## Motion

| Token | Value | Usage |
|-------|-------|-------|
| `--duration-fast` | 100ms | Micro-interactions (hover, toggle) |
| `--duration-normal` | 200ms | Transitions standard (color, opacity) |
| `--duration-slow` | 350ms | Entrées/sorties (modals, sheets, pages) |
| `--easing-default` | `cubic-bezier(0.4, 0, 0.2, 1)` | Standard (Material-like) |
| `--easing-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Rebond subtil (toggles, badges) |

> Préférer `prefers-reduced-motion: reduce` → désactiver toutes les animations sauf les transitions de couleur.

---

## Responsive

Mobile-first, un seul breakpoint. Desktop = bonus, pas une cible primaire.

### Stratégie

| Principe | Règle |
|----------|-------|
| **Breakpoint unique** | `md:` = 768px (tablette paysage / desktop) |
| **Approche** | Mobile-first → `@media (min-width: 768px)` pour les overrides |
| **Pas de clamp()** | Steps fixes, simples et prévisibles |

### Ce qui change au `md:`

#### Typographie : +2px sur tous les tokens

```css
/* Mobile (default) → Desktop (md:) */
--type-display:    32px → 34px
--type-stat:       20px → 22px
--type-page-title: 18px → 20px
--type-section:    16px → 18px
--type-stat-small: 16px → 18px
--type-emphasis:   14px → 16px
--type-body:       14px → 16px
--type-caption:    12px → 14px
--type-label:      12px → 14px
--type-nav:        10px → 12px
--type-micro:      10px → 12px
```

#### Spacing : inchangé

Les tokens spacing (`--space-1` à `--space-12`) restent identiques sur desktop. La data density est la même — on ne "relâche" pas les espacements sur grand écran.

#### Layout

| Règle | Mobile | Desktop (md:) | Desktop large (lg:) |
|-------|--------|---------------|---------------------|
| Content max-width | 100% | `600px` centré | List + Detail Panel |
| Padding page | `--space-4` (16px) | `--space-6` (24px) | `--space-6` (24px) |
| Navigation | Bottom nav | Bottom nav | Sidebar possible |

#### Detail Panel (split view, style Linear)

Sur desktop large, quand l'utilisateur clique dans une liste (roster, bids, leaderboard), le détail s'ouvre dans un **panneau latéral droit** au lieu de naviguer vers une nouvelle page.

| Propriété | Valeur |
|-----------|--------|
| Breakpoint minimum | `lg:` (1024px) — en dessous, navigation push classique |
| Largeur liste | `360px` — `440px`, `flex-shrink: 0` |
| Largeur panel | `flex: 1`, min `360px` |
| Séparateur | `1px solid var(--border-default)` vertical |
| Background | `--bg-app` (panel) vs `--bg-subtle` (liste) — ou inversé, pour créer un contraste subtil |
| Animation ouverture | Slide-in droite, `var(--duration-slow)` (350ms) |
| Fermeture | Bouton close ou sélection d'un autre item (remplace le contenu) |

```
┌──────────────────────────────────────────────────┐
│  ┌───────────────┐│┌─────────────────────────┐   │
│  │  Liste         ││  Detail Panel            │   │
│  │  (360-440px)   ││  (flex: 1, min 360px)    │   │
│  │                ││                          │   │
│  │  · Rider A     ││  Rider B                 │   │
│  │  · Rider B ◄───││  Stats, XP, history      │   │
│  │  · Rider C     ││  Actions                 │   │
│  │                ││                          │   │
│  └───────────────┘│└─────────────────────────┘   │
│            border-default                         │
└──────────────────────────────────────────────────┘
```

> **En dessous de 1024px :** pas de panel. Clic sur un item = navigation push (nouvelle page). Le detail panel n'existe qu'en contexte desktop large.

### Ce qui ne change PAS

Couleurs, borders, radius, shadows, motion, composants — tout est identique entre mobile et desktop. Seules la typo, le padding page, et le pattern de navigation (push vs split) s'adaptent.

### Breakpoints

| Token | Value | Usage |
|-------|-------|-------|
| `md:` | `768px` | Typo +2px, padding page `--space-6`, max-width 600px |
| `lg:` | `1024px` | Detail panel (split view list + detail) |

> Deux breakpoints. Pas de `sm:`, pas de `xl:`. Mobile-first, le reste est bonus.

### Implémentation

```css
/* globals.css — Typo responsive */
@media (min-width: 768px) {
  :root {
    --type-display: 34px;
    --type-stat: 22px;
    --type-page-title: 20px;
    --type-section: 18px;
    --type-stat-small: 18px;
    --type-emphasis: 16px;
    --type-body: 16px;
    --type-caption: 14px;
    --type-label: 14px;
    --type-nav: 12px;
    --type-micro: 12px;
  }

  .app-container {
    max-width: 600px;
    margin-inline: auto;
    padding-inline: var(--space-6);
  }
}

/* Detail panel — split view */
@media (min-width: 1024px) {
  .app-layout {
    display: flex;
    height: 100dvh;
  }

  .app-layout__list {
    width: 400px;
    flex-shrink: 0;
    border-right: 1px solid var(--border-default);
    overflow-y: auto;
  }

  .app-layout__detail {
    flex: 1;
    min-width: 360px;
    overflow-y: auto;
    animation: panel-slide-in var(--duration-slow) var(--easing-default);
  }

  .app-container {
    max-width: none; /* full width dans chaque panneau */
  }
}

@keyframes panel-slide-in {
  from { opacity: 0; transform: translateX(16px); }
  to { opacity: 1; transform: translateX(0); }
}
```

---

## Tokens CSS — Copier-coller

```css
:root {
  /* ── Layer 1: Neutral Sky Blue Night (200°, ~18% sat) ── */
  --bg-app: #0c1012;
  --bg-subtle: #111618;
  --bg-surface: #151b1e;
  --bg-surface-hover: #1a2226;
  --bg-surface-active: #1f292e;

  --border-subtle: #151b1e;
  --border-default: #273339;
  --border-hover: #334249;

  --text-high: #eaeff1;
  --text-mid: #89a1ad;
  --text-low: #74919f;
  --text-ghost: #334249;

  /* ── Layer 2: Accent (Tailwind Cyan) ── */
  --cyan-950: #083344;
  --cyan-900: #164e63;
  --cyan-800: #155e75;
  --cyan-700: #0e7490;
  --cyan-600: #0891b2;
  --cyan-500: #06b6d4;
  --cyan-400: #22d3ee;
  --cyan-300: #67e8f9;

  /* Sky-500 — pont accent/neutral pour labels brand */
  --sky-500: #0ea5e9;

  --accent-default: var(--cyan-500);
  --accent-hover: var(--cyan-600);
  --accent-active: var(--cyan-700);
  --accent-highlight: var(--cyan-400);   /* hero stat — use when relevant */
  --accent-label: var(--sky-500);        /* badges text + gradient fills ONLY */
  --badge-bg: rgba(14, 165, 233, 0.10);  /* sky-500 @ 10% */
  --accent-subtle-bg: rgba(8, 51, 68, 0.5);
  --accent-focus-ring: rgba(103, 232, 249, 0.4);

  /* ── Layer 3: CTA Gradient ── */
  --cta-gradient: linear-gradient(135deg, #06b6d4, #22d3ee);
  --cta-gradient-hover: linear-gradient(135deg, #0891b2, #06b6d4);
  --cta-gradient-active: linear-gradient(135deg, #155e75, #0891b2);
  --cta-text: #020617;
  --cta-shadow: 0 4px 24px rgba(6, 182, 212, 0.25);

  /* ── Semantic ── */
  --success: #10b981;
  --danger: #ef4444;
  --warning: #f59e0b;

  /* ── Typography ── */
  --font-sans: 'Geist Sans', system-ui, -apple-system, sans-serif;
  --font-mono: 'Geist Mono', 'SF Mono', 'Cascadia Code', monospace;

  /* Even-number scale — all +2px at md: (768px+) */
  --type-display: 32px;       /* 900 Geist Mono */
  --type-stat: 20px;          /* 800 Geist Mono */
  --type-page-title: 18px;    /* 700 Geist Sans */
  --type-section: 16px;       /* 600 Geist Sans */
  --type-stat-small: 16px;    /* 700 Geist Mono */
  --type-emphasis: 14px;      /* 600 Geist Sans */
  --type-body: 14px;          /* 400 Geist Sans */
  --type-caption: 12px;       /* 500 Geist Sans */
  --type-label: 12px;         /* 700 Geist Sans UPPERCASE */
  --type-nav: 10px;           /* 500 Geist Sans */
  --type-micro: 10px;         /* 600 Geist Sans */

  --tracking-tight: -0.02em;
  --tracking-snug: -0.01em;
  --tracking-normal: 0;
  --tracking-wide: 0.08em;
  --tracking-wider: 0.06em;

  /* ── Spacing (base 4px) ── */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-12: 48px;

  /* ── Borders & Radius ── */
  --radius-sm: 4px;
  --radius-md: 6px;      /* filter chips (interactive) */
  --radius-lg: 8px;      /* cards, filter chip containers */
  --radius-pill: 20px;   /* tags (non-interactive) */
  --radius-full: 9999px;
  --border-width-default: 1px;
  --border-width-focus: 2px;

  /* ── Shadows ── */
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.3);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.4);
  --shadow-lg: 0 8px 32px rgba(0,0,0,0.5);
  --shadow-glow: 0 0 20px rgba(6,182,212,0.15);

  /* ── Motion ── */
  --duration-fast: 100ms;
  --duration-normal: 200ms;
  --duration-slow: 350ms;
  --easing-default: cubic-bezier(0.4, 0, 0.2, 1);
  --easing-spring: cubic-bezier(0.34, 1.56, 0.64, 1);

  /* ── Mesh Gradient (Web only) ── */
  --mesh-color-1: #040607;
  --mesh-color-2: #0c1012;
  --mesh-color-3: #1f292e;
  --mesh-color-4: #06b6d4;
  --mesh-color-5: #0ea5e9;
}
```

---

## Checklist de validation

Avant de valider un écran :

- [ ] Hero numbers en `--cyan-400` utilisés de façon pertinente (pas par défaut sur tous les chiffres)
- [ ] Un seul CTA gradient max par vue
- [ ] Display (32px) utilisé pour les chiffres clés — pas systématiquement partout
- [ ] Zéro couleur hors-système
- [ ] Tous les autres chiffres en `--text-high` + Geist Mono
- [ ] Labels structurels en uppercase + letter-spacing
- [ ] Bottom nav en normal case (pas UC)
- [ ] Toutes les cards ont `border: 1px solid var(--border-default)` (#273339)
- [ ] Cards utilisées uniquement pour modals, drag-and-drop, toasts, expandable
- [ ] Dividers en `--border-subtle`
- [ ] Focus rings visibles
- [ ] Couleurs sémantiques sur texte uniquement
- [ ] Contraste WCAG AA sur tous les textes (`--text-low` = AA depuis v1.1)
- [ ] Touch targets ≥ 44×44px sur tous les éléments interactifs
- [ ] Safe area insets sur bottom nav (`env(safe-area-inset-bottom)`)
- [ ] Underline Tabs: page-level only, max 4, cyan-500 underline, `--type-section`
- [ ] Filter Chips: in-section only, contained light (border, no bg), 6px radius chips, no cyan in active state
- [ ] Tags: 20px pill radius, non-interactive, using defined 4 variants only
- [ ] Radius = affordance: 6px = interactive, 20px = decorative — no mixing

---

## Template — Documentation composant

> **Mode d'emploi :** copier ce template pour chaque composant à documenter.
> Objectif : qu'un développeur puisse implémenter le composant **sans aller chercher ailleurs**.
> Remplir au minimum : Description, Variants, States, Tokens Used. Le reste peut venir en v2.

```markdown
## Component: [Nom]

### Description
[1-2 phrases : ce que c'est, quand l'utiliser, quand NE PAS l'utiliser]

### Variants

| Variant | Quand l'utiliser | Exemple |
|---------|-----------------|---------|
| primary | [Action principale] | "Recruter", "Enchérir" |
| secondary | [Action secondaire] | "Annuler", "Voir détails" |
| ghost | [Action tertiaire, dans un contexte dense] | "Filtrer", "Trier" |

### States

| State | Visuel | Comportement |
|-------|--------|--------------|
| Default | [couleur bg, border, text] | — |
| Hover | [changement bg/border] | cursor: pointer |
| Active/Pressed | [changement bg + scale] | feedback tactile |
| Focused | [focus ring cyan-300 @ 40%] | keyboard nav |
| Disabled | [opacity 40%, curseur not-allowed] | non-interactif |
| Loading | [skeleton ou spinner] | non-interactif, feedback visuel |

### Tokens utilisés

| Catégorie | Tokens |
|-----------|--------|
| Colors | `--bg-surface`, `--text-high`, `--accent-default` |
| Typography | `--type-body` (14px/600) |
| Spacing | `--space-3` padding, `--space-2` gap |
| Radius | `--radius-md` (10px) |
| Shadow | `--shadow-sm` |
| Motion | `--duration-fast`, `--easing-default` |

### Dimensions & Touch targets

| Taille | Height | Min touch | Padding |
|--------|--------|-----------|---------|
| sm | 32px | 44×44 (padding étendu) | `--space-2` x `--space-3` |
| md | 40px | 44×44 | `--space-3` x `--space-4` |
| lg | 48px | 48×48 | `--space-3` x `--space-6` |

### Accessibilité

- **Role :** `[button / tab / link / ...]`
- **Keyboard :** `[Tab pour focus, Enter/Space pour activer, Escape pour fermer]`
- **Screen reader :** `[Annoncé comme "bouton [label]", état disabled annoncé]`
- **Contraste :** `[ratio text/bg vérifié, focus ring visible]`

### Do's and Don'ts

| ✅ Do | ❌ Don't |
|------|---------|
| [Utiliser un seul CTA primary par écran] | [Mettre 2 CTA gradient côte à côte] |
| [Label court, verbe d'action] | [Label vague "OK", "Cliquer ici"] |
| [Feedback visuel sur press] | [Bouton sans état pressed] |

### Exemple de code (React/Tailwind)

[Snippet minimal mais fonctionnel avec les classes Tailwind mappées aux tokens]
```

### Composants à documenter (par priorité)

Les composants ci-dessous sont listés par ordre d'impact. Les cocher au fur et à mesure.

#### P0 — Core (bloque le développement)

- [x] **Card (Standard)** — bg-surface + border-default, hover/active states, radius 8px. v2.3
- [ ] **Button** — primary (CTA gradient), secondary (outline), ghost, icon-only. 3 tailles.
- [ ] **Bottom Navigation** — 5 items, active state, badge notification, safe-area.
- [ ] **List Row** — rider row avec avatar, name, team, stat. States: default, pressed, swipe-to-action.
- [ ] **Input / Text Field** — default, focused, error, disabled. Avec label et helper text.

#### P1 — Important (bloque des écrans clés)

- [x] **Underline Tabs** — page-level navigation, cyan-500 underline, 2-4 tabs. v3.0
- [x] **Filter Chips (Contained Light)** — in-section filtering, border-only container, 6px radius chips, 2-5 options. v3.0
- [x] **Tags** — non-interactive metadata, 4 variants (default, highlighted, success, warning), 20px pill radius. v3.0
- [ ] **Hero Stat Block** — display number + label. Variante avec sous-stats.
- [ ] **Section Header** — label uppercase + optional action link.
- [ ] **Avatar** — image, initials fallback, sizes 24/32/40/48, online indicator.
- [ ] **Progress Bar** — gradient cyan, determinate/indeterminate, avec label %.

#### P2 — Overlay & Feedback

- [ ] **Bottom Sheet / Modal** — header, content scroll, actions. Backdrop, drag-to-dismiss.
- [ ] **Toast / Notification** — success/error/info/warning. Auto-dismiss, action link.
- [ ] **Toggle / Switch** — on/off, disabled, avec label.
- [ ] **Tooltip** — texte court, position auto, trigger hover/long-press.
- [ ] **Skeleton / Loading** — placeholder pour chaque type de contenu (text, stat, row, avatar).

#### P3 — Spécifiques Fantasy Cycling

- [x] **Brand Card (XP Progression)** — frosted glass + beam animé, 5 layers, hover/click states. v2.3
- [ ] **Rider Card** — photo, name, team, stats, bid button. Draggable.
- [ ] **Bid Row** — rider + montant + status (pending/won/lost).
- [ ] **Leaderboard Row** — rank + name + score. Highlight position changes (↑↓).
- [ ] **Stage Result Row** — rider + points + time. Collapsible detail.
- [ ] **Budget Indicator** — bar + montant restant. Warning states.

---

## Auto-critique & Points de discussion

### Ce qui fonctionne bien

1. **La cohérence de famille hue** : Sky Blue Night (200°), Cyan (188°) et Sky-500 (199°) sont dans la même zone ~188-200° du spectre — tout le système "parle la même langue" chromatique.
2. **La séparation Mono/Sans** est claire et renforce l'identité "data app".
3. **Le système 7 niveaux + sous-tokens** couvre tous les cas sans bloat.

### Ce que je challengerais

1. ~~**`--text-low` à 3.5:1**~~ → **FIXÉ** : `#74919f` (5.73:1 AA ✅) — meilleur ratio de toutes les versions.

2. **`--text-mid` à #89a1ad (7.07:1 AAA)** — amélioration significative vs v2.0 (6.51:1). Plus besoin de bumper.

3. **Le display à 32px est-il encore trop gros ?** Sur un écran 375px, 32px/900 en mono prend ~40% de la largeur pour un nombre à 5 chiffres. Alternative : 28px qui reste imposant mais laisse plus de breathing room.

4. **Manque un token `--type-button`** explicite. Actuellement les boutons réutilisent `--type-body` (14px/600), mais un token dédié permettrait d'ajuster indépendamment si besoin.

5. **La scale responsive avec clamp()** est proposée mais pas testée. Sur desktop large (1440px+), le display à 48px max pourrait être trop gros. À valider avec des mockups desktop.

6. ~~**Pas de token pour le segmented control actif**~~ → **FIXÉ v3.0** : Filter Chips active = `bg-surface-active` + `text-high` + weight 600. No cyan (avoids hierarchy collision with page tabs).

### Questions ouvertes

1. **Veut-on un `--bg-elevated`** distinct de `--bg-surface` pour les bottom sheets et modals ? (Plus clair que surface, pour créer de la profondeur)
2. **Icon size tokens** : actuellement ad-hoc (18px, 20px). Faut-il formaliser une scale d'icônes (16/20/24) ?
3. ~~**Spacing scale**~~ → **FAIT v1.0** : documenté dans la section Spacing.

---

---

## Navigation Redesign Components (v3.1 — 2026-05-13)

These four components are introduced as part of the navigation redesign. They form the universal shell that wraps every screen.

---

## Glassmorphism Rules

**Where:** Bottom nav + Contextual Action Bar **only**. Never on cards, inputs, or inline content.

**Why only there:** These two components float above scrollable content. The blur creates physical depth — the content "breathes" beneath them. Using glassmorphism elsewhere would flatten the hierarchy.

### Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `--bg-glass` | `rgba(8, 14, 26, 0.80)` | Background of glass surfaces |
| `--border-glass` | `rgba(255, 255, 255, 0.06)` | Top/bottom border of glass surfaces |
| `--blur-glass` | `20px` | `backdrop-filter: blur()` value |

### Implementation

```css
.glass-surface {
  background: var(--bg-glass);
  border-top: 1px solid var(--border-glass);
  backdrop-filter: blur(var(--blur-glass));
  -webkit-backdrop-filter: blur(var(--blur-glass)); /* Safari */
}
```

### Do's and Don'ts

| ✅ Do | ❌ Don't |
|------|---------|
| Bottom nav + CTA bar only | Cards, list rows, modals |
| Always pair with `--border-glass` top border | Glass without border (floats in air) |
| Test on Safari (prefix required) | Forget `-webkit-backdrop-filter` |

---

## Component: L2 Navigation Tabs

### Description

Sub-navigation for switching between views within a screen section. Appears sticky just below the TopBar. Hides on scroll down, reappears on scroll up (uses `hooks/use-scroll-direction.ts`).

**Not** the same as Underline Tabs (which are the legacy per-page tab pattern). L2 Tabs replace Underline Tabs in the navigation redesign.

### When to use

| Use L2 Tabs | Don't use L2 Tabs |
|-------------|-------------------|
| Switching between content structures on one screen | Filtering data within a view (use Filter Pills) |
| Sub-views of a bottom nav section (Racing, Auction, Team, Ranking) | More than 4 destinations |
| Sticky navigation below the universal TopBar | Nested inside a card or modal |

### Spec

```css
/* Tab bar */
.l2-tab-bar {
  display: flex;
  gap: var(--space-2);      /* 8px between tabs */
  padding: var(--space-2) var(--space-4); /* 8px 16px */
  background: var(--bg-app);
  position: sticky;
  top: 0;                   /* just below TopBar */
  z-index: 10;
  transition: transform var(--duration-normal) var(--easing-default);
}

.l2-tab-bar.hidden {
  transform: translateY(-100%);
}

/* Individual tab */
.l2-tab {
  padding: 6px 14px;
  font: 500 var(--type-emphasis) var(--font-sans);  /* 14px/500 */
  color: var(--text-low);
  background: transparent;
  border: none;
  border-radius: var(--radius-lg);  /* 8px — squarish chip */
  cursor: pointer;
  transition: all var(--duration-fast);
  white-space: nowrap;
}

/* Active state */
.l2-tab.active {
  background: var(--bg-surface-active);
  border: 1px solid var(--border-hover);
  color: var(--text-high);
  font-weight: 600;
}

/* Hover (desktop only) */
@media (hover: hover) {
  .l2-tab:hover:not(.active) {
    color: var(--text-mid);
    background: var(--bg-surface-hover);
  }
}
```

### States

| State | Background | Text | Border | Radius |
|-------|-----------|------|--------|--------|
| **Inactive** | transparent | `--text-low` | none | — |
| **Active** | `--bg-surface-active` | `--text-high`, 600 | `--border-hover` (1px) | `--radius-lg` (8px) |
| **Hover** | `--bg-surface-hover` | `--text-mid` | none | — |

### Hide-on-scroll behavior

```tsx
// Reuse existing hook
const scrollDir = useScrollDirection();

<div className={cn("l2-tab-bar", scrollDir === "down" && "hidden")}>
  {tabs.map(tab => <button key={tab} className={cn("l2-tab", active === tab && "active")} />)}
</div>
```

### Tokens

| Category | Token |
|----------|-------|
| Typography | `--type-emphasis` (14px/500–600 Geist Sans) |
| Colors | `--text-low` (inactive), `--text-high` (active), `--text-mid` (hover) |
| Background | transparent (inactive), `--bg-surface-active` (active), `--bg-surface-hover` (hover) |
| Border | none (inactive), `--border-hover` 1px (active) |
| Radius | `--radius-lg` (8px) — active chip only |
| Spacing | `6px 14px` padding chip, `--space-2` gap, `--space-2 --space-4` bar padding |

### Do's and Don'ts

| ✅ Do | ❌ Don't |
|------|---------|
| `--radius-lg` (8px) active chip | Use underline (that's Underline Tabs) |
| Plain text for inactive tabs | Add border or background to inactive tabs |
| Hide on scroll with `use-scroll-direction` | Always visible — competes with content |
| Max 4 tabs | 5+ tabs (truncation, overflow issues) |
| `--type-emphasis` 14px | `--type-section` 16px — too prominent |

---

## Component: Filter Pills

### Description

Data-filtering control used inside the Auction / Market sections. Visually distinct from L2 Tabs via the 20px radius. Always show outline border (unlike Filter Chips which are borderless when inactive).

The pill radius (same as Tags) is intentional: Filter Pills are "softer" than L2 Tabs (navigation) and signal "narrow the data" rather than "change the view."

### Spec

```css
/* Container */
.filter-pills {
  display: flex;
  gap: var(--space-2);
  overflow-x: auto;
  padding-bottom: 2px; /* prevent border cut */
}

/* Individual pill */
.filter-pill {
  padding: 5px 14px;
  font: 500 var(--type-caption) var(--font-sans);  /* 12px/500 */
  color: var(--text-low);
  background: transparent;
  border: 1px solid var(--border-default);          /* always visible outline */
  border-radius: var(--radius-pill);                /* 20px */
  cursor: pointer;
  transition: all var(--duration-fast);
  white-space: nowrap;
}

/* Active */
.filter-pill.active {
  background: var(--bg-surface-active);
  border-color: var(--border-hover);
  color: var(--text-high);
  font-weight: 600;
}

/* Hover (desktop only) */
@media (hover: hover) {
  .filter-pill:hover:not(.active) {
    color: var(--text-mid);
    border-color: var(--border-hover);
  }
}
```

### Key differences vs Filter Chips

| Aspect | Filter Pills (new) | Filter Chips (existing) |
|--------|-------------------|------------------------|
| Radius | `--radius-pill` (20px) | `--radius-md` (6px) |
| Border inactive | `--border-default` (always) | `--border-default` (Option B) or none |
| Context | Navigation redesign screens | Legacy in-section filtering |
| Typography | `--type-caption` (12px) | `--type-caption` (12px) — same |

### Tokens

| Category | Token |
|----------|-------|
| Radius | `--radius-pill` (20px) |
| Border | `--border-default` (inactive), `--border-hover` (active) — always present |
| Background | transparent (inactive), `--bg-surface-active` (active) |
| Typography | `--type-caption` (12px/500–600) |

---

## Component: CompoundHeaderBlock

### Description

The universal top-right element in the TopBar. Displays rank and treasury info (non-clickable) alongside the user avatar (clickable → profile/settings).

**1 instance per screen**. Part of the universal TopBar — not duplicated per section.

### Visual structure

```
┌─────────────────────────────────┐
│  #3 · 142k€  │  JS             │
│  (non-clickable)│ (clickable)   │
└─────────────────────────────────┘
       ↑ overflow-hidden, radius-compound (10px)
```

- **Left zone:** Rank `#N` + separator dot + treasury `NNk€` — plain text, no interaction
- **Separator:** `border-right: 1px solid var(--border-default)`
- **Right zone:** Avatar initials — gradient cyan, clickable

### Spec

```css
/* Outer container */
.compound-header {
  display: flex;
  align-items: center;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-compound);  /* 10px */
  overflow: hidden;
  height: 32px;
}

/* Info zone (non-interactive) */
.compound-info {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding: 0 var(--space-3);              /* 0 12px */
  font: 600 var(--type-caption) var(--font-mono); /* 12px/600 Geist Mono — numbers */
  color: var(--text-high);
  white-space: nowrap;
  user-select: none;
  border-right: 1px solid var(--border-default);
}

/* Avatar zone (interactive) */
.compound-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: linear-gradient(to bottom right, var(--color-cyan-600), var(--color-cyan-400));
  font: 700 var(--type-micro) var(--font-sans);  /* 10px/700 */
  color: var(--cta-text);                         /* #020617 */
  cursor: pointer;
  transition: opacity var(--duration-fast);
}

.compound-avatar:hover {
  opacity: 0.85;
}
```

### Data fetching

The layout `app/(game)/league/[leagueId]/layout.tsx` fetches rank + treasury and passes them as props down to TopBar → CompoundHeaderBlock.

```ts
// Rank: sort teams by XP descending, find index of current team
const myRank = rankData.findIndex(t => t.id === teamId) + 1;

// Treasury: teams.treasury (current team)
```

Format: `#3 · 142k€` — rank as `#N`, treasury in `k€` (divide by 1000, round to nearest k).

### Tokens

| Category | Token |
|----------|-------|
| Container | `--radius-compound` (10px), `--border-default` |
| Typography | `--type-caption` + Geist Mono (numbers), `--type-micro` (initials) |
| Colors | `--text-high` (info), `--cta-text` (initials) |
| Avatar gradient | `cyan-600 → cyan-400` (bottom-right) |
| Height | 32px fixed |

### Do's and Don'ts

| ✅ Do | ❌ Don't |
|------|---------|
| Numbers in Geist Mono | Body text font for rank/treasury |
| `overflow: hidden` on container | Rounded corners on zones individually |
| Avatar only clickable | Make info zone clickable |
| `#N · NNk€` format | Full treasury (hard to scan) |

---

## Component: ContextualActionBar

### Description

A sticky glass bar that floats above the bottom nav, providing contextual info (left) and a primary action button (right). Used on Auction screens. Adapts dynamically to the current state (active phase / pending round / phase closed).

**Glass surface** — uses `--bg-glass` + `--blur-glass`. One instance per screen maximum.

### States

| Phase state | Info text (left ghost) | Button (right) |
|-------------|------------------------|----------------|
| Active | `8/10 slots · 33k€ left` | `[Place Bid]` |
| Pending (commissioner) | `Round 2 · 3 bids pending` | `[Validate Round]` |
| Closed | `Phase closed · Next: Jun 2` | `[View History]` |

### Spec

```css
/* Bar container */
.cta-bar {
  position: sticky;
  bottom: 0;
  display: flex;
  align-items: stretch;
  height: 56px;
  background: var(--bg-glass);
  border-top: 1px solid var(--border-glass);
  backdrop-filter: blur(var(--blur-glass));
  -webkit-backdrop-filter: blur(var(--blur-glass));
  overflow: hidden;
  border-radius: 0 0 0 0;  /* no radius — flush with bottom nav above */
}

/* Info zone (ghost, left) */
.cta-bar__info {
  flex: 1;
  display: flex;
  align-items: center;
  padding: 0 var(--space-4);
  font: 500 var(--type-caption) var(--font-sans);
  color: var(--text-low);
}

/* Action button (right, full-height) */
.cta-bar__btn {
  align-self: stretch;
  display: flex;
  align-items: center;
  padding: 0 var(--space-5);                        /* 0 20px */
  font: 600 var(--type-emphasis) var(--font-sans);  /* 14px/600 */
  color: var(--cta-text);
  background: var(--cta-gradient);
  border-left: 1px solid var(--border-glass);
  border-radius: 0 0 var(--radius-lg) 0;            /* bottom-right only — or overflow on container */
  cursor: pointer;
  white-space: nowrap;
  transition: background var(--duration-fast);
}

.cta-bar__btn:hover {
  background: var(--cta-gradient-hover);
}
```

### Tokens

| Category | Token |
|----------|-------|
| Background | `--bg-glass` |
| Border | `--border-glass` (top + left separator) |
| Blur | `--blur-glass` (20px) |
| Info text | `--type-caption` (12px), `--text-low` |
| Button text | `--type-emphasis` (14px/600), `--cta-text` |
| Button background | `--cta-gradient` → `--cta-gradient-hover` |
| Height | 56px |

### Do's and Don'ts

| ✅ Do | ❌ Don't |
|------|---------|
| Full-height button (align-self: stretch) | Button with top/bottom margin |
| Glass background + blur | Solid opaque background |
| Dynamic text based on phase state | Static "Place Bid" regardless of context |
| Single primary action | Two buttons in the bar |

---

*WattHunter Design System v3.1 — 2026-05-13*
*Palette: Sky Blue Night (~18% sat, ~200° hue) | Fonts: Geist Sans + Geist Mono*
*Historique: v0 Radix Slate → v1.0 Teal B1 (195°, 12%) → v1.1 text-low fix → v2.0 Blue Night (220°, 18%) → v2.1 Sky Blue Night (200°, 18%) → v2.2 +Sky-500 accent-label, type scale 11 niveaux → v2.3 +Card Standard, +Brand Card XP → v2.4 Sky-500 restreint (gradients + badges only), cyan-400 hero stat maintenu, +badge-bg token → v3.0 Component system: +Underline Tabs, +Filter Chips (Contained Light), +Tags (4 variants), radius-as-affordance (6px interactive / 20px decorative), +radius-pill token → v3.1 Navigation Redesign: +L2 Tabs (8px chip), +Filter Pills (20px, always-outline), +CompoundHeaderBlock, +ContextualActionBar, +Glassmorphism rules, +radius-compound (10px)*
