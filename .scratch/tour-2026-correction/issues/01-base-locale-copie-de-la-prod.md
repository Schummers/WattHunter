# 01 — Base locale, copie fidèle de la prod

**What to build:** une base Supabase locale sur laquelle les scripts du
diagnostic donnent exactement les mêmes chiffres qu'en prod, pour qu'un rescore
local vaille preuve. Rien n'est écrit en prod : le dump est en lecture seule.

**Blocked by:** None — livré.

**Status:** ready-for-human

- [x] Colima + Supabase local démarrés selon le CLAUDE.md du repo (exclusions vector / edge-runtime respectées)
- [x] Les migrations locales sont à parité avec `supabase migration list --linked` ; aucune migration en attente d'un côté ni de l'autre
- [x] Dump des données de prod pris en **lecture seule** et restauré en local ; le nombre de lignes de `race_results`, `rider_xp_daily`, `gt_final_classifications`, `stage_event_results`, `stage_profiles`, `gt_squad`, `contracts`, `teams` est identique prod / local, et la date du dump est notée dans le ticket
- [x] Le crosscheck Wikipedia du diagnostic, pointé sur le local, rend **37 / 198** ; le balayage de la zone scorée rend **79 / 454**
- [x] Le classement du Tour lu en local est identique à l'écran de prod (Leopard_Trek 3743.0, Muskatel Muskadji 3555.0, GoudalEnergies 3382.72, Klimax 2698.38, Las Chivas Pendejas 2287.74, Dixon Hormous 2087.0, Peejee 1915.7, bigdaddy 1257.92, TheAussieMate 0) et `teams.cumulative_xp` des 9 équipes est identique
- [x] La procédure de reconstruction (démarrage, restore, vérification) tient en une section du ticket et est rejouable de zéro

## Résultat

**Dump pris le 2026-09-14 à 21:56–21:59 (Asia/Bangkok)**, `supabase db dump
--linked --data-only`, 8,9 Mo, lecture seule. Aucune écriture en prod à aucun
moment de ce ticket.

| Vérification | Attendu | Mesuré en local |
|---|---|---|
| Migrations | parité | **187 / 187**, 0 en local seul, 0 en remote seul |
| Lignes, 8 tables du ticket | = prod | **identiques** |
| Lignes, **les 36 tables** de `public` | — | **0 divergence sur 36** |
| PCS réparé vs Wikipedia | 0 / 200 | **0 / 200** |
| Base vs Wikipedia | 37 / 198 | **37 / 198** |
| Zone scorée | 79 / 454 | **79 / 454** |
| XP Tour + `cumulative_xp` + `level`, 9 équipes | = prod | **0 écart sur 8** comparables |

Les deux JSON régénérés depuis le local (`crosscheck-tdf2026-2026-09-14.json`,
`etendue-tdf2026-2026-09-14.json`) sont **identiques octet pour octet** à ceux
que le diagnostic avait produits contre la prod. C'est la preuve la plus forte
disponible ici : ce n'est pas « les mêmes totaux », c'est le même fichier.

TheAussieMate n'apparaît pas dans la comparaison XP Tour, des deux côtés : elle
n'a aucune ligne `rider_xp_daily` sur les slugs du Tour, ce que le diagnostic
annonçait (0 XP). Son `cumulative_xp` local vaut 2102.61, conforme.

## Procédure de reconstruction, rejouable de zéro

```bash
# 0. Le port 54322 doit être libre (voir « Regis » ci-dessous)
colima start --cpu 4 --memory 6
cd <worktree>
supabase start --exclude vector,edge-runtime,logflare,imgproxy,studio,mailpit

# 1. Un worktree n'hérite pas du lien Supabase : supabase/.temp est gitignoré
cp ../../../supabase/.temp/project-ref supabase/.temp/project-ref
supabase migration list --linked          # doit être à parité, 187/187

# 2. Schéma local depuis les migrations, puis vider ce que les seeds ont écrit
supabase db reset
docker exec supabase_db_WattHunter psql -U postgres -d postgres -c "
DO \$\$ DECLARE t text; BEGIN
  FOR t IN select tablename from pg_tables where schemaname='public'
  LOOP EXECUTE format('TRUNCATE TABLE public.%I CASCADE', t); END LOOP;
END \$\$;
TRUNCATE TABLE auth.users CASCADE;
ALTER TABLE public.auction_bids DROP CONSTRAINT IF EXISTS auction_bids_round_check;"

# 3. Dump de prod (lecture seule) et restore
supabase db dump --linked --data-only -f /tmp/dump-data.sql
docker exec -i supabase_db_WattHunter psql -U postgres -d postgres < /tmp/dump-data.sql

# 4. Droits PostgREST (voir « Divergences » : ils manquent en local)
docker exec supabase_db_WattHunter psql -U postgres -d postgres -c "
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
NOTIFY pgrst, 'reload schema';"
```

Vérification : rejouer `wikipedia_crosscheck_tdf.py` et `sweep_zone_scoree_tdf.py`
avec `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` pointés sur le local
(`supabase status -o env`), et differ les JSON contre ceux du diagnostic.

## Quatre divergences prod / local, trouvées en chemin

Aucune ne bloque les tickets 3 à 6, les trois premières méritent d'être sues.

1. **Un `pg_dump --data-only` échoue par lot, pas par ligne.** Les `INSERT` sont
   multi-lignes : un seul doublon rejette **toute la table**. Au premier restore,
   sept tables sont passées à la trappe d'un coup (`leagues`, `sponsors`,
   `policies`, `tactic_usage_limits`, `gt_rescue_windows`, `auction_bids`,
   `auth.users`) parce que les migrations les avaient déjà semées. **La ligue
   Classic V2 était absente et `teams` affichait pourtant 26 lignes**, le bon
   compte : `session_replication_role = replica` désactive les clés étrangères
   pendant le restore, donc rien n'a protesté. Vider avant de restaurer est
   obligatoire, et comparer les 8 tables du ticket ne l'aurait pas vu — il a
   fallu comparer les 36.
2. **`auction_bids_round_check`.** Les migrations produisent `round BETWEEN 1 AND 8` ;
   la prod contient une ligne à `round = 9` (enchère annulée du 2026-07-02). La
   contrainte est donc **plus stricte en local qu'en prod** : le schéma que
   `db reset` reconstruit n'est pas celui qui tourne. Contrainte retirée en
   local pour charger la ligne. Sans rapport avec le scoring, mais c'est une
   dérive schéma réelle, à traiter hors de ce chantier.
3. **Les droits PostgREST ne sont pas dans les migrations.** Après `db reset`,
   `service_role` a zéro `GRANT SELECT` sur `public` : toute lecture par le
   client Supabase répond `42501`. La prod les a, ils viennent de la plateforme,
   pas du repo. Un `db reset` ne reconstruit donc pas une base utilisable par le
   pipeline sans ce rattrapage.
4. **Le schéma `storage` local est plus ancien que celui de la prod**
   (`buckets.versioning_status`, `objects.archived_at` inconnues). Deux lots de
   storage non chargés. Sans effet ici : les photos coureurs sont servies par le
   bucket de prod, le pipeline n'y touche pas.

## Regis

Le port 54322 était tenu depuis six semaines par la stack Supabase locale du
projet **Regis**. Arrêtée avec l'accord de l'utilisateur ; ses données sont
intactes dans son volume Docker :

```bash
docker volume ls --filter label=com.supabase.cli.project=Regis
```

**À relancer en fin de chantier** (`cd ~/Documents/Regis && supabase start`),
après avoir arrêté celle de WattHunter.

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
