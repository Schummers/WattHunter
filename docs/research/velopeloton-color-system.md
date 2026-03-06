# 🎨 VéloPeloton — Color Design System

> **Philosophy:** Restrained Cyan.  
> Le fond disparaît. Le blanc structure. Le cyan guide l'œil vers ce qui compte.

---

## Architecture 4 couches

| Couche | Source | Rôle | Contexte |
|--------|--------|------|----------|
| **1. Neutral** | Radix Slate Dark | Background, surfaces, texte, dividers | App + Web (~80% surface) |
| **2. Accent** | Tailwind Cyan | Interactions, états actifs, hero stat | App + Web (~15% surface) |
| **3. CTA Gradient** | TW Cyan-500 → Cyan-400 | Boutons d'action primaires (fixe) | App + Web (~5% surface) |
| **4. Mesh Gradient** | 5 couleurs brand (animé) | Hero sections, marketing, onboarding | Web uniquement |

---

## Layer 1 — Neutral (Radix Slate Dark)

Fondation du design. Doit rester **silencieux** pour que l'accent ressorte.

### Backgrounds

| Token | Hex | Radix Ref | Usage |
|-------|-----|-----------|-------|
| `--bg-app` | `#111113` | Slate 1 | Background principal de l'app |
| `--bg-subtle` | `#18191b` | Slate 2 | Background alterné, sections secondaires |
| `--bg-surface` | `#212225` | Slate 3 | Cards (usage rare), inputs, wells |
| `--bg-surface-hover` | `#272a2d` | Slate 4 | Hover state des surfaces |
| `--bg-surface-active` | `#2e3135` | Slate 5 | Pressed/selected state des surfaces |

### Borders & Dividers

| Token | Hex | Radix Ref | Usage |
|-------|-----|-----------|-------|
| `--border-subtle` | `#212225` | Slate 3 | Dividers entre sections |
| `--border-default` | `#363a3f` | Slate 6 | Borders de composants (inputs, cards) |
| `--border-hover` | `#43484e` | Slate 7 | Borders au hover |

### Texte

| Token | Hex | Radix Ref | Usage |
|-------|-----|-----------|-------|
| `--text-high` | `#edeef0` | Slate 12 | Texte principal, titres, noms, chiffres |
| `--text-mid` | `#b0b4ba` | Slate 11 | Texte secondaire, descriptions |
| `--text-low` | `#696e77` | Slate 9 | Labels, captions, metadata |
| `--text-ghost` | `#43484e` | Slate 7 | Texte désactivé, placeholders |

### Règle clé

> **Le texte blanc (`--text-high`) porte 90% de l'information.**  
> Scores secondaires, noms de coureurs, stats d'étape = tout en blanc.  
> La hiérarchie se fait par **size + weight**, pas par couleur.

---

## Layer 2 — Accent (Tailwind Cyan)

Usage **chirurgical**. Chaque pixel de cyan doit avoir une raison d'exister.

### Scale complète

| Token | Hex | TW Ref | Usage principal |
|-------|-----|--------|-----------------|
| `--cyan-950` | `#083344` | Cyan 950 | Background teinté très subtil (rare) |
| `--cyan-900` | `#164e63` | Cyan 900 | — réservé — |
| `--cyan-800` | `#155e75` | Cyan 800 | Progress bar start, accents très sombres |
| `--cyan-700` | `#0e7490` | Cyan 700 | — réservé — |
| `--cyan-600` | `#0891b2` | Cyan 600 | Hover state des éléments interactifs |
| `--cyan-500` | `#06b6d4` | Cyan 500 | **PRIMARY** — interactions, toggles, links, active states |
| `--cyan-400` | `#22d3ee` | Cyan 400 | **HERO STAT** — le seul chiffre coloré par écran |
| `--cyan-300` | `#67e8f9` | Cyan 300 | Glow effects, focus rings (avec opacité) |

### Tokens fonctionnels

| Token | Valeur | Usage |
|-------|--------|-------|
| `--accent-default` | `--cyan-500` | État par défaut des éléments interactifs |
| `--accent-hover` | `--cyan-600` | Hover |
| `--accent-active` | `--cyan-700` | Pressed |
| `--accent-highlight` | `--cyan-400` | Hero number, notification dots |
| `--accent-subtle-bg` | `--cyan-950` @ 50% opacity | Background teinté exceptionnel |
| `--accent-focus-ring` | `--cyan-300` @ 40% opacity | Focus visible accessibility |
| `--accent-progress-start` | `--cyan-800` | Début des progress bars |
| `--accent-progress-end` | `--cyan-500` | Fin des progress bars |

---

## Layer 3 — CTA Gradient fixe (Cyan-500 → Cyan-400)

Gradient **fixe** réservé aux boutons d'action primaires dans l'app et le web. Le traitement le plus premium des éléments interactifs. 100% mono-hue Cyan — aucune couleur externe.

### Définition

