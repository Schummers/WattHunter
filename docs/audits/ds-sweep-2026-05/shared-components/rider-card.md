# Audit · apps/web/components/rider-card.tsx
Generated: 2026-05-21
Used by: auction/auctions-client, auction/market/market-client, team/page, team/gt/gt-team-client, components/gt-rescue-market (+ tests)

## Tour d'horizon
Composant liste universel du game loop : affiche un coureur (avatar, PCS rank overlay, nom, équipe, drapeau, mouvement de classement, XP, boost%) dans un row cliquable. Deux modes principaux : **open-slot** (slot vide à remplir) et **rider** (coureur actif). Variantes visuelles pilotées par props : `bidState` (outbid/not-accepted), `isLocked` (RiderLockBadge), `isOpenSlot`, `rightContent` libre, `href` vs `onNavigate`.

## Violations détaillées

### A · Typographie (0)

Aucune violation. Toutes les déclarations de taille de police utilisent `text-[length:var(--type-*)]`.

_Faux positifs détecteur à noter_ : aucun.

### B · Couleurs (0)

Aucune violation. Toutes les couleurs utilisent des tokens sémantiques (`var(--text-*)`, `var(--bg-*)`, `var(--border-*)`, `var(--accent-*)`, `var(--badge-bg)`). Pas de hex hardcodé, pas de classe Tailwind palette.

### C · Spacing & Radius (0)

Aucune violation regex (pas de `rounded-[Npx]`, `p-[Npx]`, `gap-[Npx]`).

**Note sémantique — `rounded-full` (L.64 et L.114) :**
Le DS définit `--radius-full: 9999px` pour "Avatars, notification dots, toggle thumbs" et recommande l'usage du token. En pratique, `rounded-full` (Tailwind) est l'équivalent exact (`border-radius: 9999px`), utilisé en convention sur tout le codebase (`bottom-nav`, `rail-router`, `achievement-badge`, etc.). Ce n'est **pas** une violation — les deux formes produisent la même valeur CSS. Il n'existe pas de classe Tailwind `rounded-[var(--radius-full)]` qui serait plus sémantique en Tailwind v4 avec `@theme inline`. Marqué comme **false-positive sémantique** : aucune correction requise.

### D · Patterns composants (2)

| ID | File:Line | Current pattern | Proposed component | Rationale |
|---|---|---|---|---|
| D-001 | rider-card.tsx:136 | `<span className="shrink-0 bg-[var(--badge-bg)] text-[var(--accent-highlight)] text-[length:var(--type-micro)] font-semibold rounded-[var(--radius-pill)] px-1.5 py-0.5">+{boostPct}%</span>` | `<Badge variant="highlighted" className="shrink-0">+{boostPct}%</Badge>` | DS §Badge — variant "highlighted" est exactement spécifié pour "boost %, strategy type, XP badge" avec `--badge-bg` + `--accent-label`. Le composant `Badge` (`ui/badge.tsx`) implémente déjà ces tokens. Remplacer l'inline span élimine la duplication de tokens et assure la cohérence avec les autres boost badges de l'app. | MANUAL | `--accent-highlight` (cyan-400) vs `--accent-label` (#0ea5e9/sky-500) : vérifier visuellement si les deux tokens donnent un rendu identique avant de valider le swap. Si différence visible, garder `--accent-highlight` via `className` override sur `<Badge>`. |
| D-002 | rider-card.tsx:114 | `<span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[length:var(--type-micro)] font-semibold font-mono text-[var(--text-mid)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-full px-1.5 leading-tight">#{rider.pcs_rank}</span>` | Garder le `<span>` custom avec ajout `tabular-nums` (voir E-001) | Ce span est un **PCS rank overlay** positionné en absolute sur l'avatar. La position absolute et le sizing minimal (`px-1.5`) le rendent non substituable par `<Badge>` sans surcharge de layout. Pas de composant DS pour les overlays positionnés. **Pas une violation D pure** — conservé custom, violation E uniquement. Confidence : MANUAL — si un composant `<AvatarBadge>` est créé à l'avenir, ce serait le bon candidat. |

> **Note sur D-002** : le détecteur regex flags ce span (`rounded-full border` pattern). Après analyse : c'est un overlay avatar custom avec contraintes de layout (absolute, -bottom-1), pas assimilable à Pill/Badge. La règle D s'applique aux badges/tags inline dans un flux de texte, pas aux overlays positionnés. **False-positive du détecteur** pour la dimension D — seule la violation E (tabular-nums) est retenue.

### E · Geist Mono numbers (2)

| ID | File:Line | Current | Proposed | Confidence | Rationale |
|---|---|---|---|---|---|
| E-001 | rider-card.tsx:114–115 | `font-mono` présent, `tabular-nums` absent sur `#{rider.pcs_rank}` | Ajouter `tabular-nums` : `className="... font-mono tabular-nums ..."` | AUTO | DS §Typographie règle 2 : "Geist Mono pour TOUT ce qui est numérique, toujours avec `tabular-nums`". Le `pcs_rank` est un entier qui s'aligne dans un overlay — `tabular-nums` garantit la stabilité de largeur. |
| E-002 | rider-card.tsx:136–137 | `{boostPct}%` rendu sans `font-mono` ni `tabular-nums` dans le span boost badge | Après application de D-001 (`<Badge variant="highlighted">`), ajouter `className="shrink-0 font-mono tabular-nums"` sur le Badge | MANUAL | `boostPct` est un chiffre (ex: `+15%`). DS impose Geist Mono sur tous les nombres. Le boost badge utilise `--type-micro` (Geist Sans selon la spec) mais contient un nombre — la règle E prend le dessus pour les valeurs numériques. À appliquer en même temps que D-001. |
| E-003 | rider-card.tsx:186–187 | `font-mono` présent, `tabular-nums` absent sur `{xp.toLocaleString()}` | Ajouter `tabular-nums` : `className="text-[length:var(--type-stat-small)] font-bold font-mono tabular-nums text-[var(--text-high)]"` | AUTO | DS §Typographie règle 2 + convention `budget-client.tsx` (exemple canonique : `font-mono tabular-nums` systématiquement). `xp` est la stat principale visible sur la card, l'alignement en colonne est critique pour les listes. |

## Cross-cutting issues

- **`boostPct` = remontada boost** : le rendu `+{boostPct}%` dans le rider-card ne montre pas visuellement de quel type de boost il s'agit. Si d'autres types de boost sont ajoutés plus tard, ce prop deviendra insuffisant. Logger pour un futur chantier : typer `boostPct` avec une union `{ type: "remontada" | "other"; pct: number }` pour permettre un tooltip ou une icône contextuelle. → **follow-up hors scope sweep**.

- **`font-mono` vs `font-[family-name:var(--font-geist-mono)]`** : le composant utilise `font-mono` (Tailwind utility → `--font-mono: "Geist Mono"`) alors que `budget-client.tsx` utilise `font-[family-name:var(--font-geist-mono)]`. Les deux pointent vers la même font via le `@theme inline` de `globals.css`. `font-mono` est la forme canonique Tailwind v4 — aucune violation mais noter l'incohérence de style dans le codebase. → **follow-up hors scope**.

## Checklist verification
- [ ] Screenshot before captured (variantes : default, with-bid, GT-mode, open-slot, locked)
- [ ] Screenshot after captured
- [ ] Diff visuel décrit
- [ ] typecheck/lint/vitest PASS
- [ ] Pas de régression sur les 5 pages consommatrices (auctions-client, market-client, team/page, gt-team-client, gt-rescue-market)
