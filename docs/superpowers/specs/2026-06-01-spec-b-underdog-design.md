# Spec B — Underdog — Design

> 2026-06-02 · Source de vérité Spec B (consolide le journal `memory/sessions/2026-05-31.md`, les arbitrages de session, et la §B2bis UI de la version main). **Cette version écrase le draft main au merge.**
> Partie de la refonte équilibrage (voir `docs/handoffs/2026-06-02-refonte-equilibrage-index.md`).
> Statut : **figé**, plan d'implémentation prêt → `docs/superpowers/plans/2026-06-02-spec-b-underdog.md`.

## Intention

À la fin du Giro 2026 les écarts d'XP/argent explosent. Spec A ralentit le leader ; **Spec B fait remonter les faibles**. Mécanisme : un rôle « underdog » réservé aux équipes en retard, qui booste les coups d'éclat des coureurs peu cotés, élargit le squad et réduit leurs salaires — le tout réversible dès que l'équipe remonte.

## Concept central

**Underdog = un RÔLE de squad** (comme gc_leader, sprinter…), cap **2** par équipe/GT, **assignable uniquement par les équipes éligibles**. Ce n'est pas un modificateur global sur tous les coureurs.

## B0 — Éligibilité d'équipe (infra partagée)

- **Critère** : `team.cumulative_xp < 0.75 × max(cumulative_xp de la ligue)`. Le leader (= le max) n'est jamais éligible.
- **Snapshot** : recalculé à chaque frontière de phase WT (et donc à chaque début de GT). On stocke :
  - une **table d'audit** `underdog_eligibility(team_id, phase_id, year, is_eligible, leader_xp, team_xp, computed_at)` — historique par phase ;
  - un **flag runtime dénormalisé** `teams.underdog_eligible boolean` — lu par les triggers/paie.
- **RPC** `recompute_underdog_eligibility(p_phase_id, p_year)` (SECURITY DEFINER) : pour chaque ligue, calcule le leader, met à jour `teams.underdog_eligible` + upsert le snapshot. Invoquée par une commande Python (`run_pipeline.py underdog-eligibility`) au début de chaque phase/GT — cohérent avec le modèle opérationnel local (post-race, startlists…).

> **Résolution d'ambiguïté** : le journal dit « recalculé à chaque GT ». Comme la réduc salaire doit « revenir plein tarif à la phase suivante » (paie = chaque phase WT) et que le squad 1-semaine arrive en Spec C, on recalcule **à chaque phase** (surensemble strict). Le flag `teams.underdog_eligible` est l'unique source runtime.

## B1 — Coureur underdog

**Définition unique** : `riders.pcs_rank > 100`. Sert à la fois au boost et à la réduc salaire (seuil cohérent).

## B2 — Boost dynamique (scoring)

- **Formule** : `mult = clamp(pcs_rank / 100, 1, 4)` — **rang ABSOLU** (pas field-relative).
- **Portée** : appliqué aux coureurs **en rôle underdog**, sur les **étapes** d'un GT uniquement. **PAS sur les classements finaux** (`/gc`, `/points`, `/kom`) — cohérent avec le lock Spec A D4 (aucun mult de rôle sur les finals). `mult = 1.0` sur un slug `/gc`.
- **Implémentation** : le boost remplace `gt_role_mult` pour les coureurs underdog (le slot `gt_role_mult` du pipeline existant), donc il traverse naturellement strategy bonus / classif / nemesis / remontada.
- **Validé sur 6 cas réels Giro** : Valgren rk272 win →×2.72 (218 XP) · Dversnes rk213 win →×2.13 (170) · Milesi rk260 4e →×2.60 (65) · Plowright rk381 4e →×3.81 (95) · Maestri rk432 2e →×4 (cap, 200) · Silva rk69 win →×1.0 (bon coureur, pas underdog). Field-relative rejeté (Valgren aurait eu ×1.0 sur une échappée faible).

## B3 — Cap squad 8 → 10

- Les équipes éligibles peuvent aligner **10** coureurs dans le `gt_squad` (au lieu de 8). Les 2 slots sont **libres** (n'importe quel coureur, pas forcément underdog).
- **Borné par le roster, lui-même borné par le level** (colonne *Slots* : L1=6 … **L5=10** … L7-8=12). Un underdog Level 3 (roster ≤ 8) ne profite pas du cap à 10 : il faut le bon level. C'est voulu.
- **Réversible** : à la sortie de zone, le cap repasse à 8 à la phase suivante. **Rien à release** — le squad est une sélection par course, pas une possession. Si l'équipe avait 10 sélectionnés, elle devra en désélectionner 2 pour le GT suivant (le cap insert l'y forcera).
- **Scope** : GT uniquement (`gt_squad` = phases 4/6/8). Le squad des courses 1-semaine est livré par Spec C ; l'éligibilité B0 sera réutilisée telle quelle.

## B4 — Réduc salaire −50 %

