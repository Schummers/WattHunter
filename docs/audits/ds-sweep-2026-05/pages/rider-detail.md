# Audit · /league/[id]/rider/[riderId]
Generated: 2026-05-21
Files: rider/[riderId]/page.tsx + rider-detail-client.tsx + loading.tsx
States: tab=pcs, tab=game, modal-release-open, owned-by-me, owned-by-other

---

## Component tree rendu (1 niveau)

- `page.tsx` (server) → `<RiderDetailClient>` (tout le rendu visuel est dans ce fichier)
  - `<BackHeader>` (shared, conditionnel si `!inRail`)
  - `<Avatar>` / `<AvatarImage>` / `<AvatarFallback>` (shadcn/ui — non audité)
  - `<SegmentedControl>` (shared — voir shared-components/segmented-control.md)
  - `<PcsStatsSection>` (inline dans rider-detail-client.tsx)
  - `<GameResultsSection>` (inline dans rider-detail-client.tsx)
  - `<StickyBar>` (shared — voir shared-components/sticky-bar.md)
  - `<ReleaseConfirmModal>` (composant isolé dans `components/release-confirm-modal.tsx` — audité ici)
  - `<Button>` (shadcn/ui — non audité)

## Composants partagés utilisés (déjà audités → ne PAS dupliquer leurs violations)

- `BackHeader` → voir `shared-components/back-header.md`
- `SegmentedControl` → voir `shared-components/segmented-control.md`
- `StickyBar` → voir `shared-components/sticky-bar.md`
- `Tag` / `Pill` → voir `shared-components/pill.md` ← violations D-001 à D-004 ci-dessous concernent les inline spans qui AURAIENT DÛ utiliser `<Tag>`

## États audités

- [x] tab=pcs (Season Rankings + Race Programme)
- [x] tab=game (Game Results groupés par mois)
- [x] modal-release-open (ReleaseConfirmModal visible)
- [x] owned-by-me (context=team, isInRoster=true, bouton Release Rider visible)
- [x] owned-by-other (context=ranking, ownership line affichée)
- [x] context=market (bouton Draft Auction, bid input visible)
- [x] loading.tsx (skeleton spinner)

---

## Violations sur le code spécifique de la page

### A · Typographie (1)

| ID | File:Line | Current | Proposed | Confidence | Rationale |
|---|---|---|---|---|---|
| A-001 | rider-detail-client.tsx:486 | `text-base` | `text-[length:var(--type-stat-small)]` | MANUAL | Bid input field. Mobile fallback : `text-base` précède `md:text-[length:var(--type-stat-small)]` dans la même className. Le token `--type-stat-small` = 16px, `text-base` = 16px — valeur identique. Mais le DS mandate l'usage des tokens. Fix : remplacer `text-base` par `text-[length:var(--type-stat-small)]` et supprimer la clause responsive `md:text-[length:var(--type-stat-small)]` redondante. La ligne complète devient : `text-[length:var(--type-stat-small)]`. Confidence MANUAL : vérifier visuellement que le responsive md: ne masquait pas un intent de taille différente sur mobile (mais puisque text-base=16px=--type-stat-small mobile, c'est équivalent). |

### B · Couleurs (6)

