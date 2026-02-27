# WattHunter — Regles du Jeu

> **Document vivant** — Mis a jour a chaque changement de regle.
> Source de verite pour les mecaniques de jeu implementees et prevues.
> Derniere mise a jour : 2026-02-28

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

**Univers total :** ~923 coureurs (383 ProTeam + ~540 WorldTour)

**Donnees par coureur :**
- Nom, nationalite, equipe reelle UCI, type d'equipe
- Photo, age, specialite (grimpeur/sprinteur/rouleur/puncheur/contre-la-montre/polyvalent)
- Points PCS glissants 365 jours, classement PCS, salaire mensuel calcule

**Acces par niveau :**

| Niveau | Acces |
|--------|-------|
| 1 | ProTeam uniquement (~383) |
| 2 | ProTeam + PCS rank ≤400 |
| 3-9 | Progressivement plus de coureurs |
| 10 | TOUS les coureurs (~923) |

*Exception ProTeam :* Les coureurs ProTeam restent accessibles au Niveau 1 meme s'ils atteignent le top-10 PCS.

---

## 4. Economie

### 4.1 Tresorerie de depart

| Constante | Valeur |
|-----------|--------|
| Tresorerie initiale | 500 000 € |

### 4.2 Entrees
- Revenue des coureurs : quotidien (points PCS × taux de conversion)
- Paiements sponsors : mensuel le 1er du mois

### 4.3 Sorties
- Salaires des coureurs : mensuel le 1er du mois
- Encheres gagnees : deduction immediate

### 4.4 Formule de salaire

```
Salaire annuel = (PCS_glissant_1an / 1000) × 500 000 €
Salaire mensuel = Salaire annuel / 12
Plancher : 5 000 €/mois | Plafond : 300 000 €/mois
```

**Exemples :**
- 100 pts PCS → 50k€/an → 4 167€/mois → **plancher a 5 000€**
- 1 000 pts PCS → 500k€/an → 41 667€/mois
- 7 200 pts PCS → 3.6M€/an → 300k€/mois → **plafonne a 300 000€**

**Salaire verrouille :** A l'achat, le salaire est fige au taux du marche a la date d'enchere. Ne change plus tant que le coureur est dans l'equipe.

### 4.5 Rentabilite d'un coureur

```
Revenue mensuel = points_PCS_du_mois × TAUX_CONVERSION
Profit mensuel = Revenue mensuel − Salaire du contrat
```

| Constante | Valeur | Statut |
|-----------|--------|--------|
| TAUX_CONVERSION | 500 €/point PCS | **PLACEHOLDER — calibration Excel requise** |

### 4.6 Faillite

**Mois 1 de tresorerie negative :**
- Statut "dette", tresorerie negative
- Bloque aux encheres, mais peut jouer

