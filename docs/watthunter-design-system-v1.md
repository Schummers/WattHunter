# WattHunter — Design System v1.0

> **Philosophy:** Restrained Cyan on Teal-tinted Dark.
> Le fond a du caractère mais reste silencieux. Le blanc structure. Le cyan guide l'œil.

---

## Architecture 4 couches

| Couche | Source | Rôle | Surface |
|--------|--------|------|---------|
| **1. Neutral** | Teal-tinted dark (B1) | Backgrounds, surfaces, texte, dividers | ~80% |
| **2. Accent** | Tailwind Cyan | Interactions, états actifs, hero stat | ~15% |
| **3. CTA Gradient** | Cyan-500 → Cyan-400 | Boutons d'action primaires | ~5% |
| **4. Mesh Gradient** | 5 couleurs brand (animé) | Hero sections, marketing, onboarding | Web only |

---

## Layer 1 — Neutral Teal-Tinted (B1)

**Remplace Radix Slate Dark.** Hue ~195° (teal), saturation ~10-14%. Suffisamment teinté pour avoir du caractère, assez subtil pour ne pas rivaliser avec l'accent cyan.

### Pourquoi B1 ?

Le Radix Slate pur (hue 0°, sat 0%) était **trop plat** — pas de personnalité, pas de lien avec la brand. B1 injecte une teinte teal subtile qui :

- Crée une parenté naturelle avec l'accent Cyan (~188°) — même famille de hue
- Ajoute de la profondeur sans saturer l'œil
- Différencie WattHunter d'un thème dark générique

### Backgrounds

| Token | Hex (B1) | Ancien (Slate) | Delta | Usage |
|-------|----------|----------------|-------|-------|
| `--bg-app` | `#0b1113` | `#111113` | Hue shift 195° | Background principal de l'app |
| `--bg-subtle` | `#101719` | `#18191b` | +teal tint | Background alterné, sections secondaires |
| `--bg-surface` | `#131d20` | `#212225` | Plus sombre, plus teal | Cards, inputs, wells |
| `--bg-surface-hover` | `#182428` | `#272a2d` | — | Hover state des surfaces |
| `--bg-surface-active` | `#1b272c` | `#2e3135` | — | Pressed/selected state |

### Borders & Dividers

| Token | Hex (B1) | Ancien (Slate) | Usage |
|-------|----------|----------------|-------|
| `--border-subtle` | `#131d20` | `#212225` | Dividers entre sections |
| `--border-default` | `#243338` | `#363a3f` | Borders de composants |
| `--border-hover` | `#2e4048` | `#43484e` | Borders au hover |

### Texte

| Token | Hex (B1) | Ancien (Slate) | Contrast vs bg-app | Usage |
|-------|----------|----------------|---------------------|-------|
| `--text-high` | `#ebf0f1` | `#edeef0` | ~15:1 ✅ AAA | Titres, noms, chiffres |
| `--text-mid` | `#8a9da3` | `#b0b4ba` | ~7:1 ✅ AA | Descriptions, texte secondaire |
| `--text-low` | `#6a8890` | `#696e77` | 5.0:1 ✅ AA | Labels, captions, metadata |
| `--text-ghost` | `#2e4048` | `#43484e` | ~1.8:1 | Placeholders, disabled (décoratif uniquement) |

> **`--text-low` fixé (v1.1) :** rehaussé de `#456068` (2.83:1 ❌) à `#6a8890` (5.02:1 ✅ AA).
> Passe AA sur `--bg-app` et `--bg-surface`. Passe AA-large sur `--bg-surface-active` (4.03:1).
> Utilisable pour du small text (11px labels) sans restriction.
>
> **`--text-ghost` :** réservé aux éléments **purement décoratifs** (placeholders, texte disabled).
> Ne porte jamais d'information critique — toujours doublé d'un autre indicateur visuel.

### Échelle complète (12 steps, Radix-like)

Pour référence, voici la scale complète dérivée de B1 :

