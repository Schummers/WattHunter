# 02 — Harnais de vérification contre une source externe

Status: `ready-for-agent`
Created: 2026-09-14

## Problème

Les vérifications existantes (`verify_tdf2026_closeout.py`, les audits « 0 écart »)
recalculent l'XP à partir du rang stocké. Si le rang est faux, le recalcul est faux
pareil et le diff sort à zéro. Elles ne peuvent pas, par construction, détecter une
erreur d'import. C'est pourquoi le bug a survécu à deux clôtures de Grand Tour.

L'erreur a été trouvée parce que l'utilisateur a envoyé des captures d'écran. Ce
ticket sert à ne plus dépendre de cette chance.

## Solution

Un outil qui confronte `race_results` à une **table de référence externe** — rang →
coureur — transcrite d'une source dont la justesse est établie (capture d'écran,
export manuel, autre fournisseur), et qui sort les écarts rang par rang.

Le prototype de cette session fait déjà le travail et sert de base : voir
`verif/diff_stages.py` et `verif/expected.py` dans ce dossier. Il a produit le
constat « 137 conformes, 13 écarts » sur sept étapes de la Vuelta 2026.

## Exigences

- **Comparer par rang**, pas par position dans une liste : un coureur hors pool
  crée un trou légitime dans les rangs stockés, ce n'est pas un écart.
- **Traiter les ex æquo comme interchangeables.** Deux coureurs à égalité stricte
  (mêmes points, ou même temps d'arrivée) peuvent être ordonnés différemment d'un
  rendu à l'autre. Sans cette règle l'outil croule sous les faux positifs — c'est
  arrivé en session sur les rangs 6/7 du Points final et de l'étape 21.
- **Normaliser les noms correctement.** `unicodedata.NFKD` ne décompose pas `ø`,
  `ł`, `đ`, `æ`, `ß`. Le prototype a sorti un faux positif sur Jørgen Nordhagen
  avant correction.
- **Sortir un compte exploitable** : nombre de rangs vérifiés, nombre d'écarts,
  et pour chaque écart le rang, la valeur attendue et la valeur en base.

## Seam et tests

Fonction pure : `(rows_en_base, table_de_reference) → liste d'écarts`. Aucun accès
réseau ni base dans la fonction testée, l'accès base reste au bord.

Cas à couvrir : trou légitime pour coureur hors pool, ex æquo dans les deux sens,
nom accentué et nom à caractère non décomposable, transposition simple, héritage
de rang.

## Out of scope

La collecte automatique de la source externe. L'outil consomme une table de
référence, il ne va pas la chercher.

## Comments
