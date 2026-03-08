# WattHunter Icons — V5 Tall & Slim

## Integration HTML (`<head>`)

```html
<!-- Favicon -->
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" href="/icons/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/icons/favicon-16x16.png" sizes="16x16" type="image/png">
<link rel="icon" href="/icons/favicon-32x32.png" sizes="32x32" type="image/png">

<!-- Apple Touch Icon -->
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">

<!-- PWA Manifest -->
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#06b6d4">
```

## Fichiers inclus

| Fichier | Taille | Usage |
|---------|--------|-------|
| `watthunter-logo.svg` | Vectoriel | Master — export, print, OG images |
| `favicon.svg` | Vectoriel | Favicon SVG (modern browsers) |
| `favicon.ico` | 16+32+48 | Favicon legacy (tous browsers) |
| `favicon-16x16.png` | 16×16 | Tab browser |
| `favicon-32x32.png` | 32×32 | Tab browser retina |
| `icon-48x48.png` | 48×48 | Windows pin |
| `icon-64x64.png` | 64×64 | Bookmarks |
| `icon-96x96.png` | 96×96 | Google TV, shortcuts |
| `icon-128x128.png` | 128×128 | Chrome Web Store |
| `apple-touch-icon.png` | 180×180 | iOS home screen |
| `icon-192x192.png` | 192×192 | Android home (PWA) |
| `icon-256x256.png` | 256×256 | Medium displays |
| `icon-384x384.png` | 384×384 | Large displays |
| `icon-512x512.png` | 512×512 | Splash screen (PWA) |
| `maskable-icon-512x512.png` | 512×512 | PWA maskable (with safe zone) |
| `site.webmanifest` | — | PWA manifest prêt à l'emploi |

## Next.js App Router

Place les fichiers dans `public/icons/` et le manifest dans `public/`.

## Couleurs brand utilisées

- Top: `#22d3ee` (Cyan-400)
- Bottom gradient: `#0891b2` → `#06b6d4` (Cyan-600 → Cyan-500)
- Overlay: noir 20% opacity
- Theme color: `#06b6d4` (Cyan-500)
- Background maskable: `#111113` (bg-app)
