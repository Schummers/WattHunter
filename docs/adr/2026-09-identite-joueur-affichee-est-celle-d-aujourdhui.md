# ADR 2026-09 — L'identité affichée est celle d'aujourd'hui, le rang reste celui d'origine

Statut : accepté, 2026-09-15. Code : `apps/web/lib/palmares/identity.ts`.

## Contexte

Depuis l'arrivée du palmarès et de l'archive La Route du Tour (PR #79), la même
personne portait deux identités selon l'écran :

- Ranking de la saison en cours : le nom d'équipe (`teams.name`), "GoudalEnergies".
- Ranking d'une saison archivée et les quatre onglets du palmarès : le nom de
  compte (`users.display_name`), "David Choncoutié".

Seuls 4 comptes sur 9 ont un nom d'équipe différent de leur nom de compte, donc
l'incohérence ne frappait qu'une partie de la grille : on ouvrait 2025 et une
ligne sur deux changeait de nom. La ligne archivée était en plus un rang et un
nom nus, sans badge ni score, là où la ligne 2026 est une vraie ligne de jeu.

Le code documentait explicitement le choix inverse pour le badge : « nobody had
a badge equipped in 2019, showing today's badge would say something false ».

## Décisions

1. **Le libellé affiché est le nom d'équipe courant du joueur, sur toutes les
   saisons.** Résolu une fois par `loadPlayerIdentities`, qui remplace quatre
   ré-écritures de la même jointure `league_members → users`.
2. **La clé d'agrégation reste le nom de compte.** C'est le seul pont entre les
   deux ères (une archive close n'a pas d'`user_id`). On ne change que le
   libellé : renommer une équipe ne coupe pas un historique en deux.
3. **Le badge affiché est celui équipé aujourd'hui, saisons archivées incluses.**
   Nom et badge répondent à « qui est ce joueur », pas à « qu'avait-il équipé en
   2019 ». Un joueur sans badge retombe sur ses initiales.
4. **Aucun rang, aucun score n'est recalculé.** Les rangs restent les ordres
   d'arrivée d'origine, et les points La Route du Tour s'affichent en `PTS`,
   jamais en `XP` : deux échelles qui ne s'additionnent ni ne se comparent.
5. **Sur une page de ligue, la ligue consultée gagne** pour choisir l'équipe de
   référence, sinon c'est la ligue la plus récente de la saison. Un joueur qui a
   renommé son équipe entre V1 et V2 se lit sous le nom de la ligue ouverte.

## Conséquences

- La bannière d'emblème reste réservée à la ligne de la saison en cours : c'est
  le seul marqueur qui distingue encore une ligne vivante d'une ligne d'archive.
- Un joueur qui change de nom d'équipe voit tout son historique d'affichage
  changer avec lui. C'est le comportement voulu, et c'est réversible : les
  données stockées, elles, n'ont pas bougé.
- Un ancien joueur sans compte WattHunter garde le nom de l'archive, en
  italique, parce qu'aucune identité courante n'existe pour lui.
