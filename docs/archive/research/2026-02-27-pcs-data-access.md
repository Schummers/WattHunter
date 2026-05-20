# Accès aux données ProCyclingStats — Recherche & Décision

**Date:** 27 février 2026
**Auteur:** Session de recherche WattHunter
**Statut:** Décision prise

---

## Contexte

WattHunter a besoin d'accéder aux données de procyclingstats.com (profils coureurs, rosters équipes, résultats courses, classements) pour alimenter le jeu de fantasy cycling. Le cœur du système repose sur cette connexion.

---

## Problème identifié

procyclingstats.com est derrière une protection Cloudflare bot (HTTP 403 pour les requêtes programmatiques). La librairie Python `procyclingstats` (v0.2.7) peut parser le HTML mais ne peut pas fetcher les pages elle-même.

---

## Solutions étudiées

### 1. Librairies Python existantes

#### procyclingstats (themm1)

- **GitHub:** https://github.com/themm1/procyclingstats
- 92 stars, 35 forks, v0.2.7 (septembre 2025)
- Fonctionne comme parser HTML, pas comme fetcher
- Classes disponibles: `Team`, `Rider`, `Race`, `Ranking`
- Champs `Team.riders()`: `rider_name`, `rider_url`, `nationality`, `age`, `career_points`, `ranking_points`, `ranking_position`
- Méthodes `Rider`: `.name()`, `.nationality()`, `.birthdate()`, `.points_per_speciality()`, `.season_results()`, `.image_url()`
- Accepte du HTML pré-fetché: `Team("url", html=html_str, update_html=False)`
- **Verdict:** Bon parser, mais ne résout pas le problème Cloudflare

#### pcs-scraper

- **PyPI:** https://pypi.org/project/pcs-scraper/
- Dernière mise à jour: mars 2023, v0.2.0, alpha
- Même problème Cloudflare
- **Verdict:** Abandonné, inutilisable

#### FirstCyclingAPI (baronet2)

