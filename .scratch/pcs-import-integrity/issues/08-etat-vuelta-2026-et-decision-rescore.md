# 08 — État de la Vuelta 2026 après correctif, et décision de rescore

Status: `ready-for-human`
Created: 2026-09-14
Dépend de : `01` (verdict), `03` (correctif livré)
Remplace le travail prévu aux tickets `05` (chiffrage XP) et `06` (étendue), qui
sont devenus mesurables au lieu d'extrapolables.

> **Ce ticket demande un arbitrage humain avant toute écriture en prod.**
> Rien n'a été écrit. Tout ce qui suit est mesuré en lecture seule, et chaque
> chiffre est reproductible par les commandes de la dernière section.

## Ce qui a été établi

### 1. La cause (ticket 01, verdict H1)

PCS brouille délibérément l'ordre DOM des noms de coureurs dans ses tables de
résultats et rétablit l'ordre visuel en CSS. Sur une ligne brouillée, le
`<td class="ridername">` porte le coureur voisin, pendant que BIB, âge, rang,
points et la colonne Team restent ceux de la vraie ligne. La feuille de style du
site nomme la table et le numéro de ligne :

```css
.results[data-id="SEINSF"] tbody tr:nth-child(6) div.cont { position:absolute; top: 26px; }
.results[data-id="SEINSF"] tbody tr:nth-child(7) div.cont { position:absolute; top:-19px; }
```

L'écran dit vrai, le markup ment. Un navigateur normal reçoit le même DOM
brouillé : ce n'est pas ciblé sur les bots. Ni notre code ni `procyclingstats`
ne sont en cause.

Le brouillage **tourne dans le temps** : une étape brouillée en août peut être
propre aujourd'hui, et l'inverse. C'est pourquoi un ré-import aveugle répare une
étape et en casse une autre.

### 2. Le correctif (ticket 03, livré, branche `fix/pcs-dom-obfuscation`)

`services/pcs-sync/pcs_deobfuscate.py`, branché dans `fetch_html` et dans
`import_race_results` / `import_gc_results`. Répare, ou refuse l'import.

**Validation forte** : les lignes que notre détecteur trouve sont exactement
celles que le CSS de PCS nomme (9 paires sur 5 tables, au numéro de ligne près),
par deux signaux indépendants. Et sur les 5 jeux de clôture refetchés,
**107 rangs comparés aux captures de l'utilisateur, 0 écart**.

Conséquence pratique : **les captures d'écran ne sont plus nécessaires**, le
scraper réparé est une source fiable.

### 3. L'étendue réelle sur la Vuelta 2026