| Step | Hex | Sat | Usage type |
|------|-----|-----|------------|
| 1 | `#0b1113` | ~12% | bg-app |
| 2 | `#101719` | ~12% | bg-subtle |
| 3 | `#131d20` | ~14% | bg-surface |
| 4 | `#182428` | ~14% | surface-hover |
| 5 | `#1b272c` | ~14% | surface-active |
| 6 | `#243338` | ~15% | border-default |
| 7 | `#2e4048` | ~15% | border-hover |
| 8 | `#3a5058` | ~14% | — réservé — |
| 9 | `#456068` | ~14% | — ancien text-low, retiré — |
| 10 | `#6a8890` | ~13% | text-low (fixé v1.1) |
| 11 | `#8a9da3` | ~10% | text-mid |
| 12 | `#ebf0f1` | ~6% | text-high |

---

## Layer 2 — Accent (Tailwind Cyan)

**Inchangé.** Le B1 s'harmonise naturellement avec le Cyan car les deux partagent une famille de hue (~190-195° pour B1, ~188° pour Cyan).

### Scale

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

### Tokens fonctionnels

| Token | Valeur | Usage |
|-------|--------|-------|
| `--accent-default` | `--cyan-500` | État par défaut |
| `--accent-hover` | `--cyan-600` | Hover |
| `--accent-active` | `--cyan-700` | Pressed |
| `--accent-highlight` | `--cyan-400` | Hero number, notification dots |
| `--accent-subtle-bg` | `--cyan-950` @ 50% | Background teinté exceptionnel |
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

### Les 5 couleurs

| Slot | Hex | Source | Rôle |
|------|-----|--------|------|
| uColor1 | `#020617` | TW Slate-950 | Centre — ancre sombre profonde |
| uColor2 | `#0b1120` | Custom navy | Mid-dark — profondeur |
| uColor3 | `#1e293b` | TW Slate-800 | Mid-tone — relief subtil |
| uColor4 | `#06b6d4` | TW Cyan-500 | Accent lumineux — brand primary |
| uColor5 | `#22d3ee` | TW Cyan-400 | Highlight — point le plus lumineux |

### Implémentation animée (makegradient.com)

```html
<script src="https://makegradient.com/embed.js"></script>
<div
  data-lumina-gradient
  data-colors='["#020617","#0b1120","#1e293b","#06b6d4","#22d3ee"]'
  data-mode="mesh"
  data-noise="0.05"
  data-speed="1"
  style="width: 100%; height: 100%; position: absolute; inset: 0;"
></div>
```

### CSS fallback statique (sans JS)

```css
.mesh-gradient-fallback {
  background-color: #020617;
  background-image:
    radial-gradient(circle at 20% 20%, #0b1120 0%, transparent 55%),
    radial-gradient(circle at 70% 25%, #1e293b 0%, transparent 50%),
    radial-gradient(circle at 30% 75%, rgba(6, 182, 212, 0.25) 0%, transparent 50%),
    radial-gradient(circle at 80% 70%, rgba(34, 211, 238, 0.18) 0%, transparent 45%);
}
```

### WebGL uniforms (OGL)

