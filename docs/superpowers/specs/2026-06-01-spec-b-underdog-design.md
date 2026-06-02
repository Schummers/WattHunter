# Spec B — Système Underdog (Refonte équilibrage)

> Statut : **DRAFT** · 2026-06-01 · Partie 2/3 de la refonte équilibrage
> Remplace la Remontada (désactivée). Spec A = levels/rôles · Spec C = bonus/sponsors

## Contexte & problème

Les meilleures équipes débloquent les meilleurs coureurs (plus de level, plus d'argent), prennent le moins de risques et creusent l'écart. Les équipes faibles n'ont aucun chemin de remontée.

L'idée de la Remontada était bonne (permettre de remonter) mais sa mécanique d'overtakes était fragile aux recalculs (désactivée le 2026-05-21). On la remplace par un **style de jeu alternatif pour les équipes faibles** : jouer des outsiders.

**But : donner aux équipes faibles un levier fort et lisible pour rattraper, en récompensant les paris sur des coureurs improbables.**

## Concept

L'underdog se joue à deux niveaux :

1. **Au niveau de l'équipe** (équipes faibles éligibles) : plus de place dans le roster + coureurs moins chers, pour pouvoir prendre des risques.
2. **Au niveau du coureur** (un nouveau rôle) : un boost de scoring qui récompense un coureur mal classé qui surperforme.

**Définition unique d'un "coureur underdog" = rang PCS au-delà du #100.** Ce seuil unique sert à la fois pour la réduc salaire et pour le boost (cohérence).

## Décisions (LOCKED sauf marqué OPEN)

### B1 — Éligibilité d'une équipe

- Une équipe est **underdog-éligible** si `cumulative_xp < 75% du leader`.
- Recalculé **au début de CHAQUE phase de jeu (GT ou non), avant le premier round** — y compris les phases sans Grand Tour. Snapshot figé pour toute la phase. Les perks squad/rôle ne s'activent qu'en phase GT ; la **réduc salaire s'applique à toutes les phases**.
- Exemple post-Giro (leader Klimax 2607 → seuil 1955) : éligibles = AussieMate, Goudal, Peejee, Dixon, Muscat, bigdaddy (6/8). Non éligibles = Klimax, Leopard.

### B2 — Perks des équipes éligibles

- **Squad GT élargi : 8 → 10 coureurs.** Les 2 slots supplémentaires sont des **slots de rôle underdog** (cap 2), ajoutés aux caps existants (gc1, sprint1, climb1, tt1, hunter2, dom2 = 8 → +underdog2 = 10).
- **Réduction de salaire −50%** sur les coureurs **rang PCS > #100**, **uniquement sur les coureurs ACQUIS pendant une phase où l'équipe est éligible** (les coureurs déjà détenus avant ne sont PAS réduits).
  - S'applique au **salaire mensuel récurrent** (= plancher d'enchère). **Arrondi à l'incrément 100 €**, **plancher minimum conservé**.
  - Tient pour toute la phase. **Si l'équipe n'est plus éligible à une phase suivante → la réduction disparaît** : les coureurs concernés repassent au plein tarif.
  - Implémentation : flag `underdog_discount` sur le contrat à l'acquisition (si équipe éligible + rk>100). Salaire effectif = plein × 0.5 **SI** (flag **ET** équipe actuellement éligible), sinon plein tarif. Réévalué à chaque phase.
- Le **rôle underdog est indisponible** pour les équipes non-éligibles.

### B2bis — Affichage du prix réduit (UI) — VALIDÉ + maquetté 2026-06-02

**Maquette HTML validée : [`docs/mockups/2026-06-02-ui-mockups.html`](../../mockups/2026-06-02-ui-mockups.html)** — section 2 (prix underdog).

