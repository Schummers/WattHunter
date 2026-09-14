# 01 — Base locale, copie fidèle de la prod

**What to build:** une base Supabase locale sur laquelle les scripts du
diagnostic donnent exactement les mêmes chiffres qu'en prod, pour qu'un rescore
local vaille preuve. Rien n'est écrit en prod : le dump est en lecture seule.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Colima + Supabase local démarrés selon le CLAUDE.md du repo (exclusions vector / edge-runtime respectées)
- [ ] Les migrations locales sont à parité avec `supabase migration list --linked` ; aucune migration en attente d'un côté ni de l'autre
- [ ] Dump des données de prod pris en **lecture seule** et restauré en local ; le nombre de lignes de `race_results`, `rider_xp_daily`, `gt_final_classifications`, `stage_event_results`, `stage_profiles`, `gt_squad`, `contracts`, `teams` est identique prod / local, et la date du dump est notée dans le ticket
- [ ] Le crosscheck Wikipedia du diagnostic, pointé sur le local, rend **37 / 198** ; le balayage de la zone scorée rend **79 / 454**
- [ ] Le classement du Tour lu en local est identique à l'écran de prod (Leopard_Trek 3743.0, Muskatel Muskadji 3555.0, GoudalEnergies 3382.72, Klimax 2698.38, Las Chivas Pendejas 2287.74, Dixon Hormous 2087.0, Peejee 1915.7, bigdaddy 1257.92, TheAussieMate 0) et `teams.cumulative_xp` des 9 équipes est identique
- [ ] La procédure de reconstruction (démarrage, restore, vérification) tient en une section du ticket et est rejouable de zéro
