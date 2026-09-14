# 02 — Ranking : retirer le level et la trésorerie

**What to build:** dans le classement d'une ligue, une ligne d'équipe n'affiche
plus ni son niveau ni son argent. Le niveau est constant à 8 en mode classic donc
il ne distingue personne, et la trésorerie n'a rien à faire dans un classement.
Restent le rang, l'emblème équipé, le nom d'équipe, le joueur et l'XP.

**Blocked by:** None — can start immediately.

**Status:** done

- [x] La ligne de classement n'affiche plus le niveau.
- [x] La ligne de classement n'affiche plus la trésorerie.
- [x] Le nom de l'achievement équipé, quand il y en a un, reste affiché.
- [x] Les tests existants de la page sont mis à jour, pas contournés.
- [x] Rien ne change sur l'onglet coureurs.

## Livré — 2026-09-14 (`26b0f75`)

Level et trésorerie retirés de l'affichage **et** du payload sérialisé (la page
ne les sélectionne plus en base). Le nom de l'achievement équipé reste, seul,
sur la ligne de sous-titre. Onglet coureurs intact.

Aucun test n'existait sur cette page : rien à mettre à jour, rien contourné.
