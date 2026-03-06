# Guide exhaustif : design system mobile-first et dark-mode-first pour une Fantasy Cycling app

**Un design system dark-mode-first et mobile-first n'est pas un thème sombre ajouté à un système clair — c'est une architecture de tokens, de composants et de patterns conçue dès l'origine pour des écrans tenus à une main dans la pénombre.** Ce guide couvre la stack Next.js + TypeScript + Supabase + Vercel + shadcn/ui + Tailwind CSS v4, avec des valeurs concrètes, des choix tranchés et des sources vérifiées. Le contexte Fantasy Cycling impose des contraintes spécifiques : consommation majoritairement mobile et en soirée (suivi de courses en direct), interfaces denses en données (classements, statistiques, équipes), et une esthétique gaming qui favorise naturellement le dark mode. L'état de l'art 2025-2026 converge vers trois évolutions majeures : Tailwind v4 abandonne `tailwind.config.js` au profit d'une configuration CSS-first via `@theme`, shadcn/ui migre vers OKLCH (espace colorimétrique perceptuellement uniforme), et les viewport units dynamiques (`svh`, `dvh`) atteignent **93%** de support navigateur global.

---

## 1. Contexte et état de l'art des design systems en 2025-2026

L'écosystème des design systems a connu une transformation structurelle entre 2023 et 2026. Tailwind CSS v4, sorti début 2025, a remplacé la configuration JavaScript par une approche CSS-native via la directive `@theme`, avec des builds **5× plus rapides** et un HMR quasi-instantané. shadcn/ui, devenu le standard de facto pour les projets React/Next.js avec **108k+ étoiles GitHub**, a migré ses tokens de HSL vers **OKLCH** — un espace colorimétrique qui garantit une uniformité perceptuelle critique pour le dark mode. Radix UI supporte désormais à la fois ses propres primitives et Base UI comme couches headless.

Contrairement au consensus qui traite le dark mode comme une variation cosmétique, **le paradigme dark-mode-first exige d'inverser le processus de conception** : on définit d'abord les surfaces sombres, les contrastes sur fond noir, et les tokens d'élévation par luminosité — puis on dérive le thème clair. Cette approche élimine le problème classique où les couleurs d'accent « vibrent » sur fond sombre parce qu'elles ont été choisies pour un fond blanc.

Trois perspectives non évidentes émergent de cette recherche :

1. **`svh` est supérieur à `dvh` pour 90% des cas mobiles**, malgré le nom « dynamique » de ce dernier. `dvh` provoque des recalculs de layout constants et un effet « glitchy » lorsque la barre d'URL mobile apparaît/disparaît. `svh` garantit que le contenu tient toujours dans le viewport minimal.

2. **Le texte clair sur fond sombre paraît plus gras** qu'en mode clair à cause de l'effet de halation — environ **47% de la population** souffre d'astigmatisme qui amplifie ce phénomène. Il faut réduire le `font-weight` d'un cran en dark mode (ex. : passer de 400 à 350 en variable font) et utiliser du texte off-white (`#E0E0E0`) plutôt que du blanc pur.

3. **Les ombres sont fonctionnellement inutiles en dark mode.** Sur fond sombre, les box-shadows sont imperceptibles. Material Design 3 les a remplacées par des « tonal surfaces » : la hiérarchie visuelle se construit par la luminosité croissante des surfaces (plus élevé = plus clair), combinée à des bordures subtiles (`1px solid` avec des tokens `outlineVariant`).

---

## 2a. Responsive et patterns mobile-first

### Breakpoints : la configuration Tailwind v4

Tailwind v4 utilise des breakpoints **min-width** (mobile-first) définis en CSS via `@theme` avec des unités `rem` :

| Préfixe | Min-width | Pixels | Media query générée |
|---------|-----------|--------|---------------------|
| `sm` | 40rem | 640px | `@media (width >= 40rem)` |
| `md` | 48rem | 768px | `@media (width >= 48rem)` |
| `lg` | 64rem | 1024px | `@media (width >= 64rem)` |
| `xl` | 80rem | 1280px | `@media (width >= 80rem)` |
| `2xl` | 96rem | 1536px | `@media (width >= 96rem)` |

Les utilitaires sans préfixe s'appliquent à **toutes les tailles d'écran** ; les préfixés (`md:`) s'activent à partir du breakpoint et au-dessus. La personnalisation se fait en CSS pur — plus de fichier JS :

```css
@theme {
  --breakpoint-xs: 30rem;  /* 480px — petit mobile */
  --breakpoint-3xl: 120rem; /* ultra-wide */
}
```

**Contrainte critique** : les valeurs `--breakpoint-*` doivent être des littéraux (pas de `var()`). Pour une app Fantasy Cycling mobile-first, le code par défaut cible les écrans **< 640px** ; toute adaptation desktop se fait via `sm:` et au-dessus.

### Touch targets : le standard à respecter

