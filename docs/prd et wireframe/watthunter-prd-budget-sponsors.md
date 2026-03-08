# WattHunter — PRD Budget & Sponsors
**Version** : 2.0 · **Status** : Draft · **Last updated** : March 2026

---

## 1. Overview

Le système Budget & Sponsors est le moteur économique de WattHunter. Il répond à 3 questions clés pour le joueur :
1. **Combien j'ai en caisse ?**
2. **D'où vient l'argent, où il part ?**
3. **Combien j'ai pour la prochaine enchère ?**

---

## 2. Structure des écrans

| Écran | Accès | Description |
|-------|-------|-------------|
| **Budget** | Bottom nav | Solde · transactions · sponsors |
| **Marketplace** | Budget → "Change sponsor →" | Sélection sponsor par slot (main ou secondary) |
| **All Transactions** | Budget → "See all →" | Historique complet par mois avec filtres |

> Pas de page "Sponsors" dédiée. La gestion se fait directement depuis les cards sur la page Budget.

---

## 3. Écran Budget

### 3.1 Navigation temporelle — Phases racing calendar

- Navigation par **auction phase** (7 phases sur la saison)
- Format affiché : **"[Phase Name] · [Start] – [End]"**
- Flèches gauche/droite. Phase la plus récente = flèche droite désactivée

| # | Phase | Dates |
|---|-------|-------|
| 1 | Season Start | Jan 1 – Feb 28 |
| 2 | The Flandrians | Mar 1 – Apr 12 |
| 3 | The Ardennes | Apr 13 – May 10 |
| 4 | Giro d'Italia | May 11 – Jun 14 |
| 5 | Tour de France | Jun 15 – Aug 2 |
| 6 | La Vuelta | Aug 3 – Sep 21 |
| 7 | End of Season | Sep 22 – Nov 2 |

### 3.2 Hero — Balance

- Label "Balance" (uppercase small) + montant €, font taille maximale, **noir**
- Ligne inline sous le montant : `Income +€XXXk  ·  Outgoing −€XXXk`
  - Labels gris, valeurs noires
  - Income = sponsors + bonus riders
  - Outgoing = salaires riders uniquement
- **Pas de codes couleur, pas de boxes colorées, pas de dots**

### 3.3 Transactions

Section **placée avant les sponsors** dans le scroll.

**Header** : "Transactions" + "See all →"

**Filtres chips** (horizontal scroll) : All · Bonuses · Salaries · Sponsors

**Affichage** : 4–5 transactions les plus récentes de la phase en cours

#### Anatomie des 3 types de transaction cards

| Type | Visuel gauche | Ligne 1 (titre) | Ligne 2 (sous-titre) | Montant | Date |
|------|--------------|-----------------|---------------------|---------|------|
| **Bonus** | Avatar initiales rider (rond, gris) | Nom du rider | Nom de la course · Étape si GT | +€XX,000 | Jour (Apr 12) |
| **Salary** | Avatar initiales rider (rond, gris) | Nom du rider | "Salary" | −€XX,000 | Jour (Apr 1) |
| **Sponsor** | Logo rond (noir = main, gris = secondary) | Nom du sponsor | "Sponsorship" | +€XXX,000 | Jour (Apr 1) |

**Règles visuelles communes :**
- Tous les montants = **noir** (pas de vert/rouge sur les chiffres)
- Le +/− distingue income vs outgoing
- Tous les avatars/logos = **ronds**, même taille (30px)
- Sous-titre Course GT = "Race Name · Stage X"

### 3.4 Section Sponsors

Placée en bas, après les transactions.

**Structure commune aux 2 cards :**
- Logo rond (34px) · Nom · Tier · Montant/mois
- Tags conditions : vert si remplie, gris disabled si pas remplie
- Footer : "Change sponsor →" → ouvre Marketplace

**Slot Principal** (T3/T4/T5) : border noire, tier label orange "Main · T3"
**Slot Secondaire** (T1/T2) : border grise, tier label gris "Secondary · T2"

