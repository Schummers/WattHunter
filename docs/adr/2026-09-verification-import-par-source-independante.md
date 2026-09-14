# ADR 2026-09 — Vérifier l'import par une source indépendante avant toute clôture

Statut : accepté, 2026-09-14. Contexte et procédure :
`docs/runbooks/gt-closeout-playbook.md`.

## Contexte

PCS brouille l'ordre DOM des noms de coureurs et le rétablit en CSS. Deux
Grands Tours (Tour et Vuelta 2026) ont été clos avec des rangs faux, validés
par des audits « 0 écart » qui recalculaient l'XP depuis le rang stocké :
ils prouvaient que le barème était bien appliqué à des rangs faux.

## Décisions

1. **Aucune clôture de Grand Tour n'écrit en prod sans un contrôle des rangs
   contre une source sans lien avec PCS** (Wikipedia, wikitext par l'API,
   `wikipedia_crosscheck.py`). Un rescore, quel que soit son résultat, ne
   prouve rien sur l'import.
2. **Une course close n'est jamais rescorée avec un barème qui a changé
   depuis.** On corrige les rangs, on documente la marge d'XP, on ne rejoue
   pas un scoring que les joueurs n'ont pas joué. Appliqué au Tour 2026
   (+29 XP max par équipe, 171 XP d'écart minimum entre deux places).

## Conséquences

- La preuve d'une clôture a trois couches (import, barème, dérive), pas une.
- Le harnais de contrôle et les outils de clôture deviennent de l'outillage
  de saison, à sortir de `.scratch/` (voir le playbook, §6).
- Le Giro 2026 reçoit un diagnostic, pas une réécriture, tant que la
  décision 2 tient.
