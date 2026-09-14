# 13 — Supprimer le transfert de palmarès V1→V2 écrit en dur

**What to build:** la page des emblèmes lit les achievements débloqués sur toutes
les ligues de la saison du joueur, et le tableau `HARDCODED_GRANTS` de
`apps/web/app/(game)/league/[leagueId]/achievements/page.tsx` disparaît.

Ce contournement existe parce que le seed de la ligue classic V2 n'a pas cloné
`rider_xp_daily` : le palmarès gagné en V1 (Classiques, Giro) n'était visible
nulle part en V2, et trois équipes ont reçu leurs badges à la main, par UUID.
L'entité saison du ticket 01 donne la vraie réponse : V1 et V2 pointent vers la
même saison 2026, la grille se calcule par joueur sur les deux ligues.

Le risque à la suppression est silencieux : un badge qui disparaît d'un profil ne
lève aucune erreur. D'où le critère de comparaison avant/après.

**Blocked by:** 01 — Entité saison.

**Status:** ready-for-agent

- [ ] La grille d'achievements agrège les ligues de la saison, par joueur.
- [ ] `HARDCODED_GRANTS` et son `unlockedSlugs.push(...)` sont supprimés.
- [ ] Les slugs débloqués des trois équipes concernées (Klimax, Leopard_Trek,
      Dixon Hormous) sont relevés avant et après, et l'écart est consigné dans le
      ticket. Zéro écart attendu.
- [ ] Aucun UUID d'équipe ne subsiste en dur dans le code de la page.