**Avant Lv.5** : slot principal = locked card dashed + opacité réduite
- Message : "Unlocks at Level 5 · min €550k/month"

---

## 4. Marketplace

Ouverte depuis "Change sponsor →" sur l'une des deux cards.
Le context (main vs secondary) détermine les tiers affichés.

### 4.1 Header

- Label slot : "Main sponsor" ou "Secondary sponsor"
- Titre : "Choose a sponsor"
- Sous-titre : tiers disponibles + level requis

### 4.2 Message info

`Change will take effect at the next phase.`

> Pas de warning alarmiste. L'information est neutre et factuelle.

### 4.3 Liste sponsors

Groupée par tier avec header : `T3 · €550k / month · Lv.5+`

**Sponsor actuel** : logo orange + checkmark orange

**Sponsor sélectionné (autre)** : fond légèrement orangé + logo orange + checkmark

**Sponsors locked** : opacité 33% + mention "Unlock at Level X"

**Conditions** : tags verts si remplie, gris si pas encore remplie

**Logique conditions OR** : quand un sponsor accepte plusieurs spécialités, affiché "One-day or Sprint" (une seule suffit)

### 4.4 Sticky CTA — Comportement

| État | Comportement |
|------|-------------|
| Aucun nouveau sponsor sélectionné | **CTA absent** (pas de bouton visible) |
| Nouveau sponsor sélectionné | CTA apparaît en sticky bottom |

**Contenu du CTA (quand visible) :**
```
New monthly budget        €900,000 / month
[ Switch to Ineos Grenadiers → ]
```
- Budget preview juste au-dessus du bouton (les deux sont visuellement liés)
- Label bouton contextuel : "Switch to [Nom sponsor] →"

---

## 5. All Transactions

### 5.1 Navigation phase

Phase name + dates en header compact avec flèches.

### 5.2 Filtres

Chips permanents : **All · Bonuses · Salaries · Sponsors**

### 5.3 Groupement

Groupé par **mois calendaire** avec total net en header de groupe (noir).

Même anatomie de cards que sur la page Budget principale.

---

## 6. Système Sponsors

### 6.1 Structure des slots

| Slot | Tiers autorisés | Unlock |
|------|----------------|--------|
| Secondaire | T1 · T2 | Lv.1 |
| Principal | T3 · T4 · T5 | Lv.5 |

**Budget max théorique par niveau :**

| Level | Max budget/mois |
|-------|----------------|
| Lv.1–2 | €200k (Lotto T1) |
| Lv.3–4 | €350k (T2 secondary) |
| Lv.5–6 | €900k (T3 550k + T2 350k) |
| Lv.7 | €1,100k (T4 750k + T2 350k) |
| Lv.8+ | €1,350k (UAE 1M + T2 350k) |

### 6.2 Grille complète des sponsors

| # | Tier | Sponsor | Budget/mois | Unlock | Nationalité | Spécialité (OR) | Résultat min |
|---|------|---------|------------|--------|-------------|-----------------|--------------|
| 1 | T1 | Lotto | €200k | Lv.1 | — | — | — |
| 2 | T2 | Groupama-FDJ | €350k | Lv.3 | 2× 🇫🇷 | GC | — |
| 3 | T2 | Movistar | €350k | Lv.3 | 2× 🇪🇸 | GC | — |
| 4 | T2 | Uno-X | €350k | Lv.3 | 2× 🇩🇰/🇳🇴 | One-day | — |
| 5 | T2 | Alpecin | €350k | Lv.3 | 2× 🇧🇪/🇳🇱 | One-day or Sprint | — |
| 6 | T3 | Decathlon | €550k | Lv.5 | 2× 🇫🇷 | GC or Sprint | Top 10 stage race |
| 7 | T3 | Soudal Quick-Step | €550k | Lv.5 | 2× 🇧🇪 | One-day or Sprint | Top 10 classic |
| 8 | T3 | Ineos Grenadiers | €550k | Lv.5 | 2× 🇬🇧 | One-day or GC | Top 10 stage race |
| 9 | T3 | Bora-Hansgrohe | €550k | Lv.5 | 2× 🇩🇪 | One-day or GC | Top 10 classic |
| 10 | T3 | Trek | €550k | Lv.5 | 2× 🇺🇸 | One-day or TT | Top 10 classic |
| 11 | T4 | Lidl | €750k | Lv.7 | — | GC or Sprint | Top 10 GT/monument |
| 12 | T4 | Red Bull | €750k | Lv.7 | — | GC or TT | Top 10 GT/monument |
| 13 | T4 | Visma | €750k | Lv.7 | — | GC or One-day | Top 10 GT/monument |
| 14 | T5 | UAE Group | €1M | Lv.8 | — | GC | Top 5 GT/monument |

