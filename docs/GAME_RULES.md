# WattHunter — Regles du Jeu

> **Document vivant** — Mis a jour a chaque changement de regle.
> Source de verite pour les mecaniques de jeu implementees et prevues.
> Derniere mise a jour : 2026-03-16

## Vue d'ensemble

WattHunter est un fantasy game de cyclisme pour groupes d'amis. Les joueurs construisent des equipes virtuelles en achetant des coureurs professionnels aux encheres, gagnent des points bases sur les resultats reels PCS (ProCyclingStats) et competitionnent au sein de leur ligue.

---

## 1. Ligues

| Regle | Valeur | Statut |
|-------|--------|--------|
| Joueurs max par ligue | 20 | Implemente |
| Joueurs min pour lancer | 1 (pas de minimum) | Implemente |
| Un joueur peut avoir plusieurs ligues | Oui | Implemente |
| Code d'invitation | 6 caracteres alphanumeriques (sans 0/O/1/I/l) | Implemente |
| Statuts de ligue | pending → active → completed | Implemente |

**Regles de lancement :**
- Seul le commissaire (createur) peut lancer la premiere enchere
- Des que la ligue passe en `active`, plus aucune equipe ne peut rejoindre
- Pas de nombre minimum de joueurs requis

> **Deviation PRD :** Le PRD original prevoyait 6-12 joueurs et un minimum de 4 pour lancer. Simplifie a max 20, pas de minimum.

---

## 2. Deux indicateurs independants

### Team Score (XP)
- XP cumule depuis la creation de l'equipe
- Determine : classement de la ligue, niveau de l'equipe, deblocage de fonctionnalites
- Calcule quotidiennement a 09:00 UTC

### Tresorerie (€)
- Solde cash : entrees − sorties
- Determine : capacite d'achat aux encheres
- Affiche en permanence dans le header

**Lien strategique :** L'XP et la tresorerie sont independants — l'argent ne donne pas directement de l'XP. Mais une tresorerie elevee permet d'acheter de meilleurs coureurs qui generent plus d'XP.

---

## 3. Coureurs

**Univers total :** Top 500 coureurs du ranking PCS global individuel (12 mois glissants)

**Donnees par coureur :**
- Nom, nationalite, equipe reelle UCI, type d'equipe
- Photo, age, specialite (grimpeur/sprinteur/rouleur/puncheur/contre-la-montre/polyvalent)
- Points PCS glissants 365 jours, classement PCS, salaire mensuel calcule

**Acces par niveau (gating PCS) :**

| Niveau | Rang PCS debloque |
|--------|-------------------|
| 1 | #351-500 |
| 2 | #251-500 |
| 3 | #176-500 |
| 4 | #101-500 |
| 5 | #76-500 |
| 6 | #51-500 |
| 7 | #26-500 |
| 8 | #11-500 |
| 9 | #4-500 |
| 10 | #1-500 |

---

## 4. Economie

### 4.1 Tresorerie de depart

| Constante | Valeur |
|-----------|--------|
| Tresorerie initiale | 200 000 € |

### 4.2 Entrees
- Bonus des coureurs : par course (voir §4.5)
- Paiements sponsors : au debut de chaque phase d'enchere
- **Sponsor par defaut (Lotto) :** 200 000 € (1ere phase) → 300 000 € (phases suivantes) — automatiquement actif des le debut

### 4.3 Sorties
- Salaires des coureurs : au debut de chaque phase d'enchere (apres paiement sponsor)
- Encheres gagnees : deduction immediate

### 4.4 Formule de salaire

```
Salaire mensuel = points_PCS_1an × 2 000 / 12
Plancher : 5 000 €/mois | Pas de plafond
```

