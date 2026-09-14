# 09 — Diagnostic du Tour de France 2026 (aucune écriture)

Status: `ready-for-human`
Created: 2026-09-14
Dépend de : `01` (cause), `03` (correctif), `08` (état Vuelta)
Suite du handoff `docs/handoffs/2026-09-14-integrite-import-tour-giro-handoff.md`

> **Périmètre arrêté par l'utilisateur le 2026-09-14 : diagnostic seul.** Rien
> n'a été écrit en base. Tout ce qui suit est mesuré en lecture seule et
> reproductible par les commandes de la dernière section.

## Le résultat en une ligne

**L'ampleur est plus large que sur la Vuelta, l'impact est dix fois plus
faible** : 79 rangs faux dans la zone qui rapporte de l'XP, sur 23 des 24 slugs,
mais tous les écarts sont des **échanges entre rangs voisins**, donc 5 à 10
points de barème. Le plus gros delta par équipe est de 29 XP, pour un écart
minimum de 171 XP entre deux places au classement du Tour. **Aucune place du
Tour n'est en jeu.**

## 1. Le correctif est validé une seconde fois, indépendamment

Wikipedia (wikitext brut, API `action=parse`, aucun lien avec PCS) donne le top
10 de chaque étape. Les pages PCS refetchées aujourd'hui par le chemin de
production, correctif `pcs_deobfuscate` actif, sont confrontées à ce top 10 :

| Comparaison | Écarts |
|---|---|
| PCS réparé vs Wikipedia | **0 / 200 rangs** |
| Base de prod vs Wikipedia | **37 / 198 rangs** |

Le correctif produit exactement ce que dit une source qui ne dépend pas de PCS,
sur 200 rangs du Tour, après l'avoir déjà fait sur la Vuelta. La base, elle, est
fausse sur 18,7 % du top 10.

Deux variantes de nommage rencontrées, vérifiées à la main et traitées en alias
(ce ne sont pas des erreurs de rang) : `Josh Tarling` / `joshua-tarling`. Les
pages Tour capitalisent le template (`{{Cyclingresult start`) et titrent
« Stage N result » en minuscule, là où la Vuelta fait l'inverse : les regex sont
insensibles à la casse dans la version Tour du harnais.

## 2. L'étendue, limitée à la zone qui score

Top 20 d'une étape, top 30 de la GC finale, top 10 des maillots. Au-delà le
barème vaut 0 et un rang faux ne change rien.

**79 rangs faux sur 454 comparés. 23 slugs sur 24 touchés.** Seule l'étape 12
est propre.

| Étape | Rangs faux | | Étape | Rangs faux |
|---|---|---|---|---|
| 2 | 8, 9, 19, 20 | | 13 | 8, 9, 15, 16 |
| 3 | 8, 9, 15, 16 | | 14 | 8, 9, 15, 16 |
| 4 | 7, 15, 16 | | 15 | 6, 7, 15, 16 |
| 5 | 6, 7, 15, 16 | | 16 | 8, 9, 15, 16 |
| 6 | 8, 9, 19, 20 | | 17 | 6, 7, 15, 16 |
| 7 | 8, 9, 19, 20 | | 18 | 6, 7, 15, 16 |
| 8 | 6, 7, 15, 16 | | 19 | 6, 7, 15, 16 |
| 9 | 6, 7, 15, 16 | | 20 | 6, 7 |
| 10 | 6, 7, 15, 16 | | 21 | 9, 10 |
| 11 | 8, 9, 19, 20 | | **gc** | 9, 10 |
| **12** | **aucun** | | **points** | 6, 7 |
| | | | **kom** | 6, 7 |
| | | | **youth** | 9, 10 |

La régularité est la signature du brouillage : **une ou deux paires adjacentes
par page**, jamais un rang isolé, jamais rien dans le top 5. Le vainqueur et le
podium de chaque étape sont justes partout.

Détail : `etendue-tdf2026-2026-09-14.json`.

### L'étape 1 est propre

Étape 1 = TTT scorée via la GC (mémoire `tdf2026_stage1_ttt_via_gc`). PCS n'y
publie qu'un classement par équipes, Wikipedia non plus : elle sort du
crosscheck automatique. Vérifiée à la main contre la table Wikipedia
« General classification after stage 1 » : **les 10 premiers rangs stockés en
base sont exacts** (le rang 7, Piganzoli, manque en base parce qu'il n'est sous
contrat nulle part, trou légitime).

### Les maillots finaux ne sont pas dans `race_results`

Points / KOM / Youth vivent dans `gt_final_classifications` (Spec A A2), et leur
page PCS se lit avec `Stage.points()/.kom()/.youth()`, pas avec `.results()` —
qui sur ces pages rend la table de la dernière étape. Un harnais qui l'ignore
conclut « propre » sur trois slugs qu'il n'a jamais regardés. C'est arrivé au
premier passage de ce diagnostic.

## 3. L'impact XP, au barème de juillet

