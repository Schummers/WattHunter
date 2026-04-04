# WattHunter — Product Requirements Document
> Version 2.0 · Mars 2026 · Web App Mobile-first

---

## Overview

WattHunter est une fantasy cycling league web app. Les joueurs recrutent des coureurs professionnels via un système d'enchères par rounds (7 rounds/an, toujours avant les Grands Tours), construisent une équipe, et accumulent des XP et des bonus € basés sur les performances réelles des coureurs.

**Stack cible :** Next.js · TypeScript · Supabase · Tailwind CSS
**Plateforme :** Web app responsive — Mobile-first (390px) · Tablet (768px) · Desktop (1280px)
**Langue de l'interface :** Anglais
**Authentification :** Par league — chaque joueur appartient à une league privée

---

## Navigation principale

```
Bottom nav (mobile) / Top nav (desktop)
├── Home        — Dashboard saison
├── Team        — My Team + Recruts (2 tabs)
├── Budget      — Trésorerie & historique financier
└── Ranking     — Classement league + équipes adverses
```

> La bottom nav **disparaît** dans les pages de détail (Rider Detail, Policies, History, Levels).
> Elle réapparaît au retour via la flèche ←.

---

## Composant — Rider Card (unifié)

> **Un seul composant card utilisé dans My Team ET Recruts.**

### Layout

```
[PHOTO]  Nom P. 🇫🇷            [XP / Input]
[#rank]  Nom de l'équipe
```

- **Photo** : avatar 36px, cercle. Fond noir si coureur boosté (policy active).
- **PCS Rank badge** : positionné sous la photo, centré. Format `#N`. Fond `#E8E8E8`, texte `#555` — ratio de contraste ≥ 4.6:1 (WCAG AA).
- **Nom Prénom** : initiale du prénom, nom complet. Ex : `Pogačar T.` Flag emoji directement après le nom.
- **Équipe** : 2e ligne, gris moyen.
- **Spécialité & âge** : absents de la card — uniquement dans la page détail et la zone bid.
- **Côté droit** :
  - My Team (roster) : XP + label "XP"
  - My Team (bids pending) : montant du bid en italique gris
  - Recruts : champ input avec salaire minimum pré-rempli

### États visuels

| État | Traitement |
|------|-----------|
| Default | Border gris clair, fond blanc |
| Bid actif | Background brand 11% opacity + border avatar brand |
| Outbid (round actif) | Background warn orange 9% opacity + message "⚠ Outbid +Xk by @joueur" |
| Boosted (policy) | Avatar fond noir, badge boost blanc inline sur le nom |
| Dans le roster | Chevron `›` à droite, tappable vers détail |

### Interactions

- **Tap zone info (nom/équipe)** → navigation vers Rider Detail page
- **Tap champ input** → clavier remonte, coureur sélectionné apparaît au-dessus du clavier (keyboard-up state)

---

## Écran 1 — My Team

### Objectif
> *"Voir l'état de mon équipe et comment elle performe."*

### Header (2 lignes)

**Ligne 1 :**
- Gauche : Total XP saison (valeur grande, label petit au-dessus)
- Droite : Classement `3rd / 12 ›` — tappable → navigue vers Ranking page

**Ligne 2 :**
- Gauche : Pill boost `+10% boost active` (point brand coloré + bordure noire)
- Droite : Lien `Change policies →`

> Pas de barre de progression ranking. Pas de niveau dans le header.

### Sections

1. **Roster** — liste des coureurs actifs (composant Rider Card)
2. **Pending bids** — visible uniquement pendant un round actif (J-3 à J-0). Disparaît après clôture du round.
3. **Team level** — niveau actuel, barre XP, prochain unlock. Lien `See all →`.

### User Stories

| ID | Story |
|----|-------|
| US-01 | En tant que joueur, je veux voir mon total XP saison en premier plan |
| US-02 | En tant que joueur, je veux voir mon classement tappable qui me redirige vers la page Ranking |
| US-03 | En tant que joueur, je veux voir mon boost actif résumé en un tag et un lien vers les policies |
| US-04 | En tant que joueur, je veux voir mon roster avec les XP individuels |
| US-05 | En tant que joueur, je veux voir mes bids en attente uniquement pendant la période active du round |
| US-06 | En tant que joueur, je veux savoir si j'ai été outbid, de combien, et par qui, pendant le round actif |
| US-07 | En tant que joueur, je veux voir mon niveau d'équipe et le prochain unlock en bas de l'écran |

### Acceptance Criteria