| Standard | Taille minimale | Niveau |
|----------|----------------|--------|
| **WCAG 2.5.8** (AA) | **24×24** CSS px | Minimum absolu |
| **WCAG 2.5.5** (AAA) | **44×44** CSS px | Recommandé |
| **Apple HIG** | **44×44** pt | Requis iOS |
| **Material Design 3** | **48×48** dp | Recommandé Android |

**Recommandation tranchée : cibler 44×44px minimum pour tous les éléments interactifs**, avec un espacement de **8px** entre cibles adjacentes. Pour les boutons de l'app Fantasy Cycling (sélection de coureurs, actions de jeu), utiliser `min-h-11 min-w-11` (44px) comme classe de base. L'icône visuelle reste à 20-24px à l'intérieur d'un padding qui remplit la zone tactile : `<button className="p-3"><Icon className="h-5 w-5" /></button>`.

### Typographie fluide avec clamp()

La formule standard combine `rem` et `vw` pour respecter le zoom navigateur (exigence WCAG) :

```css
font-size: clamp(MIN_REM, calc(BASE_REM + FACTOR × 1vw), MAX_REM);
```

| Élément | Min | Max | Valeur clamp() recommandée |
|---------|-----|-----|---------------------------|
| Body | 16px (1rem) | 20px (1.25rem) | `clamp(1rem, 0.5vw + 0.8rem, 1.25rem)` |
| H1 | 32px (2rem) | 48px (3rem) | `clamp(2rem, 2.4rem + 1vw, 3rem)` |
| H2 | 24px (1.5rem) | 35px (2.2rem) | `clamp(1.5rem, 1.7rem + 0.5vw, 2.2rem)` |
| H3 | 20px (1.25rem) | 28px (1.75rem) | `clamp(1.25rem, 1rem + 0.5vw, 1.75rem)` |
| Caption | 12px (0.75rem) | 14px (0.875rem) | `clamp(0.75rem, 0.7rem + 0.1vw, 0.875rem)` |

**Piège courant** : utiliser uniquement `vw` dans la valeur préférée casse le zoom navigateur. Toujours combiner `vw + rem`. Tailwind v4 ne fournit pas d'utilitaires clamp() natifs — utiliser des valeurs arbitraires (`text-[clamp(...)]`) ou des variables CSS dans `@layer base`. L'outil Utopia (utopia.fyi) génère des échelles fluides complètes.

### Viewport mobile et safe areas

Pour résoudre le problème historique du `100vh` sur mobile (la barre d'URL cause un overflow) :

- **`100svh`** (Small Viewport Height) : le viewport quand la barre d'URL est visible. **Utiliser pour 90% des cas** — garantit que le contenu tient toujours.
- **`100dvh`** (Dynamic) : se met à jour en temps réel. Provoque des recalculs constants — **à éviter sauf cas spécifique**.
- **`100lvh`** (Large) : viewport sans barre d'URL. Réserver aux images de fond plein écran.
- **Support navigateur** : **93%** global (Chrome 108+, Safari 15.4+, Firefox 101+).

Pattern de fallback :
```css
.app-shell { height: 100vh; height: 100svh; }
```

Pour les encoches et indicateurs home (iPhone), utiliser `env()` avec le meta tag `viewport-fit=cover` :

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
```

```css
.bottom-nav {
  padding-bottom: max(16px, env(safe-area-inset-bottom));
}
```

Les valeurs typiques sont **~44px** pour `safe-area-inset-top` (encoche) et **~34px** pour `safe-area-inset-bottom` (indicateur home). Le support global de `env()` atteint **~97%**.

### Espacement et scroll

Tailwind v4 utilise une **base de 4px** (`--spacing: 0.25rem`), parfaitement alignée avec le grid system 4px/8px de Material Design. Les valeurs les plus utilisées en mobile (`p-2` = 8px, `p-4` = 16px, `p-6` = 24px) couvrent la majorité des besoins.

Pour le scroll mobile, trois propriétés CSS essentielles :

```css
body {
  overscroll-behavior-y: contain; /* Désactive pull-to-refresh natif */
}
.modal-content {
  overscroll-behavior: contain; /* Empêche le scroll chaining */
}
html {
  scroll-behavior: smooth;
}
@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
}
```

---

## 2b. Dark mode : architecture et bonnes pratiques

### Contrastes WCAG pour le dark mode

Les exigences sont **identiques** en light et dark mode — le WCAG ne fait aucune exception :

| Critère | Texte normal | Grand texte (≥24px) |
|---------|-------------|---------------------|
| **AA** (1.4.3) | **4.5:1** | **3:1** |
| **AAA** (1.4.6) | **7:1** | **4.5:1** |
| **Non-texte** (1.4.11) | **3:1** contre couleur adjacente | — |

**Erreur fréquente** : le gris `#777777` a un ratio de **4.47:1** contre blanc — il ne passe **pas** le seuil AA de 4.5:1 (pas d'arrondi). En dark mode, tester systématiquement les contrastes à chaque niveau d'élévation : quand la surface s'éclaircit, le contraste avec le texte foreground diminue.