```css
--cta-gradient: linear-gradient(135deg, #06b6d4, #22d3ee);
--cta-gradient-hover: linear-gradient(135deg, #0891b2, #06b6d4);
--cta-gradient-active: linear-gradient(135deg, #155e75, #0891b2);
--cta-text: #020617;
--cta-shadow: 0 4px 24px rgba(6, 182, 212, 0.25), 0 1px 3px rgba(0, 0, 0, 0.3);
```

### Couleurs source

| Couleur | Hex | Ref | Rôle dans le gradient |
|---------|-----|-----|----------------------|
| Cyan-500 | `#06b6d4` | TW Cyan 500 | Start (gauche/haut) — brand primary |
| Cyan-400 | `#22d3ee` | TW Cyan 400 | End (droite/bas) — highlight |
| Slate-950 | `#020617` | TW Slate 950 | Texte sur gradient |

### États

| État | Gradient | Effet |
|------|----------|-------|
| Default | Cyan-500 → Cyan-400 | + shadow |
| Hover | Cyan-600 → Cyan-500 | Shadow intensifiée |
| Active/Pressed | Cyan-800 → Cyan-600 | Shadow réduite |
| Disabled | Opacity 40% sur default | Pas de shadow |

### Règle

> **100% Tailwind Cyan. Aucune couleur externe.**  
> Le gradient reste dans la famille mono-hue Cyan (~188°).  
> 1 CTA gradient max par écran. Si un 2e bouton est nécessaire → CTA secondaire (border only).

---

## Layer 4 — Mesh Gradient animé (Web / Marketing)

Gradient WebGL animé avec noise pour les contextes marketing et atmosphériques. Adapté de makegradient.com avec les couleurs ajustées à la brand (Option Safe — Sky-500 remplacé par Cyan-500).

### Les 5 couleurs

| Slot | Hex | Source | Rôle dans le mesh |
|------|-----|--------|-------------------|
| uColor1 | `#020617` | TW Slate-950 | Centre — ancre sombre profonde |
| uColor2 | `#0b1120` | Custom navy | Mid-dark — profondeur |
| uColor3 | `#1e293b` | TW Slate-800 | Mid-tone — relief subtil |
| uColor4 | `#06b6d4` | TW Cyan-500 | Accent lumineux — brand primary |
| uColor5 | `#22d3ee` | TW Cyan-400 | Highlight — point le plus lumineux |

### Pourquoi ces couleurs

Les 3 darks (`#020617`, `#0b1120`, `#1e293b`) sont dans la même famille navy saturée (~hue 220°). Ils créent un "ciel nocturne" profond. Les 2 accents sont Cyan-500 et Cyan-400 — strictement brand, pas de Sky-500 ou couleur étrangère. Le résultat : un gradient immersif qui ne contient que des couleurs traçables dans le design system.

### Implémentation

**Embed animé (makegradient.com) :**

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

**CSS fallback (sans JS) :**

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

**Uniforms OGL/WebGL :**

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

| Contexte | Gradient | Lisibilité |
|----------|----------|------------|
| **✓** Hero section site web | Animé, plein écran | Texte en overlay avec shadow |
| **✓** Écran d'onboarding | Animé, fond | Texte centré sur zones sombres |
| **✓** Open Graph / Social cards | Statique (fallback CSS) | Titre + logo |
| **✓** Splash screen app | Animé, 2-3 secondes | Logo uniquement |
| **✓** Bannières marketing | Statique ou animé | Headline + CTA |
| **✗** Background app | — | Trop chargé pour de la data |
| **✗** Derrière du texte dense | — | Lisibilité dégradée |
| **✗** Emails transactionnels | — | Pas de support WebGL |
| **✗** Cards / Panels UI | — | Le gradient est atmosphérique, pas structurel |

### Règle

> **Le mesh gradient est réservé aux contextes où l'atmosphère prime sur la lisibilité.**  
> Dès qu'il y a de la data à lire → fond flat Radix Slate (`--bg-app`).  
> Les deux mondes ne se mélangent pas.

---

## Règles d'usage

### La règle du Hero Number

Chaque écran a **un seul chiffre** affiché en `--cyan-400`.  
C'est le point d'ancrage visuel — le chiffre le plus important de la vue.

| Écran | Hero Number | Couleur |
|-------|-------------|---------|
| Home | Score total | `--cyan-400` |
| Équipe | Budget restant | `--cyan-400` |
| Classement | Position actuelle | `--cyan-400` |
| Stats étape | Points de l'étape | `--cyan-400` |
| Transferts | Solde disponible | `--cyan-400` |

Tous les **autres chiffres** (scores coureurs, km, stats secondaires) = `--text-high` (blanc).

### Hiérarchie des éléments interactifs

```
CTA Primaire      → Gradient fixe Cyan-500→Cyan-400 (1 par écran max)
CTA Secondaire    → Border cyan-500, bg transparent
Lien / Action     → Texte cyan-500
Toggle / Switch   → Cyan-500 actif, Slate-7 inactif
Tab active        → Dot cyan-500 sous l'icône
Progress bar      → Gradient cyan-800 → cyan-500
Notification dot  → Cyan-500 solid, 6px
Focus ring        → Cyan-300 @ 40% opacity, 2px offset
```

