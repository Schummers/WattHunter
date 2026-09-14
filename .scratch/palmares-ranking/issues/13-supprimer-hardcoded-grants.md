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

**Status:** done

- [x] La grille d'achievements agrège les ligues de la saison, par joueur.
- [x] `HARDCODED_GRANTS` et son `unlockedSlugs.push(...)` sont supprimés.
- [x] Les slugs débloqués des trois équipes concernées (Klimax, Leopard_Trek,
      Dixon Hormous) sont relevés avant et après, et l'écart est consigné dans le
      ticket. Zéro écart attendu.
- [x] Aucun UUID d'équipe ne subsiste en dur dans le code de la page.

## Livré — 2026-09-15

`HARDCODED_GRANTS` et son `unlockedSlugs.push(...)` sont supprimés. Plus aucun
UUID d'équipe en dur dans la page. La grille lit désormais **toutes les équipes
du joueur dans les ligues de la saison** (hors démo, hors `pending`), et les
classements Monument Man / Classic Man comparent des **joueurs**, plus des
équipes : quelqu'un qui tient une équipe dans chaque ligue se battait contre
lui-même, son XP coupé en deux.

### Avant / après, mesuré en prod

| Joueur | Badges accordés à la main | Retrouvés par le calcul |
|---|---|---|
| Klimax | flandres-top10, giro-gc-podium, lbl-top10, paris-roubaix-top10 | **les 4** |
| Jonathan Schummers | flandres-top10, giro-gc-podium, paris-roubaix-podium, paris-roubaix-top10 | **les 4** |
| Dixon Hormous | giro-kom-victory | **le 1** |

**Zéro écart.** Les neuf attributions manuelles reviennent du calcul réel.

### Le hardcode cachait deux bugs, pas un

Le ticket supposait que le seul problème était le seed V2 qui n'avait pas cloné
`rider_xp_daily`. En mesurant, deux autres causes sont apparues, et sans elles
la suppression aurait fait disparaître des badges en silence.

**1. Le gate de complétion verrouillait tout le Giro.** `completedGrandTourYears`
exige la présence de l'étape 21 dans `gt_daily_classifications`. Or le Giro 2026
s'y arrête à l'**étape 20** (le Tour et la Vuelta vont bien à 21). Aucune année
de Giro n'était donc jamais « complète », et **aucun badge Giro ne pouvait se
débloquer**, ni GC ni maillot.

Corrigé en ajoutant un second porteur au signal A : la présence d'un classement
final. Un classement final n'existe qu'une fois la course terminée, donc le
garde-fou n'est pas affaibli — il cesse seulement de dépendre d'une étape qui
n'a jamais été importée. Le signal B (GC scoré) reste exigé, et trois tests le
verrouillent.

**2. Le bloc 4 interrogeait une table vide.** Il cherchait les maillots du Giro
dans `gt_daily_classifications` à l'étape 21, alors que la Spec C a déplacé les
finales dans `gt_final_classifications`. C'est le gotcha déjà noté dans la
mémoire projet (`palmares_v1_v2_hardcode`). Le maillot KOM de Dixon Hormous
(Giulio Ciccone) était légitime depuis le début, simplement cherché au mauvais
endroit.

### Une erreur d'étiquette au passage

Le commentaire du code annonçait l'équipe `…c1a551c00002` comme « Leopard_Trek ».
Elle appartient en réalité à **Jonathan Schummers**. Personne ne pouvait le voir :
c'est précisément ce que coûte un tableau indexé par UUID.