```js
uColor1: new Vec3(0.008, 0.024, 0.090)  // #020617
uColor2: new Vec3(0.043, 0.067, 0.125)  // #0b1120
uColor3: new Vec3(0.118, 0.161, 0.231)  // #1e293b
uColor4: new Vec3(0.024, 0.714, 0.831)  // #06b6d4
uColor5: new Vec3(0.133, 0.827, 0.933)  // #22d3ee
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

### Type Scale — 7 niveaux

| Niveau | Size | Weight | Font | Line-height | Tracking | Cas d'usage |
|--------|------|--------|------|-------------|----------|-------------|
| **display** | 32px (2rem) | 900 | Mono | 1.0 | -0.02em | Hero stat (XP total, budget) |
| **stat** | 20px (1.25rem) | 800 | Mono | 1.1 | -0.01em | Stats secondaires, scores coureurs |
| **heading** | 15px (0.9375rem) | 700 | Sans | 1.3 | 0 | Noms coureurs, titres de sections |
| **body** | 14px (0.875rem) | 400 | Sans | 1.5 | 0 | Descriptions, texte courant |
| **caption** | 12px (0.75rem) | 500 | Sans | 1.4 | 0 | Texte secondaire, hints |
| **label** | 11px (0.6875rem) | 700 | Sans | 1.2 | 0.08em | Labels uppercase (TOTAL XP, SEASON) |
| **micro** | 9px (0.5625rem) | 600 | Sans | 1.2 | 0.06em | Badges, metadata extrême |

### Changements vs v0 (type system HTML)

| Élément | Avant (v0) | Après (v1) | Pourquoi |
|---------|------------|------------|----------|
| **display** | 36px/900 | **32px/900** | 36px trop imposant sur mobile 375px — écrase le contenu |
| **stat** | 22px/800 | **20px/800** | Proportionnel au display réduit |
| **heading** | 16px/700 | **15px/700** | "WattHunter" et section titles trop proéminents à 16px |
| **body** | 14px/400 | 14px/400 (= 0.875rem) | **Inchangé** — standard mobile |
| **Bottom nav** | 9px UC + tracking | **10px normal case/500** | UC trop agressif en bottom nav, normal case = plus clean et lisible |
| **Back button** | 14px/600 | **13px/500** | Trop grand, doit être discret (action secondaire) |

### Rem et base font-size

> **Convention : `html { font-size: 16px }` → 1rem = 16px.**
> Body text = 14px = 0.875rem. C'est un choix délibéré : sur mobile, 14px est le sweet spot (16px est trop grand pour une app data-dense).
> Quand on dit "body = 1rem" c'est une convention Tailwind/web (prose), pas une obligation. Pour une app, 0.875rem body est standard.

### Tokens sémantiques typographiques

| Token | Spec | Contexte |
|-------|------|----------|
| `--type-display` | 900 32px/1.0 Geist Mono | Hero stat unique |
| `--type-stat` | 800 20px/1.1 Geist Mono | Stats, scores, classements |
| `--type-stat-small` | 700 16px/1.2 Geist Mono | Stats inline, valeurs secondaires |
| `--type-heading` | 700 15px/1.3 Geist Sans | Section titles, rider names |
| `--type-heading-sm` | 600 13px/1.3 Geist Sans | Sub-headings, back button |
| `--type-body` | 400 14px/1.5 Geist Sans | Texte courant, descriptions |
| `--type-caption` | 500 12px/1.4 Geist Sans | Hints, texte secondaire |
| `--type-label` | 700 11px/1.2 Geist Sans | Labels uppercase + letter-spacing |
| `--type-micro` | 600 9px/1.2 Geist Sans | Badges, metadata |
| `--type-nav` | 500 10px/1.2 Geist Sans | Bottom navigation (normal case) |

### Règles typographiques

1. **UPPERCASE réservé aux labels structurels** : "TOTAL XP", "SEASON", "ROSTER", "PENDING BIDS". Jamais pour la bottom nav, jamais pour les boutons d'action.
2. **Geist Mono pour TOUT ce qui est numérique** : scores, positions, budgets, pourcentages, dates numériques, timer. Toujours avec `tabular-nums`.
3. **Hiérarchie par size + weight, pas par couleur** : en dark mode, on ne peut pas se reposer sur des variations de gris subtiles. La taille et le poids font le travail.
4. **Un seul display par écran** : comme le hero number en cyan, il n'y a qu'un seul élément en 32px/900 par vue.

---

## Application par composant

### Header / App Bar

| Élément | Token | Spec |
|---------|-------|------|
| Logo "WattHunter" | `--type-heading` | 15px/700, `--text-high` |
| Subtitle (ex: "Fantasy Cycling") | `--type-caption` | 12px/500, `--text-low` |
| Back button text | `--type-heading-sm` | 13px/500, `--text-mid` |
| Back arrow icon | — | 18px, `--text-mid` |

### Hero Stats

| Élément | Token | Spec |
|---------|-------|------|
| Hero number | `--type-display` | 32px/900 Mono, `--cyan-400` |
| Hero label | `--type-label` | 11px/700 UC, `--text-low` |
| Secondary stat value | `--type-stat` | 20px/800 Mono, `--text-high` |
| Secondary stat label | `--type-label` | 11px/700 UC, `--text-low` |

### Segmented Control / Tabs

| Élément | Token | Spec |
|---------|-------|------|
| Tab label (inactive) | `--type-caption` | 12px/500, `--text-mid` |
| Tab label (active) | `--type-caption` | 12px/600, `--text-high` |

### Lists (Roster, Bids, Results)

| Élément | Token | Spec |
|---------|-------|------|
| Section header | `--type-label` | 11px/700 UC + tracking, `--text-low` |
| Rider name | `--type-heading` | 15px/700, `--text-high` |
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

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-sm` | 6px | Tags, pills, badges |
| `--radius-md` | 10px | Buttons, inputs, segmented controls |
| `--radius-lg` | 14px | Cards, bottom sheets, modals |
| `--radius-full` | 9999px | Avatars, notification dots, toggle thumbs |

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

