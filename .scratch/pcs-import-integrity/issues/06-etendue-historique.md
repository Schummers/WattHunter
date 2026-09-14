# 06 — Mesurer l'étendue du problème sur le Giro et le Tour 2026

Status: `needs-info`
Created: 2026-09-14
Bloqué par: `01-tester-origine-decalage.md`

## Problème

Le décalage a été mesuré sur la Vuelta 2026 uniquement. Le Giro 2026 et le Tour
2026 ont été importés par le même pipeline, sur la même source, et clôturés avec
des vérifications qui ne pouvaient pas détecter ce type d'erreur. Leur justesse
est inconnue, pas établie.

Le Tour 2026 a été déclaré « 0 écart sur 1380 lignes » le 2026-07-26. Cette
affirmation reste vraie sur ce qu'elle mesurait — la conformité de l'XP au barème
— et ne dit rien de la conformité des rangs à la réalité de la course.

## Travail

Dépend du verdict du ticket 01. Si H1 (HTML altéré), l'ancienneté du comportement
détermine la période contaminée — chercher quand PCS a durci ses contre-mesures,
en recoupant avec l'historique des blocages Cloudflare déjà documentés
(nodriver KO Chrome 151, injections manuelles du cutover Giro).

Sinon : échantillonner trois étapes par Grand Tour avec le harnais du ticket 02 et
une source externe, et extrapoler.

## Attention

Le Giro 2026 a déjà connu une injection manuelle depuis captures d'écran lors du
cutover du 2026-06-03, Cloudflare ayant bloqué le scraper. Ces données-là sont
probablement plus fiables que les données scrapées, pas moins. À distinguer dans
l'échantillonnage.

## Comments
