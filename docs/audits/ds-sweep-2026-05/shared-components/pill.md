# Audit · apps/web/components/pill.tsx
Generated: 2026-05-21
Used by: auction/status, team/strategies-client, team/budget/marketplace-client, components/gt-goals-preview, components/tactic-card, components/sponsor-bonus-card, components/tactic-stage-list (7 direct importers of `Tag` from this file)

## Tour d'horizon

`pill.tsx` EST le composant DS officiel pour les Tags/Pills (§ Tags du design system v3). Il expose :
- `Tag` — composant principal (span + cva)
- `Pill` — alias `@deprecated`, redirige vers `Tag`
- `tagVariants` — export CVA pour composition externe

Variantes disponibles : `default` (border visible, text-low), `highlighted` (badge-bg + accent-label), `success` (success-bg + success), `warning` (warning-bg + warning).

**Conséquence directe pour cet audit :** ce fichier EST la source de vérité du composant. Les valeurs de padding, typography et radius définies ici sont les valeurs *canoniques* qui doivent cascader. Certaines "violations" détectées par le scanner sont donc intentionnellement définissantes — elles doivent être évaluées non pas comme des hardcodes à éliminer, mais comme des candidats à tokeniser si un `--space-*` correspondant existe déjà.

---

## Violations détaillées

### A · Typographie (0)

Aucune violation. Le composant utilise `text-[length:var(--type-caption)]` — conforme au DS.

---

### B · Couleurs (0)

Aucune violation hardcodée. Toutes les couleurs utilisent des tokens sémantiques :
- `var(--border-default)` — default variant
- `var(--text-low)` — default variant
- `var(--badge-bg)` — highlighted variant
- `var(--accent-label)` — highlighted variant
- `var(--success-bg)` / `var(--success)` — success variant
- `var(--warning-bg)` / `var(--warning)` — warning variant

