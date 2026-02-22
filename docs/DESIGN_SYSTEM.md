# WattHunter — Design System

> **Document vivant** — Reference pour toute creation UI.
> Toute nouvelle page ou composant doit respecter ces regles.
> Derniere mise a jour : 2026-02-22

---

## Philosophie

- **Dark-first** — Le mode sombre est le mode principal (`<html className="dark">`)
- **Inspire de Linear** — Minimal, dense, professionnel. Pas de decoration superflue
- **Pas de nested cards** — Utiliser des separateurs (`h-px bg-border`) pour structurer
- **Densite informationnelle** — Compact mais lisible, pas de padding excessif

---

## Couleurs

### Palette Zinc (base)

| Role | Light | Dark | Tailwind |
|------|-------|------|----------|
| Background | Zinc 50 `#fafafa` | Zinc 950 `#09090b` | `bg-background` |
| Surface | White `#ffffff` | Zinc 900 `#18181b` | `bg-wh-surface` |
| Border | Zinc 200 `#e4e4e7` | Zinc 800 `#27272a` | `border-border` |
| Text primary | Zinc 950 `#09090b` | Zinc 50 `#fafafa` | `text-foreground` |
| Text secondary | Zinc 500 `#71717a` | Zinc 400 `#a1a1aa` | `text-muted-foreground` |
| Muted surface | Zinc 100 `#f4f4f5` | Zinc 800 `#27272a` | `bg-muted` |

### Accent

| Token | Valeur | Usage |
|-------|--------|-------|
| `--accent` | `#34F6F2` | Liens, selections, bouton brand, icones actives |
| `--wh-accent-muted` | `rgba(52, 246, 242, 0.15)` | Background des elements actifs (sidebar, badges) |
| `--ring` | `#34F6F2` | Focus ring sur les inputs et boutons |

L'accent est identique en light et dark. Il est assez lumineux pour contraster sur Zinc 950.

### Destructive

| Mode | Valeur | Usage |
|------|--------|-------|
| Light | Red 500 `#ef4444` | Erreurs, suppressions |
| Dark | Red 400 `#f87171` | Erreurs, suppressions |

### Charts

| Chart | Couleur | Hex |
|-------|---------|-----|
| 1 (principal) | Accent | `#34F6F2` |
| 2 | Cyan | `#06b6d4` |
| 3 | Sky | `#0ea5e9` |
| 4 | Violet | `#8b5cf6` |
| 5 | Amber | `#f59e0b` |

---

## Typographie

### Police

**Inter** via `@fontsource-variable/inter` — sans-serif variable.

```css
--font-sans: "Inter Variable", ui-sans-serif, system-ui, sans-serif;
```

### Echelle

| Usage | Class Tailwind | Poids |
|-------|---------------|-------|
| Titre page | `text-xl font-semibold` | 600 |
| Titre section | `text-lg font-semibold` | 600 |
| Label de champ | `text-sm font-medium` | 500 |
| Corps de texte | `text-sm` | 400 |
| Caption / meta | `text-xs` | 400 |
| Code / monospace | `text-lg font-semibold tracking-widest` | 600 |

### Couleurs de texte

| Usage | Class |
|-------|-------|
| Titre / contenu principal | `text-foreground` |
| Description / secondaire | `text-muted-foreground` |
| Lien / accent | `text-accent` |
| Erreur | `text-destructive` |

---

## Espacement

### Grille 8px

Unite de base : **8px** (`0.5rem` = Tailwind `2`).

| Espace | Tailwind | Pixels | Usage |
|--------|----------|--------|-------|
| Micro | `gap-1`, `p-1` | 4px | Uniquement micro-ajustements (icone + texte dans un badge) |
| Base | `gap-2`, `p-2` | 8px | Padding interne des elements, gap dans les nav items |
| Standard | `gap-3`, `p-3` | 12px | Gap dans les boutons, padding des list items |
| Section | `gap-4`, `p-4` | 16px | Minimum entre sections, padding sidebar header |
| Large | `gap-8`, `p-8` | 32px | Padding du contenu principal |
| Extra | `gap-10` | 40px | Espacement entre blocs majeurs (onboarding) |

