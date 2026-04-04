# WattHunter — PRD Secondary Screens v2
> Mars 2026 · Settings · History · Team Levels · Policies · Ranking

---

## Règles de navigation communes aux pages secondaires

- **Pas de topnav WattHunter** sur les pages secondaires (pas de logo, pas de league switcher en haut)
- **Flèche ← retour** en haut à gauche uniquement
- **Bottom nav conservé** sauf History et Team Levels (pages détail pures)
- History : pas de bottom nav (vient de Recruts, retour direct)
- Team Levels : pas de bottom nav (vient de My Team, retour direct)

---

## Écran A — Settings

### Objectif
> *"Gérer mon profil, mes leagues et les préférences de l'app."*

### Navigation
- Tap avatar (topnav) → Settings
- Page dédiée · Flèche ← retour · Bottom nav conservé

### Structure

```
← Back
────────────────────────
[Avatar]  Nom · Email
          Edit profile →
────────────────────────
League switcher
  [Les Forçats]  [Cycling Nerds]  [+ Join / Create]
  Active = bordure brand 2px
────────────────────────
[Nom league] · [Rôle] · [N players]
  Team name  [champ input éditable]
  ─────
  [🔗] Invite code · WH-4F2X9     Copy
  [🚪] Leave league                ›  (rouge)
────────────────────────
Documentation
  [⭐] How points work        ›
  [💰] Bonus & money          ›
  [🏆] Team levels & unlocks  ›
  [🔁] Auctions & rounds      ›
────────────────────────
  [↩] Sign out                    (rouge)
```

### League switcher

- Chips horizontales scrollables
- **Active** : bordure brand 2px, texte bold noir. Pas de fond coloré.
- **Autres** : bordure gris, texte noir
- Dernier chip : `+ Join / Create` → page dédiée

### Settings contextuels

La section league se met à jour entièrement quand on change de league active dans le switcher :
- Nom de la league + rôle (Admin / Member) + nb players
- Nom d'équipe **dans cette league** (champ input inline éditable)
- Invite code **de cette league**
- Leave league **pour cette league**

> Pas de league rules — hors scope.
> Langue non affichée — anglais uniquement en v1, pas d'option visible.

### Documentation in-app — 4 sections

| Section | Contenu |
|---------|---------|
| How points work | Système XP, impact des courses, policies sur le calcul |
| Bonus & money | Comment se calculent les bonus €, triggers |
| Team levels & unlocks | Progression, niveaux, ce qu'on débloque |
| Auctions & rounds | Fonctionnement des enchères et des rounds |

### Page Join / Create

**Join** : champ texte code d'invitation + bouton Join
**Create** : Nom de la league + Nom de l'équipe → génère invite code

### User Stories

| ID | Story |
|----|-------|
| US-A1 | Je veux voir mon profil (nom, email) et l'éditer |
| US-A2 | Je veux switcher entre mes leagues et avoir les settings contextuels |
| US-A3 | Je veux modifier le nom de mon équipe par league |
| US-A4 | Je veux copier le code d'invitation d'une league |
| US-A5 | Je veux rejoindre ou créer une league |
| US-A6 | Je veux quitter une league |
| US-A7 | Je veux accéder aux 4 sections de documentation in-app |
| US-A8 | Je veux me déconnecter |

### Acceptance Criteria

| ID | Critère | Priorité |
|----|---------|----------|
| AC-A1 | Pas de topnav WattHunter sur cette page | P0 |
| AC-A2 | League switcher : chip active = bordure brand 2px | P0 |
| AC-A3 | Section league entièrement contextuelle selon le chip actif | P0 |
| AC-A4 | Team name = champ input inline, tap pour éditer | P0 |
| AC-A5 | Invite code + bouton Copy (copie clipboard) | P0 |
| AC-A6 | Leave league → modale confirmation avant exécution | P0 |
| AC-A7 | 4 items documentation → pages in-app dédiées | P1 |
| AC-A8 | Sign out → confirmation + redirect login | P0 |
| AC-A9 | "+ Join / Create" → page Join/Create league | P0 |

