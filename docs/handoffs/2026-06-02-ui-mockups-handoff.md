# Handoff — UI Mockups (transverse Spec B + C)

> Lire d'abord : `docs/handoffs/2026-06-02-refonte-equilibrage-index.md`. **CLAUDE.md Rule #1 : lire `docs/watthunter-design-system-v3.md` AVANT toute maquette/dev front.**

## ✅ FAIT & VALIDÉ (2026-06-02) — maquette : [`docs/mockups/2026-06-02-ui-mockups.html`](../mockups/2026-06-02-ui-mockups.html)

Les 2 affichages ont été maquettés (HTML, DS v3) et **validés par l'utilisateur**. Décisions reportées dans les specs (source de vérité) : **Spec C §C4** (sponsor card) et **Spec B §B2bis** (prix underdog).

**Récap des décisions verrouillées :**
- **Sponsor card** : ancrée sur le composant prod réel `sponsor-bonus-card.tsx` (header + chevron + tags rôle + radio marketplace + footer nationalité). 2 colonnes `A`/`B` (A = 1-sem/one-day, B = GT/Monument ×2), montants colonne A en `--text-mid`, en-têtes A/B sur la ligne du bloc, libellé "Top N" littéral, légende nat→A→B, nationalité ×1.20.
- **Prix underdog** : pas de puce, prix plein barré + réduit en layout **"right" partout**, format **"K"**, composant partagé `<RiderPrice>`. Dépend du **spec "prix au millier"** (à rédiger — voir index).

> Le périmètre ci-dessous est conservé pour traçabilité (intention initiale). L'implémentation suit désormais les specs B/C mis à jour.

## But initial : maquettes HTML pour valider 2 affichages avant implémentation

### 1. Sponsor bonus card — 2 colonnes (Spec C)

Le composant `apps/web/components/sponsor-bonus-details.tsx` (aujourd'hui 1 colonne, + variante prestige T5/T6) → **généraliser en 2 colonnes pour tous** : gauche = course d'une semaine / one-day, droite = **GT / Monument (×2)**. T1-T3 = bloc BASE BONUS seul ; T4+ = + blocs GOALS par archétype (chips d'archétype en tête). Wireframe validé dans le spec C section C4.

Données exemple : voir Spec C (T4 Decathlon : GC 10k/20k, podium 5k/10k, one-day 10k/20k ; goals GC podium 30/60, top5 20/40, leader 15/30, jeune 10/20 ; goals Sprint 30/60, 20/40, 10/20, 10/20).

### 2. Prix réduit underdog — strikethrough (Spec B)

Afficher **prix plein barré + prix réduit (−50%)** UNIQUEMENT sur les **prix d'acquisition** d'un coureur underdog (rk>100) quand l'équipe qui regarde est éligible. PAS sur les montants déjà payés/engagés.

**Sites concernés (prix d'acquisition / min salaire)** :
- `auction/[auctionId]/rider-table.tsx:140` (colonne Salary)
- `auction/[auctionId]/rider-dialog.tsx:140,203` (Minimum salary)
- `rider/[riderId]/rider-detail-client.tsx:232` (box "Min. Salary")
- `components/draft-bid-card.tsx:234` (helper min)
- `auction/market/market-client.tsx:361,385` (placeholder + helper)

**Sites à NE PAS toucher** (montant réel déjà) : salaire locked/payé, enchères placées, results, history, treasury/budget. NB : `auction/status/page.tsx:240` a déjà un pattern barré (budget) réutilisable.

**Pas de composant de prix partagé** aujourd'hui (3 helpers : `formatEuro`, `formatThousands`, `toLocaleString` ; `lib/format.ts`, `lib/sponsors.ts`). → créer `<RiderPrice>` (source unique) et migrer les ~6 sites.

**3 options visuelles à maquetter :**
- **A — Inline** (tables) : ~~155 000 €~~ **77 500 €** + puce `−50%`.
- **B — Empilé** (fiche coureur) : gros prix réduit + dessous `~~155 000 €~~` + tag `Underdog −50%`.
- **C — Badge + tooltip** : prix réduit + badge `−50%`, plein au survol.
- Reco : composant `<RiderPrice>` rendant A en table/modal, B en fiche. Puce = pattern Tag (radius 20px). Plein barré en `--text-low`, réduit en `--text-high`/accent. À trancher avec maquette.

## Prompt à coller dans la nouvelle discussion

```
On fait des maquettes HTML pour 2 affichages de la refonte équilibrage WattHunter, à valider avant implémentation.
Lis d'abord, sans relire d'anciennes conversations :
- docs/watthunter-design-system-v3.md (Rule #1 — obligatoire)
- docs/handoffs/2026-06-02-refonte-equilibrage-index.md
- docs/handoffs/2026-06-02-ui-mockups-handoff.md
Produis des maquettes HTML stylées au design system v3 (Sky Blue Night, Geist Mono pour les nombres) pour : (1) la sponsor bonus card en 2 colonnes (1-sem | GT/Monument), (2) les 3 options A/B/C d'affichage du prix réduit underdog (barré + réduit). Je choisis, puis on planifie l'implémentation (composant partagé <RiderPrice> + généralisation de sponsor-bonus-details.tsx).
```
