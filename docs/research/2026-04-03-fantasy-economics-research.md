# Fantasy League Economics — Research & Proposals

**Date:** 2026-04-03
**Status:** Research complete, proposals drafted, to be designed in future session
**Context:** Recherche comparative sur 20+ jeux fantasy/manager pour améliorer le système économique de WattHunter. Objectifs : simplifier l'onboarding + rendre l'économie plus fun/engageante.

---

## Table of Contents

1. [Research — Industry Overview](#1-research--industry-overview)
2. [Key Mechanics Across the Industry](#2-key-mechanics-across-the-industry)
3. [Gaps: WattHunter vs Industry](#3-gaps-watthunter-vs-industry)
4. [What Makes WattHunter Unique](#4-what-makes-watthunter-unique)
5. [Proposals — Budget Page P&L](#5-proposals--budget-page-pl)
6. [Proposals — Sponsor Readability](#6-proposals--sponsor-readability)
7. [Future Considerations](#7-future-considerations)
8. [Sources](#8-sources)

---

## 1. Research — Industry Overview

### 1.1 The 3 Economic Models in Fantasy Sports

#### A. Budget fixe, pas de salaire récurrent
**Jeux :** FPL (11M joueurs), Velogames, F1 Fantasy, UEFA Fantasy, MotoGP Fantasy

- Budget identique au départ (£100M, $100M, 100 crédits)
- Prix fixés par l'opérateur ou le marché
- Coût **one-shot** à l'achat, pas de salaire récurrent
- Seule friction : transfers limités ou pénalité en points (-4 pts FPL, -20 pts F1)
- Prix dynamiques basés sur la popularité (FPL) ou la performance (F1, MotoGP)
- **Aucun risque de faillite** — tu ne peux simplement pas acheter au-delà du budget

**Détail par jeu :**

| Jeu | Budget | Prix dynamiques | Transfers | Particularité |
|-----|--------|-----------------|-----------|---------------|
| FPL | £100M | Oui (popularité, daily) | 1/semaine, -4pts extra | Profit 50% haircut sur revente |
| F1 Fantasy | $100M | Oui (rolling 3-race avg) | 3/race, -20pts extra | Budget croît si tes picks montent |
| Velogames | 100 crédits | Non (statiques) | ~2/étape | Pure draft puzzle, pas d'économie |
| UEFA Fantasy | €100M | Oui (performance) | 3 fenêtres illimitées | Budget +5M à la phase KO |
| MotoGP | $40M | Oui (rolling 3-race) | 1/race | Team value = salary cap (compound) |
| road.cc | 150 crédits | Oui (daily) | 2/jour, +10cr extra | Daily trading, prix affectent budget |
| Wielermanager | 120M€ | Non | Illimités mais coût progressif | Kopman (capitaine) bonus, 50K joueurs |

#### B. Salary cap + enchères, FAAB pour waivers
**Jeux :** ESPN Fantasy Football, Yahoo Fantasy, CBS Fantasy, Sleeper, Fantrax

- Budget draft $200–$260 (enchère ouverte ascending)
- FAAB séparé $100–$1000 pour les waivers (sealed bid)
- Salaires **ne sont PAS récurrents** en format standard — c'est un coût unique au draft
- Seules les **contract/dynasty leagues** ont des salaires récurrents
- Dead money sur les coupes de contrat (50–100% du salaire restant)
- Hard cap universel — le système bloque au-delà

| Plateforme | Budget draft | FAAB | Enchère | Dead money |
|------------|-------------|------|---------|------------|
| ESPN | $200 | $100 | Open ascending live | Non (standard) |
| Yahoo | $200 (adj.) | $100 | Open ascending live | Oui (keeper leagues) |
| CBS | $260 (adj.) | $100 | Open ascending live | Oui (contract leagues) |
| Sleeper | $200 | $100 ($0 bid OK) | Open ascending live | Non |
| DraftKings/FanDuel | $50K-$60K/contest | N/A | N/A (daily) | N/A |

#### C. Manager games à économie persistante
**Jeux :** Hattrick, Football Manager, Top Eleven, Pro Cycling Manager, OSM

- **Revenus multiples** : sponsors (hebdo/mensuel) + billetterie (par match) + TV + primes
- **Salaires récurrents** : payés par semaine ou par mois
- **Faillite possible** (Hattrick : -500K → dissolution de l'équipe)
- Sponsor lié à la division/réputation, pas un choix libre

| Jeu | Revenus | Salaires | Faillite | Sponsor |
|-----|---------|----------|----------|---------|
| Hattrick | Sponsors (hebdo) + billetterie + primes | Hebdomadaires | Oui (-500K → dissolution) | Objectif de perf → humeur → income |
| Football Manager | TV + sponsors (mensuel) + billetterie + transferts | Mensuels | Non (board intervient) | Automatique, lié à réputation |
| Top Eleven | Sponsors (cash) + TV (tokens) + billetterie | Récurrents | Non | Choix durée contrat (daily→season) |
| Pro Cycling Manager | Budget annuel sponsor (lump sum) | Annuels | Non | 2-3 offres/an, choix stratégique |
| OSM | TV + sponsors + billetterie + cups | Récurrents | Non (chairman safety net) | Automatique |

---

### 1.2 Auction & Bidding Formats

| Format | Comment ça marche | Qui l'utilise | Pertinence WattHunter |
|--------|-------------------|---------------|----------------------|
| **FAAB (sealed bid, 1st price)** | Budget saison, bids cachés, le plus offrant gagne et paie son bid | ESPN, Yahoo, CBS, Sleeper | **Très proche du modèle WH** |
| **English auction (ascending)** | Enchère ouverte, timer, surenchère visible | ESPN/Yahoo draft, Sorare | Non retenu (trop interactif) |
| **Vickrey (sealed bid, 2nd price)** | Le plus offrant gagne mais paie le 2e prix | Aucune plateforme majeure | Intéressant théoriquement mais pas adopté |
| **Rolling waivers** | File d'attente par priorité (inverse standings) | ESPN (défaut) | Favorise le tanking |
| **Progressive cost transfers** | Transfers gratuits au début, coût croissant | Wielermanager | Anti-churning efficace |

**Détail FAAB (le plus pertinent pour WH) :**
- Budget typique : $100 pour la saison
- Bids soumis pendant la fenêtre (24h-7j), révélés à la résolution
- $0 bids autorisés sur Sleeper (pas ESPN)
- Tiebreaker : waiver priority (Sleeper) ou inverse standings (ESPN)
- Budget ne se recharge pas — gestion sur toute la saison
- Mécanisme anti-hoarding naturel : dépenser gros tôt = rien pour plus tard

---

### 1.3 Salary & Contract Systems (jeux avec salaires récurrents)

#### Ottoneu Fantasy Baseball (le plus proche de WH)
- Cap $400, roster 40 joueurs
- Salaire fixé par enchère (comme WH)
- **Auto-escalade** : +$2/an automatique pour tout joueur avec une apparition MLB
- **Arbitrage offensif** : tu peux allouer $3 de salaire à un joueur adverse pour le rendre plus cher
- **Cut penalty** : 50% du salaire en dead cap jusqu'à fin de saison
- **Anti-hoarding** : escalade auto + arbitrage = les contrats cheap deviennent chers

#### Dynasty Contract Leagues (League Tycoon)
- Contrats 1-5 ans, salaire fixé par enchère
- **Rookie contracts** : escalade ~10% par an
- **Dead money** : 50% du salaire restant sur le cap pendant 1-2 saisons
- **Franchise tag** : garder un joueur en fin de contrat à un prix premium
- Hard cap ou luxury tax (rare)

#### Keeper Leagues (format casual)
- Salaire = bid de l'an dernier + $5/an (ou +10-30%)
- Maximum 2-4 ans de keeper
- **Inflation** : les keepers sous-côtés créent de l'"argent gratuit" qui gonfle les prix restants (20-40% d'inflation observée)

#### Pro Cycling Manager
- Budget annuel du sponsor, reçu en lump sum (1er juillet)
- 2-3 offres de sponsors avec budget et potentiel de croissance différents
- Performance cette saison → offre sponsor l'an prochain (effet retardé)
- Pas de prize money direct en budget

---

### 1.4 Income & Sponsor Mechanics in Games

#### Pattern 1 — Sponsor par réputation/division (FM, Hattrick, OSM)
Sponsor income calculé automatiquement selon ton niveau/division. Pas de choix.

#### Pattern 2 — Choix de durée de contrat (Top Eleven)
Même sponsor, durée variable. Daily = +40% income mais login quotidien requis. Engagement loop.

#### Pattern 3 — Objectif de performance (Hattrick)
Tu choisis un objectif de difficulté (top 3, top 7, avoid relegation). Plus difficile = plus d'income. Si tu rates → sponsor mood baisse → income réduit la phase suivante. **Pattern le plus pertinent pour WH.**

#### Pattern 4 — Offres annuelles à choisir (PCM)
2-3 offres discrètes. Budget court terme vs potentiel de croissance long terme. Choix stratégique.

#### Répartition garantie vs variable dans l'industrie

| Jeu | Garanti (%) | Variable (%) | Cadence |
|-----|-------------|-------------|---------|
| Football Manager | ~60% (TV + sponsor base) | ~40% (billetterie + primes) | Mensuel/par match |
| Hattrick | ~50% (sponsor hebdo) | ~50% (billetterie + fin de saison) | Hebdomadaire |
| Top Eleven | ~40% (sponsor saison) | ~60% (match income, bonus) | Daily-mensuel |
| Pro Cycling Manager | ~100% (budget annuel) | ~0% (dans la saison) | Annuel |
| Sorare | ~0% | ~100% (pure performance) | Hebdomadaire |
| **WattHunter** | **~70-80%** (sponsor base) | **~20-30%** (race bonuses) | **Par phase** |

---

### 1.5 Bankruptcy & Financial Failure

| Mécanisme | Qui l'utilise | Comment ça marche |
|-----------|---------------|-------------------|
| **Hard cap (prévention totale)** | ESPN, Yahoo, CBS, FPL | Le système bloque avant que tu dépasses. Pas de faillite possible. |
| **Gel progressif** | Hattrick | -200K → gel des achats. -500K → 2 semaines pour récupérer, sinon dissolution. |
| **Chairman safety net** | OSM | Si net worth < 50% de la moyenne → injection auto du chairman. Pas de faillite. |
| **Board intervention** | Football Manager | Le board injecte des fonds en urgence ou force des ventes. |
| **Auto-release cascade** | **WattHunter** | -10K → auto-release du plus cher au moins cher. |
| **Dead money penalty** | Ottoneu, Dynasty | 50-100% du salaire reste en cap penalty après release. Empêche le churn. |

---

## 2. Key Mechanics Across the Industry

### Mécaniques universelles (adoptées partout)
1. **Hard cap enforcement** — le système empêche de dépenser au-delà du budget
2. **Bid minimum** — $1 ou 5K€ pour éviter les bids à 0
3. **Transaction log** — historique complet des flux financiers

### Mécaniques populaires (adoptées par 50%+)
4. **FAAB sealed bid** — enchères cachées, le plus offrant gagne
5. **Position/roster limits** — limiter le nombre de joueurs par position
6. **Transfer friction** — chaque transfer a un coût (points, argent, ou quota limité)

### Mécaniques différenciantes (niches mais puissantes)
7. **Sponsor objectives** (Hattrick) — choix risque/récompense sur la performance
8. **Budget compound** (F1, MotoGP) — ton budget croît si tes picks montent en valeur
9. **Dead money** (Ottoneu, Dynasty) — cut penalty proportionnel au salaire
10. **Salary escalation** (Ottoneu +$2/an, keeper +$5/an) — les contrats deviennent plus chers naturellement
11. **Arbitrage offensif** (Ottoneu) — tu peux gonfler les salaires de tes rivaux
12. **Captain/Boost désignation** (Wielermanager, MotoGP, F1) — choix actif par course/semaine

---

## 3. Gaps: WattHunter vs Industry

### Gap 1 — Pas de comeback mechanic
**Industrie :** Dynasty leagues donnent le 1er pick de draft aux derniers. FAAB bonus pour les équipes en difficulté. Consolation brackets.

**WattHunter actuel :** Rien d'explicite. Les perdants ont implicitement plus de cap room (moins de riders = moins de salaires), mais pas d'avantage formel.

**Risque :** Les joueurs en retard de XP + level se retrouvent avec un pool restreint ET moins de slots → spirale descendante sans issue.

**Pistes de solution :**
- Bonus FAAB pour les derniers du classement (budget d'enchère supplémentaire)
- Pool élargi temporairement pour les équipes en retard de level
- XP catch-up bonus (XP bonus si tu es 2+ levels en dessous du leader)

---

### Gap 2 — Sponsor divergence non compensée
**Industrie :** Revenue sharing (NFL), salary floor (NBA), chairman safety net (OSM).

**WattHunter actuel :** T1=250K vs T6=1.25M → 5× d'écart sans aucun mécanisme compensatoire.

**Risque :** Rich-get-richer. Les équipes de haut level avec T5-T6 sponsors accumulent massivement plus que les T1-T2.

**Pistes de solution :**
- Les bonus sponsor sont déjà proportionnels au tier (seuils plus durs à haut level), ce qui compense partiellement
- Vérifier que le ratio income/salaires reste similaire entre les tiers
- Éventuellement un "salary floor" (income minimum garanti pour tous)

---

### Gap 3 — Budget page pas assez lisible
**Industrie :** DraftKings affiche en temps réel "remaining salary" pendant la construction. F1 Fantasy montre "team value" qui croît/décroît. Hattrick a un P&L hebdomadaire détaillé.

**WattHunter actuel :** Balance globale + income/outgoing agrégés + transaction list. `phaseSalaries` calculé mais non affiché. Pas de breakdown par catégorie. Pas de projection.

**Voir section 5 pour les propositions détaillées.**

---

### Gap 4 — Pas de gel avant faillite
**Industrie :** Hattrick freeze les achats à -200K avant la faillite à -500K. 2 paliers de protection.

**WattHunter actuel :** On passe directement de "tout va bien" à "auto-release à -10K". Pas de warning intermédiaire.

**Pistes de solution :**
- Warning visuel quand `salaries > sponsor_base` (le joueur dépend des bonus)
- Gel des nouvelles enchères si treasury < seuil (ex: 20K)
- Notification push "Attention, ta masse salariale dépasse ton sponsor"

---

### Gap 5 — Pas de limite de concentration
**Industrie :** FPL max 3 joueurs par club. Dynasty leagues ont des position limits.

**WattHunter actuel :** Aucune limite. Un joueur peut prendre tous les riders d'une même équipe.

**Risque faible** dans le contexte WattHunter (pool de 600 riders, pas de corrélation forte par équipe comme en football). À surveiller mais pas prioritaire.

---

### Gap 6 — Gestion d'équipes inactives
**Industrie :** Commissioner reassigns ou bot prend le relais. FM remplace par un manager IA.

**WattHunter actuel :** Pas défini.

**Pistes de solution :**
- Après N jours d'inactivité → team gelée (pas de bids, pas de releases)
- Après 2 phases d'inactivité → riders relâchés automatiquement dans le pool
- Notification aux autres joueurs de la ligue

---

## 4. What Makes WattHunter Unique

**Ce qu'aucun jeu de cycling fantasy ne fait :**
1. **Salaire récurrent par phase** (bid = salaire mensuel) — Velogames, road.cc, Wielermanager sont tous en budget one-shot
2. **Sponsor avec bonus par résultat de course** — aucun jeu cycling n'a de sponsor system
3. **Enchère sealed-bid multi-round** — Velogames et road.cc n'ont pas d'enchères
4. **Système de niveaux + unlock progressif du pool** — unique dans le cycling fantasy
5. **Policies qui boostent l'XP** — aucun équivalent

**Parallèle le plus proche dans l'industrie :**
- **Ottoneu Baseball** : enchère = salaire récurrent + hard cap + cut penalty
- **Hattrick** : sponsor objectifs + faillite progressive + économie persistante
- **MotoGP Fantasy** : team value compound + tiers de riders (Gold/Silver)

---

## 5. Proposals — Budget Page P&L

### Contexte actuel (ce qui existe dans le code)

**Page :** `/league/[leagueId]/budget/`

| Élément | État |
|---------|------|
| Hero card : Treasury + Phase Income + Phase Outgoing | ✅ Existe |
| Sponsor card avec bonus expandables | ✅ Existe |
| Transaction list (5 dernières, filtrables) | ✅ Existe |
| Phase navigation | ✅ Existe |
| `phaseSalaries` (total salaires) | ⚠️ Calculé mais NON affiché |
| Breakdown par catégorie (sponsor vs bonus vs salaires) | ❌ N'existe pas |
| Projection next phase | ❌ N'existe pas |
| Indicateur de risque | ❌ N'existe pas |

### Proposal : P&L simplifié par phase

Remplacer le hero card actuel (Income | Outgoing | Balance) par un P&L en 3 lignes + indicateur :

```
┌─────────────────────────────────────────┐
│  Treasury                    425,000 €  │  ← cumul toutes phases
│─────────────────────────────────────────│
│  Phase 3 — Paris-Nice → Classiques      │
│                                         │
│  Sponsor base              +250,000 €   │
│  Race bonuses               +45,000 €   │
│  Salaries                  -180,000 €   │
│                           ───────────   │
│  Phase total               +115,000 €   │
│                                         │
│  ⚠️ Salary > sponsor: bankruptcy risk   │  ← UNIQUEMENT si salaries > sponsor base
└─────────────────────────────────────────┘
```

**Règles :**
- **Treasury** = cumul global (toutes les phases passées)
- **3 lignes par phase** : sponsor base, race bonuses, salaries — c'est tout
- **Phase total** = somme des 3
- **Warning** = affiché **seulement** si `sum(salaries) > sponsor.monthly_budget`
- Pas de projection, pas de simulateur, pas de détail par rider — juste les faits

**Pourquoi ces 3 lignes :**
Le joueur comprend immédiatement :
1. Combien son sponsor lui donne (garanti)
2. Combien ses riders lui ont rapporté (variable)
3. Combien il paie en salaires (engagé)
4. Est-ce qu'il vit au-dessus de ses moyens (warning)

**Inspirations industrie :**
- Hattrick P&L hebdomadaire (sponsors + billetterie - salaires)
- DraftKings "remaining salary" en temps réel
- F1 Fantasy "team value" visible

---

## 6. Proposals — Sponsor Readability

### Contexte actuel (ce qui existe dans le code)

**Page :** `/league/[leagueId]/budget/marketplace`

| Élément | État |
|---------|------|
| Sponsors groupés par tier | ✅ Bien |
| Locked sponsors à 40% opacity + lock icon | ✅ Bien |
| Budget mensuel affiché | ✅ Bien |
| Bonus expandables (3 lignes T1-T4, 5 lignes T5-T6) | ⚠️ Dense, difficile à parser |
| Multipliers ×2 et ×1.5 affichés | ⚠️ Pas clair qu'ils se stackent |
| Flags nationalité | ⚠️ Pas expliqué pourquoi |
| Phrase d'accroche stratégique | ❌ N'existe pas |
| Exemple concret de gains | ❌ N'existe pas |

### Problèmes identifiés

1. **Multiplier stacking pas évident** — ×2 et ×1.5 séparés, le joueur ne comprend pas que 20K × 2 × 1.5 = 60K
2. **Seuils sans contexte** — "Top 15" ne dit rien si tu ne connais pas le cyclisme
3. **T5-T6 vs T1-T4 = 2 formats visuels différents** — confus
4. **Flags sans explication** — le joueur ne sait pas pourquoi il y a des drapeaux
5. **Pas de résumé stratégique** — il faut lire toutes les lignes pour comprendre l'orientation

### Proposal A — Tagline + exemples concrets

Ajouter à chaque sponsor :
- **1 phrase d'accroche** visible sans expander (résumé de la stratégie)
- **1 exemple concret** par ligne de bonus dans le détail expandable

```
┌─────────────────────────────────────────┐
│ ▶ Groupama-FDJ          [GC] 🇫🇷        │
│   450K / phase                          │
│   « Spécialiste GC — gros bonus         │
│     sur les classements généraux »       │
│                                         │
│   Bonus par résultat de course :        │
│   ┌───────────────────────────────────┐ │
│   │ GC Top 15           +20K         │ │
│   │   ×2 Grand Tour  ×1.5 🇫🇷        │ │
│   │   ex: Bardet 5e Tour             │ │
│   │       = 20K×2×1.5 = 60K          │ │
│   │───────────────────────────────────│ │
│   │ One-Day Top 15       +5K         │ │
│   │   ×2 Monument   ×1.5 🇫🇷         │ │
│   │───────────────────────────────────│ │
│   │ Étape Top 5          +5K         │ │
│   │   ×2 Grand Tour stage            │ │
│   └───────────────────────────────────┘ │
│                                         │
│                       [Select ○]        │
└─────────────────────────────────────────┘
```

**Pro :** Garde le système actuel intact, juste meilleure présentation.
**Con :** Toujours des multipliers à comprendre.

### Proposal B — Montants fixes pré-calculés (no multipliers dans l'UI)

Afficher directement les montants par type d'événement au lieu de base + multipliers :

```
┌─────────────────────────────────────────┐
│ ▶ Groupama-FDJ          [GC] 🇫🇷        │
│   450K / phase                          │
│   « Spécialiste GC — gros bonus         │
│     sur les classements généraux »       │
│                                         │
│   Ce que tu gagnes :                    │
│   ┌───────────────────────────────────┐ │
│   │ Stage Race GC Top 15       +20K  │ │
│   │ Grand Tour GC Top 15       +40K  │ │
│   │                                  │ │
│   │ One-Day Top 15              +5K  │ │
│   │ Monument Top 15            +10K  │ │
│   │                                  │ │
│   │ Étape (stage race)          +5K  │ │
│   │ Étape (Grand Tour)        +10K   │ │
│   │                                  │ │
│   │ 🇫🇷 Coureur français : tout ×1.5  │ │
│   └───────────────────────────────────┘ │
│                                         │
│                       [Select ○]        │
└─────────────────────────────────────────┘
```

**Pro :** Le joueur voit exactement ce qu'il gagne, zéro calcul mental. "Mon rider finit 5e au Tour → je gagne 40K" (ou 60K si FR).
**Con :** Plus de lignes (6 au lieu de 3). La mécanique sous-jacente est la même (base × multiplier), c'est juste l'affichage qui change.

### Proposal C — Simplifié radical (5 lignes max)

Pré-calculer et afficher les montants pour chaque scénario avec icônes :

```
┌─────────────────────────────────────────┐
│ ▶ Groupama-FDJ          [GC] 🇫🇷        │
│   450K / phase                          │
│   « Spécialiste GC — gros bonus         │
│     sur les classements généraux »       │
│                                         │
│   Ce que tu gagnes :                    │
│   ┌───────────────────────────────────┐ │
│   │ 🏆 GC stage race             20K │ │
│   │ 🏆 GC Grand Tour             40K │ │
│   │ 🏁 One-Day / classique        5K │ │
│   │ 🏁 Monument                  10K │ │
│   │ 🚩 Étape                   5-10K │ │
│   │                                  │ │
│   │ 🇫🇷 Coureur FR : tout ×1.5      │ │
│   └───────────────────────────────────┘ │
│                                         │
│   Seuil : Top 15 GC / One-Day          │
│           Top 5 Étapes                  │
│                                         │
│                       [Select ○]        │
└─────────────────────────────────────────┘
```

**Pro :** Ultra scannable, 5 lignes + 1 nationalité. Les seuils sont regroupés en bas. Minimum de bruit.
**Con :** Perd un peu de granularité sur les seuils par catégorie.

### Recommendation

**Proposal B** semble le meilleur compromis : montants pré-calculés (pas de ×2 à comprendre), mais assez de détail pour voir la différence entre stage race et grand tour. Le ×1.5 nationalité reste comme seul multiplier — c'est simple car c'est un seul concept ("riders de ton pays = bonus").

**Note :** Le changement est purement UI — la mécanique de calcul en backend reste la même (base × multiplier). On affiche juste les résultats pré-calculés au lieu de la formule.

---

## 7. Future Considerations

### 7.1 Sponsor Objectives (Hattrick-style) — à explorer plus tard

**Concept :** Chaque sponsor pourrait avoir un objectif par phase (ex: "2 riders GC top 10"). Si atteint → bonus supplémentaire. Si raté → rien (pas de pénalité pour garder ça simple).

**Status :** Le système de bonus actuel est déjà proche d'un objectif implicite (les bonus se déclenchent sur des résultats). La question est : faut-il ajouter un objectif EXPLICITE avec un reward séparé ? Ou est-ce que les bonus suffisent ?

**Decision :** À re-évaluer après implémentation du nouveau sponsor system. Le système de bonus par résultat EST déjà une forme d'objectif. Ajouter un layer supplémentaire risque de complexifier sans bénéfice clair.

### 7.2 Dilemme stratégique T5 (Visma vs Red Bull)

Le design actuel a déjà un excellent dilemme à T5 :

| Scénario | Visma | Red Bull |
|----------|-------|----------|
| Rider 2e du Tour (GC) | **75K** | 50K |
| Rider 4e du Tour (GC) | 25K | **50K** |
| Rider 3e Paris-Roubaix | **75K** | 50K |
| 3 riders top 5 classiques | 75K | **90K** |

**Visma = high risk / high reward (podiums prestige).** Red Bull = consistent (top 5 partout).

Ce dilemme est un point fort du design — à préserver et mettre en avant dans l'UI.

### 7.3 Mécaniques non retenues (et pourquoi)

| Mécanique | Pourquoi pas retenue |
|-----------|---------------------|
| **Dead money** (Ottoneu) | Pas de durée de contrat dans WH — le concept n'a pas de sens sans engagement temporel |
| **Salary escalation auto** (+$2/an) | WH escalade déjà naturellement via PCS points (si un rider performe mieux, son salaire min augmente) |
| **Vickrey auction** (2nd price) | Trop contre-intuitif pour un jeu casual ("j'ai gagné mais je paie moins ?") |
| **Revenue sharing** | Pas de mécanisme inter-joueurs dans WH — chaque joueur est indépendant |
| **Captain/Boost** designation | Les policies remplissent ce rôle (choix actif qui affecte les gains) |
| **Luxury tax** (soft cap) | Hard cap est plus simple et universel dans le fantasy |

---

## 8. Sources

### Football / Soccer Fantasy
- [FPL Price Changes — FPL Dashboard](https://fpl.page/article/how-fpl-price-changes-work-tool-predictor)
- [FPL Basics — Premier League](https://www.premierleague.com/en/news/2174907)
- [Sorare Guide — SorareCEO](https://sorareceo.com/what-is-sorare/)
- [MPG Rules — hplay.fr](https://www.hplay.fr/guide-mpg-mon-petit-gazon/)
- [UCL Fantasy Rules — UEFA](https://www.uefa.com/uefachampionsleague/news/025f-0fd4b42cc0a7-74498b7df63b-1000/)

### US Sports Fantasy
- [ESPN Salary Cap Draft — ESPN Support](https://support.espn.com/hc/en-us/articles/360000037931)
- [ESPN FAB — ESPN Support](https://support.espn.com/hc/en-us/articles/360000066231)
- [Yahoo FAAB — Yahoo Help](https://help.yahoo.com/kb/fantasy-basketball/faab-free-agent-acquisition-budgets-waivers-sln6118.html)
- [CBS FAB Process](https://help.baseball.cbssports.com/s/article/How-does-the-FAB-process-work)
- [DraftKings vs FanDuel — Fantasy Footballers](https://fantasyfootballers.org/featured/draftkings-vs-fanduel/)
- [FanDuel Salary Cap — RotoGrinders](https://rotogrinders.com/articles/behind-fanduel-s-salary-cap-956)

### Motorsport & Cycling Fantasy
- [F1 Fantasy Guide 2026 — Into the Chicane](https://intothechicane.com/2026/02/26/f1-fantasy-2026-the-complete-beginners-guide/)
- [F1 Fantasy Chips — Gridside](https://gridside.app/blog/guides/f1-fantasy-chip-strategy-2026)
- [Velogames Rules](https://www.velogames.com/sixes-classics/2026/rules.php)
- [Velogames — Cycling Weekly](https://www.cyclingweekly.com/news/trademark-tussles-scoring-systems-and-pricing-pogacar)
- [road.cc Fantasy Guide](https://road.cc/content/feature/85953)
- [Wielermanager — FanArena](https://fanarena.com/sporza-wielermanager-biggest-fantasy-cycling-game-world/)
- [MotoGP Fantasy Guidelines](https://fantasy.motogp.com/help/-game-guidelines)

### Auction & Bidding Mechanics
- [FAAB — Sleeper Support](https://support.sleeper.com/en/articles/1876040)
- [Salary Cap Drafts — ESPN](https://www.espn.com/fantasy/football/story/_/id/45710068)
- [Vickrey Auction — Wikipedia](https://en.wikipedia.org/wiki/Vickrey_auction)
- [Waiver Order — ESPN Support](https://support.espn.com/hc/en-us/articles/360000093771)

### Salary & Contract Systems
- [Ottoneu Rules — Fangraphs](https://ottoneu.fangraphs.com/rules)
- [Ottoneu Arbitration — RotoGraphs](https://fantasy.fangraphs.com/ottoneu-arbitrary-arbitration-salary-increases/)
- [Dynasty Salary Cap — League Tycoon](https://leaguetycoon.com/learn/salary-cap-dynasty/)
- [Contract Dynasty — League Tycoon](https://leaguetycoon.com/learn/contract-dynasty-league/)
- [Salary Inflation — FantasyPros](https://support.fantasypros.com/hc/en-us/articles/115001362928)
- [Pro Cycling Manager Guide — Cyanide Studio](https://web.cyanide-studio.com/games/cycling/2025/pcm/guide/?page=career-manage)

### Bankruptcy & Budget Management
- [Dynasty Dead Money — League Tycoon](https://leaguetycoon.com/learn/dynasty-dead-money/)
- [Hattrick Bankruptcy — Wiki](https://wiki.hattrick.org/wiki/Bankruptcy)
- [Hattrick Finances — Wiki](https://wiki.hattrick.org/wiki/Finances)
- [Ottoneu Cap Space — RotoGraphs](https://fantasy.fangraphs.com/ottoneu-101-navigating-ottoneu-cap-space/)

### Sponsors & Income Mechanics
- [FM Finances Guide — FM Stories](https://footballmanagerstory.com/fm-2020-guide-to-finances/)
- [Hattrick Sponsors — Wiki](https://wiki.hattrick.org/wiki/Sponsors)
- [Top Eleven Finances — Fandom](https://top-eleven.fandom.com/wiki/Finances)
- [Top Eleven Deconstruction — ARPU Brothers](https://arpubrothers.com/blog/deconstruction-of-top-eleven-football-manager/)
- [OSM Economics — OSM Tactics](https://www.osmtactic.com/tactics/economics-of-osm/)
- [Sorare Rewards — Help](https://help.sorare.com/hc/en-us/articles/4402879613969)