| ID | Critère | Priorité |
|----|---------|----------|
| AC-01 | XP total affiché en typographie large, en position haute gauche | P0 |
| AC-02 | Classement `Xe / N ›` affiché en haut droite, tappable → Ranking page | P0 |
| AC-03 | Ligne 2 : boost pill + lien "Change policies →" | P0 |
| AC-04 | Chaque card roster : photo · #rank · Nom Flag · Équipe · XP · chevron | P0 |
| AC-05 | Coureurs boostés : avatar noir + badge "+X%" inline sur le nom | P1 |
| AC-06 | Section "Pending bids" visible uniquement pendant round actif (J-3 → J-0) | P0 |
| AC-07 | Outbid : fond orange 9% opacity + "⚠ Outbid +Xk by @joueur" | P0 |
| AC-08 | Section bids disparaît après clôture du round — coureur dans roster ou absent | P0 |
| AC-09 | Tap card → Rider Detail page | P1 |
| AC-10 | Section niveau : badge niveau · barre XP chiffrée · prochain unlock | P1 |
| AC-11 | "See all →" → page Niveaux & Unlocks | P2 |

---

## Écran 2 — Recruts

### Objectif
> *"Trouver les meilleurs coureurs disponibles et placer mes enchères."*

### Structure

```
Round header : "Next Round · Jan 13 · J-8"      "History →"
Search bar
Pills : [All] [Teams] [Speciality] [Nationality] [Age]
─────────────────────────────────────────
  Vue selon pill sélectionnée (voir ci-dessous)
─────────────────────────────────────────
Sticky : "4/6 slots · 57 000 €"     [Save]
```

### Comportement des Pills

**All (default)**
- Liste de tous les coureurs disponibles (non recrutés dans aucune équipe)
- Composant Rider Card avec input bid visible
- Tri par PCS Rank par défaut

**Teams / Speciality / Nationality / Age**
- Vue accordion : liste des groupes (équipes, spécialités, etc.) avec compteur "N avail."
- Tap sur un groupe → accordion s'ouvre et affiche les coureurs du groupe (Rider Card)
- Un seul accordion ouvert à la fois — cliquer un autre ferme le précédent
- Chaque coureur dans l'accordion = même composant Rider Card avec input bid

Groupes par pill :
- **Teams** : équipes WorldTour et ProTeam
- **Speciality** : GC · One-day · Sprint · TT · Climber
- **Nationality** : pays avec compteur
- **Age** : `< 23 ans` · `> 32 ans`

### Comportement input bid

**Tap sur champ input (zone droite de la card) :**
1. Clavier natif remonte
2. La liste passe en opacité réduite
3. Le coureur sélectionné apparaît dans une barre fixe au-dessus du clavier :
   - Photo + Nom + Équipe + Spécialité + Salaire min
   - Input avec valeur actuelle (salaire min si nouveau bid, montant existant si modification)
   - Boutons − / + par 1 000
   - Budget restant après bid (mis à jour en live)
   - Bouton "Confirm bid"
4. Tap ailleurs ou "Confirm" → ferme le clavier, met à jour la card

**Tap sur la zone info de la card (photo/nom/équipe) :**
→ Navigation vers Rider Detail page

### User Stories

| ID | Story |
|----|-------|
| US-08 | Je veux voir uniquement les coureurs disponibles par défaut |
| US-09 | Je veux filtrer par équipe, spécialité, nationalité, âge via pills + accordion |
| US-10 | Je veux placer un bid en tapant sur le champ input d'une card |
| US-11 | Je veux voir en permanence mon budget restant et mes slots disponibles |
| US-12 | Je veux pouvoir supprimer un bid existant depuis la zone bid |
| US-13 | Je veux accéder à l'historique des enchères depuis le header du round |

### Acceptance Criteria

| ID | Critère | Priorité |
|----|---------|----------|
| AC-12 | Par défaut (pill All) : uniquement coureurs non recrutés | P0 |
| AC-13 | Round header : nom du round · date · J-N à gauche · "History →" à droite | P0 |
| AC-14 | Pills dans l'ordre : All · Teams · Speciality · Nationality · Age | P0 |
| AC-15 | Pills Teams/Speciality/Nationality/Age → vue accordion (pas liste directe) | P0 |
| AC-16 | Un seul accordion ouvert à la fois | P0 |
| AC-17 | Chaque groupe affiche le compteur de coureurs disponibles | P1 |
| AC-18 | Champ input visible dans chaque card avec salaire minimum pré-rempli | P0 |
| AC-19 | Tap input → keyboard-up avec coureur visible au-dessus du clavier | P0 |
| AC-20 | Tap zone info → Rider Detail page | P0 |
| AC-21 | Sticky : `X/Y slots · Budget €` + bouton Save (sans badge) | P0 |
| AC-22 | Card avec bid actif : background brand + border avatar brand | P0 |
| AC-23 | Bid ne peut pas être inférieur au salaire minimum du coureur | P0 |
| AC-24 | Si budget insuffisant : bouton Confirm désactivé + message d'erreur | P0 |
| AC-25 | Sur ≥768px : master-detail (liste gauche, panneau bid/détail droite) | P1 |