Barème vérifié **dans les données**, pas supposé : `rider_xp_daily` du Tour
stocke 250 / 210 / 170 sur `/gc` et 100 / 80 / 65 sur `/points`, soit exactement
les valeurs d'avant la rehausse `3583af0` (2026-08-28). Les quatre commits de
drift sont tous postérieurs à la clôture du Tour (2026-07-27).

Le delta est **exact, ce n'est pas une exposition brute** : `rider_xp_daily`
conserve les rank_points joués et tous les multiplicateurs, et un changement de
rang ne touche que les rank_points. Aucune ligne du Tour n'a de
`nemesis_modifier ≠ 1`, donc la réserve habituelle sur les duels ne mord pas ici.

**51 lignes d'XP déplacées, réparties sur 21 slugs.**

| # | Équipe | XP Tour | Écart au précédent | Delta bug | Exposition | Drift d'un rescore |
|---|---|---|---|---|---|---|
| 1 | Leopard_Trek | 3743.0 | | **+29.0** | 240.0 | +258.0 |
| 2 | Muskatel Muskadji | 3555.0 | 188.0 | +13.5 | 139.5 | +255.0 |
| 3 | GoudalEnergies | 3382.7 | 172.3 | −13.5 | 305.5 | +175.0 |
| 4 | Klimax | 2698.4 | 684.3 | +11.4 | 481.4 | +148.0 |
| 5 | Las Chivas Pendejas | 2287.7 | 410.6 | −10.5 | 237.0 | +143.0 |
| 6 | Dixon Hormous | 2087.0 | 200.7 | +14.5 | 253.5 | +99.0 |
| 7 | Peejee | 1915.7 | 171.3 | +1.0 | 124.5 | +82.0 |
| 8 | bigdaddy | 1257.9 | 657.8 | −9.3 | 89.9 | +2.0 |

TheAussieMate n'a marqué aucun XP sur le Tour.

Trois colonnes qu'il ne faut pas confondre :

- **Delta bug** — ce que la correction du rang change, à barème et à code
  constants. C'est le chiffre qui compte.
- **Exposition** — l'XP crédité sur un rang qui n'était pas le bon. Comparable
  aux chiffres du ticket 08, **pas** un delta net.
- **Drift** — ce qu'un rescore au code d'aujourd'hui changerait **en plus**,
  à rang inchangé. Rien à voir avec le bug.

**Le drift est 5 à 20 fois plus gros que le bug.** Un rescore du Tour ajouterait
entre +2 et +258 XP par équipe pour des raisons qui n'ont aucun rapport avec
l'incident : GC finale 250 → 400, maillots 100 → 150, Youth 50 → 75. C'est
l'argument contre le rescore, et il est chiffré.

Le drift ci-dessus ne couvre que les finaux. Le barème d'étape n'a pas bougé ;
le fix underdog (`0a0b106`) et les termes côtes/sprints (`844cae8`) ne jouent pas
non plus sur le Tour : **`stage_event_results` est vide pour le Tour 2026**, donc
un rescore y ajouterait 0 XP d'événements tout en en ayant ajouté sur la Vuelta.
Autrement dit, un rescore du Tour au code actuel ne le rendrait pas comparable à
la Vuelta, il creuserait un autre écart.

Détail ligne par ligne : `impact-tdf2026-2026-09-14.json`.

### Les six plus gros deltas

| Slug | Coureur | Équipe | Rang base → réel | Delta XP |
|---|---|---|---|---|
| stage-18 | Pablo Castrillo | GoudalEnergies | 6 → 7 | −10.0 |
| stage-16 | Bruno Armirail | Dixon Hormous | 9 → 8 | +10.0 |
| points | Tadej Pogačar | Muskatel Muskadji | 7 → 6 | +8.0 |
| kom | Lenny Martinez | Klimax | 7 → 6 | +8.0 |
| kom | Isaac Del Toro | Las Chivas Pendejas | 6 → 7 | −8.0 |
| stage-11 | Magnus Cort | Klimax | 20 → 19 | +7.9 |

À comparer aux 180, 169 et 93 XP assis sur un seul rang faux de la Vuelta. La
différence ne tient pas à la fréquence du bug, elle tient à ce que sur le Tour
les échanges sont toujours entre rangs voisins.

## 4. Ce que ça change aux classements

### Classement du Tour

Rien. Le plus gros delta est de 29 XP, le plus petit écart entre deux places est
de 171,3 XP, et le pire renversement possible entre deux équipes voisines vaut
42,5 XP. **Aucune place du Tour n'est indéterminée.**

### Classement général de la saison (`teams.cumulative_xp`)

