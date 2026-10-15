# Boucle de dev

<!-- produit:generique:debut (copié de ~/AI OS/templates/produit/boucle-de-dev.md, ne pas modifier ici) -->

La **boucle de dev** est le runner commun à tous les produits :
`~/AI OS/system/scripts/boucle-de-dev.py` (ADR racine 0011 et 0012). Elle
tourne sur le serveur (Mac mini), une fois par heure et par repo, et mène
chaque ticket prêt jusqu'à une PR vérifiée. Ce repo n'en garde pas de copie :
il la règle par `.boucle-de-dev.json` et la nourrit par ses issues.

## Ce qu'elle prend

- Les issues ouvertes `ready-for-agent`, non assignées à un autre, sans
  bloquant ouvert (relation « blocked by », ou ligne `Blocked by: #n` dans le
  corps). Celles d'un milestone passent d'abord, par ordre de milestone puis
  de numéro, et les tickets sans milestone ensuite.
- Jamais un ticket qui porte `needs-info`, `ready-for-human`, `hitl` ou un
  label `wayfinder:` de décision (`map`, `grilling`, `prototype`, `research`).
  Un `wayfinder:task` prêt pour un agent est pris.
- Elle ne filtre ni `parking` ni `horizon:v2` : un ticket hors carte ne porte
  donc jamais `ready-for-agent`.

## Ce que fait une session de ticket

Une session neuve (`claude -p`) par ticket, qui ne voit que lui et n'écrit
jamais sur GitHub (le runner publie). Dans l'ordre : lire le ticket,
`AGENTS.md` et `docs/agents/decisions.md` ; auto-grill (elle tranche le
réversible, renvoie le reste en `needs-info`) ; découper si trop gros ;
implémenter ; `code-review` ; vérifier ; écrire ses pièges dans
`docs/agents/learnings.md`. Le runner pousse, ouvre la PR, commente, et merge
seul si le repo le permet.

Fichiers du repo qu'elle lit ou écrit :

| Fichier | Rôle |
|---|---|
| `AGENTS.md` | Conventions et **commandes de vérification**, qui priment sur ses habitudes |
| `.boucle-de-dev.json` | Réglages (ci-dessous) |
| `docs/agents/decisions.md` | Les décisions de l'auto-grill, une ligne chacune, relues comme précédents |
| `docs/agents/learnings.md` | Les pièges rencontrés ; le propriétaire les trie avant d'en monter un dans `AGENTS.md` |

## Réglages : `.boucle-de-dev.json`

Tous facultatifs (modèle : `~/AI OS/templates/produit/boucle-de-dev.json.example`).

| Clé | Effet |
|---|---|
| `verify` | Les commandes de vérification ; sans elle, celles de `package.json` |
| `prompt` | Un prompt de session propre au repo, à la place de `session-de-ticket.prompt.md` |
| `slots` | Sessions en parallèle, chacune dans sa copie de travail |
| `daily_usd` | Plafond de dépense par jour pour ce repo |
| `notify` | `quiet` : pas de message Telegram par ticket, seulement les blocages |
| `merge_author_email` | Auteur du merge (`""` pour garder celui de GitHub) |

## Brancher, mettre en pause, arrêter

- **Brancher** : sur le serveur, cloner le repo puis installer
  `~/AI OS/system/launchd/com.aios.boucle-de-dev.plist` sous le nom
  `com.aios.boucle-de-dev.<repo>`, en remplaçant `__NAME__`, `__REPO__`,
  `__MERGE__` (`1` merge seul, `0` s'arrête à la PR verte) et
  `__TG_THREAD__` (voir `system/launchd/README.md`).
- **Tester** : `boucle-de-dev.py --repo <clone> --dry-run` affiche la
  frontière ; `--once` traite un seul ticket.
- **Pause** : `touch ~/.boucle-de-dev/<repo>.pause` (ou `pause` pour tous les
  repos), effective avant le prochain ticket.
- **Répondre** à une question `needs-info` : dans le fil Telegram « Dev »
  d'Hermes (le runner commente l'issue et remplace `needs-info` par
  `ready-for-agent`), ou à la main, en commentaire de l'issue puis avec le
  même échange de labels.

<!-- produit:generique:fin -->

## Spécifique à ce repo

- Branché sur la boucle : non (en pause).
- À la reprise : écrire `.boucle-de-dev.json` avec les commandes de `AGENTS.md` (section Commands), puis installer le runner.