---

## Écran B — Auction History

### Objectif
> *"Consulter les enchères passées de la league pour calibrer mes bids."*

### Navigation
- Accessible via `History →` dans le round header de Recruts
- **Pas de topnav, pas de bottom nav** — page détail pure
- Flèche ← retour vers Recruts

### Structure

```
← Recruts
────────────────────────
[Search rider…]
────────────────────────
ROUND 3 — PRE TOUR · Jan 13 · 14 riders
  [Photo]  Pogačar T. 🇸🇮     → @MaxVelo     [Won]           180 000 · 4 bids
  [Photo]  Vingegaard J. 🇩🇰   → @MaxVelo     [Lost][My bid]  155 000 · 3 bids
  [Photo]  Van Aert W. 🇧🇪     → @JS (you)    [Won]            88 000 · 2 bids
  [Photo]  Van der Poel M. 🇧🇪  → @Poulidor99                  96 000 · 5 bids
────────────────────────
ROUND 2 — PRE GIRO · Nov 4, 2025 · 11 riders
  ...
```

### Tags par entrée

| Tag | Condition | Visuel |
|-----|-----------|--------|
| **Won** | Coureur remporté par moi | Vert |
| **Lost** | J'ai bidé mais pas gagné | Gris |
| **My bid** | J'ai participé (gagné ou perdu) | Brand orange |
| *(aucun)* | Je n'ai pas bidé sur ce coureur | — |

### User Stories

| ID | Story |
|----|-------|
| US-B1 | Je veux voir toutes les enchères de la league groupées par round |
| US-B2 | Je veux savoir qui a remporté chaque coureur et à quel prix |
| US-B3 | Je veux voir le nombre de bids par coureur |
| US-B4 | Je veux identifier mes bids gagnés et perdus |
| US-B5 | Je veux chercher un coureur dans l'historique |

### Acceptance Criteria

| ID | Critère | Priorité |
|----|---------|----------|
| AC-B1 | Pas de topnav ni bottom nav | P0 |
| AC-B2 | Scroll vertical groupé par round, plus récent en premier | P0 |
| AC-B3 | Header round : nom · date · nb riders | P0 |
| AC-B4 | Tags Won/Lost/My bid calculés depuis le point de vue du joueur connecté | P0 |
| AC-B5 | Search filtre en temps réel sur le nom du coureur dans tous les rounds | P1 |
| AC-B6 | Round en cours non visible — uniquement rounds clôturés | P0 |

---

## Écran C — Team Levels

### Objectif
> *"Voir ma progression et planifier mes prochains unlocks."*

### Navigation
- Accessible via `See all →` depuis My Team
- **Pas de topnav ni bottom nav** — page détail pure
- Flèche ← retour vers My Team

### Système de niveaux (10 niveaux)

| Niveau | Nom cyclisme | XP requis | Unlock |
|--------|-------------|-----------|--------|
| 1 | Porteur de bidon | 0 | 6 rider slots · Policy: Speciality (1 active max) |
| 2 | Domestique | 100 | 7 rider slots |
| 3 | Équipier | 200 | Policy: Teams (1 active max) |
| 4 | Grimpeur | 500 | 8 rider slots |
| 5 | Rouleur | 900 | Policy: Nationality · 2 active policies simultanément |
| 6 | Baroudeur | 1 400 | Policy slot 3 |
| 7 | Puncheur | TBD | TBD |
| 8 | Sprinteur | TBD | TBD |
| 9 | Capitaine | TBD | TBD |
| 10 | Maillot Jaune | TBD | TBD |

> **XP = même compteur que le classement saison.** Reset à chaque saison.
> Niveaux 7→10 : placeholder "coming soon", pas de badges/cosmétiques en v1.

