# 01 — Entité saison et rattachement des ligues

**What to build:** une saison existe en base et vaut une année. Chaque ligue est
rattachée à une saison, et l'on peut demander « toutes les ligues de la saison
2026 » et « toutes les saisons connues ». Les deux ligues classic de 2026
(V1, qui a porté les Classiques et le Giro, et V2, qui a porté le Tour et la
Vuelta) pointent vers la même saison 2026, de sorte qu'un classement d'année
puisse les agréger.

Le rattachement, pas la recopie : aucune ligne d'XP n'est réécrite ni déplacée.
L'agrégation se fait à la lecture, **par joueur** et non par équipe, puisqu'un nom
d'équipe change à chaque saison.

**Blocked by:** None — can start immediately.

**Status:** done

- [x] Une migration crée l'entité saison (année) et le rattachement des ligues.
- [x] Toutes les ligues existantes sont rattachées à la saison 2026.
- [x] Une requête retourne le cumul d'XP par joueur sur une saison, toutes ligues
      de cette saison confondues, sans doublon quand un joueur a une équipe dans
      chacune des deux ligues.
- [x] Le contournement écrit en dur dans la page achievements (transfert manuel du
      palmarès V1 vers V2) est identifié et marqué comme supprimable, avec le
      ticket qui le supprimera.
- [x] `supabase db reset` rejoue la migration sans erreur.
- [x] La skill `supabase:supabase-postgres-best-practices` a été chargée avant
      d'écrire la migration.

## Livré — 2026-09-14 (`f8648a9`)

Migration `20260914000000_seasons.sql`. Table `seasons`, clé naturelle `year` :
une saison EST une année, un id de substitution n'aurait ajouté qu'une jointure
entre deux fois la même valeur. Le rattachement passe par une clé étrangère sur
`leagues.season_year`, qui existait déjà comme entier libre — aucune colonne
ajoutée aux ligues, aucune ligne d'XP réécrite.

`season_player_xp(year)` agrège par joueur. Vérifié en local : un joueur avec
une équipe dans chaque ligue 2026 sort **une seule ligne**, 100 + 250 = 350.

Garde-fou non demandé mais nécessaire : `leagues.season_year` a pour défaut
l'année courante, donc la première ligue créée le 1er janvier suivant aurait
heurté la FK et cassé la création de ligue. Trigger `leagues_ensure_season`, qui
ouvre la saison à la demande. La FK reste une vraie contrainte (vérifié : une
ligue en saison 1999 est refusée).

Contournement `HARDCODED_GRANTS` : annoté dans le code comme supprimable, et
daté par le **ticket 13**, créé pour l'occasion.