| ID | File:Line | Current | Proposed | Confidence | Rationale |
|---|---|---|---|---|---|
| B-001 | rider-detail-client.tsx:434 | `border-red-400` | `border-[var(--danger-border)]` | MANUAL | Bid input container — état d'erreur. `red-400` est un hardcode Tailwind palette. `--danger-border` = `rgba(239,68,68,0.30)` défini dans globals.css. `red-400` = `#f87171` ≠ `--danger` = `#ef4444`. L'intent est "danger border" → token sémantique correct. Confidence MANUAL : l'effet visuel sera légèrement différent (rouge plus atténué via opacité 0.30 vs rouge vif `red-400`). Cohérent avec les boutons Cancel/Release qui utilisent déjà `--danger-border`. |
| B-002 | rider-detail-client.tsx:488 | `text-red-400` | `text-[var(--status-danger)]` | MANUAL | Bid input text — état d'erreur. `--status-danger = var(--danger) = #ef4444`. `red-400 = #f87171`. Légèrement plus foncé avec le token. MANUAL car changement de teinte visible. Intent clair : danger text. |
| B-003 | rider-detail-client.tsx:496 | `text-red-400` | `text-[var(--status-danger)]` | MANUAL | Error helper text sous le bid input (span mt-[3px]). Même mapping que B-002. |
| B-004 | rider-detail-client.tsx:528 | `text-red-400` | `text-[var(--status-danger)]` | AUTO | Bouton "Cancel Draft" — texte rouge. Tous les tokens danger sont déjà présents sur ce même élément (`--danger-border`, `--danger-bg`). Le `text-red-400` est une incohérence manifeste. `--status-danger` est le token sémantique exact pour ce contexte. |
| B-005 | rider-detail-client.tsx:539 | `text-red-400` | `text-[var(--status-danger)]` | AUTO | Bouton "Release Rider" — même pattern exact que B-004. |
| B-006 | release-confirm-modal.tsx:78 | `text-red-400` | `text-[var(--status-danger)]` | AUTO | Bouton "Release" confirmé dans la modal — état `isPaidPhase && !isBlockedThisPhase`. Le reste de la ligne utilise déjà `--danger-border` et `--danger-bg`. Incohérence manifeste identique à B-004/B-005. |