### Regles

- **Jamais** d'espacement arbitraire (`p-[13px]`)
- **Minimum entre sections** : `gap-4` (16px)
- **Padding du contenu principal** : `p-8` (32px)
- Separateurs avec `my-6` (24px de marge verticale)

---

## Border Radius

| Usage | Class | Pixels |
|-------|-------|--------|
| **Defaut** (boutons, inputs, badges, cards) | `rounded-md` | 6px |
| Modals, popovers | `rounded-lg` | 8px |
| Avatars | `rounded-full` | Cercle |
| Progress bar track | `rounded-sm` | 4px |

### Interdit

- `rounded-xl`, `rounded-2xl`, `rounded-3xl` — jamais utilises
- `rounded-full` sur autre chose que les avatars

---

## Icones

### Librairie

**Solar Icons** (style linear/thin) via `@iconify/react` + `@iconify-json/solar`.

```tsx
import { Icon } from "@iconify/react";

<Icon icon="solar:bolt-linear" className="size-4" />
```

### Tailles

| Contexte | Class | Pixels |
|----------|-------|--------|
| Inline (bouton, nav) | `size-4` | 16px |
| Feature card | `size-5` | 20px |
| Hero / onboarding | `size-12` | 48px |

### Icones utilisees

| Icone | Identifiant | Contexte |
|-------|-------------|----------|
| Accueil | `solar:home-2-linear` | Sidebar |
| Encheres | `solar:bolt-linear` | Sidebar, onboarding |
| Equipe | `solar:users-group-rounded-linear` | Sidebar |
| Tresorerie | `solar:wallet-linear` | Sidebar |
| Classement | `solar:chart-2-linear` | Sidebar |
| Politiques | `solar:target-linear` | Sidebar, onboarding |
| Sponsors | `solar:handshake-linear` | Sidebar |
| Parametres | `solar:settings-linear` | Sidebar |
| Copier | `solar:copy-linear` | Bouton copie |
| Check | `solar:check-circle-linear` | Confirmation |
| Fusee | `solar:rocket-2-linear` | Onboarding |
| Email | `solar:letter-linear` | Bouton Google |

### Style

- Toujours utiliser la variante `-linear` (trait fin)
- Couleur : `text-accent` pour les icones d'accentuation, sinon heriter du parent
- Ne jamais utiliser `-bold` ou `-filled`

---

## Composants

### Button

4 variantes principales :

| Variante | Usage | Apparence |
|----------|-------|-----------|
| `brand` | Action principale (CTA) | `bg-accent text-accent-foreground font-semibold shadow-sm` |
| `outline` | Action secondaire | Bordure + fond transparent |
| `ghost` | Action tertiaire | Pas de bordure ni fond |
| `destructive` | Suppression / danger | Rouge |

```tsx
<Button variant="brand">Action principale</Button>
<Button variant="outline">Secondaire</Button>
<Button variant="ghost">Tertiaire</Button>
```

Tailles : `xs`, `sm`, `default`, `lg`, `icon`, `icon-xs`, `icon-sm`, `icon-lg`.

### Badge

```tsx
<Badge variant="secondary">En attente</Badge>
<Badge variant="outline">Commissaire</Badge>
```

- Toujours `rounded-md` (pas `rounded-full`)
- Variantes : `default`, `secondary`, `outline`, `destructive`

### Input

```tsx
<Input type="email" placeholder="Email" />
```

- Hauteur : `h-9`
- Border : `border-input` (Zinc 200/800)
- Focus : ring accent `ring-ring/50`

### Progress

```tsx
<Progress value={65} />
```

- Track : `bg-muted`, hauteur `h-1`, `rounded-sm`
- Indicateur : `bg-accent`

### Avatar

