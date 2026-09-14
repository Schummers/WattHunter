# Handoff : palmarès WattHunter (historique La Route du Tour)

Rédigé le 2026-09-12 depuis la session de scraping + grill + wireframes du 20-21 août 2026.
Repo : `~/AI OS/cycling/watthunter` (branche `main`, tout est commité, commit `cc814ef`).

**Première chose à faire dans la nouvelle session** : Jonathan a dit avoir "une nouvelle vision" pour la feature, à présenter avant de continuer. Ne rien implémenter, ne rien re-griller, l'écouter d'abord, puis confronter sa vision à ce qui est déjà tranché et découvert ci-dessous.

---

## 1. De quoi il s'agit

Jonathan et son groupe d'amis jouent depuis 2017 à *La Route du Tour* (laroutedutour.fr), un jeu fantasy cyclisme concurrent. Objectif double, confirmé :
1. **Migrer cet historique réel** (30 tours, 2017-2025) dans WattHunter comme palmarès de leur groupe.
2. **Construire une feature palmarès pérenne** qui s'auto-alimentera avec les futures saisons WattHunter.

Rien n'est implémenté côté app ni base. Tout est au stade design.

## 2. Livrables existants (tous dans le repo, commités)

| Fichier | Contenu |
|---|---|
| `research/laroutedutour/rankings.csv` | 231 lignes, 30 tours, classement final de chaque tour (rang, équipe, joueur, 12 colonnes de points) |
| `research/laroutedutour/README.md` | **Lire en premier.** Dictionnaire de colonnes, règle de désambiguïsation des noms, tours exclus et pourquoi, identités fusionnées, mapping joueurs LRDT → comptes WattHunter |
| `research/laroutedutour/wireframes/palmares-wireframes.html` | 3 écrans × 6 itérations = 18 wireframes, avec section "partis pris" et verdict par itération |
| Artifact publié | https://claude.ai/code/artifact/868307df-6980-4df2-92b6-0141f6416212 (privé, même contenu que le HTML) |

**Perdu** : le script Python `palmares_stats.py` qui calculait les agrégats (victoires, podiums, rang moyen, XP converti, titres de maillot, lissage bayésien) vivait dans le scratchpad de session, expiré. Reconstructible en 15 min depuis le CSV avec les ratios de la section 4 et les règles du README. Si la nouvelle session a besoin de chiffres, le refaire et cette fois le commiter dans `research/laroutedutour/`.

## 3. Ce qui est tranché (grill du 20-21 août)

- **Victoire** = rang 1 au classement combiné, quel que soit le format (Grand Tour, une semaine, Classiques).
- **Titre de maillot** = meilleur cumul d'une catégorie (GC, sprinteur, grimpeur, jeune) sur un tour. Compté à part, jamais comme une victoire.
- **Une seule vue unifiée** LRDT + WattHunter, avec conversion des points LRDT en XP (Jonathan a refusé deux vues séparées).
- **Conversion** : ratio approximatif par colonne, calibré ×2,5 sur les catégories dominantes. Pas de re-scrape étape par étape (600 pages, refusé).
- **Points bruts LRDT conservés** à côté des valeurs converties, pour recalibrer sans re-scraper.
- **Colonnes orphelines** (sprints intermédiaires, sommets, combatif) : gardées, converties au ratio étape. Les jeter biaiserait de 9 % les courses à étapes contre 0 % les classiques.
- **Colonne `bonus`** : ignorée, c'est un compteur de tactiques (0 à 4), pas des points.
- **Identités** : kli_max = Klimax, Sandy Chazar = David Choncoutié. Règle permanente : toute nouvelle variante d'orthographe d'un joueur doit être soumise à Jonathan avant fusion.
- **Tours exclus** (4 sur 34) : deux jamais commencés, un hors groupe, un à 2 équipes. Détail dans le README.
- **Emplacement** : `research/laroutedutour/` dans le repo watthunter, pas le vault.
- **Compte `maxbike.cc`** : inscription dormante sans aucune ligue, à ignorer.

## 4. Barème LRDT vs WattHunter (source de la conversion)

| Catégorie | LRDT | WattHunter | Ratio retenu |
|---|---|---|---|
| Victoire d'étape GT | 40 | 100 | ×2,5 |
| Vainqueur final GC | 100 | 250 | ×2,5 |
| Vert / pois final | 50 | 100 | ×2 (colonne mixte → ×1,8) |
| Blanc final | 50 | 50 | ×1 (colonne mixte → ×0,9) |
| GC quotidien | 10 | 15 | ×1,5 (colonne mixte → ×2,0) |

Colonnes "mixtes" : le CSV additionne quotidien et final dans une seule colonne, impossible à séparer, d'où un ratio intermédiaire. Barème WattHunter : `services/pcs-sync/scoring.py` lignes 62-133. Barème LRDT : page `/rules` du site.

