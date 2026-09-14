# 04 — Corriger l'achievement Classic Man

**What to build:** l'achievement « Classic Man » récompense le plus gros cumul
d'XP sur les classiques. Il compte aujourd'hui Paris-Nice et Tirreno-Adriatico,
qui sont des courses par étapes, donc il ne récompense pas ce qu'il annonce.

Après ce ticket, il consomme le helper de courses d'un jour du ticket 03 et ne
compte plus que de vraies courses d'un jour.

**Blocked by:** 03 — Quatre groupes d'épreuve dans Ranking.

**Status:** ready-for-agent

- [ ] La liste de slugs écrite à la main disparaît au profit du helper partagé.
- [ ] Paris-Nice et Tirreno-Adriatico ne comptent plus dans Classic Man.
- [ ] Le détenteur de l'achievement est recalculé et la valeur avant/après est
      consignée dans le ticket, même si elle ne change pas.
- [ ] Un test verrouille le fait qu'une course par étapes n'entre pas dans le
      calcul.