- **−50 %** sur le salaire récurrent des coureurs **`pcs_rank > 100`**, **recrutés pendant que l'équipe est éligible** (contrats existants exclus).
- **Flag** : `contracts.underdog_discount boolean`, posé à la création du contrat par un trigger `BEFORE INSERT` (si `teams.underdog_eligible` ET `pcs_rank > 100`). Robuste quelle que soit la voie de création du contrat.
- **Application** : à la **paie** (`confirm_phase_setup`), pour chaque contrat actif : si `teams.underdog_eligible` (actuel) ET `contracts.underdog_discount` → débit = `floor(locked_salary × 0.5 / 100) × 100` ; sinon `locked_salary` plein.
- **Réversible** : dès que l'équipe remonte (`underdog_eligible = false`), la paie suivante reprend le plein tarif. Le flag de contrat reste posé (réactivable si l'équipe re-décroche).
- **Pas de changement à l'enchère** : `place_bid` inchangé. Le plancher d'enchère reste le salaire plein ; la réservation de solvabilité reste pleine (conservateur, sûr). L'avantage réel = le débit récurrent divisé par deux. Arrondi au pas de 100 € (cohérent `floor(.../100)×100`).

## B2bis — Affichage du prix réduit (UI) — VALIDÉ + maquetté 2026-06-02

> Contrepartie visuelle de B4. **Hors périmètre du plan backend Spec B** : c'est de l'UI transverse (composant partagé `<RiderPrice>`) qui dépend de **Spec D — prix au millier**. Tracké ici pour la cohérence ; implémenté dans son propre lot. Le backend B4 (flag `underdog_discount` + éligibilité) **produit** le prix réduit que ce composant affiche.

**Maquette HTML validée : [`docs/mockups/2026-06-02-ui-mockups.html`](../../mockups/2026-06-02-ui-mockups.html)** — section 2 (prix underdog). *(Le fichier maquette vit dans le checkout main, non committé — à committer pour que le lien résolve post-merge.)*

Principe : montrer le **prix plein barré + le prix réduit** uniquement là où s'affiche un **prix d'acquisition** (min salaire / plancher d'enchère), jamais sur les montants déjà payés/engagés (salaire locked, enchères placées, results, history, treasury/budget).

**Décisions de design (LOCKED 2026-06-02, validées sur maquette) :**
- **Pas de puce / chip** (pas la place). Juste **prix plein barré** (`--text-low`) + **prix réduit** (`--text-high`).
- **Un seul layout : "to the right"** (plein barré puis réduit, sur une ligne), appliqué **partout** — l'option "below" est abandonnée (le format K rend le "right" assez compact, mobile inclus).
- **Prix en format "K"** (ex. `52k → 26k`, `500k`) sur toutes les surfaces de prix coureur.
- **Composant partagé `<RiderPrice>`** (source unique) à créer et migrer sur les ~6 sites — unifie aussi les 3 formats incohérents actuels (`155,000 EUR` / `€155 000` / `155 000`).

**Sites concernés (prix d'acquisition / min salaire)** : `auction/[auctionId]/rider-table.tsx` (col. Salary), `rider-dialog.tsx` (Minimum salary + label d'enchère), `rider/[riderId]/rider-detail-client.tsx` (box "Min. Salary"), `components/draft-bid-card.tsx` (helper min), `auction/market/market-client.tsx` (placeholder + helper "Min:"). **Ne PAS toucher** : montants réels déjà payés/engagés.

> **⚠️ Dépendance — Spec D « prix au millier »** : l'affichage en K et le strikethrough propre ne tiennent que si les enchères passent au pas de **1 000 €** (aujourd'hui 100 €). C'est une **constante de jeu** (`docs/GAME_RULES.md §11`) → **spec D dédié requis avant l'implémentation `<RiderPrice>`** (formule salaire arrondie au millier, step/validation d'enchère, migration des montants existants, invariants treasury). Voir l'index de refonte. **Note de cohérence** : B4 fixe l'arrondi de la réduc salaire au pas de 100 € ; si Spec D passe au millier, réaligner B4 sur 1 000 €.

## B5 — Goals sponsors Visma / Red Bull

Hors périmètre Spec B (couvert par Spec C) : même set de goals que T4 (Ineos/Decathlon/Soudal/Lidl), **sans** bonus nationalité.

## Dépendances

- **Spec A P1** : `riders.pcs_rank` existe déjà — pas de capture à ajouter.
- **Spec A A9 « Race Team » (dépendance DURE, ordre de build)** : A9 généralise `gt_squad` + les RPCs `gt_add_to_squad`/`gt_assign_role`/`enforce_gt_squad_cap` de `phase_id (4/6/8)` vers un identifiant `race_slug`. Ce sont **exactement les objets que B3 (cap squad + rôle) réécrit**. → Construire **A9 avant** la partie squad de Spec B, puis rebaser B3 sur les RPCs généralisés (clé d'éligibilité sur le même identifiant de course qu'A9 choisit). Le cap 8→10 s'étendra alors naturellement aux courses 1-semaine.
- **Spec A P2** (scoring refonte) : le boost B2 modifie le calcul de `gt_role_mult` dans `scoring.py`. Si P2 atterrit d'abord, rebaser la Task scoring sur le nouveau code — le point d'injection (role mult des membres de squad GT) reste stable.
- **Spec C** : pas de dépendance de build. Croisement uniquement en B5 (goals Visma/RB), porté par Spec C.
- **Spec D « prix au millier »** : prérequis de la §B2bis (UI), pas du backend B1-B5.

## Hors périmètre (non régressions à préserver)

- Pas de mult de rôle sur les classements finaux (lock D4).
- Tactiques (Unleash/Overdrive/Nemesis/Call the Bus) inchangées ; underdog n'interagit avec aucune.
- RLS jamais bypassé ; tout passe par RPC SECURITY DEFINER. App en anglais.
