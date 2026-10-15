# Pilotage : GitHub Issues

<!-- produit:generique:debut (copié de ~/AI OS/templates/produit/issue-tracker.md, ne pas modifier ici) -->

Ce repo est un **produit** : tout son pilotage vit dans les GitHub Issues du
repo, le vault ne garde que le pourquoi. Opérer avec `gh`, lancé dans le
clone (`{owner}/{repo}` est rempli par `gh api`).

## Où vit quoi

| Où | Quoi |
|---|---|
| Vault, goal du produit | La vision, les KPI, la review hebdo et le bloc « Roadmap » (des liens vers les maps et milestones, dans l'ordre). Jamais de tâche ni de projet |
| Vault, backlog du goal | Les idées non rédigées. Le propriétaire seul l'alimente : un agent n'y écrit pas et ne s'en sert pas comme liste de travail |
| GitHub, map Wayfinder | Ce qui reste à décider pour atteindre une destination |
| GitHub, milestone du même nom | Ce qui reste à exécuter pour cette destination |
| GitHub, hors carte | Les tickets rédigés mais non planifiés : `parking`, `horizon:v2`, sans milestone |
| Repo, `docs/` | Research (`docs/research/`), specs, ADR (`docs/adr/`), glossaire (`CONTEXT.md`) |

La research propre à ce produit vit ici, jamais dans le vault. La research
générique (un marché, une méthode qui sert plusieurs goals) vit dans le vault.

## Vocabulaire

- **Destination** : un état du produit qu'un utilisateur peut constater, nommé
  par une phrase (« les parents sortent leur déclaration »). Une map et un
  milestone portent son nom.
- **Roadmap** : la suite ordonnée des destinations. Elle vit dans le goal du
  vault, que la review hebdo réordonne.
- **Map** : l'issue `wayfinder:map` d'une destination. Corps : Destination,
  Notes, Decisions so far, Not yet specified, Out of scope. Ses sous-issues ne
  sont que des tickets de décision.
- **Ticket de décision** : `wayfinder:grilling` (une conversation avec le
  propriétaire), `wayfinder:research` (un agent sur sources primaires),
  `wayfinder:prototype` (un brouillon sur lequel réagir), `wayfinder:task`
  (un travail manuel qui débloque une décision).
- **Ticket d'exécution** : une tranche de dev ou une tâche dans le milestone,
  avec un label de triage.
- **Boucle de dev** : le runner commun qui prend les tickets `ready-for-agent`
  du milestone. Voir `docs/agents/boucle-de-dev.md`.

## La chaîne, du goal au code

1. **Discovery** : market et user research, en tickets `discovery`
   (`wayfinder:research` quand ils tranchent une décision). Le résultat va dans
   `docs/research/`.
2. **Roadmap** : nommer les destinations et leur ordre dans le goal du vault.
3. **Ouvrir une destination** : une map et un milestone du même nom.
4. **Tracer la map** : un grill large fait remonter les questions ouvertes,
   chacune devient un ticket de décision, sous-issue de la map.
5. **Trancher** : un ticket par session. Commentaire de résolution, fermeture,
   une ligne dans « Decisions so far » de la map (titre lié et gist). La
   décision crée ou précise des tickets d'exécution dans le milestone.
6. **Exécuter** : la boucle de dev prend les `ready-for-agent` du milestone
   sans bloquant ouvert, le propriétaire prend les `ready-for-human`.
7. **Fermer** : la map quand tout est tranché, le milestone quand la
   destination est atteinte. La destination suivante puise dans `parking` et
   dans le backlog du vault.

## Labels

| Famille | Labels |
|---|---|
| Décision | `wayfinder:map`, `wayfinder:grilling`, `wayfinder:research`, `wayfinder:prototype`, `wayfinder:task` |
| Exécution | `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix` |
| Nature | `discovery` (market et user research) |
| Hors carte | `parking`, `horizon:v2` |

Un label propre à ce repo est déclaré dans la section « Spécifique à ce
repo », sinon il ne doit pas exister. Créer un label manquant plutôt
qu'inventer un quasi-synonyme.

## Règles anti-dérive

- Un ticket n'entre dans un milestone que s'il sert la destination.
- Un bug trouvé en dev passe en `parking`, sauf s'il bloque la destination.
- Un ticket d'exécution n'est `ready-for-agent` que lorsque tous ses tickets
  de décision sont fermés. Ne jamais poser `ready-for-agent` sans l'accord du
  propriétaire sur un repo où la boucle tourne : elle le prend aussitôt.
- Si une demande déborde de la destination (section « Out of scope » de la
  map), le dire avant de coder.

## Commandes

- **Créer** : `gh issue create --title "..." --body "..." --label "..." [--milestone "<destination>"]`, heredoc pour un corps multi-ligne.
- **Lire** : `gh issue view <n> --comments`.
- **Lister** : `gh issue list --state open --label "<label>" [--milestone "<destination>"]`.
- **Commenter, labelliser, fermer** : `gh issue comment <n> --body "..."`, `gh issue edit <n> --add-label "..." --remove-label "..."`, `gh issue close <n> --reason "completed|not planned"`.
- **Id d'une issue** (pour les relations) : `gh api repos/{owner}/{repo}/issues/<n> --jq .id`, jamais le `#numéro` ni le `node_id`.
- **Sous-issue d'une map** : `gh api -X POST repos/{owner}/{repo}/issues/<map>/sub_issues -F sub_issue_id=<id>`.
- **Bloquer** (relation native, entre n'importe quels tickets, même d'une destination à l'autre) : `gh api -X POST repos/{owner}/{repo}/issues/<bloqué>/dependencies/blocked_by -F issue_id=<id du bloquant>`. `issue_dependencies_summary.blocked_by` compte les bloquants ouverts.
- **Frontière de décision** : `gh api "repos/{owner}/{repo}/issues/<map>/sub_issues?per_page=100" --jq '.[] | select(.state=="open" and (.assignees|length)==0 and .issue_dependencies_summary.blocked_by==0) | "\(.number) \(.title)"'`.
- **File d'exécution** : `gh issue list --milestone "<destination>" --label ready-for-agent --state open`, moins les tickets qui ont un bloquant ouvert.
- **Claim** : `gh issue edit <n> --add-assignee @me`, la première écriture de la session.
- **PR** : `Closes #<n>` dans le corps ferme l'issue au merge.
- **Pour les skills** : « publier dans l'issue tracker » = créer une issue GitHub ; « récupérer le ticket » = `gh issue view <n> --comments`. Les PR externes ne sont pas une surface de demande (`/triage` ne les lit pas).

<!-- produit:generique:fin -->

## Spécifique à ce repo

- Repo : `Schummers/WattHunter`. Goal du vault : `watthunter`.
- En pause jusqu'en 2027 : aucune destination ouverte. La reprise part du backlog du vault (`watthunter-backlog.md`) et ouvre une première paire map et milestone.
- Avant le 2026-10-15, les PRD et tickets vivaient en Markdown local sous `.scratch/<feature-slug>/` : ils restent en lecture, tout nouveau ticket est une issue GitHub.
- Labels propres à ce repo : aucun.
