# 07 — Déplacer la page des emblèmes dans les réglages

**What to build:** la page actuelle d'achievements, badges et bannières quitte
l'emplacement Palmares de la navigation. Elle devient accessible depuis un bouton
dans les réglages, et l'emplacement Palmares se libère pour la nouvelle page.

Rien n'est jeté ni réécrit : l'interface existe et fonctionne, elle change
d'adresse. Les liens entrants existants continuent de fonctionner ou redirigent.

**Blocked by:** None — can start immediately.

**Status:** done

- [x] Un bouton dans les réglages ouvre la page des emblèmes.
- [x] L'entrée Palmares de la navigation ne pointe plus vers cette page.
- [x] Les liens existants vers l'ancienne adresse ne cassent pas.
- [x] Le libellé du bouton est en anglais.
- [x] Aucune fonctionnalité de la page n'est perdue.

## Livré — 2026-09-14 (`4d29a09`)

La route ne bouge pas (`/league/[id]/achievements`) : c'est la façon la plus sûre
de tenir « les liens existants ne cassent pas », sans redirection à maintenir.
Ce qui bouge, c'est l'accès : entrée Palmares retirée de la sidebar et de la
bottom nav, bouton « Emblems, badges & banners → » dans la section League des
réglages.

Le titre de la page passe de « Palmares » à « Emblems », pour rendre le nom à la
future page.