| # | Équipe | XP cumulé | Écart | Delta bug Tour | Drift Tour |
|---|---|---|---|---|---|
| 1 | Leopard_Trek | 9936.1 | | +29.0 | +258.0 |
| 2 | Peejee | 7813.6 | 2122.5 | +1.0 | +82.0 |
| 3 | Klimax | 7770.0 | **43.6** | +11.4 | +148.0 |
| 4 | GoudalEnergies | 7761.4 | **8.7** | −13.5 | +175.0 |
| 5 | Muskatel Muskadji | 7446.9 | 314.5 | +13.5 | +255.0 |
| 6 | Las Chivas Pendejas | 6813.7 | 633.2 | −10.5 | +143.0 |
| 7 | bigdaddy | 4914.2 | 1899.5 | −9.3 | +2.0 |
| 8 | Dixon Hormous | 3742.6 | 1171.6 | +14.5 | +99.0 |
| 9 | TheAussieMate | 2102.6 | 1640.0 | 0 | 0 |

Corrigé du seul bug du Tour, l'ordre ne change pas : Klimax gagne 11,4 et
GoudalEnergies perd 13,5, ce qui **écarte** la 3e de la 4e au lieu de les
croiser. Mais **la correction du Tour (24,9 XP de mouvement relatif) est
supérieure à l'écart qui sépare la 3e de la 4e (8,7 XP)**. Les places 3 et 4
restent indéterminées, et elles le restent surtout à cause de la Vuelta, dont
les corrections (ticket 08) sont d'un autre ordre de grandeur et n'ont toujours
pas été appliquées.

**Conclusion sur les classements : le Tour n'est pas le problème. La Vuelta
l'est.**

## 5. Ce qui reste ouvert

- **Le Giro 2026.** Même séquence, ticket 10, priorité basse. Drift plus large
  encore (cutover ancien/nouveau barème, injection manuelle depuis captures).
- **Les rangs 11-20 ne sont validés que par le correctif**, pas par Wikipedia
  qui s'arrête à 10. Ils représentent 42 des 79 écarts, mais des rangs à 2-20
  points de barème.
- **La régularité même du résultat mérite un œil.** Une paire dans le 6-9 et une
  dans le 15-16 ou 19-20 sur presque chaque étape, c'est cohérent avec ce que le
  CSS de PCS nomme, mais je n'ai pas relevé les règles CSS du Tour comme ça a été
  fait pour l'étape 19 de la Vuelta. C'est le point que je contre-vérifierais en
  premier.
- **Les pages en cache sont la seule trace du chiffrage.** Le brouillage tourne
  dans le temps : `fixtures/sweep-tdf/` photographie PCS au 2026-09-14.

## 6. Reproduire, commande par commande

Tout est en lecture seule.

```bash
cd services/pcs-sync

# 1. Refetch des 25 pages du Tour par le chemin de prod (cache : ne refait rien)
SCRAPER_BACKEND=playwright .venv/bin/python \
  ../../.scratch/pcs-import-integrity/verif/fetch_tdf2026.py

# 2. Triangulation Wikipedia / PCS repare / base
.venv/bin/python ../../.scratch/pcs-import-integrity/verif/wikipedia_crosscheck_tdf.py

# 3. Etendue sur la seule zone qui score
.venv/bin/python ../../.scratch/pcs-import-integrity/verif/sweep_zone_scoree_tdf.py

# 4. Impact XP : delta bug (bareme juillet) et drift, en colonnes separees
.venv/bin/python ../../.scratch/pcs-import-integrity/verif/impact_tdf2026.py
```

### Artefacts

| Fichier | Contenu |
|---|---|
| `crosscheck-tdf2026-2026-09-14.json` | la triangulation, slug par slug |
| `etendue-tdf2026-2026-09-14.json` | les 79 rangs faux de la zone scorée |
| `impact-tdf2026-2026-09-14.json` | les 51 lignes d'XP déplacées, les 3 colonnes par équipe |
| `fixtures/wikipedia-tdf/*.json` | les 3 pages Wikipedia, wikitext brut |
| `fixtures/sweep-tdf/*.html` | les 25 pages PCS refetchées (gitignoré, lourd) |

### Points à contre-vérifier en priorité

1. **Les règles CSS du Tour n'ont pas été relevées.** Sur la Vuelta, la preuve
   centrale était la correspondance détecteur ↔ feuille de style de PCS. Ici on
   s'appuie sur Wikipedia, qui est une preuve indépendante mais ne couvre que le
   top 10. Relever le CSS d'une étape du Tour fermerait la boucle.
2. **Les alias de nommage.** Un seul a été nécessaire (`Josh Tarling`). Un alias
   manquant se présenterait comme un faux écart, pas comme un silence.
3. **La colonne drift ne couvre que les finaux.** C'est justifié (barème d'étape
   inchangé, `stage_event_results` vide sur le Tour), mais c'est une hypothèse à
   relire plutôt qu'un calcul exhaustif.
4. **`teams.cumulative_xp` est pris comme classement général**, pas la somme de
   `rider_xp_daily` — qui ne contient que Tour et Vuelta pour cette ligue, le
   Giro ayant été cloné au seed de la V2.

## Comments
