# Correction du Tour de France 2026 — rangs et événements, sans rescore

**Date :** 2026-09-14
**Périmètre :** option A + événements. Rangs corrigés, événements importés,
**aucun XP modifié.**
**Chantier :** `.scratch/tour-2026-correction/`, branche
`investigation/integrite-import-tour-2026`. Diagnostic amont :
`.scratch/pcs-import-integrity/issues/09-diagnostic-tour-2026.md`.

## Ce qui a été fait

PCS brouille l'ordre DOM des noms de coureurs dans ses tables de résultats et
rétablit l'ordre visuel en CSS (`docs/agents/`, mémoire `pcs_dom_obfuscation`).
Le Tour 2026 avait été importé avant le correctif : **79 rangs faux dans la zone
qui rapporte de l'XP**, sur 23 des 24 slugs.

Les 25 pages PCS du Tour, photographiées le 2026-09-14 dans
`.scratch/pcs-import-integrity/fixtures/sweep-tdf/` (gitignoré, 15 Mo), ont été
ré-importées par le chemin de production avec le correctif actif.

| Table | Avant | Après |
|---|---|---|
| `race_results` (slugs Tour) | 3207 | 3348 |
| `gt_final_classifications` | 200 | 206 |
| `stage_event_results` (Tour) | 0 | 503 |
| `rider_xp_daily` | 1539 | **1539, inchangées** |
| `teams.cumulative_xp` / `level` | — | **inchangés** |

Preuves, mesurées sur la base après correction :

| Vérification | Résultat |
|---|---|
| Base vs Wikipedia | **0 / 200** |
| Base vs PCS réparé, rangs 1-15 | **0 / 300** |
| Zone scorée (top 20 étape, top 30 GC, top 10 maillots) | **0 / 459** |
| `stage-1` (TTT scorée via GC) | 18 lignes identiques, ligne à ligne |
| `rider_xp_daily` / `teams` / `team_ranking_daily` | 0 ligne de diff |

Les dénominateurs sont passés de 198 et 454 à 200 et 459 : le ré-import a
**ajouté** 141 lignes, aucune perdue. Elles sont portées par 7 coureurs entrés
dans le pool après juillet 2026 (Sean Quinn, Lars Craps, John Degenkolb, Anders
Skaarseth, Michel Hessmann, Jan Tratnik, Robbe Dhondt), dont **aucun n'est sous
contrat dans la ligue Classic V2**.

## Ce qui n'a PAS été corrigé : 51 lignes d'XP mal attribuée

**C'est la marge résiduelle assumée de ce chantier.** Le rang vit dans
`race_results`, l'XP dans `rider_xp_daily` : corriger le second demande de
rescorer, et **le rescore d'un Grand Tour terminé est impossible avec le moteur
actuel** (voir la section suivante). Les rangs sont donc justes, l'XP déjà
distribuée reste celle des rangs faux.

51 lignes, 21 slugs. Écart par équipe, au barème de juillet :

| Équipe | XP Tour en base | Écart dû au bug | Ce qu'elle aurait dû avoir |
|---|---|---|---|
| Leopard_Trek | 3743.00 | **+29.00** | 3772.00 |
| Dixon Hormous | 2087.00 | **+14.50** | 2101.50 |
| Muskatel Muskadji | 3555.00 | **+13.50** | 3568.50 |
| Klimax | 2698.38 | **+11.44** | 2709.82 |
| Peejee | 1915.70 | +1.00 | 1916.70 |
| bigdaddy | 1257.92 | **−9.32** | 1248.60 |
| Las Chivas Pendejas | 2287.74 | **−10.50** | 2277.24 |
| GoudalEnergies | 3382.72 | **−13.50** | 3369.22 |

Les six plus gros écarts individuels :

| Slug | Coureur | Équipe | Rang base → réel | Delta XP |
|---|---|---|---|---|
| stage-18 | Pablo Castrillo | GoudalEnergies | 6 → 7 | −10.0 |
| stage-16 | Bruno Armirail | Dixon Hormous | 9 → 8 | +10.0 |
| points | Tadej Pogačar | Muskatel Muskadji | 7 → 6 | +8.0 |
| kom | Lenny Martinez | Klimax | 7 → 6 | +8.0 |
| kom | Isaac Del Toro | Las Chivas Pendejas | 6 → 7 | −8.0 |
| stage-11 | Magnus Cort | Klimax | 20 → 19 | +7.9 |