## Responsive (Desktop)

Pour le passage mobile → desktop, utiliser `clamp()` sur les niveaux display et stat :

```css
--type-display-size: clamp(32px, 4vw, 48px);
--type-stat-size: clamp(20px, 2.5vw, 28px);
--type-heading-size: clamp(15px, 1.8vw, 18px);
```

Les autres niveaux (body, caption, label, micro) restent fixes — ils sont déjà optimisés pour la lisibilité.

---

## Tokens CSS — Copier-coller

```css
:root {
  /* ── Layer 1: Neutral Teal-Tinted (B1) ── */
  --bg-app: #0b1113;
  --bg-subtle: #101719;
  --bg-surface: #131d20;
  --bg-surface-hover: #182428;
  --bg-surface-active: #1b272c;

  --border-subtle: #131d20;
  --border-default: #243338;
  --border-hover: #2e4048;

  --text-high: #ebf0f1;
  --text-mid: #8a9da3;
  --text-low: #6a8890;
  --text-ghost: #2e4048;

  /* ── Layer 2: Accent (Tailwind Cyan) ── */
  --cyan-950: #083344;
  --cyan-900: #164e63;
  --cyan-800: #155e75;
  --cyan-700: #0e7490;
  --cyan-600: #0891b2;
  --cyan-500: #06b6d4;
  --cyan-400: #22d3ee;
  --cyan-300: #67e8f9;

  --accent-default: var(--cyan-500);
  --accent-hover: var(--cyan-600);
  --accent-active: var(--cyan-700);
  --accent-highlight: var(--cyan-400);
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

  --type-display: 900 32px/1.0 var(--font-mono);
  --type-stat: 800 20px/1.1 var(--font-mono);
  --type-stat-small: 700 16px/1.2 var(--font-mono);
  --type-heading: 700 15px/1.3 var(--font-sans);
  --type-heading-sm: 600 13px/1.3 var(--font-sans);
  --type-body: 400 14px/1.5 var(--font-sans);
  --type-caption: 500 12px/1.4 var(--font-sans);
  --type-label: 700 11px/1.2 var(--font-sans);
  --type-micro: 600 9px/1.2 var(--font-sans);
  --type-nav: 500 10px/1.2 var(--font-sans);

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
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 14px;
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
  --mesh-color-1: #020617;
  --mesh-color-2: #0b1120;
  --mesh-color-3: #1e293b;
  --mesh-color-4: #06b6d4;
  --mesh-color-5: #22d3ee;
}
```

---

## Checklist de validation

Avant de valider un écran :

- [ ] Un seul hero number en `--cyan-400` par vue
- [ ] Un seul CTA gradient max par vue
- [ ] Un seul display (32px) max par vue
- [ ] Zéro couleur hors-système
- [ ] Tous les autres chiffres en `--text-high` + Geist Mono
- [ ] Labels structurels en uppercase + letter-spacing
- [ ] Bottom nav en normal case (pas UC)
- [ ] Cards utilisées uniquement pour modals, drag-and-drop, toasts, expandable
- [ ] Dividers en `--border-subtle`
- [ ] Focus rings visibles
- [ ] Couleurs sémantiques sur texte uniquement
- [ ] Contraste WCAG AA sur tous les textes (`--text-low` = AA depuis v1.1)
- [ ] Touch targets ≥ 44×44px sur tous les éléments interactifs
- [ ] Safe area insets sur bottom nav (`env(safe-area-inset-bottom)`)

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

