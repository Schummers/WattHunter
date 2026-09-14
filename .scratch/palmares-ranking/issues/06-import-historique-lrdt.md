# 06 — Table de palmarès historique et import de La Route du Tour

**What to build:** l'historique du groupe de 2017 à 2025 entre en base et devient
interrogeable. Après ce ticket, une requête répond à « qui a gagné le Giro 2023 »,
« quel était le podium de la Vuelta 2025 » et « combien de Tours a gagné tel
joueur », pour les neuf saisons jouées avant WattHunter.

Les données vivent dans une **table dédiée**, jamais sous forme de fausses ligues
ou de fausses équipes. Elles portent le rang d'origine, le nom d'équipe de
l'époque, les points bruts par catégorie, et un lien vers le compte WattHunter du
joueur quand il existe.

Source : `research/laroutedutour/rankings.csv`. Règles d'import dans le README de
ce dossier et dans le PRD : courses d'une semaine exclues (24 épreuves retenues
sur 30), identités fusionnées, aucune conversion des points en XP.

**Blocked by:** 01 — Entité saison et rattachement des ligues.

**Status:** ready-for-agent

- [ ] Une table dédiée accueille un résultat par équipe et par épreuve, avec son
      rang d'origine et ses points bruts par catégorie.
- [ ] Les 24 épreuves retenues sont importées, les courses d'une semaine exclues.
- [ ] Chaque ligne porte sa saison, son type d'épreuve et le nom d'origine du tour.
- [ ] Le mapping vers les comptes WattHunter est appliqué, identités fusionnées
      comprises.
- [ ] Les trois joueurs sans compte sont importés avec leur pseudo d'époque et un
      marqueur d'ancien joueur.
- [ ] L'import est idempotent : le relancer ne crée aucun doublon.
- [ ] Les agrégats calculés depuis la base concordent avec
      `research/laroutedutour/palmares_stats.py` : 6 victoires pour David
      Choncoutié, 5 pour Peejee, 3 titres de saison pour Klimax, 15 maillots pour
      Peejee.
