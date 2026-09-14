# 01 — Trancher l'origine du décalage : HTML altéré (H1) ou parse de la lib (H2)

Status: `ready-for-human`
Created: 2026-09-14
Bloque: `03-corriger-alignement-import.md`, `05-cloturer-vuelta-2026.md`, `06-etendue-historique.md`

## Pourquoi ce ticket d'abord

Tout le reste dépend du verdict. Sous H2, le correctif est local et le scraper
reste exploitable. Sous H1, PCS nous ment et la question n'est plus « comment
parser » mais « quelle source de données ». Corriger avant de savoir, c'est
risquer de réécrire proprement des données fausses.

## Le test

Lecture seule, aucune écriture en base.

1. Refaire un fetch de `race/vuelta-a-espana/2026/stage-4` par le chemin exact du
   scraper (`fetch_html` via `BrowserSession`, backend et options identiques à la
   production), et **sauvegarder le HTML brut sur disque**.
2. Dans ce HTML, isoler la ligne du rang 8 et lire le nom du coureur qu'elle porte,
   ainsi que l'équipe et le temps de la même ligne.
3. Comparer à la capture de référence : rang 8 = Carapaz (EF Education), rang 9 =
   Skjelmose (Lidl-Trek).
4. En parallèle, appeler `Stage(...).results()` sur **ce même HTML sauvegardé** et
   relever ce que l'entrée d'index 7 (rang 8) contient.

## Critères de décision

- **HTML dit Skjelmose au rang 8** → H1. PCS sert des données altérées. Marquer
  ce ticket `ready-for-human` : la suite est un arbitrage produit sur la source,
  pas une tâche de code.
- **HTML dit Carapaz au rang 8 mais `results()[7]` dit Skjelmose** → H2. Le bug
  est dans le parse. Débloquer le ticket 03.
- **HTML dit Carapaz et `results()[7]` dit Carapaz** → le HTML servi maintenant
  diffère de celui servi lors de l'import du 2026-08-25. Piste : altération
  intermittente, ou dépendante de la session Cloudflare. Refaire le test trois
  fois à quelques heures d'écart avant de conclure.

## Vérifications complémentaires dans le même passage

- Chercher dans le HTML une **incohérence intra-ligne** du type de celle observée
  sur la page KOM (coureur d'une équipe A affiché avec l'équipe B). Sa présence
  est un marqueur fort de H1, son absence n'infirme rien.
- Vérifier si les lignes fautives portent un attribut structurel commun (icône de
  maillot, cellule de temps `,,`, colspan) qui expliquerait un désalignement de
  zip côté lib.

## Livrable

Le HTML brut sauvegardé, conservé comme fixture pour le ticket 02, et une note de
verdict en commentaire de ce ticket nommant l'hypothèse retenue et la preuve.

## Comments

### Verdict — 2026-09-14 : **H1 confirmée**, avec le mécanisme exact

PCS **brouille délibérément l'ordre DOM des noms de coureurs et rétablit l'ordre
visuel en CSS**. L'écran dit vrai, le markup ment. Toute lecture machine du HTML
reçoit des données fausses ; aucun humain ne peut s'en apercevoir en regardant la
page.

Ce n'est ni un bug de PCS ni un défaut de `procyclingstats`. Notre code et la lib
sont hors de cause.

#### Le test prévu, et son résultat inattendu

Fetch de `race/vuelta-a-espana/2026/stage-4` par le chemin exact du scraper
(`fetch_html` via `BrowserSession`, `SCRAPER_BACKEND=playwright`, USER_AGENT de
production). HTML brut sauvegardé :
`fixtures/vuelta-2026-stage-4.raw.html`.

- Le HTML dit **Carapaz** au rang 8, et `Stage(...).results()[7]` dit **Carapaz**.
- Cross-check ligne à ligne HTML brut vs `results()` : **0 écart sur 182 lignes**.

C'est la troisième branche des critères de décision : le HTML servi aujourd'hui
sur l'étape 4 diffère de celui servi à l'import du 2026-08-26. On a donc élargi
le test aux quatre autres étapes fautives, et c'est là que la preuve est tombée.

#### La preuve : une étape brouillée en direct

Comparaison à trois (capture de référence / HTML fetché maintenant / base) —
`verif/compare_html_base_capture.py` :

| Étape | html-now vs capture | base vs capture |
|---|---|---|
| 4  | 0 écart | 4 écarts |
| 7  | 0 écart | 3 écarts |
| 13 | 0 écart | 3 écarts |
| 16 | 0 écart | 2 écarts |
| **19** | **4 écarts** | 1 écart |