> Note : `--accent-label` est défini en globals.css comme `#0ea5e9` (sky-500 hardcodé à ce niveau primitif — mais c'est un token primitif, pas un hardcode dans le composant). `--success` et `--warning` sont également des valeurs primitives définies une fois dans globals.css. Conformes.

---

### C · Spacing & Radius (2)

| ID | File:Line | Current | Proposed | Confidence | Rationale |
|---|---|---|---|---|---|
| C-001 | pill.tsx:6 | `py-[3px]` | `MISSING_TOKEN · suggère ajouter --space-px-3 ou utiliser py-[var(--space-tag-y)]` | MANUAL | Le DS spec §Tag documente explicitement `padding: 3px 10px` comme valeur canonique. `--space-1` = 4px (trop grand), `--space-0.5` n'existe pas. La valeur 3px est intentionnelle et définissante — aucun token existant ne la couvre. Option alternative : Tailwind `py-0.5` = 2px (trop petit) ou `py-1` = 4px (trop grand). **Aucune substitution propre possible sans casser le rendu**. Flags MISSING_TOKEN. |
| C-002 | pill.tsx:6 | `px-[10px]` | `MISSING_TOKEN · suggère ajouter --space-tag-x: 10px ou utiliser px-2.5` | MANUAL | Le DS spec §Tag documente `padding: 3px 10px` comme valeur canonique. `px-2.5` = 10px en Tailwind (base 4px × 2.5). **Substitution propre disponible : `px-2.5`**. Pas de token sémantique dédié, mais l'équivalent Tailwind standard existe. Confidence abaissée à MANUAL car le DS pourrait vouloir un token `--space-tag-x` pour pouvoir ajuster à la volée. |

> **Analyse MISSING_TOKEN détaillée :**
>
> Le DS §Spacing liste `--space-1: 4px`, `--space-2: 8px`, `--space-3: 12px`. Il n'y a pas de token couvrant 3px (padding vertical tag) ni de token explicite pour le padding horizontal 10px. La spec Tag §Tokens documente textuellement "3px 10px padding" comme valeur du composant sans assigner de token. Deux lectures possibles :
>
> 1. **Lecture conservatrice** : ces valeurs sont intentionnellement non-tokenisées car elles sont internes au composant. Le composant Pill est lui-même le token. → `py-[3px] px-[10px]` sont légitimes, mais `px-2.5` serait plus propre pour le px.
>
> 2. **Lecture stricte sweep** : même les valeurs internes d'un composant DS devraient utiliser des tokens ou des Tailwind utilities standards quand ils existent. → `px-2.5` pour les 10px, `py-[3px]` reste un MISSING_TOKEN.

---

### D · Patterns composants (0)

`false-positive · this IS the Pill primitive`

Le composant est lui-même le primitif Tag/Pill. Il n'y a pas de `<span className="rounded-full border...">` inline qui devrait être remplacé par `<Tag>` — c'est le fichier qui DÉFINIT `<Tag>`. Aucune violation D applicable.

---

### E · Geist Mono numbers (0)

Aucune valeur numérique inline dans le JSX du composant. Les enfants (`{children}`) sont fournis par les consommateurs — auditables dans leurs propres rapports.

---

## Cross-cutting issues (à logger en follow-ups)

1. **`Pill` deprecated sans migration documentée** : l'alias `export const Pill = Tag` est marqué `@deprecated` mais aucune date de suppression ni migration guide n'est documentée. 0 consommateur direct trouvé (tous importent `Tag`), mais le nom `Pill` reste exporté et accessible. → follow-up : supprimer l'export `Pill` dans un chantier de nettoyage séparé.

2. **`gap-1.5` vs `--space-1: 4px`** : le composant utilise `gap-1.5` = 6px pour l'espacement icône-label, alors que le DS spec §Tag documente `gap: 4px` (`--space-1`). Discordance spec/implémentation. Ce n'est pas une violation de classe C (pas de `[Npx]` arbitraire), mais mérite attention. → follow-up : aligner sur `gap-1` (4px) ou mettre à jour la spec.

3. **`[&>svg]:size-3`** = 12px pour les icônes SVG — valeur hardcodée via variant arbitraire Tailwind. Pas dans le scope A-E (pas une propriété de spacing/radius/couleur/typo), mais c'est un candidat token `--icon-size-tag: 12px`. → follow-up hors scope.

4. **`warning-bg` discordance spec** : la spec DS §Tag documente `rgba(245,158,11,0.08)` pour warning background, mais globals.css définit `--warning-bg: rgba(245, 158, 11, 0.10)`. Opacité 0.08 (spec) vs 0.10 (implémentation). Pas une violation du composant pill.tsx (qui utilise le token), mais une inconsistance spec/token. → follow-up dans un chantier design-system-token-audit.

---

## Checklist verification (à cocher par le repair agent)

- [ ] Screenshot before captured (état: default, highlighted, success, warning)
- [ ] Screenshot after captured
- [ ] Diff visuel: décrire textuellement les changements attendus
  - C-001 (`py-[3px]`) : si conservé ou remplacé par `py-[var(--space-tag-y)]`, aucun changement visuel (valeur identique). Si `py-0.5` → léger écrasement vertical (2px vs 3px) — **RÉGRESSION potentielle**.
  - C-002 (`px-[10px]` → `px-2.5`) : aucun changement visuel (10px = 10px). Safe.
- [ ] typecheck PASS
- [ ] lint PASS (0 warning ignoré)
- [ ] vitest PASS sur les tests touchant pill.tsx
- [ ] Pas de régression sur les 7 pages/composants consommateurs (audit visuel spot-check recommandé sur auction/status et tactic-card qui ont des usages visibles en prod)

---

## Résumé pour Phase 3 (Réparateur)

| Classe | Count | Action recommandée |
|---|---|---|
| A | 0 | Rien |
| B | 0 | Rien |
| C | 2 | C-001 : MISSING_TOKEN (bloquer si pas de token ajouté), C-002 : remplacer par `px-2.5` (safe) |
| D | 0 | false-positives — composant primitif |
| E | 0 | Rien |
| **Total** | **2** | **1 safe AUTO, 1 BLOCKED/MISSING_TOKEN** |

### Décision recommandée pour Jonathan (gate Phase 2)

- **C-002 (`px-[10px]` → `px-2.5`)** : AUTO-safe, à appliquer. Sémantiquement équivalent (10px = 10px), élimine l'arbitraire `[Npx]`.
- **C-001 (`py-[3px]`)** : BLOCKED en attente de décision. Deux options :
  - Option A — Ajouter `--space-tag-y: 3px` dans globals.css et utiliser `py-[var(--space-tag-y)]`
  - Option B — Accepter `py-[3px]` comme valeur définissante interne du primitif (exception documentée dans DS)
  - Option C — Utiliser `py-px` (1px, trop petit) × 3 n'existe pas en Tailwind standard

> **Recommandation de l'auditeur** : Option B. Ce composant IS le primitif — la valeur 3px est la spec. L'annotater avec un commentaire `/* DS canonical: tag padding-y */` plutôt que de créer un token one-off. Logger dans follow-ups.md pour considération lors du prochain DS token audit.