## 5. Trois contraintes dures découvertes (détaillées en section 01 du HTML)

1. **Ne jamais reclasser l'histoire.** La conversion change l'ordre d'arrivée dans 13 tours sur 30 et le vainqueur sur 2 (Giro 2024, Tour 2023). Le rang affiché doit toujours venir de la source, l'XP converti ne sert qu'aux agrégats.
2. **Le lissage bayésien seul ne suffit pas.** Un joueur à 1 victoire en 2 tours reste sur le podium même à C=40. Il faut lissage + seuil de participation.
3. **Participation très inégale** : 4 joueurs à 30/30, d'autres à 8, 3, 2. C'est le vrai problème de design, et la raison d'être des 6 itérations de l'écran A.

## 6. Ce qui reste à trancher

- **Q3** : seuil de participation pour le classement "moyenne". Proposé 15 tours. Jonathan avait promis de répondre par vocal, jamais reçu.
- **Q4** : Fangio (3 tours, aucun compte WattHunter identifié) : importer avec profil placeholder, ou exclure.
- **Q5** : découpage MVP. Proposé V1 = palmarès historique LRDT seul en lecture, V2 = auto-alimentation par les saisons WattHunter.
- **Q1bis** : côté WattHunter, une ligue couvre les 9 phases d'une saison entière (Classiques, Giro, Tour, Vuelta dans la même ligue), alors qu'un tour LRDT = une seule épreuve. "Le plus de victoires Giro" n'a donc pas d'équivalent futur direct. Options : score par phase (proche de ce qui existe sur achievements), ou seulement "champion de saison".
- **Q7** : où stocker la donnée migrée. Recommandé : table dédiée (type `legacy_palmares_results`), pas de fausses lignes dans `leagues`/`teams`.
- **Q8** : points de sommet côté WattHunter. `Stage.climbs()` existe dans la lib PCS et n'est appelé nulle part. Piste séparée, hors chantier palmarès.
- **Recommandation wireframes** (section 06 du HTML) : A3 (seuil visible) en vue principale, A4 (vitrine par épreuve) en second onglet, B3 (grille épreuve × joueur) pour la saison, C2 + C5 pour le profil. A5 (lissage) écarté.

## 7. Faits techniques WattHunter vérifiés (ne pas re-chercher)

- `leagues` n'a **aucune colonne de type de course**. Seul `mode` (manager/classic) existe, et c'est l'économie, pas le calendrier.
- `/league/{id}/achievements` (label nav "Palmares") est déjà une page **joueur/manager**, pas coureur, mais scoped à **une seule ligue**. Rien de cross-ligue ni cross-saison n'existe.
- `/league/{id}/ranking` lit uniquement le live d'une ligue. **Aucun mécanisme de "saison archivée"** : le V2 auto-alimenté part de zéro.
- Table joueurs : `public.users` (`id`, `display_name`), pas `profiles`.
- Sprints intermédiaires : **non récupérables** avec la lib PCS (6 onglets seulement). Combatif : page PCS cassée (renvoie le GC), et `breakaway_bonus` couvre déjà l'intention.

## 8. Pièges de méthode rencontrés

- L'arbre d'accessibilité du navigateur (`read_page`) **fait disparaître silencieusement des colonnes** sur les tableaux DataTables. Toujours extraire depuis le DOM brut.
- La sortie de `javascript_tool` (Claude in Chrome) est tronquée vers 900 caractères. Pour sortir un gros bloc : l'écrire dans le DOM dans un `<pre>` puis lire avec `get_page_text`.
- `supabase db query --linked` fonctionne en lecture, mais le classificateur d'auto mode bloque `auth.users` et parfois `information_schema`. Lire le schéma dans `supabase/migrations/` (attention : `create table` en minuscules, grep insensible à la casse).
- Le site LRDT est en http, la session est portée par le Chrome de Jonathan via l'extension Claude in Chrome. Ne jamais saisir de mot de passe, même sur demande.

## 9. Skills suggérées

- `mattpocock-skills:grilling` : si la nouvelle vision rouvre des décisions, la griller avant de coder. Jonathan choisit lui-même entre `grill-me` et `grill-with-docs` (règle du CLAUDE.md AI OS), ne pas décider à sa place.
- `design` (canvas Claude Design) : si les wireframes doivent être retravaillés visuellement, préférer ce canvas au HTML statique de l'artifact, c'est éditable à la main.
- `mattpocock-skills:domain-modeling` : pour fixer le vocabulaire (victoire, titre, saison, ère, épreuve) avant le schéma, il y a déjà de la confusion entre "tour LRDT" et "ligue WattHunter".
- `supabase:supabase-postgres-best-practices` : à charger avant toute migration, quand la Q7 sera tranchée.
- Lire `docs/watthunter-design-system-v3.md` avant tout front (Rule #1 du CLAUDE.md projet).