### 6.3 Conditions détaillées

**Nationalité** : au moins N riders de la nationalité dans le roster actif.

**Spécialité** : logique OR — au moins UNE des spécialités listées doit être couverte par une policy active.

**Résultat** : évalué sur la saison en cours uniquement (reset chaque année).

| Catégorie | Courses incluses |
|-----------|-----------------|
| Classic | Paris-Roubaix, Ronde, Liège-BL, Milan-Sanremo, Lombardie, Amstel, Flèche |
| Stage race | Tour, Giro, Vuelta, Dauphiné, Romandie, Suisse, Paris-Nice |
| GT | Tour de France, Giro d'Italia, Vuelta a España |
| Monument | Paris-Roubaix, Ronde, Milan-Sanremo, Liège-BL, Il Lombardia |

### 6.4 Système confidence

**MVP** : non implémenté, non affiché.
**Post-MVP** : documenté séparément (voir section 10).

### 6.5 Changement de sponsor

- Effectif à la **prochaine phase** (pas immédiat)
- Pas de pénalité display en MVP (mécanique confidence post-MVP)
- Conditions reset sur le nouveau sponsor

---

## 7. Intégrations système

| Système | Lien |
|---------|------|
| **Level system** | Unlock T2 Lv.3, slot principal + T3 Lv.5, T4 Lv.7, T5 Lv.8 |
| **Policies** | Conditions sponsors référencent policies actives (GC, One-day, Sprint, TT) — logique OR |
| **Riders** | Nationalité riders vérifie conditions · salaires → Outgoing |
| **Racing results** | Bonus → Income · Conditions résultats → satisfaction sponsor |

---

## 8. MVP vs Post-MVP

### MVP (v1)
- [x] Balance + Income/Outgoing compact inline
- [x] Navigation par auction phase avec vraies dates
- [x] 7 phases nommées (racing calendar)
- [x] 2 slots sponsors (principal + secondaire)
- [x] Grille 14 sponsors avec conditions OR visibles
- [x] Conditions tags : vert met / gris disabled
- [x] Marketplace groupée par tier, CTA sticky à la sélection uniquement
- [x] Preview budget mensuel dans le CTA
- [x] Transactions avec 3 types de cards (anatomy définie)
- [x] Filtres transactions : All / Bonuses / Salaries / Sponsors
- [x] All Transactions avec groupement par mois
- [x] Locked states (level requis)

### Post-MVP
- [ ] Calcul dynamique confidence (XP bracket + résultats)
- [ ] Départ sponsor si confidence < seuil leave
- [ ] Budget effect (+10% / nominal / −25%) selon confidence
- [ ] Indisponibilité sponsor 2 phases après changement
- [ ] Loyalty streak bonus
- [ ] Notifications sponsor en danger

---

## 9. Open questions

| # | Question | Impact |
|---|----------|--------|
| 1 | Si solde insuffisant pour payer salaires → pénalité ? forced sell ? | Finance |
| 2 | Les bonus résultats — quel montant par type de résultat ? | Balance économique |
| 3 | Saison = année calendaire ou cycle UCI ? | Date système |
| 4 | Astana / XDS — à inclure dans la grille ? | Game design |
