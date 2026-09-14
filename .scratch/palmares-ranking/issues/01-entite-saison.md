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

**Status:** ready-for-agent

- [ ] Une migration crée l'entité saison (année) et le rattachement des ligues.
- [ ] Toutes les ligues existantes sont rattachées à la saison 2026.
- [ ] Une requête retourne le cumul d'XP par joueur sur une saison, toutes ligues
      de cette saison confondues, sans doublon quand un joueur a une équipe dans
      chacune des deux ligues.
- [ ] Le contournement écrit en dur dans la page achievements (transfert manuel du
      palmarès V1 vers V2) est identifié et marqué comme supprimable, avec le
      ticket qui le supprimera.
- [ ] `supabase db reset` rejoue la migration sans erreur.
- [ ] La skill `supabase:supabase-postgres-best-practices` a été chargée avant
      d'écrire la migration.