### Système de surfaces et d'élévation

Material Design 3 a remplacé les ombres par des **surfaces tonales** pour le dark mode. Le fond de base est `#121212` ; chaque niveau d'élévation ajoute un overlay blanc semi-transparent :

| Élévation | Opacité overlay | Couleur résultante |
|-----------|----------------|-------------------|
| 0dp | 0% | `#121212` |
| 1dp | 5% | `#1E1E1E` |
| 2dp | 7% | `#222222` |
| 4dp | 9% | `#272727` |
| 8dp | 12% | `#2E2E2E` |
| 16dp | 15% | `#353535` |
| 24dp | 16% | `#383838` |

La formule logarithmique est : `alpha = ((4.5 × ln(elevation + 1)) + 2) / 100`. MD3 va plus loin en appliquant une **teinte tonale** dérivée de la couleur primaire (pas juste du blanc), créant une hiérarchie visuelle plus riche.

**Position tranchée** : pour une app gaming/sport, utiliser **3 niveaux de surface maximum** (base, raised, overlay) suivant le modèle Reshaped, plutôt que les 10+ niveaux de Material Design qui ajoutent une complexité inutile pour un MVP.

### Le débat noir pur vs gris foncé

**`#000000` contre `#121212`** : le consensus technique favorise le gris foncé, mais avec nuance. Le noir pur cause un effet de halation (texte qui « saigne » optiquement), surtout pour les ~47% de personnes astigmates. Cependant, Apple utilise le noir pur sur OLED pour économiser la batterie. **Recommandation** : utiliser `#121212` ou `oklch(0.145 0 0)` (valeur shadcn/ui) comme fond principal, et proposer un mode « AMOLED dark » optionnel avec `#000000` en v2.

### Palette de couleurs dark-mode-first

Pour les couleurs d'accent sur fond sombre : **désaturer et éclaircir**. Les couleurs vives du mode clair (gamme 500-700 du tonal palette) « vibrent » contre le noir. Utiliser la gamme **200-400** en dark mode.

| Rôle | Valeur light | Valeur dark | Format OKLCH |
|------|-------------|-------------|--------------|
| Background | `#FFFFFF` | `#121212` | `oklch(0.145 0 0)` |
| Foreground | `#1A1A1A` | `#E0E0E0` | `oklch(0.985 0 0)` |
| Primary | `#2563EB` (blue-600) | `#60A5FA` (blue-400) | Tonalité plus claire |
| Muted | `#F5F5F5` | `#272727` | `oklch(0.269 0 0)` |
| Border | `#E5E7EB` | `rgba(255,255,255,0.10)` | `oklch(1 0 0 / 10%)` |
| Texte medium | `#6B7280` | `#999999` | ~60% opacité blanc |
| Texte disabled | `#D1D5DB` | `#626262` | ~38% opacité blanc |

**Point critique pour Fantasy Cycling** : les couleurs de maillots d'équipes cyclistes (jaune, vert, pois) doivent être testées spécifiquement sur fond sombre. Le jaune Tour de France (`#FFD700`) passe bien en dark mode ; le vert sprint nécessite une désaturation.

### Prévention du FOUC et transitions

Le setup `next-themes` est le standard de facto pour Next.js :

```tsx
// app/layout.tsx
<html lang="fr" suppressHydrationWarning>
  <body>
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"  // dark-mode-first !
      enableSystem={true}
      disableTransitionOnChange={true}
    >
      {children}
    </ThemeProvider>
  </body>
</html>
```

`next-themes` injecte un **script bloquant** dans `<head>` qui lit `localStorage` et applique la classe `.dark` avant le premier rendu, éliminant tout flash. Le `defaultTheme="dark"` est crucial pour le paradigme dark-first : les nouveaux utilisateurs voient le dark mode par défaut.

Pour les images en dark mode, appliquer un filtre CSS léger :

```html
<img class="dark:brightness-90 dark:contrast-110" src="rider.jpg" />
```

---

## 2c. Architecture de tokens

### Trois niveaux d'abstraction

L'architecture de tokens à 3 niveaux est le standard industriel validé par Brad Frost, Material Design 3, Radix Themes et Reshaped :

**Niveau 1 — Tokens primitifs** (valeurs brutes, aucune sémantique) :
```css
@theme {
  --color-blue-50: oklch(97% 0.01 250);
  --color-blue-500: oklch(60% 0.16 250);
  --color-blue-900: oklch(20% 0.10 250);
  --color-neutral-900: oklch(15% 0 0);
  --color-yellow-400: oklch(90% 0.15 95); /* Maillot jaune */
  --color-green-500: oklch(65% 0.18 150); /* Sprint vert */
}
```

