# PRD 09 — Classement (Standings & Analytics)

> **Statut** : A implementer (MVP)
> **Date** : 2026-02-28
> **Scope** : Classement general, detail par equipe, resultats des courses

---

## Contexte

La page Classement est le moteur competitif du jeu. Elle repond a "ou est-ce que je me situe ?" et "que s'est-il passe dans les courses ?". Elle combine le leaderboard de la ligue avec les resultats factuels des courses PCS qui impactent les equipes.

---

## Classement general

### US-STAND-01 : Voir le classement de la ligue

**En tant que** joueur,
**je veux** voir le classement de toutes les equipes de ma ligue,
**afin de** savoir ou je me situe par rapport a mes rivaux.

**Colonnes du tableau :**

| Colonne | Description |
|---------|-------------|
| Rang | Position (1, 2, 3...) avec medailles or/argent/bronze pour le top 3 |
| Equipe | Nom de l'equipe + avatar du joueur |
| Niveau | Niveau actuel (1-10) |
| XP Total | XP cumule depuis le debut |
| XP Jour | XP gagne aujourd'hui |
| Tresorerie | Solde actuel (€) |
| Coureurs | Nombre de coureurs dans le roster |

**Mon equipe est toujours mise en surbrillance** (fond accent-muted ou bordure accent).

**Tri :**
- Par defaut : XP total (desc) — c'est le classement officiel
- Options : tresorerie, XP jour, niveau, nombre de coureurs

**Interaction :**
- Tap sur une equipe → voir le detail de cette equipe (US-STAND-03)

### US-STAND-02 : Voir l'evolution du classement

**En tant que** joueur,
**je veux** voir si les equipes ont monte ou descendu dans le classement,
**afin de** suivre la dynamique de la competition.

**Contenu :**
- Fleche haut/bas/stable a cote du rang
- Delta par rapport a hier (ou la semaine derniere)
- Couleur : vert (monte), rouge (descend), gris (stable)

**Note MVP :** Necessite de stocker l'historique de classement (snapshot quotidien). Si trop complexe, reporter en Alpha+ et afficher uniquement le rang statique.

---

## Detail par equipe

### US-STAND-03 : Voir le detail d'une equipe adverse

**En tant que** joueur,
**je veux** voir la composition de l'equipe d'un rival,
**afin de** analyser sa strategie et me comparer.

**Contenu :**
- Nom de l'equipe + avatar du joueur
- Niveau + XP total
- Tresorerie
- Liste des coureurs (meme infos que le roster, mais en lecture seule) :
  - Nom, nationalite, specialite, equipe reelle
  - Points PCS (publics)
  - Salaire du contrat (pubic? → a decider)
- Politiques actives (visibles par tous)
- Sponsor actif (visible par tous)

**Interaction :**
- Tap sur un coureur → detail coureur (lecture seule, pas de bouton "relacher")
- Bouton retour → classement general

**Question a trancher :** Est-ce que les salaires des contrats adverses sont publics ? Arguments :
- **Oui** : transparence, permet d'estimer la strategie financiere du rival → plus strategique
- **Non** : garde une part de mystere → plus de fun
- **Recommandation** : les rendre publics — ca enrichit l'analyse et la discussion

---

## Resultats des courses

### US-STAND-04 : Voir les resultats des courses du jour

**En tant que** joueur,
**je veux** voir les resultats des courses cyclistes reelles,
**afin de** comprendre comment les points PCS sont generes.

**Contenu :**
- Liste des courses du jour (ou des derniers jours s'il n'y a rien aujourd'hui)
- Pour chaque course :
  - Nom de la course
  - Date
  - Top 10 du classement general (ou de l'etape)
  - Pour chaque coureur dans le top 10 : nom, equipe reelle, points PCS gagnes
  - **Highlight** : si un coureur du top 10 est dans une equipe de la ligue → badge avec le nom de l'equipe

**Interaction :**
- Tap sur un coureur → detail coureur (si dans une equipe de la ligue)

**Condition d'affichage :** Visible uniquement si des resultats existent dans `daily_scores` pour les jours recents.

### US-STAND-05 : Voir l'impact des courses sur mon equipe

**En tant que** joueur,
**je veux** voir comment les resultats des courses impactent specifiquement mon equipe,
**afin de** evaluer la performance de mes coureurs.

**Contenu :**
- Apres chaque course, pour chaque coureur de mon equipe qui a participe :
  - Nom du coureur
  - Position dans la course
  - Points PCS gagnes
  - Revenue genere (points × TAUX_CONVERSION)
  - XP genere (points × bonus politiques)

**Note :** Cette vue peut etre un filtre/tab dans la section resultats ("Toutes les courses" vs "Mon equipe").

---

## Tabs de la page Classement

```
[Classement] [Resultats]
```

| Tab | Contenu |
|-----|---------|
| Classement | Leaderboard des equipes (US-STAND-01, 02) |
| Resultats | Resultats des courses + impact equipe (US-STAND-04, 05) |

Le tab "Classement" est le defaut.

---

## Etats speciaux

### Ligue freshement lancee (aucune enchere resolue)

- Classement : toutes les equipes a 0 XP, 300 000 € de tresorerie
- Message : "Le classement se mettra a jour quand les coureurs commenceront a marquer des points"
- Pas de resultats encore

### Pas de courses recentes

- Tab Resultats : "Pas de courses recentes. Les resultats sont mis a jour quotidiennement a 09:00 UTC."

---

## Donnees necessaires

| Donnee | Source | Temps reel ? |
|--------|--------|-------------|
| Classement equipes | `teams` WHERE league_id, ORDER BY total_xp DESC | Non |
| XP du jour par equipe | Somme `daily_scores` WHERE date = today, groupe par team | Non |
| Detail roster adverse | `contracts` JOIN `riders` WHERE team_id = X | Non |
| Politiques adverses | `team_policies` WHERE team_id = X | Non |
| Resultats courses | `daily_scores` JOIN `riders`, groupe par course/date | Non |
| Historique classement | Table `standing_snapshots` (a creer) | Non |
| Sponsor adverse | `team_sponsors` WHERE team_id = X AND status = 'active' | Non |