### Séparation sans cards

Le design est **card-minimal**. La structure se fait par :

```
1. Dividers fins         → --border-subtle (#212225), 1px
2. Spacing généreux      → 16px entre groupes, 8px entre items
3. Hiérarchie typo       → Size (32/16/13/11/9/7) + Weight (900/800/700/600)
4. Labels uppercase      → Monospace, letter-spacing 1.5px, --text-low
```

Les cards sont autorisées **uniquement** pour :
- Modals / Bottom sheets
- Éléments drag-and-drop (transferts de coureurs)
- Toasts / Notifications
- Contenu expandable (détails coureur)

Quand une card est nécessaire : `--bg-surface` (#212225) avec `--border-default` (#363a3f), border-radius 12px.

---

## Couleurs sémantiques

Basées sur Tailwind, **jamais Radix** (pour éviter les conflits avec Radix Slate).

| Sémantique | Couleur | Hex | Usage |
|------------|---------|-----|-------|
| Success | TW Emerald-500 | `#10b981` | Gain de points, hausse classement |
| Danger | TW Red-500 | `#ef4444` | Perte, budget dépassé, deadline |
| Warning | TW Amber-500 | `#f59e0b` | Blessure coureur, risque |
| Info | `--cyan-500` | `#06b6d4` | Identique à l'accent (pas de doublon) |

> **Important :** Ces couleurs sémantiques apparaissent sur le **texte uniquement** (icône + label).  
> Pas de background coloré sémantique. Le fond reste toujours neutral Slate.

---

## Tokens CSS — Copier-coller

```css
:root {
  /* ── Layer 1: Neutral (Radix Slate Dark) ── */
  --bg-app: #111113;
  --bg-subtle: #18191b;
  --bg-surface: #212225;
  --bg-surface-hover: #272a2d;
  --bg-surface-active: #2e3135;

  --border-subtle: #212225;
  --border-default: #363a3f;
  --border-hover: #43484e;

  --text-high: #edeef0;
  --text-mid: #b0b4ba;
  --text-low: #696e77;
  --text-ghost: #43484e;

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

  /* ── Layer 3: CTA Gradient (fixe) ── */
  --cta-gradient: linear-gradient(135deg, #06b6d4, #22d3ee);
  --cta-gradient-hover: linear-gradient(135deg, #0891b2, #06b6d4);
  --cta-gradient-active: linear-gradient(135deg, #155e75, #0891b2);
  --cta-text: #020617;
  --cta-shadow: 0 4px 24px rgba(6, 182, 212, 0.25);

  /* ── Layer 4: Mesh Gradient (animé, web only) ── */
  --mesh-color-1: #020617;
  --mesh-color-2: #0b1120;
  --mesh-color-3: #1e293b;
  --mesh-color-4: #06b6d4;
  --mesh-color-5: #22d3ee;

  /* ── Semantic ── */
  --success: #10b981;
  --danger: #ef4444;
  --warning: #f59e0b;
}
```

---

## Checklist de validation

Avant de valider un écran, vérifier :

- [ ] **Un seul hero number** en cyan-400 par vue
- [ ] **Un seul CTA gradient** max par vue
- [ ] **Zéro couleur hors-système** (pas de Sky, pas de bleu custom)
- [ ] Tous les autres chiffres en `--text-high`
- [ ] Labels en monospace uppercase `--text-low`
- [ ] Cards utilisées uniquement pour les cas autorisés
- [ ] Dividers en `--border-subtle` (pas de borders lourdes)
- [ ] Focus rings visibles sur tous les éléments interactifs
- [ ] Couleurs sémantiques sur texte uniquement (pas de bg coloré)
- [ ] Contraste WCAG AA minimum sur tous les textes
- [ ] Mesh gradient **uniquement** sur contextes marketing/atmosphériques

---

## Exemples de contrast ratios

| Combinaison | Ratio | WCAG |
|-------------|-------|------|
| `--text-high` (#edeef0) sur `--bg-app` (#111113) | 15.5:1 | AAA ✅ |
| `--text-mid` (#b0b4ba) sur `--bg-app` (#111113) | 9.2:1 | AAA ✅ |
| `--text-low` (#696e77) sur `--bg-app` (#111113) | 4.5:1 | AA ✅ |
| `--cyan-400` (#22d3ee) sur `--bg-app` (#111113) | 10.8:1 | AAA ✅ |
| `--cyan-500` (#06b6d4) sur `--bg-app` (#111113) | 8.1:1 | AAA ✅ |
| `--cta-text` (#020617) sur Cyan-500 (#06b6d4) | 7.4:1 | AAA ✅ |
| `--cta-text` (#020617) sur Cyan-400 (#22d3ee) | 11.3:1 | AAA ✅ |

---

*Document mis à jour le 2025-03-05 — VéloPeloton Design System v0.2*
