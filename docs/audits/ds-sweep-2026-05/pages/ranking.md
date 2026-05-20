# Audit · /league/[id]/ranking
Generated: 2026-05-21
Files: ranking/page.tsx + ranking/ranking-client.tsx
States: tab=teams (all-races, race-filtered), tab=riders (all-races, race-filtered), teams-empty, riders-empty

---

## Component tree rendu

```
page.tsx (RSC — auth guard + data fetching)
└── RankingClient (ranking-client.tsx, "use client")
    ├── <h1> "Ranking"
    ├── <SegmentedControl> segments=["Teams","Riders"] (shared — voir shared-components/segmented-control.md)
    ├── <Select> race filter (Shadcn UI — non audité)
    ├── [tabIndex === 0] Teams tab
    │   ├── UPPERCASE count label (span inline)
    │   └── divide-y list → <Link> rows
    │       ├── banner overlay (conditionnel)
    │       ├── rank span (font-mono)
    │       ├── <AchievementBadge> (shared — conditionnel, si badge équipé)
    │       ├── name + XP group
    │       ├── <MovementTag> (shared — voir shared-components/movement-tag.md)
    │       └── <ChevronRight>
    └── [tabIndex === 1] Riders tab
        ├── UPPERCASE count label (span inline)
        └── divide-y list → <Link> rows
            ├── rank span (font-mono)
            ├── <Avatar> / <AvatarImage> / <AvatarFallback> (Shadcn UI)
            ├── name + nationality + XP group
            ├── <MovementTag> (shared)
            └── <ChevronRight>
```

**Composants partagés référencés (NE PAS ré-auditer) :**
- `SegmentedControl` → voir `shared-components/segmented-control.md`
- `MovementTag` → voir `shared-components/movement-tag.md`
- `AchievementBadge` → usage unique ici (ranking row) mais composant déclaré partagé — violations couvertes dans cette page

---

## États audités

- [x] tab=teams, all-races (default state)
- [x] tab=teams, race-filtered (selectedRace non-null, movement caché, treasury caché)
- [x] tab=teams, avec banner + badge équipé (team.equippedBannerUrl non-null)
- [x] tab=teams, sans badge (equippedBadgeUrl null — spacer absent)
- [x] tab=teams, isMe=true (bg-[var(--bg-surface-active)] appliqué)
- [x] tab=teams, liste vide (empty state)
- [x] tab=riders, all-races (default state)
- [x] tab=riders, race-filtered (movement caché)
- [x] tab=riders, isMyRider=true (ring-1 sur Avatar)
- [x] tab=riders, isFree=true (opacity-60)
- [x] tab=riders, liste vide (empty state)
- [x] loading.tsx (non applicable — page déléguée à RSC, pas de loading visible dans le périmètre client)

---

## Violations sur le code spécifique de la page

### A · Typographie (0)

Analyse manuelle :

- `h1` ligne 123 : `text-[length:var(--type-page-title)]` — token valide, conforme.
- UPPERCASE count labels (lignes 161–162, 251–252) : `text-[length:var(--type-label)]` — conforme.
- Rank spans (lignes 187, 268) : `text-[length:var(--type-emphasis)]` — conforme. Note : les rangs sont des nombres, donc `font-mono` présent, conforme E.
- Team name (ligne 207), rider name (ligne 289) : `text-[length:var(--type-emphasis)]` — conforme.
- Treasury (ligne 226) : `text-[length:var(--type-caption)]` — conforme.
- XP suffix "XP" (lignes 216, 309) : `text-[length:var(--type-micro)]` — conforme.
- AvatarFallback (ligne 281) : `text-[length:var(--type-micro)]` — conforme.
- Caption owner/rider (lignes 220, 299) : `text-[length:var(--type-caption)]` — conforme.
- Empty state (lignes 241, 322) : `text-[length:var(--type-body)]` — conforme.

