# Audit · /league/[id]/auction/[auctionId]
Generated: 2026-05-21
Files: auction/[auctionId]/page.tsx, auction-client.tsx, treasury-widget.tsx, rider-dialog.tsx, rider-table.tsx, loading.tsx
States (sitemap): auction-open-no-bids, auction-open-with-bids, auction-closed, round-1/2/3, cooldown-riders, contracted-riders

---

## Component tree (1 niveau)

**page.tsx** (Server Component)
- `<TreasuryWidget>` — sticky budget bar
- `<AuctionClient>` — orchestrateur client

**auction-client.tsx** (Client Component)
- My bids list inline (éditable)
- `<RiderTable>` — table avec filtres
- `<RiderDialog>` — modal enchère

**treasury-widget.tsx** (Server + Client-compatible)
- Stat triple (Treasury / Active bids / Available budget)

**rider-dialog.tsx** (Client Component)
- Dialog Shadcn + input bid + infoRows

**rider-table.tsx** (Client Component)
- Input search + 2 selects filtres + Table Shadcn

**loading.tsx**
- Spinner centré

---

## Composants partagés utilisés (déjà audités → référencés, PAS audités à nouveau)

- `Button` → composant Shadcn configuré (audité via shared-components)
- `Badge` → `pill.tsx` / `ui/badge.tsx` (audité dans shared-components/pill.md)
- `Dialog`, `Input`, `Table`, `TableRow`, etc. → composants Shadcn de base

---

## A — Violations confirmées

### A-001 · treasury-widget.tsx:32 · MISSING_MONO (classe E)
- **Rule** : valeurs numériques affichées doivent être en `font-mono` (Geist Mono règle DS)
- **Current** : `<span className="text-[length:var(--type-body)] font-semibold text-[var(--text-high)]">{treasury.toLocaleString("en-US")} EUR</span>`
- **Proposed** : ajouter `font-mono` à la classe du span
- **Scope** : treasury-widget.tsx lignes 32, 38, 49 (les 3 stats numériques Treasury / Active bids / Available budget)
- **BLOCKED** : Non

### A-002 · auction-client.tsx:85 · MISSING_MONO (classe E)
- **Rule** : montants numériques → `font-mono`
- **Current** : `<span className="text-[length:var(--type-body)] font-semibold font-mono text-[var(--accent-default)]">` — déjà `font-mono` ici. Le script détecte un faux positif sur la variable numérique dans un contexte clé (`key={bid.id}` ligne 74).
- **Line 74** : `key={bid.id}` — FP confirmé, c'est un attribut React `key`, pas un rendu textuel. Aucune action requise.
- **Line 85** : `{bid.amount.toLocaleString("en-US")} EUR` — `font-mono` déjà présent sur le span parent (ligne 84). FP confirmé.
- **BLOCKED** : Non — 2 faux positifs, aucune action

### A-003 · rider-dialog.tsx:202 · MISSING_MONO (classe E)
- **Rule** : valeurs numériques dans `<Input>` → le script détecte `value={amount}` comme numérique sans mono
- **Current** : `<Input type="number" ... value={amount} ...>` — `amount` est une string (état `useState<string>`)
- **FP** : Oui — `<Input>` est un `<input>` HTML, `font-mono` sur l'input est légitime à vérifier mais `value` n'est pas un rendu textuel direct. Toutefois, l'`<Input>` de shadcn n'applique pas `font-mono` par défaut.
- **Proposed** : Ajouter `className="font-mono"` à l'`<Input>` (ligne 198) pour aligner le rendu numérique avec le DS
- **BLOCKED** : Non

---

## B — Faux positifs documentés

### FP-001 · auction-client.tsx:74 · `key={bid.id}`
Attribut React `key`, pas un rendu textuel. Le script audit-ds détecte heuristiquement `bid.id` comme numérique mais c'est un UUID string. Pas d'action.

### FP-002 · auction-client.tsx:85 · `font-mono` déjà présent
Le span englobant (ligne 84) porte déjà `font-mono`. Le script remonte le contenu textuel enfant comme violation mais le contexte est correct.

### FP-003 · rider-dialog.tsx:202 · `value={amount}` sur `<Input>`
`amount` est `useState<string>`. La détection heuristique confond la prop `value` d'un input avec un rendu textuel. La vraie question est si l'input doit afficher `font-mono` (voir A-003 ci-dessus, traité séparément comme violation légitime légère).

---

## C — Tokens fantômes

Aucun token fantôme détecté dans ce groupe de fichiers. Tous les tokens utilisés (`--type-page-title`, `--type-body`, `--type-caption`, `--type-label`, `--type-section`, `--text-high`, `--text-mid`, `--bg-surface`, `--bg-subtle`, `--border-default`, `--accent-default`, `--status-danger`, `--success`, `--radius-md`) sont définis dans `globals.css`.

---

## D — Composants inline (non partagés)

### D-001 · rider-table.tsx — `<select>` natif HTML (lignes 76–98)
- Le DS préconise Filter Chips (`segmented-control.tsx`) pour le filtering dans une section, ou des dropdowns Shadcn `<Select>`. Les deux `<select>` natifs (Team filter, Specialty filter) sont stylés avec des tokens corrects (`--border-default`, `--bg-surface`, `--type-body`) mais ne suivent pas le pattern Filter Chips.
- **Sévérité** : légère — pas une violation de token mais un pattern non-conforme DS
- **Proposed** : remplacer par `<Select>` Shadcn ou Filter Chips selon le volume d'options. Pour "All teams" (liste longue), `<Select>` Shadcn est approprié. Pour "All specialties" (6 options fixes), Filter Chips (`segmented-control.tsx`) serait conforme DS.

### D-002 · rider-dialog.tsx — SPECIALTY_NAMES en français (lignes 49–55)
- Les valeurs (« Grimpeur », « Sprinteur », etc.) violent la règle Language Rule du CLAUDE.md ("ALL user-facing text in the app MUST be in English").
- **Proposed** : utiliser les labels anglais (`"Climber"`, `"Sprinter"`, `"Rouleur"`, `"Puncheur"`, `"Time Trialist"`, `"All-Rounder"`)
- **BLOCKED** : Non

### D-003 · rider-table.tsx — option labels en français (lignes 92–97)
- Même problème que D-002 : `"Grimpeur"`, `"Sprinteur"`, `"Polyvalent"` dans les `<option>` du select specialty filter
- **Proposed** : aligner avec les labels anglais
- **BLOCKED** : Non

---

## E — Résumé

| Fichier | Violations réelles | FP | BLOCKED | Notes |
|---|---|---|---|---|
| page.tsx | 0 | 0 | Non | Clean |
| auction-client.tsx | 0 | 2 | Non | bid.id + font-mono déjà présent |
| treasury-widget.tsx | 1 | 0 | Non | A-001 : manque font-mono sur 3 spans numériques |
| rider-dialog.tsx | 1 + D-002 | 1 | Non | A-003 Input mono + labels FR |
| rider-table.tsx | D-001 + D-003 | 0 | Non | select natif non-DS + labels FR |
| loading.tsx | 0 | 0 | Non | Clean |