### États

| État | Visuel |
|------|--------|
| Débloqué | Badge fond gris · ✓ |
| Actuel | Badge noir inversé · bordure gauche brand · "In progress" |
| Verrouillé | Badge opacité 40% · 🔒 · message "Unlock Lv.X" |

### User Stories

| ID | Story |
|----|-------|
| US-C1 | Je veux voir mon niveau actuel et la progression vers le suivant |
| US-C2 | Je veux voir tous les niveaux, leurs noms et leurs unlocks |
| US-C3 | Je veux savoir ce que je débloque et à quelle XP |

### Acceptance Criteria

| ID | Critère | Priorité |
|----|---------|----------|
| AC-C1 | Pas de topnav ni bottom nav | P0 |
| AC-C2 | Hero : badge niveau · nom cyclisme · XP actuel / XP prochain · barre progression | P0 |
| AC-C3 | Niveau actuel : fond brand léger + bordure gauche brand | P0 |
| AC-C4 | Noms cyclisme affichés sur chaque niveau | P1 |
| AC-C5 | Unlock path sur chaque slot verrouillé | P0 |
| AC-C6 | Niveaux 7→10 condensés en 1 placeholder item | P2 |

---

## Écran D — Change Policies

### Objectif
> *"Configurer mes boosts d'équipe avant le prochain round."*

### Navigation
- Accessible via `Change policies →` depuis My Team
- Page dédiée · Flèche ← retour · Bottom nav conservé

### Règle de timing

> Les modifications s'appliquent **au prochain round** (pas celui en cours).
> On peut modifier à tout moment entre les rounds.
> Le banner affiche : **"Changes apply to the next round · Current policies active until [date du prochain round]"**

### Structure

```
← My Team
────────────────────────
Banner : "Changes apply to the next round · Active until Feb 13"
────────────────────────
[Slot 1 — actif]
  [1●] [Toggle]  Speciality boost · 4/6 riders covered
                 [GC ▾]   ← 1 seul select (valeur uniquement)

[Slot 2 — actif]
  [2●] [Toggle]  Team boost · 2/6 riders covered
                 [Visma-Lease a Bike ▾]

[Slot 3 — verrouillé]
  [3] [🔒]  Nationality boost · Unlock Lv.5

[Slot 4 — verrouillé]
  [4] [🔒]  Unlock Lv.6+
────────────────────────
Sticky : "X / Y active policies"  +5% → +10%   [Save]
```

### Select par slot

**1 seul champ select par slot** — la valeur uniquement.
Le type (Speciality / Teams / Nationality) est inscrit dans le titre du slot, pas dans un select redondant.

- Slot Speciality → select parmi : GC · One-day · Sprint · TT · Climber
- Slot Teams → select parmi toutes les équipes WorldTour/Pro
- Slot Nationality → select parmi les nationalités disponibles dans le jeu

### Règles d'activation par niveau

| Niveau | Types disponibles | Max actives | Min actives |
|--------|-------------------|-------------|-------------|
| 1–2 | Speciality seulement | 1 | 1 |
| 3–4 | Speciality · Teams | 1 | 1 |
| 5+ | Speciality · Teams · Nationality | 2 | 1 |

- **Minimum 1 policy toujours active** — toggle du slot 1 grisé et non-cliquable au Lv.1-2
- Au Lv.5 : si on active le slot 2, les deux restent actifs. Max 2.
- Si on en active un 3e (futur) → le plus ancien se décoche automatiquement (pas encore applicable en v1)

### Sticky

- **"X / Y active policies"** — compte clair du nombre de slots utilisés vs max
- Boost barré → nouveau boost calculé après save
- Bouton Save grisé si aucune modification en cours

### User Stories

