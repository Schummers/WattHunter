# Database Backup Strategy — WattHunter

**Date** : 2026-05-08
**Statut** : Spec validee, implementation a planifier
**Priorite** : Haute (pre-alpha, proteger les donnees de dev/test)

---

## Contexte

WattHunter est un jeu d'encheres cyclisme heberge sur Supabase (plan Free). La base contient des donnees vivantes difficiles a reconstruire : 600 riders enrichis (Pipeline E, ~6h de scraping), encheres, contrats, tresoreries, XP, classements.

Aujourd'hui, si une mauvaise manipulation de code corrompt les donnees (RPC bugge, migration foireuse, script de test mal cible), il n'y a **aucun moyen rapide de restaurer**.

### Ce qui existe

| Element | Statut |
|---------|--------|
| Migrations SQL versionnees (74 fichiers) | OK — le schema est recuperable |
| Seed data (policies + sponsors) | OK — donnees de reference recuperables |
| Script `backup-supabase.sh` (pg_dump) | Existe mais jamais execute |
| Script `restore-supabase.sh` (pg_restore) | Existe, non teste |
| Backups auto Supabase (plan Free) | Quotidien, 7j retention, restauration via support uniquement |
| Backup local automatise | Inexistant |
| Stockage off-site des backups | Inexistant |

### Donnees critiques (non-reconstructibles rapidement)

- `riders` : 600 riders enrichis (photo, bio, specialty, teams) — 6h de scraping pour reconstruire
- `rider_season_rankings` : classements PCS par saison
- `race_results` : resultats de courses scrapees
- `rider_teams` : historique equipes
- `contracts` : coureurs sous contrat par equipe (donnees de jeu)
- `teams` : treasury, XP, level (etat du jeu)
- `auction_bids` / `draft_bids` : encheres en cours et historique
- `treasury_log` : historique financier complet
- `sponsors` / `team_sponsors` : configuration sponsors

---

## Objectif

Mettre en place un systeme de backup automatique local qui protege contre la perte de donnees lors du developpement, avec la possibilite de restaurer rapidement a un etat anterieur.

---

## Exigences fonctionnelles

### EF-1 : Backup automatique quotidien
- Un dump complet de la base Supabase distante doit etre effectue automatiquement chaque jour
- Le backup doit tourner sans intervention manuelle une fois configure
- Le backup doit fonctionner meme si le laptop a ete eteint (rattrapage au reveil si possible)

### EF-2 : Retention et rotation
- Conserver les **7 derniers backups quotidiens**
- Supprimer automatiquement les backups plus anciens pour ne pas saturer le disque
- Nommage avec timestamp pour identifier facilement chaque backup

### EF-3 : Backup manuel a la demande
- Pouvoir lancer un backup supplementaire avant une operation risquee (migration, nouveau RPC, test destructif)
- Commande simple, une seule ligne (`./scripts/backup-supabase.sh` ou equivalent)

### EF-4 : Restauration testee et documentee
- Procedure de restauration documentee etape par etape
- Restauration sur la base **locale** (Colima) pour verifier le dump avant de toucher a la prod
- Option de restauration directe sur la base distante (avec confirmation explicite)

### EF-5 : Verification du backup
- Apres chaque dump, verifier que le fichier n'est pas vide / corrompu (taille minimale, exit code pg_dump)
- Log de chaque backup (succes/echec, taille, duree)

### EF-6 : Notification en cas d'echec
- Si un backup automatique echoue, l'utilisateur doit en etre informe (log visible, notification locale, ou alerte)

---

## Exigences non-fonctionnelles

### ENF-1 : Securite
- Le `SUPABASE_DB_URL` (connection string avec mot de passe) ne doit jamais etre commite dans git
- Les fichiers `.dump` ne doivent pas etre commites (ajouter `backups/` a `.gitignore`)
- Les dumps contiennent des donnees sensibles (traiter comme des secrets)

### ENF-2 : Performance
- Le dump ne doit pas impacter les performances de l'app (pg_dump sur Supabase est non-bloquant pour les lectures)
- Taille estimee du dump : < 50 Mo (600 riders + donnees de jeu) — stockage local negligeable

### ENF-3 : Portabilite
- La solution doit fonctionner sur macOS (laptop principal)
- Bonus : compatible Mac Mini si besoin de backup depuis l'autre machine

### ENF-4 : Simplicite
- Configuration en moins d'1 heure
- Aucune dependance externe payante (pas de S3, pas de service tiers)
- Maintenance zero une fois en place

---

## Ce qui est hors scope (pour l'instant)

- Stockage off-site (S3, cloud storage) — a considerer pour la prod/alpha
- Point-in-Time Recovery (PITR) — necessite Supabase Pro + add-on
- Backup incrementiel — overkill pour la taille actuelle de la base
- Backup avant chaque course/phase automatiquement — pourra etre ajoute plus tard via hook dans le pipeline PCS
- Backup de la base locale Colima — jetable par definition, pas besoin

---

## Approches possibles (a trancher a l'implementation)

| Approche | Principe | Pour | Contre |
|----------|----------|------|--------|
| **launchd (macOS natif)** | Fichier `.plist` dans `~/Library/LaunchAgents/` | Fire-and-forget, survit aux redemarrages, rattrapage au reveil | Config XML, macOS only |
| **crontab** | Une ligne dans `crontab -e` | Ultra simple | Permissions TCC sur macOS moderne, pas de rattrapage |
| **Script wrapper + rappel** | Script ameliore + routine Claude Code ou rappel calendrier | Flexible, verification integree | Semi-manuel |

La decision d'approche sera prise au moment de l'implementation.

---

## Scripts existants a ameliorer

Le script `scripts/backup-supabase.sh` actuel fait le minimum (pg_dump + timestamp). A l'implementation, il faudra ajouter :

1. **Rotation** : supprimer les dumps > 7 jours
2. **Verification** : check taille du fichier + exit code
3. **Logging** : ecrire dans `backups/backup.log` (date, taille, duree, succes/echec)
4. **Exit code** : retourner 1 en cas d'echec (pour que le scheduler puisse reagir)

Le script `scripts/restore-supabase.sh` fonctionne mais necessite :

1. **Documentation** : comment restaurer sur local vs distant
2. **Confirmation** : demander confirmation avant restauration sur distant
3. **Test** : verifier qu'un dump recent se restaure correctement sur Colima

---

## Definition of Done

- [ ] Backup automatique tourne quotidiennement sans intervention
- [ ] 7 jours de retention avec rotation automatique
- [ ] Backup manuel fonctionne en une commande
- [ ] Restauration testee sur base locale (Colima)
- [ ] Procedure de restauration documentee
- [ ] `backups/` dans `.gitignore`
- [ ] Premier backup execute et verifie
