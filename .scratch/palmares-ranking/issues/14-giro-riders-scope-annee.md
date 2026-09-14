# 14 — Les preuves de propriété d'un maillot ne sont pas scopées à l'année

**What to build:** un maillot de grand tour ne se débloque que si le joueur
possédait le coureur **cette année-là**.

Aujourd'hui, `giroRiderIds` (page des emblèmes) rassemble tous les coureurs ayant
marqué de l'XP pour le joueur sur **n'importe quelle** étape de Giro, toutes
années confondues. Ces identifiants servent ensuite à interroger les classements
finaux d'une année précise. Posséder Giulio Ciccone au Giro 2025 suffirait donc à
décrocher son maillot 2026, sans jamais l'avoir eu dans son équipe cette
saison-là.

Le bug est **préexistant** : il ne vient pas de la suppression du transfert écrit
en dur. Mais celle-ci l'amplifie, puisque les preuves de propriété couvrent
désormais toutes les équipes du joueur au lieu d'une seule.

Il ne se manifeste pas encore : une seule édition de chaque grand tour existe en
base. Il se déclenchera à la première saison qui rejoue un grand tour déjà joué.

**Blocked by:** None.

**Status:** ready-for-agent

- [ ] La preuve de propriété est appariée à l'année du classement interrogé.
- [ ] Le même traitement est appliqué au bloc GC, qui a la même faiblesse.
- [ ] Un test couvre le cas qui échoue aujourd'hui : coureur possédé en année N,
      maillot gagné par ce coureur en année N+1, aucun badge attendu.
- [ ] Les badges actuellement débloqués des joueurs sont relevés avant et après.
      Zéro écart attendu, puisque aucune année ne se répète encore.