```tsx
<Avatar className="size-8">
  <AvatarImage src={url} alt={name} />
  <AvatarFallback className="bg-muted text-xs text-muted-foreground">
    JS
  </AvatarFallback>
</Avatar>
```

- Taille standard : `size-8` (32px)
- Fallback : initiales sur fond muted
- Seul composant avec `rounded-full`

---

## Layout

### Shell de jeu (post-auth)

```
┌──────────┬─────────────────────────────────┐
│ Sidebar  │ TopBar (nom ligue + avatar)     │
│ 240px    ├─────────────────────────────────┤
│ fixe     │ Contenu principal               │
│ bg-      │ p-8, overflow-y-auto            │
│ surface  │ max-w selon le contenu          │
└──────────┴─────────────────────────────────┘
```

### Sidebar (240px)

- Background : `bg-wh-surface`
- Bordure droite : `border-r border-border`
- Header : logo "WattHunter" `text-lg font-semibold`, hauteur `h-14`
- Navigation : 7 items + Parametres en bas
- Item actif : `bg-wh-accent-muted text-accent`
- Item inactif : `text-muted-foreground hover:bg-muted hover:text-foreground`
- Separateurs : `border-b border-border` entre header, nav et footer

### TopBar

- Hauteur : `h-14`
- Bordure basse : `border-b border-border`
- Contenu : nom de la ligue a gauche, avatar a droite
- Padding : `px-8`

### Pages auth (pre-connexion)

- Pas de sidebar ni topbar
- Centrage vertical et horizontal : `flex items-center justify-center min-h-screen`
- Contenu : `max-w-sm` (login, signup, create, join) ou `max-w-md` (onboarding)

---

## Patterns UI

### Separateurs (pas de nested cards)

```tsx
{/* Separateur entre sections */}
<div className="my-6 border-b border-border" />

{/* Separateur entre items de liste */}
<div className="border-b border-border py-3 last:border-0">
```

### Formulaires

```tsx
<form className="flex flex-col gap-4">
  <div className="flex flex-col gap-2">
    <label className="text-sm font-medium text-foreground">Label</label>
    <Input placeholder="..." />
  </div>
  {error && <p className="text-sm text-destructive">{error}</p>}
  <Button variant="brand" type="submit">Valider</Button>
</form>
```

### Divider "ou"

```tsx
<div className="flex w-full items-center gap-3">
  <div className="h-px flex-1 bg-border" />
  <span className="text-xs text-muted-foreground">ou</span>
  <div className="h-px flex-1 bg-border" />
</div>
```

### Feature cards (onboarding)

```tsx
<div className="flex gap-4 py-5">
  <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-wh-accent-muted">
    <Icon icon="solar:target-linear" className="size-5 text-accent" />
  </div>
  <div className="flex flex-col gap-1">
    <h3 className="text-sm font-medium text-foreground">Titre</h3>
    <p className="text-sm leading-relaxed text-muted-foreground">Description</p>
  </div>
</div>
```

### Listes avec avatar

```tsx
<div className="flex items-center gap-3 border-b border-border py-3 last:border-0">
  <Avatar className="size-8">...</Avatar>
  <span className="text-sm text-foreground">{name}</span>
  <Badge variant="outline" className="ml-auto">Tag</Badge>
</div>
```

---

## A ne jamais faire

- Utiliser des couleurs hardcodees (`text-white`, `bg-gray-900`) — toujours les tokens
- Utiliser `rounded-full` sur autre chose que les avatars
- Utiliser `rounded-xl` ou plus grand
- Mettre des cartes dans des cartes (nested cards)
- Utiliser une police autre qu'Inter
- Utiliser des icones non-Solar ou en variante `-bold`/`-filled`
- Utiliser du padding arbitraire hors grille 8px
- Mettre des emojis dans l'interface (sauf si demande explicitement)
- Utiliser `bg-black` ou `bg-white` — toujours `bg-background` ou `bg-wh-surface`
