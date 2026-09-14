# 06 — Table de palmarès historique et import de La Route du Tour

**What to build:** l'historique du groupe de 2017 à 2025 entre en base et devient
interrogeable. Après ce ticket, une requête répond à « qui a gagné le Giro 2023 »,
« quel était le podium de la Vuelta 2025 » et « combien de Tours a gagné tel
joueur », pour les neuf saisons jouées avant WattHunter.

Les données vivent dans une **table dédiée**, jamais sous forme de fausses ligues
ou de fausses équipes. Elles portent le rang d'origine, le nom d'équipe de
l'époque, les points bruts par catégorie, et un lien vers le compte WattHunter du
joueur quand il existe.

Source : `research/laroutedutour/rankings.csv`. Règles d'import dans le README de
ce dossier et dans le PRD : courses d'une semaine exclues (24 épreuves retenues
sur 30), identités fusionnées, aucune conversion des points en XP.

**Blocked by:** 01 — Entité saison et rattachement des ligues.

**Status:** done

- [x] Une table dédiée accueille un résultat par équipe et par épreuve, avec son
      rang d'origine et ses points bruts par catégorie.
- [x] Les 24 épreuves retenues sont importées, les courses d'une semaine exclues.
- [x] Chaque ligne porte sa saison, son type d'épreuve et le nom d'origine du tour.
- [x] Le mapping vers les comptes WattHunter est appliqué, identités fusionnées
      comprises.
- [x] Les trois joueurs sans compte sont importés avec leur pseudo d'époque et un
      marqueur d'ancien joueur.
- [x] L'import est idempotent : le relancer ne crée aucun doublon.
- [x] Les agrégats calculés depuis la base concordent avec
      `research/laroutedutour/palmares_stats.py` : 6 victoires pour David
      Choncoutié, 5 pour Peejee, 3 titres de saison pour Klimax, 15 maillots pour
      Peejee.

## Livré — 2026-09-14

**Forme retenue : une migration générée, pas un importeur à l'exécution.**
`supabase/migrations/20260914000200_historical_palmares.sql`, produite par
`research/laroutedutour/generate_import_migration.py` depuis le CSV. L'archive est
close, neuf saisons qui ne gagneront plus une ligne : `supabase db reset` la
reconstruit à l'identique, rien ne tourne en prod, et l'idempotence est la clause
`ON CONFLICT` plutôt qu'un script que quelqu'un doit penser à relancer sans
risque. Deux tables : `historical_tours` (24) et `historical_results` (187).

Clé primaire `(tour_id, player_key)`. `tour_id` est la seule clé stable : deux
tours différents s'appellent tous les deux « C'est la reprise ».

### Agrégats calculés depuis la base, contre `palmares_stats.py`

| Mesure | Attendu | Lu en base |
|---|---|---|
| Victoires David Choncoutié | 6 | **6** |
| Victoires Peejee | 5 | **5** |
| Titres de saison Klimax | 3 | **3** (2017, 2020, 2021) |
| Maillots Peejee | 15 | **15** (3 YEL / 5 GRN / 4 POL / 3 WHT) |
| Maillots Klimax | 14 | **14** |
| Blancs Marino Alex | 6 | **6** |

Et le garde-fou du ticket 10, déjà vrai au niveau des données : victoires par
épreuve = nombre d'épreuves jouées de ce type. classics 5/5, giro 6/6,
tour-de-france 7/7, vuelta 6/6. C'est JibsEPAULE qui fait tomber le TDF juste.

### Idempotence

Migration rejouée deux fois de suite sur une base neuve : 24 tours, 187
résultats, 9 saisons, aucun doublon.

### Écart avec le PRD, assumé

Le PRD exclut Fangio et JoeDills ; ce ticket demande d'importer les trois joueurs
sans compte. Les deux sont tenus : les 12 joueurs sont **importés** (l'archive est
la vérité, et retirer des lignes fausserait les départs des autres), Fangio et
JoeDills seront **masqués à l'affichage** (0 victoire, 0 podium, 0 maillot).
JibsEPAULE est conservé partout, marqué `is_former_player`.
