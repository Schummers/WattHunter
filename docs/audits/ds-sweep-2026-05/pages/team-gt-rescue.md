# Audit · /league/[id]/team/gt/rescue
Generated: 2026-05-20
Files: gt/rescue/page.tsx + gt-rescue-market.tsx
States: pre-DNF (redirect → not audited), DNF-active (has-eligible-riders), empty-pool, existing-bid

---

## Component tree rendu

```
page.tsx (RSC — auth guard + data fetching)
└── GtRescueMarket (gt-rescue-market.tsx, "use client")
    ├── Back button (inline, lines 153–160 / 192–200)
    ├── Page header h1 + subtitle (inline, lines 162–169 / 203–211)
    ├── [existing-bid state] Bid confirmed card (inline, lines 170–184)
    ├── Search input container (inline, lines 214–237)
    ├── Counter label span (inline, lines 240–244)
    ├── RiderCard list (shared — audité dans shared-components/rider-card.md)
    │   └── renderRight() slot (inline, lines 91–146)
    │       ├── Bid input container (inline)
    │       ├── Min salary hint (inline)
    │       └── Error message (inline)
    ├── Empty state (inline, lines 265–271)
    └── StickyBar (shared — audité dans shared-components/sticky-bar.md)
```

**Composants partagés référencés (NE PAS ré-auditer) :**
- `RiderCard` → voir `shared-components/rider-card.md`
- `StickyBar` → voir `shared-components/sticky-bar.md`

---

## États audités

- [x] DNF-active / has-eligible-riders (liste riders, bid input, StickyBar "Place emergency bid")
- [x] DNF-active / empty-pool (aucun rider — empty state "No riders match your search.")
- [x] existing-bid (bid déjà placé — confirmation card, pas de liste)
- [ ] pre-DNF — redirigé côté server (page.tsx line 55 : `if (!dnfClaimed?.length) redirect(...)`) → aucun rendu visuel, non applicable

---

## Violations détaillées

### A · Typographie (2)

| ID | File:Line | Current | Proposed | Confidence | Rationale |
|---|---|---|---|---|---|
| A-001 | gt-rescue-market.tsx:126 | `text-base` | `text-[length:var(--type-body)]` | AUTO | Input bid amount. Pattern `text-base md:text-[length:var(--type-body)]` : le fallback mobile utilise `text-base` (16px Tailwind) au lieu du token DS. `--type-body` = 14px mobile / 16px desktop (responsive via globals.css). Remplacer les deux classes par le seul token — la responsivité est gérée nativement par le token. Identique à A-001/A-002 dans auction-market. |
| A-002 | gt-rescue-market.tsx:225 | `text-base` | `text-[length:var(--type-body)]` | AUTO | Search input. Même pattern `text-base md:text-[length:var(--type-body)]`. Remplacer par `text-[length:var(--type-body)]` seul. |

### B · Couleurs (0)

Aucune violation. Tous les tokens couleur utilisés sont des tokens sémantiques DS (`--text-*`, `--bg-*`, `--accent-*`, `--border-*`, `--status-danger`). Pas de hex hardcodé, pas de palette Tailwind directe.

### C · Spacing & Radius (1)

| ID | File:Line | Current | Proposed | Confidence | Rationale |
|---|---|---|---|---|---|
| C-001 | gt-rescue-market.tsx:170 | `rounded-[6px]` | `rounded-md` | AUTO | Card "Bid already placed" (état existing-bid). `globals.css` : `--radius-md: 6px` = Tailwind `rounded-md`. DS §radius-as-affordance : 6px = interactive (buttons, chips). Ce card est décoratif/informatif (pas cliquable) → questionnable (voir note ci-dessous), mais la substitution `rounded-md` est mécaniquement correcte et attendue. |