**Conclusion A : 0 violation.**

---

### B · Couleurs (0)

Analyse manuelle :

- Tous les tokens couleur vérifiés dans ranking-client.tsx :
  - `text-[var(--text-high)]`, `text-[var(--text-mid)]`, `text-[var(--text-low)]`, `text-[var(--text-ghost)]` — tous sémantiques, conformes.
  - `divide-[var(--border-subtle)]` (ligne 166, 256) — conforme.
  - `bg-[var(--bg-surface-active)]` (ligne 173) — conforme.
  - `bg-[var(--bg-app)]` (ligne 182) — conforme. Note : utilisé dans le gradient du banner overlay ; token sémantique valide.
  - `hover:bg-[var(--bg-surface-hover)]` (lignes 171, 263) — conforme.
  - `ring-[var(--accent-default)]` (ligne 273) — conforme.
  - `border-[var(--border-default)]` sur AvatarFallback (ligne 281) — conforme.
  - `bg-[var(--bg-surface)]` sur AvatarFallback (ligne 281) — conforme.

Aucun hardcode hex, rgba, ou couleur Tailwind palette détecté dans ranking-client.tsx.

**Conclusion B : 0 violation.**

---

### C · Spacing & Radius (1)

| ID | File:Line | Current | Proposed | Confidence | Rationale |
|---|---|---|---|---|---|
| C-001 | ranking-client.tsx:187, 268 | `w-[22px]` | `w-[22px]` → voir rationale | BLOCKED · missing token | Largeur fixe de la colonne rang (22px). Aucun token `--space-*` DS ne couvre cette valeur. Il s'agit d'une contrainte de layout visuel (alignement des rangs à 1–2 chiffres). Pattern identique utilisé à la ligne 268 (tab Riders). Pas de substitution exacte via utilitaires Tailwind (w-5=20px, w-6=24px). Recommandation : soit accepter `w-[22px]` comme exception documentée (layout de colonne rang), soit créer `--space-rank-col: 22px`. La valeur est identique sur les deux tabs → si modifiée, modifier les deux lignes. |

> **Recommandation auditeur C-001** : BLOCKED/MISSING_TOKEN. Valeur 22px intentionnelle pour l'alignement visuel des chiffres de rang. Aucun utilitaire Tailwind standard (`w-5`=20px, `w-6`=24px) ne correspond sans diff visuelle. Proposer à Jonathan : Option A — ajouter `--space-rank-col: 22px` dans globals.css et utiliser `w-[var(--space-rank-col)]`. Option B — accepter `w-[22px]` comme exception documentée (pattern de layout rank column, 2 occurrences synchronisées).

---

### D · Patterns composants (0)

Analyse manuelle :

- **SegmentedControl** (ligne 130–135) : usage correct du composant partagé `SegmentedControl` pour le pattern Filter Chips / Tabs. Conforme.
- **MovementTag** (lignes 210, 297) : usage correct du composant partagé. Conforme.
- **AchievementBadge** (lignes 192–201) : usage correct, props `badgeUrl`, `tier`, `size=36`, `locked=false`. Conforme.
- UPPERCASE count labels (lignes 161–162, 251–252) : `text-[length:var(--type-label)] font-bold uppercase tracking-wide text-[var(--text-low)]` — pattern DS correct pour labels de section. Pas un Tag/Badge. Conforme (FP potentiel du scanner — voir note).
- Aucun span avec `rounded-full border` inline détecté qui devrait être un `<Tag>`.

**Conclusion D : 0 violation.**

> **Note scanner FP** : les UPPERCASE spans "N TEAMS" / "N RIDERS TOTAL" (lignes 161–162, 251–252) ont `uppercase tracking-wide` mais sont des labels de section, pas des tags pill. Pattern DS `--type-label + font-bold + tracking-wide + text-low` — correct. Ne pas flaguer.

---

### E · Geist Mono numbers (0)