Balayage des 20 étapes (l'étape 3 est annulée), refetch par le chemin de
production puis diff rang par rang contre la base.

**54 rangs faux sur 16 étapes sur 20.** Le constat initial de 13 écarts ne
portait que sur 7 étapes et sur le top 24.

| Zone | Écarts |
|---|---|
| rangs 1-10 | 30 |
| rangs 11-20 | 14 |
| rangs 21-40 | 7 |
| au-delà | 3 |

Détail complet, étape par étape : `sweep-stages-2026-09-14.json`.

Étapes propres : 5, 10, 14, 20. Étapes touchées : 1, 2, 4, 6, 7, 8, 9, 11, 12,
13, 15, 16, 17, 18, 19, 21.

### 4. L'état des 5 jeux de clôture

Écrits en prod le 2026-09-14 **avec le bug**. Le ticket 04 est périmé sur deux
points : KOM et Youth **ont** été écrits (08:03), et le rescore n'a toujours pas
tourné.

| Slug | État en base | Écarts vs capture |
|---|---|---|
| `stage-21` | 106 lignes | **5 rangs faux** |
| `gc` | 106 lignes | **2 rangs faux** (6/7 Onley-Omrzel) |
| `points` | 79 lignes | **4 rangs faux** |
| `kom` | 28 lignes | top-10 juste |
| `youth` | **1 seule ligne** | cassé, à refaire |
| rescore de clôture | **jamais lancé** | XP des maillots non distribué |

## L'impact, chiffré

31 des 54 écarts touchent un coureur sous contrat en Classic V2
(`00000000-0000-4000-8000-c1a551c2026e`). Table complète dans
`impact-xp-2026-09-14.json`, clé `diffs_touching_a_contract`.

Les plus lourds :

| Étape | Rang | Équipe créditée | Coureur crédité | XP | Devait aller à |
|---|---|---|---|---|---|
| 15 | 7 | Muskatel Muskadji | Alessandro Covi | 180.0 | Bastien Tronchon |
| 16 | 10 | Las Chivas Pendejas | Alberto Dainese | 100.0 | César Macías |
| 12 | 7 | Leopard_Trek | Enric Mas | 93.0 | Felix Gall |
| 6 | 6 | Leopard_Trek | Primož Roglič | 91.0 | Felix Gall |
| 12 | 6 | Klimax | Felix Gall | 85.0 | Enric Mas |
| 21 | 6 | Klimax | Finn Fisher-Black | 75.0 | Pello Bilbao |

### Classement de la Vuelta (XP des étapes Vuelta seulement)

| # | Équipe | XP Vuelta | Écart au précédent | XP sur un rang faux | Place en jeu ? |
|---|---|---|---|---|---|
| 1 | Peejee | 3556.2 | | 147.1 | — |
| 2 | Las Chivas Pendejas | 2623.8 | 932.4 | 169.0 | non |
| 3 | Leopard_Trek | 2408.0 | 215.8 | 328.5 | **OUI** |
| 4 | Muskatel Muskadji | 2395.0 | **13.0** | 258.0 | **OUI** |
| 5 | bigdaddy | 2322.0 | 73.0 | 33.0 | **OUI** |
| 6 | GoudalEnergies | 2074.3 | 247.7 | 116.0 | non |
| 7 | Klimax | 2008.0 | 66.3 | 303.0 | **OUI** |

La 3e et la 4e place sont séparées de **13 XP**, pour 328 et 258 XP assis sur un
rang faux. Seule la 1re place est hors d'atteinte.

Ces totaux **n'incluent pas** l'XP des maillots finaux, qui n'a jamais été
distribué. Le classement Vuelta n'est donc pas seulement faux, il est incomplet.

### Classement général de la saison

| # | Équipe | XP cumulé | Écart | XP sur un rang faux (Vuelta) |
|---|---|---|---|---|
| 1 | Leopard_Trek | 9885.1 | | 328.5 |
| 2 | Klimax | 7705.5 | 2179.6 | 303.0 |
| 3 | Peejee | 7615.9 | **89.6** | 147.1 |
| 4 | GoudalEnergies | 7586.9 | **29.1** | 116.0 |
| 5 | Muskatel Muskadji | 7371.9 | 215.0 | 258.0 |
| 6 | Las Chivas Pendejas | 6755.7 | 616.2 | 169.0 |
| 7 | bigdaddy | 4766.2 | 1989.5 | 33.0 |
| 8 | Dixon Hormous | 3742.6 | 1023.6 | 0 |
| 9 | TheAussieMate | 2102.6 | 1640.0 | 0 |

Places 2 à 5 dans un mouchoir de 334 XP, chacune exposée entre 116 et 303 XP.
La 1re place est acquise, les places 6 à 9 aussi.

### Limite de cette mesure, à ne pas surinterpréter

« XP sur un rang faux » est une **exposition brute** : l'XP crédité à un coureur
sur un rang qui n'était pas le sien. Ce n'est **pas un delta net**. Beaucoup
d'écarts sont des échanges entre deux coureurs sous contrat dans des équipes
différentes, donc une partie se compense.

Le delta net exact n'est connaissable qu'en rejouant le scoring : l'XP dépend du
niveau de l'équipe, du rôle, de l'underdog, du nemesis et des tactiques, pas
seulement du rang. Avec des écarts de 13 et 29 XP au classement, l'exposition
suffit néanmoins à conclure que les places sont indéterminées.

## Options

### A. Correction complète (recommandée)

Ré-importer les 20 étapes + les 5 slugs de clôture avec le correctif, puis
rescorer la Vuelta. Seul chemin vers un classement qui veut dire quelque chose.

Séquence obligatoire :
1. Snapshot baseline des 9 équipes et de `rider_xp_daily` **avant** toute écriture
2. Ré-import (upsert idempotent ; les pages sont en cache local dans
   `fixtures/sweep/`, pas de re-scraping nécessaire)
3. Rescore **scopé aux slugs Vuelta**, jamais large
4. Diff avant/après sur **les 9 équipes**, pas seulement celles visées

Coût estimé : 30-45 min.

**Piège documenté** : rescorer d'anciennes étapes fait dériver l'XP des autres
équipes par code-drift, le code de scoring ayant changé depuis l'import initial
(précédent backfill Giro, 2026-06-04, mémoire `giro_xp_backfill_rescore_drift`).
Le diff sur toutes les équipes sert précisément à séparer ce qui vient de la
correction de ce qui vient du drift. Sans cette séparation, on ne saura pas
justifier les changements auprès des joueurs.

### B. Clôture partielle

Corriger seulement les 5 slugs de clôture, publier avec une marge documentée.
Moins de travail, mais le classement Vuelta reste faux sur 16 étapes et les
places 3 à 7 restent indéterminées. Difficile à annoncer honnêtement.

### C. Acceptation

Publier tel quel avec la marge d'erreur annoncée. À exclure : 13 XP d'écart
entre la 3e et la 4e place, ce n'est pas une marge, c'est un tirage au sort.

## Hors périmètre de ce ticket

Le Giro et le Tour 2026. Même pipeline, même source, même bug probable, mais
courses closes depuis des mois sur une ligue playtest. Voir ticket 06. À
documenter comme marge connue plutôt qu'à corriger, sauf décision contraire.

## Reproduire, commande par commande

Tout est en lecture seule.

```bash
cd services/pcs-sync

# 1. Le brouillage, en direct sur une page actuellement brouillée
SCRAPER_BACKEND=playwright .venv/bin/python \
  ../../.scratch/pcs-import-integrity/verif/fetch_raw_stage.py \
  race/vuelta-a-espana/2026/stage-19 /tmp/s19.html
.venv/bin/python ../../.scratch/pcs-import-integrity/verif/detect_row_incoherence.py /tmp/s19.html

# 2. Le correctif, sur fixtures HTML reelles
.venv/bin/python -m pytest tests/test_pcs_deobfuscate.py -v

# 3. Les 5 jeux de cloture : PCS reparé vs base vs captures
.venv/bin/python ../../.scratch/pcs-import-integrity/verif/audit_closing.py

# 4. Le balayage des 20 etapes (utilise le cache fixtures/sweep/, sinon refetch)
SCRAPER_BACKEND=playwright .venv/bin/python \
  ../../.scratch/pcs-import-integrity/verif/sweep_stages.py
```

### Artefacts

| Fichier | Contenu |
|---|---|
| `sweep-stages-2026-09-14.json` | les 54 écarts, étape par étape, avec rang / coureur en base / coureur réel / points |
| `impact-xp-2026-09-14.json` | les 31 écarts touchant un contrat, les deux classements, l'exposition par équipe |
| `fixtures/obfuscation-css-rules-2026-09-14.txt` | les règles CSS relevées chez PCS |
| `fixtures/sweep/*.html` | les 20 pages d'étape refetchées (gitignoré, lourd) |
| `fixtures/closing/*.html` | les 5 pages de clôture refetchées (gitignoré) |
| `snapshot-pre-cloture.json` | baseline pris avant les écritures du 2026-09-14 |
| `services/pcs-sync/tests/fixtures/*.html.gz` | les 2 fixtures golden des tests |

### Points à contre-vérifier en priorité

Si ce ticket est relu par quelqu'un d'autre, ce sont les endroits où je peux
m'être trompé :

1. **La correspondance détecteur ↔ CSS de PCS.** C'est la preuve centrale du
   diagnostic. Elle tient sur une seule page (étape 19, 9 paires). À reproduire
   sur une autre page brouillée.
2. **Seules des paires adjacentes ont été observées**, jamais un cycle de 3. Le
   garde-fou refuse l'import dans ce cas, donc l'échec serait bruyant, mais
   l'hypothèse n'est pas prouvée.
3. **Le brouillage tourne dans le temps.** Ça veut dire que le balayage du
   2026-09-14 photographie l'état de PCS ce jour-là. Refait demain, il peut
   donner des paires différentes, et les pages en cache dans `fixtures/sweep/`
   sont la seule trace de ce qui a servi à ce chiffrage.
4. **L'exposition XP n'est pas un delta net** (voir la limite ci-dessus).
5. **Le classement Vuelta ci-dessus exclut l'XP des maillots finaux**, jamais
   distribué.

## Comments