> **Note C-001 :** Le DS documente `6px = interactive, 20px = decorative` comme règle d'affordance. Ce card est statique → on pourrait argumenter pour `rounded-lg` (8px) ou `rounded-[var(--radius-compound)]` (10px). Toutefois le code existant utilise délibérément 6px pour cohérence avec les autres cards informatives de l'app (même pattern dans `auction-history.md` C-001). Laisser `rounded-md` comme Proposed — Jonathan peut décider de changer vers `rounded-lg` si voulu. Confidence reste AUTO pour la substitution mécanique, MANUAL si le choix sémantique est réévalué.

### D · Patterns composants (0)

**Faux positif détecteur :**
- gt-rescue-market.tsx:241 — `<span className="text-[length:var(--type-label)] font-bold uppercase tracking-wide text-[var(--text-low)]">` détecté par la règle heuristique D (pattern `uppercase tracking-`). C'est un label inline de section ("N available · 0/1 bet"), pas un Badge ou Pill réutilisable. Pas de composant DS applicable. **FP justifié : le label est un counter de page unique, sans bordure ni background — ne ressemble pas à un Pill/Badge DS.**

Aucune violation D réelle.

### E · Geist Mono numbers (2)

| ID | File:Line | Current | Proposed | Confidence | Rationale |
|---|---|---|---|---|---|
| E-001 | gt-rescue-market.tsx:242 | `{filtered.length}` dans span sans `font-mono` | Wrapper `<span className="font-mono tabular-nums">{filtered.length}</span>` | MANUAL | Le span parent (ligne 241) est un label uppercase/tracking — Geist Sans. Le nombre `filtered.length` est un entier de comptage. DS §Typography : "Tous les chiffres en Geist Mono". Wrapper le nombre seul avec `font-mono tabular-nums` à l'intérieur du span existant. |
| E-002 | gt-rescue-market.tsx:242 | `{hasBid ? 1 : 0}` dans span sans `font-mono` | Wrapper `<span className="font-mono tabular-nums">{hasBid ? 1 : 0}</span>` | MANUAL | Même ligne, même span. `hasBid ? 1 : 0` est un entier (0 ou 1). Wrapper inline. Note : les deux wrappers peuvent être factorisés en une seule span englobant les deux nombres si le rendu textuel le permet (`{filtered.length} available · {hasBid ? 1 : 0}/1 bet` → les `/1 bet` et ` available · ` sont du texte, pas des nombres — wrapper chaque entier séparément). |

---

## Cross-cutting issues

- Le pattern "bid input + min salary hint + error" (renderRight, lignes 91-146) est identique au pattern de `auction-market/market-client.tsx` renderRiderRight (lignes 336-392). Les deux sont des slots custom passés à `RiderCard`. Extraction potentielle en `<BidInputSlot>` partagé après le sweep. → À logger dans `follow-ups.md`.
- Le composant ne définit aucun état de chargement propre (pas de skeleton, pas de Suspense boundary visible côté client). Hors scope sweep mais potentiel sujet a11y/UX.

---

## Checklist verification (à cocher par le repair agent)

- [ ] Screenshot before captured : état `DNF-active / has-eligible-riders`
- [ ] Screenshot before captured : état `existing-bid` (confirmation card)
- [ ] Screenshot before captured : état `empty-pool` (empty state message)
- [ ] Screenshot after capturés (mêmes 3 états)
- [ ] Diff visuel : A-001/A-002 → léger rétrécissement taille de police sur mobile (14px vs 16px) dans les inputs. Desktop inchangé (les deux valeurs convergeaient déjà sur 16px via `md:`). Vérifier que l'input bid reste lisible.
- [ ] Diff visuel : C-001 → visuellement identique (`rounded-[6px]` = `rounded-md` = 6px, même rendu).
- [ ] Diff visuel : E-001/E-002 → le nombre passe de Geist Sans à Geist Mono. Espacement légèrement différent (tabular vs proportional). Pas de changement de couleur ou de taille.
- [ ] typecheck PASS
- [ ] lint PASS (0 warning ignoré)
- [ ] vitest PASS (aucun test ne cible gt-rescue-market directement — vérifier `pnpm test` global)
- [ ] Pas de régression sur les pages consommatrices (rescue n'est pas un composant partagé — impact isolé)