L'étape 19 est propre en base (importée en août) et **fausse dans le HTML reçu
aujourd'hui**, sur des paires que la base n'a pas. Le brouillage est donc bien en
amont de nous, et il se déplace dans le temps : l'étape 4 était brouillée en août
et ne l'est plus, l'étape 19 l'est maintenant et ne l'était pas.

Trois refetchs successifs de l'étape 19 donnent **exactement les mêmes paires** :
ce n'est pas aléatoire par requête, c'est un état persistant de la page.

#### Le mécanisme

Sur une ligne brouillée, le `<td class="ridername">` contient le **mauvais**
coureur — nom, `href`, et l'équipe imprimée dans la cellule — tandis que le BIB,
l'âge, le rang GC, le timelag, les points et **la colonne Team** restent ceux de
la vraie ligne. La ligne se contredit elle-même.

La feuille de style principale du site, `v3_site_v160.css`, contient alors :

```css
.results[data-id="SEINSF"] tbody tr:nth-child(6)  div.cont { position:absolute; top: 26px; }
.results[data-id="SEINSF"] tbody tr:nth-child(7)  div.cont { position:absolute; top:-19px; }
```

`26px` et `-19px` valent un pas de ligne dans un sens et dans l'autre : les deux
noms sont repeints chacun dans la ligne de l'autre, et l'affichage redevient
juste. Vérifié à la mesure (ancre à +27px et -18px pour la paire, +5px pour les
lignes normales) et **confirmé par capture d'écran** : à l'écran, rang 6 =
Leknessund / Uno-X, rang 7 = Martin / Groupama, conforme aux captures de
référence, à l'inverse du DOM.

Règles complètes relevées : `fixtures/obfuscation-css-rules-2026-09-14.txt`.
9 paires actives sur tout le site à cet instant, sur 5 tables.

Ce n'est pas une contre-mesure visant les clients automatisés : un navigateur
normal reçoit le même DOM brouillé (vérifié). C'est une obfuscation du markup,
servie à tous, dans une feuille de style statique et versionnée. Délibérée.

#### Deux détecteurs, gratuits et fiables

1. **`data-id` non vide sur `table.results` = table brouillée.** Sur les cinq
   fixtures, les quatre pages propres ont `data-id=""` et seule l'étape 19 porte
   des identifiants (`SEINSF` sur la table d'étape, `ZCNQPO` et `IVNQIE` sur les
   deux autres tables de la page). Le drapeau est dans le HTML qu'on télécharge
   déjà.
2. **Incohérence intra-ligne** : l'équipe imprimée dans la cellule Rider contre
   la colonne Team. `verif/detect_row_incoherence.py` — **0 faux positif sur 670
   lignes propres, exactement 6 lignes (3 paires) sur l'étape 19**, celles-là
   mêmes que le CSS désigne.

Le BIB et la colonne Team restent fidèles à la vraie ligne : ils permettent non
seulement de détecter, mais de **reconstruire** le bon coureur.

#### Ce que ça change pour les autres tickets

- **Ticket 03 n'est pas `wontfix`.** Le PRD prévoyait de le fermer si le HTML
  portait le décalage. C'est le cas, mais le décalage est **déterministe et
  réversible** : garde-fou sur `data-id` non vide + contrôle d'incohérence
  intra-ligne, et réparation par BIB si on veut aller jusque-là. La lib
  `procyclingstats` n'est pas en cause, le correctif est dans `sync_race`.
- **Un ré-import aveugle est dangereux** : il réparerait l'étape 4 et casserait
  l'étape 19. Toute reprise doit passer par le garde-fou d'abord.
- **Ticket 06 (étendue historique)** : le brouillage tourne. Giro et Tour 2026
  ont statistiquement été touchés eux aussi.
- **Ticket 07** : la seconde source reste utile, mais l'urgence baisse — on sait
  détecter le brouillage sans source externe.

#### Reproduire

```bash
cd services/pcs-sync
SCRAPER_BACKEND=playwright .venv/bin/python \
  ../../.scratch/pcs-import-integrity/verif/fetch_raw_stage.py \
  race/vuelta-a-espana/2026/stage-19 /tmp/s19.html
.venv/bin/python ../../.scratch/pcs-import-integrity/verif/detect_row_incoherence.py /tmp/s19.html
```

Aucune écriture en base pendant ce ticket. Lecture seule de bout en bout.