- **GitHub:** https://github.com/baronet2/FirstCyclingAPI
- 33 stars, MIT license
- Retourne des DataFrames pandas
- **PROBLÈME:** FirstCycling.com est AUSSI derrière Cloudflare depuis septembre 2025 (Issue #33)
- Pas sur PyPI (installation depuis GitHub uniquement)
- Pas de support team rosters (`team.php` pas implémenté)
- Mainteneur à capacité limitée
- **Verdict:** Même problème que PCS, en plus incomplet

---

### 2. Sources de données alternatives

#### FirstCycling.com

- Aussi derrière Cloudflare depuis septembre 2025
- Lib Python existante mais cassée
- **Verdict:** Pas une alternative viable

#### UCI (uci.org)

- Classements officiels, résultats
- Pas d'API publique, pages JS-rendered
- **Verdict:** Difficile à exploiter

#### CQ Ranking (cqranking.com)

- Base de données historique
- Pas d'API
- **Verdict:** Pas adapté

---

### 3. APIs commerciales cycling

#### Sportradar Cycling API

- **URL:** https://developer.sportradar.com/more-sports/reference/cycling-overview
- Couverture: UCI World Tour, Grand Tours
- Endpoints: Competitor Profile, Rankings, Stage Summary
- **Prix: 500–1000€+/mois**
- **Verdict:** Fiable mais trop cher pour l'alpha

#### DataSportsGroup (DSG)

- **URL:** https://datasportsgroup.com/coverage/cycling/
- 242 compétitions, 4800+ coureurs, 217 équipes
- Live tracking, JSON/XML feeds
- Prix: custom (probablement cher)
- **Verdict:** Le plus complet, mais enterprise pricing

#### SportBex

- **URL:** https://sportbex.com/cycling-api/
- Grand Tours, one-day races, live updates
- Prix: custom, positionné "cost-effective"
- **Verdict:** À explorer si WattHunter génère du revenu

---

### 4. Outils de scraping généralistes

#### Tavily

- **URL:** https://docs.tavily.com
- API de recherche optimisée LLMs + Extract endpoint
- Extract: passe des URLs, renvoie markdown/texte
- **Aucune mention de bypass Cloudflare**
- Prix: 1000 crédits gratuits/mois, Extract = 1 crédit / 5 URLs
- **Verdict:** Pas conçu pour le scraping de sites protégés

#### Firecrawl

- **URL:** https://docs.firecrawl.dev
- Scraping web vers markdown/JSON structuré, open source, self-hostable
- Feature intéressante: extraction structurée avec JSON Schema
- **MAIS: échoue sur 5/6 sites Cloudflare** en tests indépendants
- Issue #2257 ouverte: fingerprint Playwright détecté
- Prix: 500 crédits gratuits (one-time), puis $16+/mois
- **Verdict:** Anti-bot insuffisant pour PCS

#### ScrapFly

- **URL:** https://scrapfly.io
- 98% success rate sur sites anti-bot
- Markdown output, bonne documentation
- **Prix: ~30€/mois**
- **Verdict:** Bonne option fallback

#### ScraperAPI

- **URL:** https://www.scraperapi.com
- 99.99% success rate Cloudflare (claim)
- **Prix: $49/mois (100K crédits)**
- **Verdict:** Le plus axé anti-bot

#### Scrape.do

- **URL:** https://scrape.do
- 98.19% success rate
- **Prix: ~30€/mois**
- **Verdict:** Simple, efficace, bonne alternative

#### FlareSolverr

- **GitHub:** https://github.com/FlareSolverr/FlareSolverr
- Open source, Docker, Selenium + undetected-chromedriver
- Résout les challenges JS, extrait cookies
- Success rate en baisse contre Cloudflare moderne
- **Verdict:** Gratuit mais fiabilité basse-moyenne en 2026

---

### 5. Approche headless browser (Playwright)

- Playwright avec stealth patches
- Success rate élevé pour les challenges JS
- Gratuit (coût infra uniquement)
- Complexité: déploiement, ressources serveur
- **Verdict:** Meilleure option gratuite pour batch/cron

---

### 6. Comment font les autres fantasy leagues ?

#### Velogames (30K joueurs)

- Un seul développeur
- Probablement semi-manuel + scraping
- Source: https://www.cyclingweekly.com/news/trademark-tussles-scoring-systems-and-pricing-pogacar-how-one-built-a-30-000-player-fantasy-cycling-game

#### Sporza Wielermanager (le plus gros au monde)

- Construit par FanArena
- Utilise des data providers commerciaux (Stats Perform/Gracenote)
- Source: https://fanarena.com/clients/sporza/

#### Velon Fantasy

- Données propriétaires (capteurs sur les vélos des coureurs)
- Source: https://www.velon.cc/how-it-works

#### Road.cc Fantasy

- End of life — maintenant subscriber-only
- Source probablement semi-manuelle

---

### 7. Datasets ouverts

#### Kaggle UCI Pro Road Cycling

- **URL:** https://www.kaggle.com/datasets/fewinder/uci-pro-road-cycling-dataset
- Dernière MAJ: juin 2019 — **7 ans obsolète**
- **Verdict:** Inutilisable pour données courantes

---

## Tableau comparatif final

| Option | Cloudflare bypass | Coût | Fiabilité | Couverture données | Verdict |
|---|---|---|---|---|---|
| PCS + Playwright | Oui (headless) | Gratuit | Moyenne | Très haute | ✅ Alpha |
| PCS + ScrapFly/Scrape.do | Oui (API) | ~30€/mois | Haute | Très haute | ✅ Fallback |
| PCS + ScraperAPI | Oui (API) | $49/mois | Très haute | Très haute | Option |
| FlareSolverr | Partiel | Gratuit | Basse-moyenne | Très haute | ❌ |
| Firecrawl | Non (17% success) | $16+/mois | Basse | Très haute | ❌ |
| Tavily | Non | Gratuit | N/A | N/A | ❌ |
| FirstCycling | Même problème CF | Gratuit | Basse | Haute | ❌ |
| Sportradar API | N/A | 500€+/mois | Très haute | Moyenne | Trop cher |
| DSG API | N/A | Custom | Très haute | Très haute | Trop cher |

---

## Décision prise (27 février 2026)

**Architecture retenue: PCS + Playwright (alpha) avec ScrapFly comme fallback**

### Pourquoi cette décision

1. Playwright est gratuit et déjà implémenté dans notre service FastAPI
2. Pour un cron job 1–2x/jour, le headless browser est suffisant
3. La librairie `procyclingstats` v0.2.7 est un excellent parser — on lui passe le HTML fetché par Playwright
4. Si Cloudflare renforce sa protection et casse Playwright, on bascule sur ScrapFly (~30€/mois) sans changer le reste du code
5. L'abstraction data source dans `sync.py` permet de switcher facilement

### Architecture technique

```
Playwright (fetch HTML) → procyclingstats (parse) → Supabase (stockage)
     ↓ fallback si cassé
ScrapFly API (fetch HTML) → procyclingstats (parse) → Supabase (stockage)
```

### Pour le futur (post-alpha, si revenu)

- Évaluer SportBex ou DataSportsGroup pour un feed API structuré
- Éliminer complètement la dépendance au scraping

---

## Sources

- [procyclingstats (themm1) — GitHub](https://github.com/themm1/procyclingstats)
- [pcs-scraper — PyPI](https://pypi.org/project/pcs-scraper/)
- [FirstCyclingAPI (baronet2) — GitHub](https://github.com/baronet2/FirstCyclingAPI)
- [Sportradar Cycling API](https://developer.sportradar.com/more-sports/reference/cycling-overview)
- [DataSportsGroup — Cycling Coverage](https://datasportsgroup.com/coverage/cycling/)
- [SportBex — Cycling API](https://sportbex.com/cycling-api/)
- [Tavily — Documentation](https://docs.tavily.com)
- [Firecrawl — Documentation](https://docs.firecrawl.dev)
- [ScrapFly](https://scrapfly.io)
- [ScraperAPI](https://www.scraperapi.com)
- [Scrape.do](https://scrape.do)
- [FlareSolverr — GitHub](https://github.com/FlareSolverr/FlareSolverr)
- [Kaggle UCI Pro Road Cycling Dataset](https://www.kaggle.com/datasets/fewinder/uci-pro-road-cycling-dataset)
- [Velogames — CyclingWeekly article](https://www.cyclingweekly.com/news/trademark-tussles-scoring-systems-and-pricing-pogacar-how-one-built-a-30-000-player-fantasy-cycling-game)
- [Sporza Wielermanager — FanArena](https://fanarena.com/clients/sporza/)
- [Velon Fantasy — How it works](https://www.velon.cc/how-it-works)