> **Note B-001 à B-003** : `red-400` (#f87171) et `--danger` (#ef4444) sont deux rouges distincts. La valeur DS `#ef4444` est intentionnelle (red-500 Tailwind, non red-400). Les fix MANUAL changeront légèrement la teinte des états d'erreur. Screenshots before/after obligatoires pour ces 3.

### C · Spacing & Radius (1)

| ID | File:Line | Current | Proposed | Confidence | Rationale |
|---|---|---|---|---|---|
| C-001 | rider-detail-client.tsx:496 | `mt-[3px]` | `mt-px` | MANUAL | Micro-espacement entre le bid input et le helper text d'erreur. `mt-[3px]` = 3px arbitraire. Option 1 : `mt-px` = 1px (Tailwind, trop petit). Option 2 : `mt-0.5` = 2px (trop petit). Option 3 : accepter `mt-[3px]` comme valeur définissante (pattern similaire à `py-[3px]` dans pill.tsx). Confidence MANUAL : aucun token `--space-*` ne couvre 3px. Substitution propre la plus proche est `mt-0.5` (2px) mais diff visuelle possible. Alternative recommandée : **accepter `mt-[3px]`** en BLOCKED avec note "valeur définissante, pas de token existant à 3px". |

> **Recommandation auditeur C-001** : BLOCKED/MISSING_TOKEN. Même situation que `py-[3px]` dans pill.tsx (C-001 de ce rapport). La valeur 3px est intentionnelle pour l'espacement visuel sub-pixel des helper textes. Ni `mt-0.5` (2px) ni `mt-1` (4px) ne sont des substitutions exactes. Proposer à Jonathan : Option A — ajouter `--space-px-3: 3px` dans globals.css et utiliser `mt-[var(--space-px-3)]`. Option B — accepter `mt-[3px]` comme exception documentée (micro-espacement sub-token). Option C — `mt-0.5` si 1px de diff acceptable.

### D · Patterns composants (5)

| ID | File:Line | Current pattern | Proposed component | Confidence | Rationale |
|---|---|---|---|---|---|
| D-001 | rider-detail-client.tsx:382 | `<span className="rounded-full border border-[var(--border-default)] bg-[var(--bg-surface)] px-2 py-0.5 text-[length:var(--type-caption)] font-medium text-[var(--text-mid)]">` | `<Tag>{rider.specialty}</Tag>` | MANUAL | Specialty badge. Le pattern est quasi-identique à `<Tag variant="default">` — border + caption + text-low. Diff : `bg-[var(--bg-surface)]` n'est pas dans Tag default (pas de bg explicite). `text-[var(--text-mid)]` ≠ `text-[var(--text-low)]` (Tag default). MANUAL : vérifier visuellement si `text-mid` vs `text-low` est intentionnel ici. Si oui, utiliser `<Tag className="text-[var(--text-mid)]">{rider.specialty}</Tag>`. |
| D-002 | rider-detail-client.tsx:387 | `<span className="rounded-full border border-[var(--border-default)] bg-[var(--bg-surface)] px-2 py-0.5 text-[length:var(--type-caption)] font-medium font-mono text-[var(--text-mid)]">` | `<Tag className="font-mono">{age} yrs</Tag>` | MANUAL | Age badge — same as D-001 + `font-mono` pour le nombre. Tag accepte className extra. Substitution : `<Tag className="font-mono">{age} yrs</Tag>`. Diff `text-mid` vs `text-low` identique à D-001. |
| D-003 | rider-detail-client.tsx:392 | `<span className="rounded-full border border-[var(--border-default)] bg-[var(--bg-surface)] px-2 py-0.5 text-[length:var(--type-caption)] font-medium font-mono text-[var(--text-mid)]">` | `<Tag className="font-mono">{rider.height_cm} cm</Tag>` | MANUAL | Height badge — identique à D-002. |
| D-004 | rider-detail-client.tsx:397 | `<span className="rounded-full border border-[var(--border-default)] bg-[var(--bg-surface)] px-2 py-0.5 text-[length:var(--type-caption)] font-medium font-mono text-[var(--text-mid)]">` | `<Tag className="font-mono">{rider.weight_kg} kg</Tag>` | MANUAL | Weight badge — identique à D-002. |
| D-005 | rider-detail-client.tsx:761 | `<span className="text-[length:var(--type-label)] font-bold uppercase tracking-wide text-[var(--text-low)]">` | **FALSE POSITIVE** | — | Faux positif du détecteur "UPPERCASE + tracking". Ce span est le label de section mois dans GameResultsSection (ex: "MAY 2026"). C'est un label de groupe, pas un Tag/Badge. Le pattern DS pour les labels UPPERCASE est `--type-label` + `font-bold` + `tracking-wide` — exact match avec ce span. Ce span N'EST PAS un Tag (il n'a pas de shape pill, pas de border). C'est un simple label de section. Aucune violation réelle. |

> **Note D-001 à D-004** : ces 4 badges hero (specialty, age, height, weight) forment un groupe visuel dans la section hero du rider. La migration vers `<Tag>` est propre mais il faudra ajouter `import { Tag } from "@/components/pill"` et décider du traitement de `text-mid` vs `text-low`. Le `bg-[var(--bg-surface)]` sur les spans existants n'existe pas dans Tag default — ce détail pourra être ajouté via className override ou ignoré si l'effet visuel est acceptable.

> **Note pcs_rank badge (ligne 359)** : `<span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[length:var(--type-micro)] font-semibold font-mono text-[var(--text-mid)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-full px-1.5 leading-tight">` — NON détecté par le scanner (pas de `rounded-full border` dans cet ordre exact). C'est un micro-badge positionné sur l'avatar. C'est un **candidat D-006** : pattern pill mais avec positionnement absolu et taille ultra-réduite (`px-1.5` vs `px-[10px]` de Tag). Migration vers `<Tag>` ici serait problématique (le positionnement absolu s'applique au span wrapper). RECOMMANDATION : false positive sémantique — laisser en l'état, ajouter un commentaire `/* DS: micro-badge, not a Tag — positional override */`.

### E · Geist Mono numbers (0 violations flaggées par le scanner)

Analyse manuelle des contextes numériques :

- `renderMetrics()` (lignes 202–282) : `gameXp`, `totalBonus`, `minSalary`, `locked_salary` → tous wrappés dans un div avec `valueClass` qui contient `font-mono`. **Conforme.**
- `stickyButtonLabel` / `slotLabel` / `stickyBudgetLabel` (lignes 289–325) : nombres dans le StickyBar → `<span className="font-mono">` explicitement présent aux lignes 629, 631, 636. **Conforme.**
- `PcsStatsSection` — `r.season`, `r.points`, `r.rank` → classes `font-mono` présentes aux lignes 692, 697, 700. **Conforme.**
- `GameResultsSection` — `r.rank`, `r.xp_gained` → classes `font-mono` présentes aux lignes 779, 784. **Conforme.**
- `age`, `height_cm`, `weight_kg` dans les badges D-002 à D-004 → `font-mono` présent dans le span. **Conforme.**
- `#${rider.pcs_rank}` ligne 359 → `font-mono` présent. **Conforme.**

**Conclusion E : 0 violation réelle.** Le code est exemplaire sur Geist Mono — tous les contextes numériques sont correctement wrappés.

---

## Notes sur page.tsx (0 violations)

Le serveur component `page.tsx` est minimal et propre — 0 violation détectée. Le fallback "Rider not found" utilise correctement `text-[length:var(--type-body)] text-[var(--text-mid)]`.

## Notes sur loading.tsx (0 violations)

Conforme. `border-[var(--accent-default)]`, `text-[length:var(--type-caption)]`, `text-[var(--text-mid)]` — tous des tokens valides.

---

## Cross-cutting issues

1. **B-001/B-003 + C-001 : pattern `red-400` incohérent avec `--danger-*`** — la même page utilise à la fois `text-red-400` (erreur) et `text-[var(--status-danger)]` (erreur dans d'autres composants partagés). Après le sweep, tous les états d'erreur seront alignés sur `--status-danger`.

2. **4 badges hero en ligne (D-001 à D-004)** — pattern dupliqué 4× qui devrait être extrait en `<RiderBadges riders={...} />` ou simplement migré vers `<Tag>`. Si migration Tag choisie, voir l'inconsistance `text-mid` vs `text-low` (Tag default) à trancher avec Jonathan.

3. **`ReleaseConfirmModal` (release-confirm-modal.tsx)** — composant dédié au rider detail uniquement. 1 violation (B-006 `text-red-400`). Audité ici pour exhaustivité, pas en composant partagé (usage = 1 seule page).

---

## Résumé violations

| Classe | Count réel | False positives | Notes |
|---|---|---|---|
| A | 1 | 0 | text-base:486 dans le bid input |
| B | 6 | 0 | 5 dans rider-detail-client + 1 dans release-confirm-modal |
| C | 1 | 0 | mt-[3px]:496 — candidat BLOCKED/MISSING_TOKEN |
| D | 4 (+1 FP) | 1 (D-005 ligne 761) | 4 inline spans à migrer vers Tag |
| E | 0 | — | Exemplaire — tous les nombres sont en font-mono |
| **Total** | **12** | **1** | **11 violations nettes** |

## Checklist verification (à cocher par le repair agent)

- [ ] Screenshot before captured (état: market/bid-input, market/bid-error, team/release-button, tab-pcs, tab-game, modal-release-open)
- [ ] Screenshot after captured
- [ ] Diff visuel: décrire textuellement les changements attendus
  - A-001 : aucun changement visuel (text-base=16px = --type-stat-small mobile). `md:` clause supprimée → vérifier que le responsive ne change pas.
  - B-001 : border erreur passe de rouge vif (red-400=#f87171) à rouge atténué (--danger-border=rgba(239,68,68,0.30)) — changement visible
  - B-002/B-003 : texte erreur passe de red-400 (#f87171) à --status-danger (#ef4444) — légère différence de teinte
  - B-004/B-005/B-006 : texte boutons danger passe de red-400 (#f87171) à --status-danger (#ef4444) — légère différence de teinte
  - D-001 à D-004 : passage aux `<Tag>` — vérifier padding (px-[10px] vs px-2 dans les spans), bg absent dans Tag default
- [ ] typecheck PASS
- [ ] lint PASS (0 warning ignoré)
- [ ] vitest PASS (pattern: rider-detail)
- [ ] Vérifier visuellement que la Section Month label (D-005 FP) n'a pas été touchée

---

## Blocked (à trancher avant Phase 3)

| ID | Issue | Options |
|---|---|---|
| C-001 | `mt-[3px]` — aucun token à 3px | A: ajouter `--space-px-3: 3px` + utiliser `mt-[var(--space-px-3)]` · B: accepter exception + commenter · C: `mt-0.5` (2px, diff visuelle mineure) |
| D-001 à D-004 | `text-[var(--text-mid)]` dans les badges vs `text-[var(--text-low)]` dans Tag default | Trancher : override intentionnel (conserver avec `className`) ou aligner sur text-low ? |

---

## Repair log (à compléter par le repair agent — Phase 3)

_Section vide — à remplir par le Réparateur._