| ID | Story |
|----|-------|
| US-D1 | Je veux voir mes policies actives et leur couverture roster |
| US-D2 | Je veux choisir la valeur à booster par slot |
| US-D3 | Je veux comprendre combien de policies je peux activer |
| US-D4 | Je veux voir l'impact du changement avant de sauvegarder |
| US-D5 | Je veux savoir quand mes changements s'appliqueront |

### Acceptance Criteria

| ID | Critère | Priorité |
|----|---------|----------|
| AC-D1 | Banner timing : "Changes apply to the next round · Active until [date]" | P0 |
| AC-D2 | 1 seul select par slot (valeur uniquement, pas de select type redondant) | P0 |
| AC-D3 | Compteur "X/Y riders covered" mis à jour en temps réel | P0 |
| AC-D4 | Minimum 1 policy active — toggle slot 1 non-cliquable si seul actif | P0 |
| AC-D5 | Maximum selon le niveau — 2e toggle déclenche désactivation auto si max atteint | P0 |
| AC-D6 | Sticky : "X / Y active policies" + boost barré → nouveau | P0 |
| AC-D7 | Save grisé si aucune modification | P1 |
| AC-D8 | Après Save : modifications verrouillées jusqu'au round suivant | P0 |
| AC-D9 | Slots verrouillés affichent le message "Unlock Lv.X" | P1 |

---

## Écran E — Ranking

### Objectif
> *"Voir le classement de la league (équipes et coureurs) et analyser les adversaires."*

### Navigation
- Accessible via bottom nav (Ranking) ou via tap `3rd / 12 →` dans My Team
- 2 tabs : **Teams** / **Riders**
- Tap ligne → page détail (Team detail ou Rider detail)

---

### Tab Teams

```
[Topnav simplifié : Ranking · Les Forçats · 12 teams]
[Teams] [Riders]
────────────────────────
[Select : All races ▾]
────────────────────────
[Ma position épinglée — fond noir]
  3  [JS]  Pédaleurs du Chaos  Lv.3 — Équipier   -1   24 680 XP
────────────────────────
1  [MX]  Echappée Royale   Lv.4 — Grimpeur   —    31 200 XP  ›
2  [PC]  Les Domestiques   Lv.3 — Équipier  +1    27 440 XP  ›
3  [JS]  Pédaleurs du Chaos  You  -1          24 680 XP
4  [VC]  Grimpeurs d'Élite  Lv.2 +2          19 120 XP  ›
...
```

**Colonnes** : position · avatar · nom équipe · niveau cyclisme · mouvement · XP

**Mouvement** : comparé au round précédent
- `+N` vert = montée
- `-N` rouge = descente
- `—` gris = stable

**Ma ligne** : fond brand léger, pas de chevron. Ma position épinglée sur card noire en haut (toujours visible).

---

### Tab Riders

```
[Teams] [Riders]
────────────────────────
[Select : All races ▾]
────────────────────────
18 riders total

1  [PO]  Pogačar T. 🇸🇮  [Active]   @MaxVelo    —    6 840 XP  ›
2  [VJ]  Vingegaard J. 🇩🇰 [Active]  @MaxVelo   +1   5 210 XP  ›
3  [WV]  Van Aert W. 🇧🇪  [Active]   @JS (you)  -1   4 210 XP  ›
5  [PR]  Roglič P. 🇸🇮    [Free]     Not recruited  3 120 XP  ›
```

**Périmètre** : uniquement les riders recrutés dans la league + riders non recrutés mais ayant eu des résultats PCS pendant la saison (pour comparaison).

**Tags** :
- `Active` : dans une équipe de la league
- `Free` : non recruté dans la league (+ opacité réduite)

**Colonne owner** : pseudo du joueur propriétaire, ou "Not recruited"
**Mon rider** : border brand sur l'avatar

**Filtre** : select dropdown pour filtrer par course passée (ne filtre que les riders ayant participé à cette course)

---

### Page Team Detail

Accessible via tap sur une ligne du tab Teams.

