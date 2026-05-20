# Audit · AchievementBadge
Generated: 2026-05-21
File: apps/web/components/achievement-badge.tsx

---

## Description fonctionnelle

Composant d'affichage des badges d'achievement. Rendu en cercle avec un ring coloré selon le tier (`victory`, `podium`, `top10`, `dynamic`) et des animations CSS `box-shadow`. État `locked` → grayscale + ring gris.

---

## A — Violations confirmées

### A-001 · Lines 7, 8, 49, 50 · HEX `#fbbf24` / `#fbbf2444` / `#fbbf2488` / `#fbbf2422` (classe B)
- **Context** : ring border et glow pour tier `victory` (amber-400)
- **DS check** : `#fbbf24` = Tailwind amber-400. Aucun token DS n'est défini pour cette couleur dans `globals.css`. Le DS ne documente pas de tokens d'achievement tier.
- **Verdict** : MISSING_TOKEN — pas de `--warning` exact ici (`--warning` = `#f59e0b` = amber-500, une teinte différente)
- **Proposed** : Créer tokens `--tier-victory: #fbbf24` et `--tier-victory-glow: rgba(251, 191, 36, 0.27)` dans globals.css, puis les référencer. Alternativement, si le DS étend le DS pour les achievements, utiliser `--warning` (#f59e0b, amber-500) comme approximation acceptable — à valider avec le designer.
- **BLOCKED** : Non (mais nécessite décision produit sur tokens à créer)

### A-002 · Lines 12, 13 · HEX `#f59e0b` / `#f59e0b55` (classe B)
- **Context** : ring border et glow pour tier `podium` (amber-500)
- **DS check** : `#f59e0b` = `--warning` exactement. Token DS disponible.
- **Verdict** : violation résolvable — remplacer par `var(--warning)` et `rgba(245, 158, 11, 0.33)` (approximation de `#f59e0b55`)
- **Proposed** :
  ```ts
  podium: {
    border: "var(--warning)",
    shadow: "0 0 8px var(--warning-border)", // --warning-border = rgba(245,158,11,0.30)
    animation: "none",
  }
  ```
- **BLOCKED** : Non

### A-003 · Lines 17, 43 · HEX `#6b7280` (classe B) — tier `top10` et état `locked`
- **Context** : ring border gris pour riders top10 et badges locked
- **DS check** : `#6b7280` = Tailwind gray-500. Aucun token DS exact dans globals.css. Le plus proche sémantique est `--color-b1-8: #40535d` (gris bleuté) ou `--text-mid` (alias de `--color-b1-10`). Gray-500 pur est en dehors de la palette Sky Blue Night.
- **Verdict** : MISSING_TOKEN — la palette DS ne couvre pas le gris neutre. Deux options :
  1. Utiliser `--color-b1-8` ou `--color-b1-9` comme ring gris neutre (aligné palette)
  2. Ajouter un token `--tier-locked: var(--color-b1-8)` dans globals.css
- **Proposed** : `border: "var(--color-b1-8)"` (primitive disponible) comme fix minimal acceptable
- **BLOCKED** : Non

### A-004 · Lines 22, 23, 53, 54 · HEX `#22d3ee` / `#22d3ee44` (classe B) — tier `dynamic`
- **Context** : ring border et glow pour tier `dynamic` (cyan-400)
- **DS check** : `#22d3ee` = `--color-cyan-400` exactement. Primitive disponible. Pas de token sémantique direct mais `--color-cyan-400` est un token primitif documenté DS.
- **Verdict** : violation partiellement résolvable — `#22d3ee` → `var(--color-cyan-400)`. Pour `#22d3ee44` (opacity 27%), utiliser `color-mix` ou `rgba(34, 211, 238, 0.27)` littéral. Dans les keyframes CSS inline, `var()` est supporté.
- **Proposed** :
  ```ts
  dynamic: {
    border: "var(--color-cyan-400)",
    shadow: "0 0 6px var(--color-cyan-400)",
    animation: "achievement-pulse 2.5s ease-in-out infinite",
  }
  ```
  Et dans les keyframes inline : remplacer `#22d3ee` par `var(--color-cyan-400)`.
  Note : les keyframes dans `<style>` injectée inline ne peuvent pas utiliser `var()` CSS directement dans `box-shadow` dans tous les contextes — à tester. Alternative : définir les keyframes dans `globals.css`.
- **BLOCKED** : Non (mais note technique sur les keyframes inline)

---

## B — Faux positifs documentés

**Aucun FP.** Toutes les violations B détectées par le script audit-ds correspondent à de vraies utilisations hardcodées de hex sans token DS existant. L'argument "intentionnel pour tier colors" est recevable comme justification métier mais ne constitue pas une exception légitime tant qu'aucun token n'est formellement défini dans le DS.

**Décision recommandée** : les couleurs de tier achievement sont des constantes de gameplay qui méritent leurs propres tokens primitifs dans globals.css (section "Gamification tokens"). Ce n'est pas une exception au DS — c'est une extension manquante du DS.

---

## C — Tokens fantômes

Aucun token DS fantôme (les hex hardcodés sont des hex littéraux, pas des `var()` invalides).

---

## D — Composants inline

### D-001 · `<style>` injectée (lignes 47–56)
- Les keyframes CSS sont injectées via un tag `<style>` inline dans le JSX. C'est un pattern acceptable pour les animations React pures sans lib d'animation, mais crée un risque de duplication si le composant est rendu multiple fois.
- **Proposed** : déplacer `@keyframes achievement-breathe` et `@keyframes achievement-pulse` dans `apps/web/app/globals.css` pour éviter la duplication et permettre l'usage de variables CSS.
- **BLOCKED** : Non

---

## E — Résumé

| Aspect | Violations réelles | FP | BLOCKED | Notes |
|---|---|---|---|---|
| HEX tier victory (#fbbf24) | 4 occurrences | 0 | Non | Aucun token DS — créer `--tier-victory` |
| HEX tier podium (#f59e0b) | 2 occurrences | 0 | Non | Mappable sur `--warning` / `--warning-border` |
| HEX locked/top10 (#6b7280) | 2 occurrences | 0 | Non | Mappable sur `--color-b1-8` (primitive) |
| HEX tier dynamic (#22d3ee) | 6 occurrences | 0 | Non | Mappable sur `--color-cyan-400` (primitive) |
| Keyframes inline | 1 pattern | 0 | Non | Déplacer dans globals.css recommandé |

**Total violations** : 14 B (détectées par le script) + 1 pattern D (keyframes inline).
**BLOCKED** : Aucune violation bloquante. Le composant fonctionne mais viole la règle d'absence de hex hardcodés.
**Action prioritaire** : A-002 (podium → `--warning`) et A-004 (dynamic → `--color-cyan-400`) sont triviales. A-001 (victory) et A-003 (locked) nécessitent un choix de token à créer ou une décision de palette.