---

## Écran 3 — Rider Detail

### Objectif
> *"Évaluer un coureur et gérer mon bid ou mon roster."*

### Navigation
- Accessible depuis My Team (roster + pending bids) et Recruts
- Flèche ← retour vers l'écran d'origine
- **Pas de bottom nav** sur cette page
- **Pas de tabs My Team / Recruts** — c'est une page à part entière

### Header (sticky)

```
← [écran d'origine]
```

### Hero

```
[PHOTO 56px]  Nom P. 🇫🇷
[#N PCS]      Équipe
              [Spécialité] [Âge]  [+X% boost si actif]

[Game XP]  [Bonus €]  [Salary]

[Zone bid / roster actions]
```

- **Photo** : 56px, cercle. PCS rank badge centré sous la photo.
- **Metrics** : 3 boîtes égales — Game XP · Bonus € · Salaire (min si disponible, payé si dans roster)
- **Zone bid (coureur disponible)** :
  - Label "My current bid" + montant
  - Input − / valeur / + par 1 000
  - CTA "Confirm bid" ou "Update bid"
  - Lien "✕ Remove bid" si bid existant
- **Zone roster (coureur dans mon équipe)** :
  - Salaire payé affiché
  - Bouton "Release rider — 1 month notice"

### Segmented control

`[PCS Stats]  [Game Stats]`

### Tab PCS Stats

**PCS Ranking by season** : tableau chronologique inversé
- Colonnes : Année · Équipe · Points · Rang

**Race programme** : startlist prévisionnelle
- Colonnes : Nom de la course · Date · Catégorie (WT/GT/Pro)
- Pas de points estimés — c'est un calendrier, pas une prédiction

### Tab Game Stats

Résultats jeu, style transactions bancaires, chronologique inversé.

```
April 2026
  12   Paris-Roubaix              840 PCS   1 050 XP   +3k €
  19   Amstel Gold Race           520 PCS     650 XP   +2k €

March 2026
  21   Milan-Sanremo              680 PCS     850 XP   +2.5k €
  25   E3 Saxo Bank Classic       420 PCS     525 XP   +1.5k €
```

### User Stories

| ID | Story |
|----|-------|
| US-14 | Je veux voir les stats PCS réelles du coureur (ranking par saison + équipe) |
| US-15 | Je veux voir son programme de courses prévu (startlist) |
| US-16 | Je veux voir ses résultats jeu passés sous forme de transactions |
| US-17 | Je veux placer ou modifier un bid directement depuis la page détail |
| US-18 | Je veux pouvoir libérer un coureur de mon roster depuis sa page détail uniquement |

### Acceptance Criteria

| ID | Critère | Priorité |
|----|---------|----------|
| AC-26 | Pas de bottom nav sur cette page | P0 |
| AC-27 | Flèche ← retour vers l'écran d'origine (My Team ou Recruts) | P0 |
| AC-28 | Hero : photo 56px · PCS rank badge · Nom Flag · Équipe · Spécialité · Âge | P0 |
| AC-29 | 3 metric boxes : Game XP · Bonus € · Salary (min ou payé selon contexte) | P0 |
| AC-30 | Zone bid visible si coureur non dans le roster (nouveau bid ou modification) | P0 |
| AC-31 | "Remove bid" visible uniquement si bid existant | P0 |
| AC-32 | "Release rider — 1 month notice" visible uniquement si coureur dans le roster | P0 |
| AC-33 | Confirmation modale avant release (irréversible à court terme) | P0 |
| AC-34 | Après release : tag `⏳ Notice · Ends [date]` visible sur la card My Team | P0 |
| AC-35 | Segmented : PCS Stats / Game Stats | P0 |
| AC-36 | PCS Stats : ranking par saison (année · équipe · points · rang) | P0 |
| AC-37 | PCS Stats : programme de courses (nom · date · catégorie) | P0 |
| AC-38 | Game Stats : résultats chronologiques inversés (mois → jour · course · PCS · XP · €) | P0 |