```
← Ranking
────────────────────────
[Avatar 44px]  Nom équipe
               @pseudo · Lv.X — Nom cyclisme
               [XP saison] [#Rang] [Niveau]
────────────────────────
Active roster · N riders
  [Photo #PCS]  Nom Flag  Équipe pro  XP ›
  ...
────────────────────────
Former riders · Season 2026
  [Photo dashed, opacity 50%]  Nom Flag  Released · Date  XP
  ...
```

- **Active roster** : coureurs actuellement dans l'équipe
- **Former riders** : tous les coureurs qui ont été dans l'équipe à un moment de la saison (libérés, préavis expiré)
- XP généré par chaque coureur visible
- Lecture seule — pas d'actions
- Pas de bids en cours visibles

---

### Page Rider Detail (depuis Ranking)

Même structure que Rider Detail principal **mais** :
- **Pas de segmented control** (Game Stats uniquement)
- **Pas de zone bid** (pas d'enchère possible depuis Ranking)
- **Pas de PCS Stats** (pas de programme de courses)
- **Banner owner** : "Owned by @pseudo · Nom équipe" ou "Not recruited"
- Hero identique : photo · PCS rank · nom · flag · équipe · spécialité · âge · metrics XP + Bonus €

---

### User Stories

| ID | Story |
|----|-------|
| US-E1 | Je veux voir le classement équipes avec mouvement de rang |
| US-E2 | Je veux ma position épinglée en haut même si je suis loin |
| US-E3 | Je veux filtrer le classement par course |
| US-E4 | Je veux voir le classement des coureurs recrutés dans la league |
| US-E5 | Je veux voir l'équipe complète d'un adversaire (actifs + anciens) |
| US-E6 | Je veux voir les stats de jeu d'un coureur depuis le classement |

### Acceptance Criteria

| ID | Critère | Priorité |
|----|---------|----------|
| AC-E1 | 2 tabs : Teams / Riders | P0 |
| AC-E2 | Ma position épinglée sur card noire en haut | P0 |
| AC-E3 | Colonnes teams : position · avatar · nom équipe · niveau · mouvement · XP | P0 |
| AC-E4 | Mouvement +N/-N/— calculé par rapport au round précédent | P1 |
| AC-E5 | Select dropdown filtre par course passée | P1 |
| AC-E6 | Tab Riders : position · photo · nom · flag · tag Active/Free · owner · mouvement · XP | P0 |
| AC-E7 | Mon rider dans la liste Riders : border brand sur avatar | P1 |
| AC-E8 | Tap team → Team Detail (active roster + former riders saison) | P0 |
| AC-E9 | Tap rider → Rider Detail lecture seule, Game Stats uniquement, pas de bid zone | P0 |
| AC-E10 | Rider Detail depuis Ranking : banner owner ou "Not recruited" | P0 |
| AC-E11 | Team Detail : pas de bids en cours visibles | P0 |

---

## Règles métier — Secondary Screens

| Règle | Description |
|-------|-------------|
| R-11 | Un joueur peut appartenir à plusieurs leagues simultanément |
| R-12 | Nom d'équipe défini par league — un joueur peut avoir des noms différents |
| R-13 | Admin ne peut pas quitter une league s'il reste des membres — doit transférer le rôle admin |
| R-14 | Les modifications de policies s'appliquent au prochain round, pas au round en cours |
| R-15 | Minimum 1 policy active à tout moment (tous niveaux) |
| R-16 | XP des niveaux = même compteur que classement saison. Reset chaque saison. |
| R-17 | Le roster adversaire est visible en lecture seule — bids en cours masqués |
| R-18 | Former riders = tous les coureurs ayant appartenu à l'équipe pendant la saison en cours |
| R-19 | Tab Riders Ranking = riders recrutés dans la league + riders libres ayant des stats PCS saison |
| R-20 | Mouvement de rang calculé par rapport à la position au round précédent |