**Niveau 2 — Tokens sémantiques** (intention, commutent entre thèmes) :
```css
:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --primary: oklch(0.6 0.16 250);
  --primary-foreground: oklch(0.98 0 0);
  --surface-raised: oklch(0.98 0 0);
  --surface-overlay: oklch(0.96 0 0);
  --border: oklch(0.92 0 0);
  --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.556 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --success: oklch(0.65 0.18 150);
  --warning: oklch(0.84 0.16 84);
}
.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  --primary: oklch(0.72 0.14 250);
  --primary-foreground: oklch(0.12 0 0);
  --surface-raised: oklch(0.20 0 0);
  --surface-overlay: oklch(0.27 0 0);
  --border: oklch(1 0 0 / 10%);
  --muted: oklch(0.269 0 0);
  --muted-foreground: oklch(0.708 0 0);
  --destructive: oklch(0.704 0.191 22.216);
}
```

**Niveau 3 — Tokens composants** (optionnels, pour la customisation fine) :
```css
:root {
  --sidebar: var(--background);
  --sidebar-foreground: var(--foreground);
  --card-radius: calc(var(--radius) + 0.125rem);
  --rider-card-padding: var(--spacing-4);
  --leaderboard-row-height: 3rem;
}
```

**Avertissement** : le niveau 3 peut exploser en complexité (Tetrisly rapporte 500+ tokens pour un seul bouton). Pour un MVP, limiter le niveau 3 aux composants les plus critiques (sidebar, chart, rider-card).

### Intégration Tailwind v4 via @theme inline

Le pont entre les tokens sémantiques et Tailwind v4 se fait via `@theme inline` — le mot-clé `inline` indique à Tailwind de conserver les `var()` au runtime plutôt que de les résoudre au build :

```css
@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-destructive: var(--destructive);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-card: var(--card);
  --color-popover: var(--popover);
  --radius-sm: calc(var(--radius) - 0.125rem);
  --radius-md: calc(var(--radius));
  --radius-lg: calc(var(--radius) + 0.125rem);
  --radius-xl: calc(var(--radius) + 0.25rem);
}
```

Ce pattern est exactement celui utilisé par shadcn/ui dans sa migration Tailwind v4. Chaque `--color-*` génère automatiquement les classes utilitaires correspondantes (`bg-primary`, `text-muted-foreground`, `border-border`).

### Pourquoi OKLCH plutôt que HSL

shadcn/ui a migré de HSL vers **OKLCH** pour une raison technique importante : HSL n'est pas perceptuellement uniforme. Deux couleurs HSL avec la même lightness (ex. `hsl(0, 100%, 50%)` rouge et `hsl(240, 100%, 50%)` bleu) n'ont **pas** la même luminosité perçue. OKLCH corrige cela — la composante L (lightness) correspond à la perception humaine réelle. Cela permet de **garantir des contrastes cohérents** entre toutes les couleurs d'accent sans ajustement manuel, ce qui est critique pour un système dark-mode-first où les contrastes sont plus délicats.

### Nommage : comparaison des approches

| Système | Pattern | Exemple | Verdict |
|---------|---------|---------|---------|
| **shadcn/ui** | Flat sémantique | `--primary`, `--border` | ✅ Simple, suffisant pour MVP |
| **Radix** | Scale numérotée | `--blue-9`, `--gray-3` | ✅ Précis, apprentissage requis |
| **Park UI** | Catégorisé | `bg-canvas`, `fg-muted` | ✅ Clair, un peu verbeux |
| **Reshaped** | Role-name-modifier | `--color-background-primary-faded` | ✅ Le plus extensible |
| **Brad Frost** | Hiérarchique | `theme-color-primary-bg` | ⚠️ Trop long |

