# 01 — Base locale, copie fidèle de la prod

**What to build:** une base Supabase locale sur laquelle les scripts du
diagnostic donnent exactement les mêmes chiffres qu'en prod, pour qu'un rescore
local vaille preuve. Rien n'est écrit en prod : le dump est en lecture seule.

**Blocked by:** le port 54322 (voir « Blocage » ci-dessous).

**Status:** needs-info — décision utilisateur requise avant de reprendre

- [ ] Colima + Supabase local démarrés selon le CLAUDE.md du repo (exclusions vector / edge-runtime respectées)
- [ ] Les migrations locales sont à parité avec `supabase migration list --linked` ; aucune migration en attente d'un côté ni de l'autre
- [ ] Dump des données de prod pris en **lecture seule** et restauré en local ; le nombre de lignes de `race_results`, `rider_xp_daily`, `gt_final_classifications`, `stage_event_results`, `stage_profiles`, `gt_squad`, `contracts`, `teams` est identique prod / local, et la date du dump est notée dans le ticket
- [ ] Le crosscheck Wikipedia du diagnostic, pointé sur le local, rend **37 / 198** ; le balayage de la zone scorée rend **79 / 454**
- [ ] Le classement du Tour lu en local est identique à l'écran de prod (Leopard_Trek 3743.0, Muskatel Muskadji 3555.0, GoudalEnergies 3382.72, Klimax 2698.38, Las Chivas Pendejas 2287.74, Dixon Hormous 2087.0, Peejee 1915.7, bigdaddy 1257.92, TheAussieMate 0) et `teams.cumulative_xp` des 9 équipes est identique
- [ ] La procédure de reconstruction (démarrage, restore, vérification) tient en une section du ticket et est rejouable de zéro

## Blocage — le port 54322 est pris par le projet Regis

Colima tourne. `supabase start` échoue net :

```
Bind for 0.0.0.0:54322 failed: port is already allocated
Try stopping the running project with supabase stop --project-id Regis
```

Dix conteneurs `supabase_*_Regis` tournent **depuis six semaines**, dont
`supabase_db_Regis` sur 54322 et `supabase_kong_Regis` sur 54321. Ce n'est pas
une collision accidentelle : c'est une stack locale d'un autre projet, laissée
allumée.

Trois issues, et le choix n'appartient pas à l'agent :

1. **Arrêter la stack Regis** (`supabase stop --project-id Regis`). Réversible :
   le volume de données survit, un `supabase start` côté Regis la remonte. C'est
   la voie la plus simple, mais elle touche un projet hors périmètre, ce que la
   règle des sessions parallèles interdit de faire sans le dire.
2. **Déplacer les ports de WattHunter** dans `supabase/config.toml`. Ne touche à
   rien chez Regis, mais `config.toml` est versionné et le `CLAUDE.md` du repo
   documente 54322 en dur : la modif déborde du ticket et périmerait la doc.
3. **Laisser tomber la base locale** et valider autrement. À déconseiller : tout
   l'intérêt des tickets 3 à 5 est que le rescore se prouve avant la prod.

Recommandation : option 1, avec un `supabase start` côté Regis en fin de
chantier. La tentative a été refusée par la couche de permissions, elle demande
un accord explicite.

**Date du dump prod : pas encore prise** (le dump attend que la base locale
existe).
