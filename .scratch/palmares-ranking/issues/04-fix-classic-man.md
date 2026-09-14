# 04 — Corriger l'achievement Classic Man

**What to build:** l'achievement « Classic Man » récompense le plus gros cumul
d'XP sur les classiques. Il compte aujourd'hui Paris-Nice et Tirreno-Adriatico,
qui sont des courses par étapes, donc il ne récompense pas ce qu'il annonce.

Après ce ticket, il consomme le helper de courses d'un jour du ticket 03 et ne
compte plus que de vraies courses d'un jour.

**Blocked by:** 03 — Quatre groupes d'épreuve dans Ranking.

**Status:** done

- [x] La liste de slugs écrite à la main disparaît au profit du helper partagé.
- [x] Paris-Nice et Tirreno-Adriatico ne comptent plus dans Classic Man.
- [x] Le détenteur de l'achievement est recalculé et la valeur avant/après est
      consignée dans le ticket, même si elle ne change pas.
- [x] Un test verrouille le fait qu'une course par étapes n'entre pas dans le
      calcul.

## Livré — 2026-09-14

`ONE_DAY_WT_PATTERNS` n'est plus une liste écrite à la main : `oneDayRaceSlugPatterns()`
la dérive du calendrier World Tour (`type: "one-day"`), année-agnostique. Un test
parcourt chaque motif produit et vérifie qu'aucun n'est une course par étapes.

### Détenteur avant / après, mesuré en prod (lecture seule)

| Ligue | Ancien barème (top 3) | Nouveau barème (top 3) | Détenteur |
|---|---|---|---|
| Classiques de l'individualisme | Leopard_Trek 671.6, Klimax 425.3, Peejee 371.6 | Leopard_Trek 727.2, Klimax 435.3, Peejee 376.8 | **inchangé** |
| WattHunter Demo League | Flamme Rouge 671.6, Les Grimpeurs 425.4, Cinq Etoiles 371.6 | Flamme Rouge 727.2, Les Grimpeurs 435.4, Cinq Etoiles 376.8 | **inchangé** |

Le détenteur ne bouge pas, les totaux si (+55.6 XP sur le leader). Deux effets
opposés qui ne s'annulent pas :

- **Retiré** : Paris-Nice et Tirreno-Adriatico, les deux courses par étapes que le
  ticket visait.
- **Ajouté** : onze classiques que la liste manuelle ignorait — Omloop Het
  Nieuwsblad, Brugge-De Panne, Eschborn-Frankfurt, San Sebastian,
  Cyclassics Hamburg, Bretagne Classic, GP Québec, GP Montréal, Great Ocean Road,
  Copenhagen Sprint, et **E3 Harelbeke**, que la liste cherchait sous le mauvais
  slug (`e3-saxo-bank-classic`, qui n'existe pas dans le calendrier).

La liste manuelle était donc fausse dans les deux sens, pas seulement sur les
deux courses d'une semaine.