**Recommandation** : adopter la convention shadcn/ui pour le MVP (compatibilité directe avec l'écosystème), puis étendre avec le pattern Reshaped (`role-name-modifier`) pour les tokens spécifiques au domaine Fantasy Cycling (`--color-foreground-jersey-yellow`, `--color-background-stage-mountain`).

---

## 2d. Composants et icônes

### Inventaire shadcn/ui et gaps pour mobile

shadcn/ui fournit **~59 composants** en mars 2026. Parmi eux, **~32 sont pleinement mobile-friendly**, **~15 nécessitent des ajustements** (touch targets, positionnement), et **~12 sont desktop-only** (Context Menu, Hover Card, Menubar, Navigation Menu, Resizable, Tooltip, Kbd).

Les composants déjà intégrés et critiques pour le mobile :

- **Drawer** (via Vaul) : bottom sheet natif avec swipe-to-dismiss — parfait pour les fiches coureurs
- **Sonner** : toasts configurables en position — utiliser `position="top-center"` pour ne pas chevaucher la navigation bottom
- **Carousel** (via Embla) : swipe natif pour les étapes de course
- **Sheet** : panneau latéral pour la navigation mobile
- **Skeleton** / **Spinner** : états de chargement

**Gaps critiques pour Fantasy Cycling** :

| Besoin | Solution recommandée |
|--------|---------------------|
| Bottom tab navigation | Custom avec shadcn `Tabs` + `fixed bottom-0` + `pb-[env(safe-area-inset-bottom)]` |
| Pull-to-refresh | Custom CSS `overscroll-behavior: none` + handler JS |
| Swipeable cards | `react-swipeable` (hooks-based) |
| Listes virtualisées (classements) | `@tanstack/react-virtual` |
| Drag-and-drop (team builder) | `@dnd-kit/core` |
| Animations (scores, transitions) | `framer-motion` |
| Picker date (calendrier de courses) | shadcn Calendar avec touch targets élargis |

Les composants **spécifiques au domaine** (Rider Card, Leaderboard Row, Stats Card, Team Roster, Stage Profile, Points Counter, Live Ticker) doivent être construits en assemblant les primitives shadcn/ui (Card, Avatar, Badge, Progress, Table, Tabs).

### Comparaison des bibliothèques d'icônes

| Critère | Lucide | Phosphor | Tabler | Heroicons | Radix Icons |
|---------|--------|----------|--------|-----------|-------------|
| **Icônes** | ~1 600 | ~9 000 (6 poids) | ~6 038 | ~1 264 (4 styles) | ~332 |
| **Styles** | 1 (stroke) | 6 (thin→duotone) | 2 (outline+filled) | 4 (outline/solid/mini/micro) | 1 |
| **Grille** | 24×24 | 24×24 | 24×24 | 24/20/16 | 15×15 |
| **Bundle (100 icônes)** | **8.58 KB** | 48.68 KB | ~10 KB | 9.23 KB | 63.37 KB |
| **Tree-shaking** | ✅ Excellent | ✅ Bon | ✅ Excellent | ✅ Excellent | ❌ Mauvais |
| **npm/semaine** | **~29.4M** | ~100K | ~1-2M | ~2.0M | ~2.6M |
| **Default shadcn/ui** | ✅ **Oui** | Non | Non | Non | Partiel |
| **Dark mode** | ✅ currentColor | ✅✅ duotone ! | ✅ currentColor | ✅ currentColor | ✅ currentColor |

**Recommandation tranchée : Lucide comme bibliothèque principale + Phosphor en complément pour le style gaming/sport.** Lucide est le choix naturel (intégration native shadcn/ui, **meilleur ratio bundle/icône**, 29M downloads/semaine). Mais Phosphor apporte une capacité unique avec son style **duotone** — la couche secondaire semi-transparente crée une profondeur visuelle excellente contre les fonds sombres, idéale pour les trophées, médailles, classements, et éléments de gamification.

**Stratégie d'icônes en dark mode** : utiliser le style outline (Lucide, `strokeWidth={1.5}`) pour la navigation et les actions secondaires, et le style filled/duotone (Phosphor) pour les états actifs, les récompenses et les points forts. C'est la convention mobile iOS/Android : icône outline = inactif, filled = actif.

Pour l'optimisation Phosphor avec Next.js :
```js
// next.config.js
module.exports = {
  experimental: {
    optimizePackageImports: ["@phosphor-icons/react"],
  },
};
```

---

## 3. Checklist design system exhaustive

| Élément | Description | Valeur recommandée | Priorité |
|---------|-------------|-------------------|----------|
| **Palette de couleurs primitives** | Échelle tonale complète par teinte | 12 steps OKLCH par couleur (modèle Radix) | MVP |
| **Tokens sémantiques light** | background, foreground, primary, secondary, muted, accent, destructive, border, ring, input | Valeurs OKLCH shadcn/ui par défaut | MVP |
| **Tokens sémantiques dark** | Idem, valeurs dark | `--background: oklch(0.145 0 0)`, `--foreground: oklch(0.985 0 0)` | MVP |
| **Tokens de surface (élévation)** | base, raised, overlay | 3 niveaux : `#121212`, `#1E1E1E`, `#272727` | MVP |
| **Couleurs d'accent Fantasy** | Jaune maillot, vert sprint, pois montagne, rouge | Désaturées pour dark mode (gamme 200-400) | MVP |
| **Tokens success/warning/info** | États de feedback | OKLCH avec variants dark | MVP |
| **Tokens chart (1-5)** | Couleurs pour graphiques de performance | 5 couleurs distinctes en dark | MVP |
| **Typographie — font family** | Sans-serif principale + mono | Geist Sans + Geist Mono (Vercel) | MVP |
| **Typographie — échelle fluide** | Tailles h1-h6, body, caption | `clamp()` avec min/max en rem+vw | MVP |
| **Typographie — line-height** | Hauteur de ligne par taille | 1.5 (body), 1.2 (headings), 1.4 (caption) | MVP |
| **Typographie — font-weight dark** | Ajustement poids dark mode | Réduire d'un cran (400→350 variable) | v2 |
| **Spacing scale** | Échelle d'espacement | Base 4px Tailwind : 4, 8, 12, 16, 24, 32, 48, 64px | MVP |
| **Border-radius** | Rayon d'arrondi | `--radius: 0.625rem` (10px), sm/md/lg/xl dérivés | MVP |
| **Shadows (light mode)** | Ombres portées | 3-4 niveaux (sm, md, lg, xl) | MVP |
| **Borders (dark mode)** | Remplacement des ombres | `1px solid oklch(1 0 0 / 10%)` | MVP |
| **Z-index scale** | Empilement | `dropdown:50, sticky:100, modal:200, toast:300, tooltip:400` | MVP |
| **Breakpoints** | Points de rupture responsive | sm:640, md:768, lg:1024, xl:1280, 2xl:1536px | MVP |
| **Touch target minimum** | Zone tactile interactive | **44×44px** min, 48×48px idéal | MVP |
| **Safe areas** | Encoches et barres système | `env(safe-area-inset-*)` avec `viewport-fit=cover` | MVP |
| **Viewport height** | Hauteur plein écran mobile | `100svh` avec fallback `100vh` | MVP |
| **Scroll behavior** | Comportement de défilement | `overscroll-behavior-y: contain` | MVP |
| **Icônes — bibliothèque principale** | Iconographie UI | Lucide Icons (`strokeWidth={1.5}` en dark) | MVP |
| **Icônes — complément gaming** | Icônes trophées/sport | Phosphor Icons (poids duotone) | MVP |
| **Taille d'icônes** | Échelle | 16px (inline), 20px (UI), 24px (navigation), 32px (feature) | MVP |
| **Button** | Bouton principal | shadcn/ui ✅ suffisant + variants custom | MVP |
| **Card** | Carte (rider card, stats) | shadcn/ui ✅ base + custom styling | MVP |
| **Drawer (bottom sheet)** | Fiche détail mobile | shadcn/ui ✅ via Vaul | MVP |
| **Tabs** | Navigation par onglets | shadcn/ui ✅ + custom bottom nav | MVP |
| **Avatar** | Photo de coureur | shadcn/ui ✅ suffisant | MVP |
| **Badge** | Indicateur (rang, points) | shadcn/ui ✅ suffisant | MVP |
| **Skeleton** | État de chargement | shadcn/ui ✅ suffisant | MVP |
| **Sonner (toast)** | Notifications | shadcn/ui ✅ `position="top-center"` | MVP |
| **Dialog** | Modales de confirmation | shadcn/ui ✅ suffisant | MVP |
| **Progress** | Barre de progression | shadcn/ui ✅ suffisant | MVP |
| **Table** | Classements | shadcn/ui + `@tanstack/react-virtual` | MVP |
| **Select / Native Select** | Sélecteurs mobiles | shadcn/ui Native Select ✅ pour mobile | MVP |
| **Input / Textarea** | Champs de formulaire | shadcn/ui ✅ suffisant | MVP |
| **Switch** | Toggle paramètres | shadcn/ui ✅ suffisant | MVP |
| **Carousel** | Étapes de course | shadcn/ui ✅ via Embla | MVP |
| **Bottom navigation** | Tab bar fixe | Custom (shadcn Tabs + fixed positioning) | MVP |
| **Motion/Animation tokens** | Durées et easings | `--duration-fast: 150ms`, `--duration-normal: 250ms`, `--ease-out: cubic-bezier(0.16, 1, 0.3, 1)` | v2 |
| **Transitions de thème** | Switch light/dark | `next-themes` + `disableTransitionOnChange` | v2 |
| **États interactifs** | hover, active, focus, disabled | Focus ring visible en dark mode, `ring-2 ring-ring` | MVP |
| **Focus indicators dark** | Indicateurs de focus | Tester spécifiquement — souvent invisibles en dark | MVP |
| **Empty states** | États vides | shadcn/ui `Empty` component (oct 2025) | v2 |
| **Error states** | États d'erreur | Pattern color + icône (pas couleur seule) | MVP |
| **Pull-to-refresh** | Rafraîchir en tirant | Custom + `overscroll-behavior` | v2 |
| **Swipe actions** | Gestes de balayage | `react-swipeable` | v2 |
| **Grid/Layout system** | Grille responsive | CSS Grid + Tailwind `grid-cols-*` responsive | MVP |
| **Images responsive** | Optimisation images | `next/image` avec AVIF+WebP, `sizes` attr | MVP |
| **Dark mode image filter** | Adaptation images | `dark:brightness-90 dark:contrast-110` | v2 |
| **Drag-and-drop** | Team builder | `@dnd-kit/core` | v2 |
| **Listes virtualisées** | Grands classements | `@tanstack/react-virtual` | v2 |
| **Countdown/Timer** | Compte à rebours course | Custom component | v2 |
| **Live ticker** | Score en direct | Custom + Supabase Realtime | v2 |
| **Accessibility audit** | Test a11y complet | axe-core, lighthouse, test clavier dark mode | v2 |
| **AMOLED dark option** | Fond noir pur OLED | `#000000` background option | Nice-to-have |
| **Haptic feedback** | Retour haptique | `navigator.vibrate()` pour actions gaming | Nice-to-have |
| **Reduced motion** | Préférence mouvement | `prefers-reduced-motion: reduce` | v2 |
| **RTL support** | Langues RTL | shadcn/ui `Direction` component (jan 2026) | Nice-to-have |

---

## 4. Études de cas : design systems analysés

### Radix Themes — La référence pour les color scales

Radix Themes propose le système de couleurs le plus rigoureux de l'écosystème React. Son **échelle à 12 paliers** où chaque step a un usage sémantique précis (step 1 = fond app, step 9 = surfaces solides à chroma maximale, step 12 = texte à fort contraste) est un modèle conceptuel puissant. Les variantes alpha (`--blue-a5`) permettent des overlays naturels. Le support P3 gamut et l'algorithme APCA pour le contraste placent Radix en avance sur WCAG 2.x.

**Forces** : meilleur système de couleurs du marché, accessibilité WAI-ARIA exemplaire, runtime theme customization via `<ThemePanel>`, support dark mode natif par classe CSS. **Faiblesses majeures** : l'intégration Tailwind est officiellement décrite comme « may not mix well » par les mainteneurs eux-mêmes. Les composants sont un « système fermé » difficile à overrider stylistiquement. Non mobile-first.

**Ce qu'on adopte** : le concept d'échelle 12 paliers avec usage sémantique par step, le système de variantes alpha, l'approche class-based pour le dark mode. **Ce qu'on évite** : le système de composants fermé — on préfère la composabilité ouverte de shadcn/ui.

### Geist (Vercel) — L'esthétique référence

Le design system interne de Vercel est remarquable par sa qualité visuelle et sa cohérence. La police **Geist Sans** (variable weight 100-900) est spécifiquement conçue pour les interfaces UI et disponible gratuitement sur Google Fonts — c'est la font par défaut de `create-next-app`. Le système supporte trois modes (system/light/dark) et utilise des effets de « Materials » (translucidité/vibrancy).

**Forces** : esthétique impeccable, ~55+ composants, intégration parfaite Next.js, police dédiée. **Faiblesses** : pas open-source en tant que système complet, pas de spécification formelle de tokens (les valeurs sont embedded dans les composants), pas mobile-first.

**Ce qu'on adopte** : la police Geist Sans + Geist Mono comme typographie du design system, le pattern three-mode (system/light/dark), l'esthétique high-contrast.

### Park UI — Le challenger multi-framework

Park UI apporte une proposition intéressante : un modèle copy-paste similaire à shadcn/ui mais construit sur Ark UI (Chakra team) et supportant React, Vue, Solid et Svelte. Son système de tokens sémantiques (`fg.disabled`, `bg.emphasized`, `border.muted`) avec valeurs `base`/`_dark` inline est élégant.

**Forces** : multi-framework, styling via « recipes » éditables, CLI d'installation, tokens Radix Colors-inspired. **Faiblesses** : communauté plus petite que shadcn, documentation critiquée (2.5/5 selon certains utilisateurs), la double piste Panda CSS / Tailwind crée de la confusion.

**Ce qu'on adopte** : le pattern de nommage `bg-*`, `fg-*`, `border-*` pour les tokens sémantiques, le concept de recipes éditables. **Ce qu'on évite** : Panda CSS — on reste full Tailwind.

### Reshaped — L'architecture de tokens la plus propre

Salué par Luis Ouriach (Figma) comme le « gold standard of just enough design system », Reshaped propose la meilleure architecture de tokens des quatre systèmes analysés. Le pattern `--rs-color-{role}-{name}-{modifier}` (ex. `--rs-color-background-primary-faded`) est clair, extensible et scalable. Les tokens `on-background-*` auto-calculés pour le contraste accessible sont une innovation notable. Le modèle d'élévation à 3 niveaux (`base`, `raised`, `overlay`) avec des valeurs différentes en dark mode est exactement ce dont une app mobile a besoin.

**Forces** : meilleure architecture de tokens, dark mode automatique via `hex`/`hexDark`, auto-contraste APCA, responsive props sur composants, intégration Tailwind en une ligne, parité Figma-React à 100%. **Faiblesses** : React-only, pas totalement open-source (tier « Plus »), communauté limitée.

**Ce qu'on adopte** : le pattern de nommage `role-name-modifier`, le modèle d'élévation 3 niveaux, les tokens statiques (noir/blanc qui ne changent pas entre modes), le concept de tokens `on-background` auto-calculés.

---

## 5. Plan d'action MVP : 15 étapes ordonnées

| # | Action | Effort estimé | Dépendances |
|---|--------|---------------|-------------|
| 1 | **Configurer Tailwind v4 CSS-first** avec `@theme`, `@custom-variant dark`, `@theme inline` | 2h | — |
| 2 | **Définir les tokens primitifs** : palette OKLCH complète (neutral, blue/primary, yellow/jersey, green/sprint, red/destructive) — 12 steps par couleur | 4h | #1 |
| 3 | **Définir les tokens sémantiques light + dark** : background, foreground, primary, secondary, muted, accent, destructive, border, ring, surface-raised, surface-overlay | 3h | #2 |
| 4 | **Installer next-themes** avec `defaultTheme="dark"`, `attribute="class"`, `disableTransitionOnChange` | 1h | #1 |
| 5 | **Configurer la typographie** : installer Geist Sans/Mono, définir l'échelle fluide avec `clamp()` (body, h1-h4, caption) | 3h | #1 |
| 6 | **Configurer le viewport mobile** : meta tag `viewport-fit=cover`, `100svh` app shell, `env(safe-area-inset-*)` sur header/footer | 2h | — |
| 7 | **Installer shadcn/ui** (init + composants core) : Button, Card, Avatar, Badge, Drawer, Tabs, Dialog, Input, Select, Progress, Skeleton, Sonner, Switch, Carousel | 3h | #3 |
| 8 | **Créer le layout AppShell mobile** : header fixe + main scrollable + bottom tab navigation avec safe areas | 4h | #6, #7 |
| 9 | **Installer Lucide + Phosphor** et définir les conventions d'usage (taille 20px UI, 24px nav, stroke 1.5 dark) | 1h | — |
| 10 | **Créer les composants domain** : RiderCard, StatsCard, LeaderboardRow (composés depuis shadcn/ui primitives) | 8h | #7, #9 |
| 11 | **Configurer next/image** : formats AVIF+WebP, `deviceSizes`, `quality={75}`, pattern responsive avec `sizes` | 2h | — |
| 12 | **Définir les états interactifs** : focus ring visible en dark, hover states, disabled states, loading states | 3h | #3, #7 |
| 13 | **Configurer scroll behavior** : `overscroll-behavior-y: contain`, `scroll-smooth` avec `prefers-reduced-motion` | 1h | — |
| 14 | **Tester les contrastes** : vérifier WCAG AA (4.5:1) pour tous les tokens text/surface en dark ET light | 3h | #3 |
| 15 | **Documenter le design system** : fichier `DESIGN_SYSTEM.md` avec conventions, tokens, composants, patterns | 4h | #1-14 |

**Effort total estimé : ~44 heures** (environ 1 semaine et demie pour un développeur senior).

---

## 6. Conclusions et recommandations

**Sur la stack** : shadcn/ui + Tailwind v4 + next-themes est le trio gagnant en 2026 pour ce type de projet. shadcn/ui fournit ~60% des composants nécessaires au MVP avec une qualité d'accessibilité et de dark mode intégrée. Tailwind v4 avec sa configuration CSS-first et `@theme inline` simplifie drastiquement l'intégration de tokens dynamiques. Pas besoin de Radix Themes en parallèle — ses composants « fermés » entrent en conflit avec Tailwind et n'apportent pas assez de valeur supplémentaire versus shadcn/ui qui est déjà construit sur les primitives Radix.

**Sur le dark mode** : commencer dark-first est un choix technique, pas cosmétique. Cela signifie que les tokens sont conçus pour le dark, les screenshots de documentation sont en dark, les tests de contraste priorisent le dark. Le fond `oklch(0.145 0 0)` (~`#1F1F1F`) de shadcn/ui est un bon défaut. **Rejeter le noir pur pour le MVP** (sauf mode AMOLED optionnel en v2). Remplacer les ombres par des bordures `oklch(1 0 0 / 10%)` et 3 niveaux de surface tonale.

**Sur la typographie** : Geist Sans est le choix optimal — gratuit, variable, conçu pour les interfaces, maintenu par Vercel (cohérence écosystème). La typographie fluide avec `clamp()` élimine le besoin de breakpoints typographiques distincts et offre une expérience plus naturelle du mobile au desktop.

**Sur les icônes** : Lucide comme base (bundle minimal, intégration shadcn/ui native) complété par Phosphor en mode duotone pour les éléments de gamification. Malgré les attentes, les Heroicons (créés par Tailwind Labs) ne sont **pas** le meilleur choix ici : avec seulement 316 icônes de base, le catalogue est trop limité pour une app gaming/sport riche.

**Sur l'architecture de tokens** : l'approche hybride shadcn/ui (niveau 2) + extensions Reshaped-style (nommage `role-name-modifier`) offre le meilleur compromis entre compatibilité écosystème et extensibilité. OKLCH est le bon choix de format — la migration depuis HSL est un one-way door vers une meilleure cohérence perceptuelle.

**Sur le mobile-first** : le piège le plus courant n'est pas technique mais organisationnel — les développeurs testent sur desktop d'abord et adaptent ensuite. **Imposer Chrome DevTools en mode responsive par défaut** (iPhone SE 375px) pendant tout le développement. Chaque composant doit d'abord fonctionner à 375px de large avec des touch targets de 44px avant toute adaptation desktop.

**Contre-argument anticipé** : « Un design system complet est du sur-engineering pour un MVP ». La réponse est que les éléments listés en priorité MVP dans ce guide (tokens sémantiques, 3 surfaces d'élévation, typographie fluide, composants shadcn/ui de base) représentent ~44h de travail total. Le coût de refactoring sans ces fondations serait **3-5× supérieur** dès le passage en production. Un design system minimal mais rigoureux n'est pas du luxe — c'est de la dette technique évitée.