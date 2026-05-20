# Audit · /league/[id]/settings
Generated: 2026-05-21
Files: page.tsx + settings-buttons.tsx + loading.tsx
States: unauthenticated, member, commissioner

---

## Component tree rendu (1 niveau)

- `page.tsx` (Server Component)
  - `BackHeader` → voir shared-components/back-header.md (déjà audité — NE PAS dupliquer)
  - `EditableField` (×4 — First name, Email, League name, Team name) ← settings-buttons.tsx
  - `Link` — "Create a new league" button
  - `SignOutButton` ← settings-buttons.tsx
  - `InviteUrlDisplay` ← settings-buttons.tsx
    - `CopyInviteCodeButton` (URL variant)
  - `CopyInviteCodeButton` (code variant)
  - `LeaveLeagueButton` ← settings-buttons.tsx
  - `LeagueSelector` ← settings-buttons.tsx (importé mais non utilisé dans page.tsx — composant mort)
- `loading.tsx` — spinner centré (pattern identique aux 3 loading skeletons)

## Composants partagés utilisés (déjà audités — NE PAS dupliquer)
- `BackHeader` → voir shared-components/back-header.md
- `Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem` (Shadcn) — dans `LeagueSelector` (non rendu actuellement)

---

## Violations détaillées

### A · Typographie (1)

| ID | File:Line | Current | Proposed | Confidence | Rationale |
|---|---|---|---|---|---|
| A-001 | settings-buttons.tsx:54 | `text-base md:text-[length:var(--type-body)]` | `text-[length:var(--type-body)]` (sans `text-base` fallback) | HIGH | `text-base` = 16px Tailwind hardcodé. Sur mobile, bypasse le token `--type-body` (14px). Le fallback mobile non-tokenisé brise la règle DS §Typographie : "ALWAYS use `text-[length:var(--type-*)]` tokens. NEVER hardcode pixel sizes." La valeur mobile devrait également utiliser `text-[length:var(--type-body)]`. **Note Jules : flaggé ligne 54 — confirmé.** |

### B · Couleurs (0)

Aucune violation. Tous les tokens utilisés sont valides :
- `--text-high`, `--text-mid`, `--text-low` → corrects
- `--accent-default` → correct (lien CTA, focus input, bouton Create)
- `--status-danger` → correct (SignOutButton, LeaveLeagueButton)
- `--border-default`, `--border-hover`, `--border-subtle` → corrects
- `--bg-surface`, `--bg-app`, `--bg-surface-hover` → corrects

### C · Spacing & Radius (1)

| ID | File:Line | Current | Proposed | Confidence | Rationale |
|---|---|---|---|---|---|
| C-001 | settings-buttons.tsx:61 | `rounded-lg` (bouton check save) | `rounded-[var(--radius-md)]` | MANUAL | Le bouton ✓ (check save) utilise `rounded-lg` (8px = `--radius-lg`). DS §Radius-as-affordance : les boutons interactifs → 6px (`--radius-md`). `rounded-lg` (8px) est réservé aux cards / tab chips. Confidence MANUAL car tous les autres boutons h-9 de la page utilisent `rounded-lg` de manière cohérente — possible décision intentionnelle "icon-button = card radius". Demander confirmation avant de changer. |

### D · Patterns composants (2)

| ID | File:Line | Current pattern | Proposed component | Rationale |
|---|---|---|---|---|
| D-001 | settings-buttons.tsx:130-141 | `window.confirm(...)` natif + `alert(result.error)` dans `LeaveLeagueButton` | Toast/modal DS ou `<dialog>` customisé | Les dialogs `confirm()` et `alert()` natifs bypassen le design system (couleurs, typographie, dark theme). Proposer : soit un modal de confirmation DS (pattern à créer), soit a minima un toast pour les erreurs. Pas de pattern DS défini pour les confirmations destructives — logger en **follow-up**. Ne pas bloquer Phase 3. |
| D-002 | settings-buttons.tsx:180-213 | `LeagueSelector` exporté mais non importé/utilisé dans `page.tsx` | Supprimer ou déplacer | Composant mort (dead export). Importe `Select` de Shadcn inutilement. Risque : confusion lors des prochaines modifications. Logger en follow-up cleanup. |

### E · Geist Mono numbers (1)

| ID | File:Line | Current | Proposed | Confidence | Rationale |
|---|---|---|---|---|---|
| E-001 | settings-buttons.tsx:221 | `<span className="font-mono text-[length:var(--type-body)] text-[var(--text-mid)]">{league?.invite_code ?? "------"}</span>` | Conforme — FP | Le code d'invitation utilise `font-mono` → correct. DS §Typographie : "Geist Mono (ALL numbers)". Le code invite est alphanumérique. **Faux positif** : conforme. |

---

## Résumé

| Catégorie | Violations | FP |
|---|---|---|
| A · Typographie | 1 (HIGH) | 0 |
| B · Couleurs | 0 | 0 |
| C · Spacing & Radius | 1 (MANUAL) | 0 |
| D · Patterns | 2 (follow-up) | 1 |
| E · Geist Mono | 0 | 1 |
| **Total** | **4** | **2** |

**BLOCKED** : aucun. A-001 est actionnable directement.

**Follow-ups Phase 3** :
- Confirmation destructive (`confirm()`/`alert()`) → créer pattern modal/toast DS
- `LeagueSelector` dead export → cleanup
- C-001 : décision radius icon-buttons (6 vs 8px) à trancher avec Jonathan