Principe : montrer le **prix plein barré + le prix réduit** uniquement là où s'affiche un **prix d'acquisition** (min salaire / plancher d'enchère), jamais sur les montants déjà payés/engagés (salaire locked, enchères placées, results, history, treasury/budget).

**Décisions de design (LOCKED 2026-06-02, validées sur maquette) :**
- **Pas de puce / chip** (pas la place). Juste **prix plein barré** (`--text-low`) + **prix réduit** (`--text-high`).
- **Un seul layout : "to the right"** (plein barré puis réduit, sur une ligne) appliqué **partout** — l'option "below" est abandonnée (le format K rend le "right" assez compact pour toutes les surfaces, mobile inclus).
- **Prix affichés en format "K"** (ex. `52k → 26k`, `500k`) sur toutes les surfaces de prix coureur.
- **Composant partagé `<RiderPrice>`** (source unique) à créer et à migrer sur les ~6 sites — unifie aussi les 3 formats incohérents actuels (`155,000 EUR` / `€155 000` / `155 000`).

**Sites concernés (prix d'acquisition / min salaire)** : `auction/[auctionId]/rider-table.tsx` (col. Salary), `rider-dialog.tsx` (Minimum salary + label d'enchère), `rider/[riderId]/rider-detail-client.tsx` (box "Min. Salary"), `components/draft-bid-card.tsx` (helper min), `auction/market/market-client.tsx` (placeholder + helper "Min:"). **Ne PAS toucher** : montants réels déjà payés/engagés.

> **⚠️ Dépendance — spec "prix au millier"** : l'affichage en K et le strikethrough propre ne tiennent que si les enchères passent au pas de **1 000 €** (aujourd'hui 100 €). C'est une **constante de jeu** (`docs/GAME_RULES.md §11`, anti-intuition CLAUDE.md) → **un spec dédié est requis avant l'implémentation `<RiderPrice>`** (formule de salaire arrondie au millier, step/validation d'enchère, migration des montants existants, invariants treasury). Voir l'index de refonte.

### B3 — Rôle Underdog & boost dynamique

- Nouveau rôle `underdog` (cap 2 par squad), assignable uniquement par les équipes éligibles.
- **Boost = rang absolu** : `mult = clamp(rang_PCS_coureur / 100, 1, 4)`.
  - Rang figé en début de course.
  - Pas de boost sous le rk100 (×1.0). Monte linéairement jusqu'à ×4 à partir du rk400. Plafond ×4.
  - **S'applique aux points de l'étape** des coureurs en rôle underdog, sur **toutes les étapes de GT**.
  - **Ne s'applique PAS aux classements finaux** (`/gc`) — cohérent avec Spec A / D4 (Q7).
- **Rejeté** : la variante "field-relative" (ratio vs moyenne du top 15). Testée sur données réelles, elle sous-récompense les vrais coups (ex. Valgren gagne une étape → ×1.0 car son échappée était faible) et dépend du field du jour.

**Cas réels validés (Giro 2026), rang absolu cap 4 :**

| Coureur | Rang | Résultat | Boost | XP |
|---|---|---|---|---|
| Valgren | 272 | gagne st.17 | ×2.72 | 218 |
| Dversnes | 213 | gagne st.15 | ×2.13 | 170 |
| Milesi | 260 | 4e st.5 | ×2.60 | 65 |
| Plowright | 381 | 4e st.6 | ×3.81 | 95 |
| Maestri | 432 | 2e st.15 | ×4.0 | 200 |
| Silva | 69 | gagne st.2 | ×1.0 | 80 *(bon coureur, pas underdog)* |

Le multiplicateur multiplie des points déjà gagnés : petit résultat × gros mult reste petit ; gros résultat (victoire) × gros mult = jackpot. La hiérarchie des places est préservée.

## Impact technique

| Changement | Approche |
|---|---|
| Rôle `underdog` | étendre l'enum des rôles (`gt_role_assignments`, contrainte de rôle) |
| Caps de rôle 8→10 | logique de cap conditionnée à l'éligibilité (RPC squad) |
| Éligibilité <75% leader | vue/RPC calculée au début de phase GT (snapshot) |
| Réduc salaire −50% rk>100 | logique de salaire/plancher d'enchère (côté RPC enchère + affichage) |
| Boost rang absolu | `scoring.py` — mult underdog = clamp(rang/100,1,4) sur résultats d'étape |

## Questions ouvertes (Spec B)
- **Q7** — Le boost underdog s'applique-t-il UNIQUEMENT aux résultats d'étape (pas aux `/gc`) ? (reco : oui, cohérent avec D4)
- **Q8** — Éligibilité : snapshot au début de la phase GT, figé pendant toute la phase ? (reco : oui)
- **Q10** — Réduc salaire −50% : arrondi à l'incrément 100 € ? Plancher minimum de salaire conservé ?
- **Q11** — Confirmer : les 2 slots élargis sont exclusivement des slots underdog (pas des slots libres pour d'autres rôles) ?
