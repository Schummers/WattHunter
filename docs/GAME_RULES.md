# WattHunter — Regles du Jeu

> **Document vivant** — Mis a jour a chaque changement de regle.
> Source de verite pour les mecaniques de jeu implementees et prevues.
> Derniere mise a jour : 2026-04-02

## Vue d'ensemble

WattHunter est un fantasy game de cyclisme pour groupes d'amis. Les joueurs construisent des equipes virtuelles en achetant des coureurs professionnels aux encheres, gagnent des points bases sur les resultats reels PCS (ProCyclingStats) et competitionnent au sein de leur ligue.

---

## 1. Ligues

| Regle | Valeur |
|-------|--------|
| Joueurs max par ligue | 20 |
| Joueurs min pour lancer | 1 (pas de minimum) |
| Un joueur peut avoir plusieurs ligues | Oui |
| Code d'invitation | 6 caracteres alphanumeriques (sans 0/O/1/I/l) |
| Statuts de ligue | pending → active → completed |

**Regles de lancement :**
- Seul le commissaire (createur) peut lancer la premiere enchere
- Des que la ligue passe en `active`, plus aucune equipe ne peut rejoindre
- Pas de nombre minimum de joueurs requis
- Le commissaire choisit un **niveau de depart** (par defaut : base sur la date actuelle et la phase WT)

---

## 2. Deux indicateurs independants

### Team Score (XP)
- XP cumule depuis la creation de l'equipe
- Determine : classement de la ligue, niveau de l'equipe, deblocage de fonctionnalites
- Calcule a chaque import de resultats de course

### Tresorerie (EUR)
- Solde cash : entrees - sorties
- Determine : capacite d'achat aux encheres
- Affiche en permanence dans le header

**Lien strategique :** L'XP et la tresorerie sont independants — l'argent ne donne pas directement de l'XP. Mais une tresorerie elevee permet d'acheter de meilleurs coureurs qui generent plus d'XP.

---

## 3. Coureurs

**Univers total :** Top 600 coureurs du ranking PCS global individuel (12 mois glissants)

**Donnees par coureur :**
- Nom, nationalite, equipe reelle UCI
- Photo, age, specialite (GC/Sprint/TT/OneDay)
- Points PCS glissants 365 jours, classement PCS, salaire mensuel calcule

**Acces par niveau (gating PCS) :**

| Niveau | Rang PCS debloque |
|--------|-------------------|
| 1 | #300-600 |
| 2 | #200-600 |
| 3 | #100-600 |
| 4 | #30-600 |
| 5 | #20-600 |
| 6 | #10-600 |
| 7 | #4-600 |
| 8 | #1-600 |

---

## 4. Economie

### 4.1 Tresorerie de depart

Les nouvelles equipes demarrent a **0 EUR**. Le premier paiement sponsor (a la selection du sponsor) remplace l'ancienne tresorerie de depart.

### 4.2 Entrees
- **Paiement sponsor :** 1x par phase, au moment de la confirmation du joueur (payday)
- **Bonus sponsor :** a chaque resultat de course qualifiant (voir §9)

### 4.3 Sorties
- **Salaires des coureurs :** deduits au payday (1x par phase)
- **Encheres gagnees :** deduction immediate du salaire verrouille
- **Frais de liberation :** 5 000 EUR forfaitaire par coureur libere

### 4.4 Formule de salaire

```
Salaire mensuel = max(5 000, floor(points_PCS_1an x 2 000 / 12 / 100) x 100)
Plancher : 5 000 EUR/mois | Arrondi au 100 inferieur | Pas de plafond
```

