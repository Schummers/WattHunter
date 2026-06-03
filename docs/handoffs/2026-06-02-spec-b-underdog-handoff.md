# Handoff — Spec B : Système Underdog

> Lire d'abord : `docs/handoffs/2026-06-02-refonte-equilibrage-index.md` + le spec `docs/superpowers/specs/2026-06-01-spec-b-underdog-design.md`.

## Statut : DESIGN quasi complet — reste l'UI (→ discussion mockups séparée)

## Décisions lockées (résumé — détail dans le spec)

- Remplace la Remontada (désactivée). Concept : style de jeu alternatif pour équipes faibles = parier sur des outsiders.
- **Définition coureur underdog = rang PCS > #100** (seuil unique boost + réduc).
- **Éligibilité équipe** : `cumulative_xp < 75% du leader`, recalculé **au début de CHAQUE phase de jeu (GT ou non), avant le 1er round**, figé pour la phase. Perks squad/rôle → phases GT ; réduc salaire → toutes phases.
- **Perks éligible** : squad GT **8→10** (2 slots **exclusivement** rôle underdog, cap 2) ; **réduc salaire −50%** sur coureurs rk>100.
- **Réduc salaire** : uniquement sur coureurs **ACQUIS pendant une phase éligible** (pas les anciens) ; arrondi 100 €, plancher conservé ; **disparaît si l'équipe perd l'éligibilité** (retour plein tarif). Impl. proposée : flag `underdog_discount` sur le contrat ; salaire effectif = plein×0.5 SI (flag ET équipe actuellement éligible).
- **Boost = rang absolu** `clamp(rang_PCS/100, 1, 4)`, coureurs en rôle underdog, **résultats d'étape seulement** (PAS /gc). Validé sur 6 cas réels Giro (Valgren rk272 win ×2.72, Maestri rk432 2e ×4, Silva rk69 win ×1.0…). Variante field-relative REJETÉE.

## Opens / doutes

1. **UI prix réduit** (le gros reste) : afficher prix plein barré + prix réduit, uniquement sur les **prix d'acquisition** (~6 sites : table enchère, modal bid, fiche coureur box Min Salary, draft-bid-card, market-client). PAS sur montants déjà payés/engagés. Pas de composant de prix partagé aujourd'hui → en créer un (`<RiderPrice>`). → **traité dans le handoff UI** (`2026-06-02-ui-mockups-handoff.md`).
2. **Mécanisme d'éligibilité** : RPC/vue calculée et figée au début de phase (snapshot). À concevoir (où stocker le snapshot, comment le leader est déterminé pour les phases hors-GT).
3. **Rôle underdog** : étendre l'enum des rôles (`gt_role_assignments` + contraintes) + caps conditionnés à l'éligibilité (RPC squad).
4. Interaction : un coureur a UN rôle → pas de cumul underdog/stage_hunter. Le boost underdog ne s'applique pas aux /gc (cohérent Spec A).

## Prompt à coller dans la nouvelle discussion

```
On finalise puis on planifie "Spec B — Système Underdog" de la refonte équilibrage WattHunter.
Lis d'abord, sans relire d'anciennes conversations :
- docs/handoffs/2026-06-02-refonte-equilibrage-index.md
- docs/handoffs/2026-06-02-spec-b-underdog-handoff.md
- docs/superpowers/specs/2026-06-01-spec-b-underdog-design.md
Le design des mécaniques est lické. À approfondir : le mécanisme d'éligibilité (snapshot par phase, leader hors-GT), l'enum rôle underdog + caps, et le flag underdog_discount. L'UI du prix réduit est traitée à part (handoff UI). Ensuite lance superpowers:writing-plans.
```
