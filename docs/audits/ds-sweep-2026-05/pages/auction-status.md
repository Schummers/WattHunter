# Audit · /league/[id]/auction/status
Generated: 2026-05-20
Files: auction/status/page.tsx + status-client.tsx

---

## Component tree rendu

- `page.tsx` (RSC)
  - `RoundStepper` (shared — `components/round-stepper.tsx`, not in 7-shared list)
  - `Tag` (shared — `components/pill.tsx` → voir `shared-components/pill.md`)
  - `<Link>` rows (inline layout — ligne 204-259)
  - `StatusClient` (client component — `status-client.tsx`)
    - `Button` (shadcn primitive)
    - `Dialog` / `DialogContent` / `DialogHeader` / `DialogFooter` (shadcn primitive)

---

## États audités

- [x] Round open — rows de teams avec statuts variés (validated, auto_validated, pending, not_yet_bid)
- [x] No open round — empty state card (ligne 271-278)
- [x] Dialog "Resolve Round" fermé
- [x] Dialog ouvert — liste `unvalidatedTeams` non vide
- [x] Dialog ouvert — état erreur (`error` non null)

---

## Violations détaillées

### A · Typographie (0)

Aucune violation de classe A détectée.

Tous les textes utilisent `text-[length:var(--type-*)]` :
- `--type-body` (ligne 38, 213, 273)
- `--type-caption` (lignes 194, 215, 219, 227, 233, 235, 43, 71, 83)

---

### B · Couleurs (3)

| ID | File:Line | Current | Proposed | Confidence | Rationale |
|---|---|---|---|---|---|
| B-001 | status-client.tsx:49 | `border-[var(--danger)]` | `border-[var(--danger-border)]` | MANUAL | Le bouton "Resolve Round" utilise `--danger` brut (100% opacité) pour la bordure. Le token sémantique `--danger-border` (30% opacité) est défini dans `globals.css` et conçu pour les bordures status — rendu moins agressif, cohérent avec les banners danger. **Cependant** : si l'intention est un bouton destructif à haute visibilité, `--danger` peut être un choix volontaire. Soumettre à validation humaine. |
| B-002 | status-client.tsx:49 | `hover:border-[var(--danger)]` | `hover:border-[var(--danger)]` | FP | Identique au token existant — pas de violation supplémentaire. (Voir B-001 pour la question racine.) |
| B-003 | status-client.tsx:83 | `border-[var(--warning)]` | `border-[var(--warning-border)]` | MANUAL | Bordure du bloc d'erreur inline dans le Dialog. Même raisonnement que B-001 : `--warning-border` (30%) est le token sémantique prévu pour les banners/alertes (`globals.css` ligne 135). L'usage actuel de `--warning` brut (100%) crée une bordure plus intense que le pattern établi dans les autres composants de l'app. |

> **Note B-002** : Faux positif explicite — `hover:border-[var(--danger)]` est le même token que l'état normal, pas une violation.

---

### C · Spacing & Radius (0)

Aucune violation de classe C détectée.

- Spacing : `py-4`, `pb-3`, `px-4`, `pt-4`, `pb-2`, `py-3`, `p-6`, `gap-1.5`, `ml-1`, `pt-6`, `p-3`, `mt-1`, `pl-5`, `space-y-2` — toutes des utilities Tailwind standard.
- Radius :
  - `rounded-[var(--radius-lg)]` (ligne 272, page.tsx) — conforme.
  - `rounded-[var(--radius-md)]` (lignes 71, 83, status-client.tsx) — conforme.

---

### D · Patterns composants (0)

Aucune violation de classe D détectée.

- Les 4 statuts de team (validated / auto_validated / pending / not_yet_bid) utilisent `<Tag variant="...">` du composant `pill.tsx` — conforme DS §pill.
- Pas de `<span class="rounded-full border...">` custom recréant un Tag/Badge.

---

### E · Geist Mono numbers (2)

| ID | File:Line | Current | Proposed | Confidence | Rationale |
|---|---|---|---|---|---|
| E-001 | page.tsx:227–229 | `<span className="text-[length:var(--type-caption)] text-[var(--text-high)]">{formatEuro(row.budget)}</span>` (sans `font-mono`) | Ajouter `font-mono` à la `className` | AUTO | `formatEuro` retourne une valeur monétaire (ex: `45 000 €`). Le DS exige Geist Mono pour ALL numbers. Le wrapper `<div className="w-24 text-right font-mono ...">` (ligne 225) applique bien `font-mono` au niveau du `<div>`, donc les `<span>` enfants héritent. **Verdict : FP** — l'héritage CSS est suffisant ici, `font-mono` est posé sur l'ancêtre direct. |
| E-002 | page.tsx:215–216 | `<span ...>Lv.{row.level}</span>` | Envelopper la partie numérique : `Lv.<span className="font-mono">{row.level}</span>` | MANUAL | `row.level` est un entier (ex: `3`). Il est mêlé au texte `Lv.` dans un `<span>` qui hérite `font-sans` (pas de `font-mono` sur l'ancêtre). Le parent `<div className="flex items-baseline gap-1.5">` n'a pas `font-mono`. Selon DS §typography : "ALL numbers → Geist Mono". Le number game-logic visible (`3`, `5`, etc.) doit être en Mono. |

> **E-001 FP justifié** : le `<div>` parent ligne 225 porte `font-mono`, les `<span>` enfants héritent cette propriété CSS — aucune action nécessaire.

---

## Cross-cutting issues

Aucun pattern récurrent intra-page justifiant une extraction de composant.

---

## Composants partagés référencés

- `pill.tsx` (`Tag`) → voir `shared-components/pill.md`
- `round-stepper.tsx` → non dans la liste des 7 composants partagés (< 3 consommateurs confirmés). Violatins éventuelles non auditées ici.

---

## Notes Phase 3

- **B-001 / B-003** : les deux items sont `MANUAL` — soumettre au gate humain avant repair. La question est : veut-on un bouton destructif à haute visibilité (`--danger` 100%) ou cohérence avec le pattern banners (`--danger-border` 30%) ?
- **E-002** : fix mécanique simple — wrapping du `{row.level}` dans un `<span className="font-mono">`. Aucun risque visuel majeur (taille identique, seule la font change).
- `status-client.tsx` est entièrement conforme sur A, C, D.
- Page très propre dans l'ensemble — 1 violation certaine (E-002), 2 violations à valider (B-001, B-003).

---

## Résumé

| Classe | Violations | FP | BLOCKED |
|---|---|---|---|
| A — Typographie | 0 | 0 | 0 |
| B — Couleurs | 2 (+ 1 FP) | 1 | 0 |
| C — Spacing & Radius | 0 | 0 | 0 |
| D — Patterns composants | 0 | 0 | 0 |
| E — Geist Mono numbers | 1 (+ 1 FP) | 1 | 0 |
| **Total** | **3** | **2** | **0** |

**Status : READY FOR REPAIR (gate humain requis sur B-001 et B-003)**