**Mois 2 consecutif de tresorerie negative :**
- Liberation automatique des coureurs (salaire le plus eleve d'abord)
- Jusqu'a ce que la tresorerie redevienne positive
- Pas de preavis pour les auto-liberations

---

## 5. Encheres

| Regle | Valeur | Statut |
|-------|--------|--------|
| Duree | 72 heures (3 rounds de 24h) | Implemente |
| Mise minimum | Salaire mensuel du coureur | Implemente |
| Increment minimum | +100 € | Implemente |
| Format | Sealed-bid 3 rounds | Implemente |
| Calendrier | Aligne sur les Grands Tours | Non implemente |

**Resolution (auction.py) :**
1. Plus haute mise gagne
2. Egalite : timestamp le plus ancien gagne (placed_at)
3. Verification en cascade du budget (coureurs tries par montant decroissant)
4. Mise gagnante = prix d'achat deduit de la tresorerie
5. Bids perdants → status `outbid`, bids annules → status `cancelled`
6. Contrat cree (`contracts` table) avec `purchase_price` + `contract_salary` verrouille
7. Email recap a tous les joueurs via Resend (< 5 min)

**Validation du budget :** `somme(mises actives autres) + nouvelle mise > tresorerie` → mise rejetee

**Visibilite des mises :**
- Pendant l'enchere : mises `won`/`outbid` visibles par tous les membres de la ligue
- Mises `active` (prochain round) : secretes, visibles uniquement par leur equipe
- Enchere terminee : toutes les mises visibles

---

## 6. Contrats

**A la creation :**
- `purchase_price` : mise gagnante (unique)
- `contract_salary` : salaire marche a la date d'enchere (mensuel, verrouille)
- `status` : active → notice → released

**Liberation d'un coureur :**
- 1 mois de preavis, 1 mois de salaire supplementaire
- Slot libere immediatement
- Coureur retourne au pool general apres le preavis

---

## 7. Scoring & Niveaux

### XP quotidien

```
XP du coureur = points_PCS_du_jour × (1 + Σ bonus_politiques_actives)
XP equipe = Σ XP de tous les coureurs du roster
```

### Progression par niveaux

| Niveau | XP cumule | Slots | Politiques | Tier Sponsor |
|--------|-----------|-------|------------|--------------|
| 1 | 0 | 6 | 0 | — |
| 2 | 5 000 | 6 | 0 | — |
| 3 | 12 000 | 7 | 1 | Tier 1 |
| 4 | 21 800 | 7 | 1 | Tier 1 |
| 5 | 35 520 | 8 | 1 | Tier 2 |
| 6 | 54 728 | 9 | 2 | Tier 2 |
| 7 | 81 619 | 10 | 2 | Tier 3 |
| 8 | 119 267 | 11 | 2 | Tier 3 |
| 9 | 171 974 | 12 | 2 | Tier 4 |
| 10 | 245 764 | 12 | 3 | Tier 5 |

*Multiplicateur : ×1.4 par niveau. A recalibrer apres simulation Excel.*

---

## 8. Politiques

5 types, +5% XP chacun, max 3 actives (Niveau 10).

| Politique | Bonus | Configuration |
|-----------|-------|---------------|
| Young Blood | +5% coureurs < 23 ans | Automatique |
| Road Warriors | +5% coureurs > 30 ans | Automatique |
| National Pride | +5% coureurs d'une nationalite | Choix du joueur |
| Team Chemistry | +5% coureurs d'une equipe UCI | Choix du joueur |
| Specialist | +5% coureurs d'une specialite | Choix du joueur |

Les bonus sont **additifs**. Exemple : National Pride (Belgique) + Specialist (Sprinteur) = +10%.

---

## 9. Sponsors

1 sponsor actif a la fois. Contrat de 2 mois. Tier limite par le niveau.

| Tier | Niveau | Option A (inconditionnel) | Option B (conditionnel) | Condition |
|------|--------|--------------------------|-------------------------|-----------|
| 1 | 3 | 80 000 €/2mo | 120 000 €/2mo | ≥3 coureurs meme nationalite |
| 2 | 5 | 170 000 €/2mo | 220 000 €/2mo | ≥2 coureurs < 23 ans |
| 3 | 7 | 250 000 €/2mo | 300 000 €/2mo | ≥2 coureurs meme specialite |
| 4 | 9 | 400 000 €/2mo | 500 000 €/2mo | ≥3 coureurs meme equipe |
| 5 | 10 | 800 000 €/2mo | 1 000 000 €/2mo | ≥4 meme nationalite OU ≥3 meme equipe |

Condition non remplie au jour du paiement → montant Option A verse a la place.

---

## 10. Constantes du jeu (resume)

| Constante | Valeur | A calibrer ? |
|-----------|--------|-------------|
| Tresorerie depart | 500 000 € | Non |
| Salaire plancher | 5 000 €/mois | Non |
| Salaire plafond | 300 000 €/mois | Verifier avec donnees reelles |
| Taux de conversion | 500 €/point PCS | **OUI — simulation obligatoire** |
| Duree d'enchere | 72 heures | Non |
| Increment d'enchere | 100 € | Non |
| Slots max | 6 (Niv 1) → 12 (Niv 10) | Non |
| Politiques max | 0 (Niv 1) → 3 (Niv 10) | Non |
| Contrat sponsor | 2 mois | Non |
| Joueurs max par ligue | 20 | Non |
| Multiplicateur XP/niveau | ×1.4 | Calibrer apres simulation |