Analyse manuelle des contextes numériques :

- Rang teams (ligne 187) : `font-mono` présent. Conforme.
- XP teams (ligne 213) : `font-mono` présent. Conforme.
- Treasury teams (ligne 226) : `font-mono` présent. Conforme.
- Rang riders (ligne 268) : `font-mono` présent. Conforme.
- XP riders (ligne 306) : `font-mono` présent. Conforme.
- Rangs dans `formatTreasury()` (lignes 67–69) : formatage côté helper, pas de rendu direct de nombre nu. Sortie string rendue dans span font-mono. Conforme.
- `{i + 1}` pour le rang rider (ligne 269) : wrappé dans span `font-mono`. Conforme.

**Conclusion E : 0 violation.**

---

## Notes sur page.tsx (0 violations)

Le RSC `page.tsx` est un data-fetching layer pur, aucun rendu visuel direct. 0 violation détectée.

---

## AchievementBadge — violations dans ce contexte

Le composant `AchievementBadge` est utilisé dans ranking-client.tsx (ligne 192–201). Les violations du composant lui-même (hardcoded hex dans `RING_STYLES`) sont dans `components/achievement-badge.tsx`. Ces violations appartiennent à l'audit du composant partagé ; elles ne sont PAS comptées dans ce rapport de page car `AchievementBadge` est un composant partagé multi-consommateurs.

> **Recommandation** : créer un audit `shared-components/achievement-badge.md` si ce composant n'est pas encore couvert. Voir note Phase 3 ci-dessous.

---

## Cross-cutting issues

1. **w-[22px] dupliqué (C-001)** — même valeur aux lignes 187 et 268. Si modifié, les deux lignes doivent être synchronisées.

2. **AchievementBadge violations non couvertes** — le composant `achievement-badge.tsx` contient des hex hardcodés (`#fbbf24`, `#f59e0b`, `#6b7280`, `#22d3ee`) et des animations `@keyframes` inline. Ces valeurs sont des choix de game-design visuellement intentionnels (rings d'achievement). Pas compté ici car hors périmètre page ranking. Voir note Phase 3.

---

## Résumé violations

| Classe | Count réel | False positives | Notes |
|---|---|---|---|
| A | 0 | 0 | Tous les tokens typographiques sont valides |
| B | 0 | 0 | Aucun hardcode couleur |
| C | 1 | 0 | w-[22px] — candidat BLOCKED/MISSING_TOKEN |
| D | 0 | 1 (UPPERCASE labels) | Labels de section, pas des Tags |
| E | 0 | — | Tous les nombres sont en font-mono |
| **Total** | **1** | **1** | **1 violation nette** |

---

## Blocked (à trancher avant Phase 3)

| ID | Issue | Options |
|---|---|---|
| C-001 | `w-[22px]` rank column — aucun token DS existant | A: ajouter `--space-rank-col: 22px` dans globals.css · B: accepter comme exception documentée (layout constraint) |

---

## Notes Phase 3

- **AchievementBadge** (`components/achievement-badge.tsx`) : non couvert par les audits shared-components existants. Le composant utilise des hex hardcodés pour les ring tiers (`#fbbf24` victory, `#f59e0b` podium, `#6b7280` locked/top10, `#22d3ee` dynamic). Ces valeurs correspondent aux tokens `--color-cyan-400` et Tailwind amber/gray palette, mais ne passent pas par des tokens DS. Recommandation : créer un audit dédié ou couvrir lors du repair de la page ranking.
- **`opacity-60` (ligne 264)** sur les riders libres — valeur Tailwind standard, pas une violation DS.
- **`size-9` (ligne 273)** sur Avatar — `size-9` = 36px, valeur Tailwind standard pour sizing d'avatar. Pas de token DS spécifique attendu ici.

---

## Repair log (à compléter par le repair agent — Phase 3)

_Section vide — à remplir par le Réparateur._