**Exemples :**
- 114 pts PCS (#500) → 228k€/an → **19 000 €/mois**
- 400 pts PCS (#100) → 800k€/an → **66 667 €/mois**
- 2 216 pts PCS (#5, Vingegaard) → 4.4M€/an → **369 333 €/mois**
- 4 552 pts PCS (#1, Pogacar) → 9.1M€/an → **758 666 €/mois**

> **Note :** Le salaire formule ci-dessus determine la **mise minimum a l'enchere**. Le salaire reel du contrat est la mise gagnante de l'enchere (voir §5).

### 4.5 Bonus par course

```
Bonus = max(0, points_course × 1 500 − salaire_mensuel)
```

Le bonus est calcule **individuellement par course** (pas cumule sur le mois). Il est **toujours positif ou nul** — un coureur ne penalise jamais la tresorerie au-dela de son salaire.

| Constante | Valeur |
|-----------|--------|
| Taux de conversion bonus | 1 500 €/point PCS |

**Dynamique "pepite" :** Les stars (salaires eleves) ne generent quasi jamais de bonus. Les coureurs peu chers (#400-500) generent du bonus des qu'ils performent en course. C'est la mecanique strategique centrale du jeu.

**Exemples :**
- Rider #450 (salaire 21k), score 20 pts en course → 20 × 1500 = 30k → bonus = 9 000 €
- Rider #100 (salaire 67k), score 30 pts en course → 30 × 1500 = 45k → bonus = 0 € (pas de malus)
- Pogacar (salaire 759k), score 100 pts en course → 100 × 1500 = 150k → bonus = 0 €

### 4.6 Faillite

**Mois 1 de tresorerie negative :**
- Statut "dette", tresorerie negative
- Bloque aux encheres, mais peut jouer

**Mois 2 consecutif de tresorerie negative :**
- Liberation automatique des coureurs (**meilleur scoreur d'abord** — le plus rentable en points PCS)
- Jusqu'a ce que la tresorerie redevienne positive
- Pas de preavis pour les auto-liberations

> **Beta :** La liberation par meilleur scoreur (et non par salaire le plus eleve) cree un dilemme strategique : perdre son meilleur coureur force le joueur a reflechir avant de se retrouver en faillite.

---

## 5. Encheres

| Regle | Valeur | Statut |
|-------|--------|--------|
| Duree | 72 heures (3 rounds de 24h) | Implemente |
| Mise minimum | Salaire marche du coureur (formule §4.4) | Implemente |
| Increment minimum | +100 € | Implemente |
| Format | Sealed-bid 3 rounds | Implemente |
| Calendrier | Aligne sur les Grands Tours | Non implemente |

> **Beta — enchere = salaire mensuel :** La mise gagnante n'est PAS un prix d'achat unique. Elle devient le **salaire mensuel recurrent** du coureur debite chaque mois. Enchérir haut = s'engager sur un salaire eleve pour toute la duree du contrat.

**Resolution (auction.py) :**
1. Plus haute mise gagne
2. Egalite : timestamp le plus ancien gagne (placed_at)
3. Verification en cascade du budget (coureurs tries par montant decroissant)
4. Mise gagnante = `contract_salary` mensuel (aucune deduction immediate de la tresorerie)
5. Bids perdants → status `outbid`, bids annules → status `cancelled`
6. Contrat cree (`contracts` table) avec `contract_salary` verrouille (= mise gagnante)

**Validation du budget :** `somme(mises actives autres) + nouvelle mise > tresorerie` → mise rejetee

**Visibilite des mises :**
- Pendant l'enchere : mises `won`/`outbid` visibles par tous les membres de la ligue
- Mises `active` (prochain round) : secretes, visibles uniquement par leur equipe
- Enchere terminee : toutes les mises visibles

---

## 6. Contrats

**A la creation :**
- `contract_salary` : mise gagnante de l'enchere (= salaire mensuel recurrent, verrouille)
- `status` : active → notice → released

> **Beta :** Le concept de `purchase_price` (achat unique) est supprime. L'enchere fixe uniquement le salaire mensuel — aucune somme n'est debitee a la signature du contrat.

**Liberation d'un coureur :**
- Release uniquement pendant la fenetre d'encheres (auction window)
- Le coureur passe en statut "notice" jusqu'au debut de la phase suivante
- Slot libere au debut de la phase suivante (PAS immediatement)
- Coureur retourne au pool general au debut de la phase suivante

---

## 7. Scoring & Niveaux

### XP quotidien

```
XP du coureur = points_PCS_du_jour × (1 + Σ bonus_politiques_actives)
XP equipe = Σ XP de tous les coureurs du roster
```

### Progression par niveaux

| Niveau | XP cumule | Slots | Politiques actives | Rang PCS debloque | Policy debloquee | Sponsor debloque |
|--------|-----------|-------|--------------------|-------------------|------------------|------------------|
| 1 | 0 | 6 | 1 | #351-500 | Speciality | Secondary T1 (200k→300k) |
| 2 | 75 | 8 | 1 | #251-500 | — | — |
| 3 | 200 | 8 | 2 | #176-500 | Nationality | Secondary T2 (400k) |
| 4 | 350 | 9 | 2 | #101-500 | — | — |
| 5 | 700 | 10 | 2 | #76-500 | Teams | Principal T3 (550k) |
| 6 | 1 200 | 10 | 2 | #51-500 | — | — |
| 7 | 1 900 | 11 | 2 | #26-500 | Age | Principal T4 (750k) |
| 8 | 2 900 | 12 | 2 | #11-500 | — | Principal T5 (1M) |
| 9 | 4 400 | 12 | 3 | #4-500 | — | — |
| 10 | 6 400 | 12 | 3 | #1-500 | — | — |

---

## 8. Politiques

4 types, +5% XP chacun. Max actives : 1 (Nv.1-2) → 2 (Nv.3-8) → 3 (Nv.9-10).
Types debloques par niveau : Speciality (Nv.1) → Nationality (Nv.3) → Teams (Nv.5) → Age (Nv.7).

| Politique | Bonus | Configuration |
|-----------|-------|---------------|
| Young Blood | +5% coureurs < 23 ans | Automatique |
| Road Warriors | +5% coureurs > 32 ans | Automatique |
| National Pride | +5% coureurs d'une nationalite | Choix du joueur |
| Team Chemistry | +5% coureurs d'une equipe UCI | Choix du joueur |
| Specialist | +5% coureurs d'une specialite | Choix du joueur |

Les bonus sont **additifs**. Exemple : National Pride (Belgique) + Specialist (Sprinteur) = +10%.

**Calcul du boost total affiche (pill My Team) :**

```
Boost total = Σ (5% × nombre de riders du roster matchant la policy)
```

Exemples :
- 1 policy Specialty=GC, 2 riders GC sur 6 → boost affiche = +10%
- 1 policy Nationality=FR, 3 riders FR sur 6 → boost affiche = +15%
- 2 policies (Specialty=GC + Nationality=FR), 2 GC + 3 FR → boost affiche = +25%
- 0 policies actives → boost affiche = +0%

Le boost s'applique individuellement : chaque rider matche reçoit +5% sur ses points PCS gagnes en course. Le pill affiche la **somme de tous les bonus individuels** comme indicateur global.

---

## 9. Sponsors

2 slots : Secondary (petit sponsor passif) + Principal (sponsor majeur avec conditions). Tier limite par le niveau (voir §7). Voir `docs/prd et wireframe/watthunter-prd-budget-sponsors.md` pour le detail complet (14 sponsors, marketplace, conditions).

**Sponsor par defaut (Lotto, T1) :**

| Regle | Valeur |
|-------|--------|
| Montant 1ere phase | 200 000 € |
| Montant phases suivantes | 300 000 € |
| Conditions | Aucune |
| Activation | Automatique a la creation d'equipe |

**Systeme de tiers :**

| Type | Tier | Niveau | Montant/mois |
|------|------|--------|--------------|
| Secondary | T1 (Lotto) | 1 | 200 000 → 300 000 € |
| Secondary | T2 | 3 | 400 000 € |
| Principal | T3 | 5 | 550 000 € |
| Principal | T4 | 7 | 750 000 € |
| Principal | T5 | 8 | 1 000 000 € |

---

## 10. Constantes du jeu (resume)

| Constante | Valeur | A calibrer ? |
|-----------|--------|-------------|
| Tresorerie depart | **200 000 €** | Non |
| Sponsor par defaut (Lotto) | **200k (1ere phase) → 300k (suivantes)** | Non |
| Enchère = salaire mensuel | Oui — pas d'achat unique | Non |
| Salaire mensuel | pts_PCS × 2 000 / 12 (pas de plafond) | Non |
| Bonus par course | max(0, pts_course × 1 500 − salaire) | Non |
| Salaire plancher (enchere min) | 5 000 €/mois | Non |
| Taux conversion bonus | 1 500 €/point PCS | Non |
| Faillite : libere en premier | Meilleur scoreur (beta) | Non |
| Duree d'enchere | 72 heures | Non |
| Increment d'enchere | 100 € | Non |
| Slots max | 6 (Niv 1) → 12 (Niv 8) | Non |
| Politiques max | 1 (Nv.1-2) → 2 (Nv.3-8) → 3 (Nv.9-10) | Non |
| Pool coureurs | Top 500 PCS global (12 mois glissants) | Non |
| XP Niveau 5 | 700 | Non |
| XP Niveau 10 | 6 400 | Non |
| Contrat sponsor | 2 mois (post-beta) | Non |
| Joueurs max par ligue | 20 | Non |
