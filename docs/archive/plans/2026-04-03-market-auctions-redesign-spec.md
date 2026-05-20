# Market & Auctions Redesign — Design Spec

> **Date:** 2026-04-03
> **Status:** Validated via wireframes (V7)
> **Scope:** Refonte du système Market/Auctions, simplification économique, nouveau flow d'enchères

---

## 1. Contexte & Motivation

Le système actuel bloque l'accès au Market tant que le joueur n'a pas confirmé son sponsor/policy. C'est frustrant : impossible de parcourir les coureurs avant de prendre des décisions financières. De plus, le système de release (fee 5k + remboursement) est complexe, la faillite crée des edge cases difficiles, et la navigation aller-retour entre Market et Budget casse l'état des bids.

**Objectifs :**
- Permettre de parcourir le marché à tout moment
- Simplifier les décisions financières (zéro fee, zéro remboursement, zéro faillite)
- Centraliser les décisions d'enchère dans un seul écran
- Garder le système simple et intuitif

---

## 2. Changements économiques

### 2.1 Release de coureurs
- **Release = gratuit.** Pas de fee, pas de remboursement du salaire.
- Le salaire de la phase est déjà payé → perdu. C'est le "coût implicite" du release.
- **Round 1 :** release possible depuis l'écran Auctions (bouton "Release" sur chaque coureur du roster).
- **Rounds 2-3 :** release possible uniquement depuis la fiche coureur (rider detail), avec pop-up de confirmation : *"Release [rider]? You already paid his €X salary for this phase. It will not be refunded."*
- Un coureur recruté dans le round en cours ne peut PAS être release dans le même round.

### 2.2 Sponsor & Policy
- **Round 1 :** modifiable depuis l'écran Auctions (boutons "Change →").
- **Après Round 1 :** modifiable depuis My Team ou rider detail, mais avec message *"Change will take effect next phase (date)"*.
- Changement de sponsor = immédiat (Round 1) ou next phase (après Round 1).
- Changement de policy = même règle.

### 2.3 Faillite → supprimée
- La validation force l'équilibre : **budget ≥ 0** pour valider un round.
- Plus de seuil de faillite (-10k), plus d'auto-release en cascade.
- Le joueur doit manuellement ajuster (baisser des bids, retirer des drafts, release des coureurs) pour atteindre l'équilibre.

### 2.4 Auto-validation (joueur inactif)
- Si un joueur ne valide pas avant la deadline d'un round :
  - Roster actuel conservé, même sponsor, même policy.
  - Aucun nouveau bid placé.
  - Si le joueur est en déficit (salaires > sponsor income) : auto-release du coureur le plus cher, en boucle jusqu'à l'équilibre.

### 2.5 Release fee & Transfer bonus → supprimés
- Table `treasury_log` : supprimer les types `release_fee` et `transfer_bonus`.
- La seule opération au release = suppression du contrat.

---

## 3. Navigation

### 3.1 Structure
- **Bottom Nav inchangée :** Home | Team | Budget | Ranking
- **Sub-tabs dans Team (navigation haute) :** My Team | Market | Auctions

### 3.2 Sub-tab "Auctions"
- Toujours visible dans les sub-tabs.
- **Avant les rounds :** lecture seule (roster + drafts visibles, pas de validation).
- **Pendant les rounds :** interactif (modifier bids, release, change sponsor/policy, valider).
- **Entre les rounds :** lecture seule (résultats du round précédent).

---

## 4. Écran Market (sub-tab)

### 4.1 Accès
- **Toujours accessible**, même hors période d'enchères.

### 4.2 Fonctionnalités
- Browse les coureurs (All, Teams, Speciality, Nationality, Age).
- Voir le salaire minimum de chaque coureur (lecture seule, non modifiable).
- **Bouton "Add to Draft"** : ajoute le coureur aux drafts. Remplace l'ancien bouton "Save".
- On peut ajouter **plus de coureurs que le nombre de slots** et **dépasser le budget** — les drafts sont des brouillons.
- Affiche "Next Round" avec date/heure en haut.
- Search bar : filtrer par rider/team (country supprimé).

