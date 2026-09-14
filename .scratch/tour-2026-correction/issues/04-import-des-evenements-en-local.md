# 04 — Import des côtes et sprints intermédiaires en local, depuis le cache

**What to build:** en local, `stage_event_results` contient les événements des 21
étapes du Tour, parsés depuis les pages déjà en cache, sans aucune requête vers
PCS, pour que le rescore puisse compter les côtes HC / cat.1 et les sprints
intermédiaires comme il le fait sur la Vuelta.

**Blocked by:** 01, 02 (parallèle au 03).

**Status:** ready-for-agent

- [ ] Import via la fonction de prod d'événements (parse du HTML d'étape), page par page, zéro requête HTTP ; toute page absente du cache fait échouer
- [ ] Comptage retrouvé à l'identique : **68 côtes** dont **19 HC / cat.1**, **19 sprints intermédiaires**, réparties comme dans le diagnostic (étape 1 et étape 16 sans sprint)
- [ ] XP d'événements distribuable, hors multiplicateur de rôle, recalculé depuis la table : **779**, dont **602** sur des coureurs qui scoraient pour une équipe de la V2
- [ ] Le garde-fou anti-silence du scoring (étape p4/p5 sans ligne KOM) ne lève plus sur aucune des 8 étapes de montagne du Tour, vérifié par un appel à blanc
- [ ] Coureurs hors pool ignorés et comptés, comme en prod ; le compte est dans le ticket
- [ ] Le baseline prod du 02 confirme que `stage_event_results` était vide pour le Tour avant ce ticket