Détail ligne par ligne :
`.scratch/tour-2026-correction/verif/xp-mal-attribuee-51-lignes.json`.

**Aucun classement n'est affecté.** Le plus gros écart vaut 29 XP, l'écart
minimum entre deux places du Tour est de 171,3 XP. Au cumulé, l'ordre est
identique corrigé ou non ; le seul duel serré, Klimax 3e / GoudalEnergies 4e
(8,7 XP), s'**écarte** à 33,6 XP une fois corrigé au lieu de se croiser.

## Pourquoi le rescore est impossible

`calculate_daily_scores` construit son ensemble de coureurs à partir des
contrats de statut `active` / `notice`, puis rejette tout résultat dont la
`race_date` tombe hors de la fenêtre `purchased_at → released_at`.

Dans la ligue V2 au 2026-09-14 : **70 contrats actifs, les 70 achetés après la
fin du Tour** ; les 82 qui tenaient pendant le Tour ont été libérés au reset de
phase de la Vuelta le 2026-08-19. Aucun coureur n'est donc éligible sur aucun
slug du Tour.

Essai en local : 17 lignes réécrites sur 1539, les 17 avec `raw_pcs_points = 0`,
zéro bonus d'événement distribué, 1522 lignes gardant leurs valeurs de juillet
sans être recalculées. `cumulative_xp` : −2029 Leopard_Trek, −1848 Klimax,
−1104 Peejee. Ce ne sont pas des deltas de barème, c'est de la destruction.

La Vuelta avait été rescorée **pendant sa propre phase**, contrats encore
actifs. **Le rescore d'un Grand Tour n'a jamais été rejouable à froid**, et
personne ne l'avait écrit.

Le diagnostic chiffrait le drift d'un rescore par reconstruction analytique,
depuis les colonnes déjà stockées dans `rider_xp_daily`. Juste comme
arithmétique, muet sur la faisabilité : il n'a jamais fait tourner le moteur.

## Rejouer

```bash
cd services/pcs-sync
.venv/bin/python ../../.scratch/tour-2026-correction/correct_tdf2026.py \
  baseline --target prod
.venv/bin/python ../../.scratch/tour-2026-correction/correct_tdf2026.py \
  reimport --target prod --write
.venv/bin/python ../../.scratch/tour-2026-correction/correct_tdf2026.py \
  import-events --target prod --write
```

La cible est obligatoire, la prod exige `--write` en plus (sans lui : baseline
puis arrêt). Le fetch HTML est remplacé par une lecture du cache ; **une URL
absente du cache fait échouer le script** plutôt que de scraper en direct, le
brouillage de PCS tournant dans le temps.

`rescore` existe dans l'outil mais **ne doit pas être lancé** tant que le moteur
n'est pas datable.

## Marges résiduelles

- **Les rangs 11-20 ne sont validés que par le correctif**, pas par Wikipedia
  qui s'arrête au top 10. Ils représentaient 42 des 79 écarts, mais des rangs à
  2-20 points de barème.
- **Les règles CSS du Tour n'ont pas été relevées.** Sur la Vuelta, la preuve
  centrale était la correspondance détecteur ↔ feuille de style de PCS. Ici on
  s'appuie sur Wikipedia, preuve indépendante mais limitée au top 10.
- **Le cache est la seule trace** de l'état de PCS au 2026-09-14.

## Tickets ouverts par ce chantier

1. **Rescore rétroactif impossible.** Charger les contrats dont la fenêtre
   couvre la date de l'étape, quel que soit leur statut actuel.
2. **Barème daté.** `_points_from_rank` et `_secondary_final_points` lisent une
   constante unique ; « le passé reste au passé » n'existe que dans un
   commentaire de `scoring.py`. Ce commentaire est **exact** après ce chantier,
   le Tour n'ayant pas été rescoré, mais il ne garantit rien.
3. **Côte franchie deux fois.** La clé primaire de `stage_event_results`
   (`race_slug, event_type, event_name, rider_id`) ignore l'ordre de
   franchissement : 4 côtes du Tour ont été écrasées en silence (Montjuïc étape
   2, Montmartre étape 21, franchies 3× chacune). Sans effet ici, ce sont des
   cat.3 et cat.4 qui valent 0, mais une HC en circuit final ferait perdre de
   l'XP sans bruit.
4. **Dérives prod / local.** `auction_bids_round_check` est plus stricte en
   local qu'en prod, et les droits PostgREST ne sont pas dans les migrations :
   un `db reset` ne rend pas une base utilisable par le pipeline.