**Exemples :**
- 114 pts PCS (#600) → 228k/an → **19 000 EUR/mois**
- 400 pts PCS (#100) → 800k/an → **66 600 EUR/mois**
- 2 216 pts PCS (#5) → 4.4M/an → **369 300 EUR/mois**

> **Note :** Le salaire determine la **mise minimum a l'enchere**. Le salaire reel du contrat est la mise gagnante (= `locked_salary`).

### 4.5 Faillite

Au payday, apres `tresorerie += sponsor_budget - salaires` :
- Si tresorerie >= -10 000 EUR → pas d'action (tolerance)
- Si tresorerie < -10 000 EUR → **cascade de faillite** :
  1. Liberer le coureur avec le **plus haut XP cumule** de l'equipe
  2. Rembourser son salaire, appliquer les frais de liberation (5 000 EUR)
  3. Si toujours < -10 000 EUR → repeter avec le suivant
  4. Jusqu'a tresorerie >= -10 000 EUR ou roster vide

---

## 5. Encheres

| Regle | Valeur |
|-------|--------|
| Format | Sealed-bid, 3 rounds par phase |
| Mise minimum | Salaire marche du coureur (formule §4.4) |
| Increment minimum | 100 EUR |
| Multiples | Mises en multiples de 100 EUR uniquement |
| Calendrier | 8 phases alignees sur le WT, 3 rounds chacune |

> **Enchere = salaire mensuel recurrent :** La mise gagnante n'est PAS un prix d'achat unique. Elle devient le **salaire mensuel recurrent** (`locked_salary`) debite a chaque payday.

**Resolution :**
1. Plus haute mise gagne
2. Egalite : timestamp le plus ancien gagne (placed_at)
3. Verification en cascade du budget (coureurs tries par montant decroissant)
4. Mise gagnante → contrat cree avec `locked_salary` = mise
5. Salaire deduit immediatement de la tresorerie

**Validation du budget :** `somme(mises actives) + nouvelle mise > tresorerie` → mise rejetee

**Condition prealable :** Le joueur doit avoir **confirme le payday** de la phase en cours avant de pouvoir placer des mises.

**Visibilite des mises :**
- Pendant l'enchere : mises `won`/`outbid` visibles par tous
- Mises `active` (round en cours) : secretes
- Enchere terminee : toutes les mises visibles

---

## 6. Contrats

**A la creation :**
- `locked_salary` : mise gagnante (salaire mensuel recurrent, verrouille)
- `status` : active | released
- `phase_recruited_id` : phase de recrutement (verrouillage liberation)

**Liberation d'un coureur :**
- Liberable **a tout moment** (sauf pendant la phase de recrutement)
- Frais forfaitaires : **5 000 EUR**, deduits immediatement
- Bonus de transfert si le coureur a apprecie :
  ```
  transfer_bonus = max(0, salaire_marche_actuel - locked_salary)
  ```
- Effet immediat : coureur retourne au pool, slot libere
- Aucun remboursement de salaire (deja paye au payday)

---

## 7. Scoring & Niveaux

### XP quotidien

```
XP du coureur = points_PCS_du_jour x (1 + somme bonus_politiques_actives)
XP equipe = somme XP de tous les coureurs du roster
```

### Progression par niveaux (8 niveaux alignes sur les phases WT)

| Niveau | Phase WT | XP cumule | Slots | Politiques max | Rang PCS | Policy debloquee | Sponsor debloque |
|--------|----------|-----------|-------|----------------|----------|------------------|------------------|
| 1 | Season Start | 0 | 6 | 1 | #300-600 | Speciality | Lotto T1 (250k) |
| 2 | Classics P1 | 25 | 7 | 1 | #200-600 | — | Astana T2 (350k) |
| 3 | Classics P2 | 150 | 8 | 2 | #100-600 | Nationality | T3 450k (x4) |
| 4 | Giro | 350 | 9 | 2 | #30-600 | — | — |
| 5 | Pre-Tour | 600 | 10 | 2 | #20-600 | Teams | T4 650k (x4) |
| 6 | Tour | 900 | 11 | 2 | #10-600 | — | — |
| 7 | Post-Tour | 1 500 | 12 | 3 | #4-600 | Age | T5 1M (x2) |
| 8 | Vuelta | 2 000 | 12 | 3 | #1-600 | — | T6 UAE 1.25M |

---

## 8. Politiques

4 types, +5% XP chacun. Max actives : 1 (Nv.1-2) → 2 (Nv.3-6) → 3 (Nv.7-8).
Types debloques par niveau : Speciality (Nv.1) → Nationality (Nv.3) → Teams (Nv.5) → Age (Nv.7).

| Politique | Bonus | Configuration |
|-----------|-------|---------------|
| Specialist | +5% coureurs d'une specialite | Choix du joueur |
| National Pride | +5% coureurs d'une nationalite | Choix du joueur |
| Team Chemistry | +5% coureurs d'une equipe UCI | Choix du joueur |
| Age (Young/Veteran) | +5% coureurs dans la tranche d'age | Choix du joueur |

Les bonus sont **additifs**. Exemple : National Pride (Belgique) + Specialist (Sprinteur) = +10%.

**Timing :** Modifiable a tout moment, effectif au prochain payday.

---

## 9. Sponsors

**1 sponsor par equipe**, gate par le niveau uniquement (aucune condition d'eligibilite).

### 6 tiers, 13 sponsors

| Tier | Niveau | Budget/phase | Sponsors | Orientation |
|------|--------|-------------|----------|-------------|
| T1 | 1 | 250 000 EUR | Lotto | Neutre |
| T2 | 2 | 350 000 EUR | Astana | Neutre |
| T3 | 3 | 450 000 EUR | Groupama (FR), Movistar (ES) | GC |
| T3 | 3 | 450 000 EUR | Alpecin (BE/NL), Uno-X (DK/NO) | One-Day |
| T4 | 5 | 650 000 EUR | Ineos (GB), Decathlon (FR) | GC |
| T4 | 5 | 650 000 EUR | Soudal QS (BE), Lidl-Trek (US/IT) | One-Day |
| T5 | 7 | 1 000 000 EUR | Visma (prestige), Red Bull-Bora (regulier) | GC |
| T6 | 8 | 1 250 000 EUR | UAE Team Emirates | Neutre |

### Bonus sur resultats de course

Les sponsors creditent des **bonus** quand un coureur de l'equipe obtient un resultat qualifiant.

**T1-T4 : 3 lignes de bonus + multiplicateurs**

Chaque sponsor a un seuil et un montant pour 3 categories :
- **Bonus GC** — classement general stage race / grand tour
- **Bonus One-Day** — classiques et monuments
- **Bonus Etape** — victoire/top X d'etape individuelle

Multiplicateurs (T1-T4 uniquement) :
- **x2** si Monument ou Grand Tour
- **x1.5** si la nationalite du coureur matche celle du sponsor
- Cumulatifs : Monument + nationalite = x3

**T5-T6 : 5 lignes explicites (pas de multiplicateur nationalite)**

Montants distincts pour One-Day / Monument / Stage Race GC / Grand Tour GC / Etape.
Seul multiplicateur : x2 pour etape de Grand Tour.

### Changement de sponsor

- Modifiable a tout moment
- Effectif au **prochain payday** (pas immediatement)
- Le sponsor actuel reste actif pour les bonus de la phase en cours

### Premier sponsor (onboarding)

- Pas de sponsor a la creation d'equipe
- Le joueur selectionne son premier sponsor → paiement immediat (= premier payday)
- Lotto (T1) recommande par defaut

---

## 10. Phases WT & Payday

### 8 phases alignees sur le calendrier World Tour

| # | Phase | Periode approx. |
|---|-------|-----------------|
| 1 | Season Start | Jan 15 – Mar 1 |
| 2 | Classics Part 1 | Mar 5 – Apr 1 |
| 3 | Classics Part 2 | Apr 5 – May 1 |
| 4 | Giro d'Italia | May 5 – Jun 1 |
| 5 | Pre-Tour | Jun 5 – Jul 1 |
| 6 | Tour de France | Jul 4 – Jul 27 |
| 7 | Post-Tour | Jul 31 – Aug 18 |
| 8 | La Vuelta | Aug 22 – Sep 15 |

### Payday (confirmation de phase)

Au debut de chaque phase, le joueur **confirme** sa configuration :
1. Ajuster sponsor, releases, politiques — pas de mouvement d'argent
2. Cliquer "Confirm"
3. Calcul : `tresorerie += sponsor_budget - somme(salaires)`
4. Si tresorerie < -10 000 → cascade de faillite (§4.5)
5. Le joueur entre en mode encheres

**Chaque joueur confirme independamment** — pas de payday global.

---

## 11. Constantes du jeu (resume)

| Constante | Valeur |
|-----------|--------|
| Tresorerie depart | 0 EUR (premier sponsor = premier paiement) |
| Sponsor par defaut | Lotto T1, 250 000 EUR/phase (fixe) |
| Enchere = salaire mensuel | Oui — pas d'achat unique |
| Salaire mensuel | max(5 000, floor(pts_PCS x 2 000 / 12 / 100) x 100) |
| Salaire plancher | 5 000 EUR/mois |
| Frais de liberation | 5 000 EUR forfaitaire |
| Tolerance faillite | -10 000 EUR |
| Faillite : libere en premier | Plus haut XP cumule |
| Increment d'enchere | 100 EUR (multiples de 100) |
| Slots max | 6 (Nv.1) → 12 (Nv.7-8) |
| Politiques max | 1 (Nv.1-2) → 2 (Nv.3-6) → 3 (Nv.7-8) |
| Pool coureurs | Top 600 PCS global (12 mois glissants) |
| XP Niveau 8 (max) | 2 000 |
| Joueurs max par ligue | 20 |