### 4.3 Bouton "Add to Draft" (anciennement "Save")
- Le champ input du montant reste visible avec le salaire minimum pré-rempli.
- Le joueur peut modifier le montant avant d'ajouter au draft.
- Validation : montant ≥ salaire minimum, multiple de 500€.
- Pas de validation budget/slots au moment de l'ajout (c'est dans Auctions).

### 4.4 Performance
- Afficher 100 coureurs par défaut.
- Bouton "Load more" pour charger les 100 suivants.

### 4.5 Changements UI
- Search bar : enlever le background, garder le stroke.
- Horizontal scrollbar : supprimée.
- Photo coureur : hauteur = hauteur des éléments à droite (nom + équipe + bid box). À finaliser pendant l'implémentation.
- Tag "My Bid" : pas dans Market. Les coureurs déjà en draft ont un indicateur visuel (à définir).

---

## 5. Écran Auctions (sub-tab) — Wireframe validé V7

### 5.1 Structure de l'écran (top → bottom)

#### Section "Rounds"
- Titre de section "Rounds" à gauche, "History →" (lien tertiaire) à droite.
- 3 blocs horizontaux : Round 1, Round 2, Round 3.
- Chaque bloc : label uppercase (`ROUND 1`), date (Geist Mono), heure (Geist Mono).
- Round actif = bordure cyan + fond teinté cyan 5% + label cyan.
- Rounds inactifs = bordure default + fond surface + label text-low.
- **Commissioner :** au clic sur un bloc, ouvre une modale pour modifier date/heure. Joueurs normaux = lecture seule.

#### Section "Sponsor & Policies"
- Titre de section "Sponsor & Policies".
- 2 cards côte à côte (grid 2 colonnes) :
  - **Card Sponsor :** label uppercase "SPONSOR", nom du sponsor, montant/phase en mono, "Change →" en haut à droite (cyan).
  - **Card Policies :** label uppercase "POLICIES 2/2" (avec compteur slots), liste des policies actives avec nom + boost total (tag cyan). "Change →" en haut à droite.
- Texte explicatif en dessous : *"Only modifiable during Round 1. Locked after validation."*
- **Boost total :** calculé sur tous les riders (roster + drafts). Ex: "Speciality: GC +15%" = 3 riders GC × 5%.
- **Visibilité :** "Change →" visible uniquement pendant Round 1. Après Round 1, les cards sont en lecture seule dans cet écran.