---

## Écran 4 — Policies (2e niveau)

### Objectif
> *"Configurer mes boosts d'équipe une fois par round."*

### Accès
Via `Change policies →` depuis My Team uniquement.

### User Stories

| ID | Story |
|----|-------|
| US-19 | Je veux activer jusqu'à 2 policies parmi 4 slots |
| US-20 | Je veux choisir le type (équipe / nationalité / spécialité) et la valeur cible |
| US-21 | Je veux voir combien de mes coureurs sont couverts par chaque policy |
| US-22 | Je veux voir l'impact total avant de valider |

### Acceptance Criteria

| ID | Critère | Priorité |
|----|---------|----------|
| AC-39 | 4 slots affichés. Maximum 2 actifs simultanément | P0 |
| AC-40 | Slots 3 & 4 verrouillés si 2 policies déjà actives | P0 |
| AC-41 | Chaque policy : toggle · type · valeur · "X/Y riders boosted" · barre couverture | P0 |
| AC-42 | Sticky : boost actuel (barré) → boost après + bouton "Save" | P0 |

---

## Écran 5 — History (2e niveau)

### Objectif
> *"Consulter les enchères passées pour calibrer mes bids futurs."*

### Accès
Via `History →` dans le round header de Recruts.

### User Stories

| ID | Story |
|----|-------|
| US-23 | Je veux voir tous les bids de la league par round |
| US-24 | Je veux filtrer par round ou chercher par nom de coureur |

### Acceptance Criteria

| ID | Critère | Priorité |
|----|---------|----------|
| AC-43 | Liste chronologique inverse : coureur · acheteur · montant · résultat | P0 |
| AC-44 | Filtre par round (select) + recherche texte | P1 |

---

## Écran 6 — Levels & Unlocks (2e niveau)

### Objectif
> *"Voir ma progression et planifier mes unlocks."*

### Accès
Via `See all →` depuis la section niveau de My Team.

### Acceptance Criteria

| ID | Critère | Priorité |
|----|---------|----------|
| AC-45 | Liste complète des niveaux : XP requis · unlock · statut (done / current / locked) | P0 |
| AC-46 | Niveau actuel mis en évidence avec barre de progression | P0 |

---

## Règles métier

| Règle | Description |
|-------|-------------|
| R-01 | Un coureur ne peut appartenir qu'à une seule équipe à la fois |
| R-02 | Un bid ne peut pas être inférieur au salaire minimum du coureur |
| R-03 | Le budget engagé (bids en cours) est déduit du budget disponible |
| R-04 | Maximum 2 policies actives simultanément |
| R-05 | Libérer un coureur déclenche un préavis de 1 mois — il reste dans le roster jusqu'à expiration |
| R-06 | Les enchères sont compétitives — le plus offrant gagne à la clôture du round |
| R-07 | 7 rounds par saison, positionnés avant les Grands Tours |
| R-08 | La section "Pending bids" dans My Team n'est visible que pendant la période active du round |
| R-09 | Un outbid est visible pendant le round actif uniquement — il disparaît à la clôture |
| R-10 | Sur clôture du round : le coureur est soit dans le roster, soit absent — pas de statut intermédiaire |

---

## Composants & accessibilité

### PCS Rank badge
- Fond : `#E8E8E8` · Texte : `#555555`
- Ratio de contraste : 4.6:1 — conforme WCAG AA
- Taille minimale : 13px height · police 7px bold

### Champ input bid
- Valeur de départ : salaire minimum du coureur
- Pas de bordure pointillée — bordure solide gris clair par défaut, border brand si bid actif
- Tap → keyboard-up avec zone coureur visible au-dessus du clavier
- Implémentation : `window.visualViewport` pour iOS · `resize` event pour Android

### Keyboard-up state
- La liste passe à 25% opacity
- Zone coureur sélectionné : sticky au-dessus du clavier
- Contient : photo · nom · équipe · spécialité · salaire min · input − val + · budget restant · bouton Confirm

---

## Priorités de développement

| Sprint | Écrans | Stories |
|--------|--------|---------|
| Sprint 1 | My Team · Recruts (All + input) | US-01 à US-13 |
| Sprint 2 | Rider Detail · Policies | US-14 à US-22 |
| Sprint 3 | History · Levels · Accordion filters · Responsive ≥768px | US-23 à US-24 + AC-25 |