- [ ] **Button** — primary (CTA gradient), secondary (outline), ghost, icon-only. 3 tailles.
- [ ] **Bottom Navigation** — 5 items, active state, badge notification, safe-area.
- [ ] **List Row** — rider row avec avatar, name, team, stat. States: default, pressed, swipe-to-action.
- [ ] **Input / Text Field** — default, focused, error, disabled. Avec label et helper text.

#### P1 — Important (bloque des écrans clés)

- [ ] **Segmented Control / Tabs** — 2-4 segments, active indicator, keyboard nav.
- [ ] **Hero Stat Block** — display number + label. Variante avec sous-stats.
- [ ] **Section Header** — label uppercase + optional action link.
- [ ] **Tag / Badge** — status (success/danger/warning), team color, size sm/md.
- [ ] **Avatar** — image, initials fallback, sizes 24/32/40/48, online indicator.
- [ ] **Progress Bar** — gradient cyan, determinate/indeterminate, avec label %.

#### P2 — Overlay & Feedback

- [ ] **Bottom Sheet / Modal** — header, content scroll, actions. Backdrop, drag-to-dismiss.
- [ ] **Toast / Notification** — success/error/info/warning. Auto-dismiss, action link.
- [ ] **Toggle / Switch** — on/off, disabled, avec label.
- [ ] **Tooltip** — texte court, position auto, trigger hover/long-press.
- [ ] **Skeleton / Loading** — placeholder pour chaque type de contenu (text, stat, row, avatar).

#### P3 — Spécifiques Fantasy Cycling

- [ ] **Rider Card** — photo, name, team, stats, bid button. Draggable.
- [ ] **Bid Row** — rider + montant + status (pending/won/lost).
- [ ] **Leaderboard Row** — rank + name + score. Highlight position changes (↑↓).
- [ ] **Stage Result Row** — rider + points + time. Collapsible detail.
- [ ] **Budget Indicator** — bar + montant restant. Warning states.

---

## Auto-critique & Points de discussion

### Ce qui fonctionne bien

1. **La parenté hue neutral/accent** : B1 (~195°) et Cyan (~188°) sont de la même famille, ça crée une cohésion chromatique naturelle.
2. **La séparation Mono/Sans** est claire et renforce l'identité "data app".
3. **Le système 7 niveaux + sous-tokens** couvre tous les cas sans bloat.

### Ce que je challengerais

1. ~~**`--text-low` à 3.5:1**~~ → **FIXÉ v1.1** : rehaussé à `#6a8890` (5.02:1 AA ✅).

2. **`--text-mid` à #8a9da3 (~7:1)** — c'est bien pour du body text, mais comparé à l'ancien Slate 11 (`#b0b4ba` à 9.2:1), on perd en lisibilité sur le texte secondaire. Option : monter à `#96aab0` (~8:1) pour retrouver du confort.

3. **Le display à 32px est-il encore trop gros ?** Sur un écran 375px, 32px/900 en mono prend ~40% de la largeur pour un nombre à 5 chiffres. Alternative : 28px qui reste imposant mais laisse plus de breathing room.

4. **Manque un token `--type-button`** explicite. Actuellement les boutons réutilisent `--type-body` (14px/600), mais un token dédié permettrait d'ajuster indépendamment si besoin.

5. **La scale responsive avec clamp()** est proposée mais pas testée. Sur desktop large (1440px+), le display à 48px max pourrait être trop gros. À valider avec des mockups desktop.

6. **Pas de token pour le segmented control actif** : actuellement c'est caption/600 mais le passage 500→600 est subtil. Alternative : caption/700 pour l'actif, ou un underline/bg accent.

### Questions ouvertes

1. **Veut-on un `--bg-elevated`** distinct de `--bg-surface` pour les bottom sheets et modals ? (Plus clair que surface, pour créer de la profondeur)
2. **Icon size tokens** : actuellement ad-hoc (18px, 20px). Faut-il formaliser une scale d'icônes (16/20/24) ?
3. ~~**Spacing scale**~~ → **FAIT v1.0** : documenté dans la section Spacing.

---

*WattHunter Design System v1.1 — 2026-03-07*
*Palette: B1 Teal Léger (~12% sat, ~195° hue) | Fonts: Geist Sans + Geist Mono*