#### Section "Roster"
- Titre "Roster" à gauche, "X/Y slots" à droite (mono).
- Liste des coureurs du roster actuel. Chaque coureur affiche :
  - Avatar (40×40) avec badge PCS (#1, #3...) en bas à droite.
  - Ligne 1 : nom (cliquable, chevron ›) + flag + rank tag (▲/▼) + boost tag (+5%).
  - Ligne 2 : équipe + spécialité.
  - Droite : salaire (mono, bold) + XP gagné (mono, text-low).
  - Bouton "Release" (fond rouge 12%, texte red-400).
- **Round 1 :** bouton Release visible.
- **Rounds 2-3 :** bouton Release masqué dans cet écran (accessible depuis rider detail).

#### Section "Draft Bids"
- Titre "Draft Bids" à gauche, "X/Y slots" à droite (total roster + drafts / max slots).
- Si over limit : "9/8 slots — over limit" en rouge.
- Chaque draft affiche :
  - **Ligne info :** avatar + nom (cliquable ›) + flag + rank tag + boost tag + **bouton poubelle 🗑** (40×40, fond rouge 12%) à droite.
  - **Ligne bid :** bouton − (40×40) | input full-width (Geist Mono, centré) | bouton + (40×40). Gap 12px entre les 3.
  - **Ligne min :** "Min: €X" centré sous l'input, 3px en dessous.
- Spacing : 16px de padding par draft, 12px entre bloc info et bid row.
- Séparateur `border-subtle` entre chaque draft.
- Cliquer sur le nom → ouvre la fiche coureur (rider detail).
- Bouton poubelle → retire du draft (pas de confirmation).
- Boutons +/− : incrément de 500€.

#### Section "Summary"
- Titre "Summary".
- Card avec fond surface :
  - Sponsor income : +€X (cyan).
  - Roster salaries (N) : −€X (rouge).
  - Draft bids (N) : −€X (rouge).
  - Divider.
  - **Remaining** : €X (cyan bold) ou **Deficit** : −€X (rouge bold).
- En état déficit : bordure de la card en rouge 30%.

#### Sticky Bar (toujours visible)
- Fixée en bas de l'écran (au-dessus de la bottom nav).
- Gauche : "X/Y slots" + montant remaining (cyan) ou deficit (rouge).
- Droite : bouton "Validate Round N" (CTA gradient).
- **Budget ≥ 0 ET slots ≤ max :** bouton actif.
- **Budget < 0 OU slots > max :** bouton grisé + message rouge *"Remove riders or lower bids to balance your budget."*

### 5.2 États de l'écran

| État | Rounds section | Config section | Roster | Drafts | Validate |
|------|---------------|----------------|--------|--------|----------|
| **Avant Round 1** | 3 blocs, aucun actif | Cards + "Change →" visibles | Avec Release | Visibles, input readonly | Bouton masqué |
| **Round 1 actif** | R1 actif (cyan) | "Change →" actifs | Avec Release | Inputs éditables | Bouton actif si balanced |
| **Après Round 1** | R1 passé, R2 pending | Cards lecture seule | Sans Release | Résultats R1 + nouveaux drafts | Bouton masqué jusqu'à R2 |
| **Round 2 actif** | R2 actif | Lecture seule | Sans Release | Inputs éditables (nouveaux seulement) | Bouton actif si balanced |
| **Tous rounds finis** | 3 passés | Lecture seule | Sans Release | Résultats finaux | Bouton masqué |

---

## 6. Écran Rider Detail — Changements

### 6.1 Action bar (mobile)
- Si coureur pas dans roster ni draft : **"Add to Draft"** (bouton primaire) + input montant.
- Si coureur déjà en draft : **"Cancel Draft"** (bouton secondaire rouge).
- Si coureur dans le roster : **"Release"** (bouton destructif rouge) avec pop-up confirmation si hors Round 1.
- L'action bar ne doit PAS être transparente (bug actuel à corriger).

### 6.2 Navigation retour
- Depuis rider detail → retour vers l'écran d'où on vient (Market ou Auctions), pas vers Budget.
- Le `?from=` searchParam doit être correctement passé.

---

## 7. Suppression de code / concepts

| Supprimé | Raison |
|----------|--------|
| Release fee (5 000€) | Remplacé par release gratuit |
| Transfer bonus | Plus de concept de "valeur marché augmentée" |
| Système de faillite (-10k threshold) | Remplacé par validation forcée à l'équilibre |
| Cascade auto-release par XP | Remplacé par auto-release du plus cher (auto-validation only) |
| Phase setup 2 étapes (état 1/état 2 du Market) | Remplacé par Market toujours ouvert + Auctions séparé |
| Concept "My Bids" dans Market | Remplacé par sub-tab Auctions |
| Country filter dans search | Supprimé, garder rider/team |
| Horizontal scrollbar dans Market | Supprimée |
| Bouton "Browse Market" dans My Bids vide | Supprimé |

---

## 8. Wireframes de référence

Les wireframes validés sont dans :
```
.superpowers/brainstorm/1316-1775198695/content/auctions-v7.html  (Auctions — état normal)
.superpowers/brainstorm/1316-1775198695/content/auctions-v4.html  (Auctions — état déficit, mockup B)
```

---

## 9. Questions ouvertes (à résoudre pendant l'implémentation)

1. **Photo coureur Market :** taille exacte à définir (hauteur = hauteur des éléments à droite).
2. **Indicateur "déjà en draft" dans Market :** quel visuel ? Badge, couleur de fond, icône ?
3. **Commissioner modal pour éditer les dates :** design exact à définir (3 date pickers + time pickers).
4. **Résultats de round :** comment afficher "tu as gagné / perdu" un coureur après la résolution d'un round ?
5. **Transition Auctions état "avant Round 1" → "Round 1 actif" :** animation ou juste refresh ?
