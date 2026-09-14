# 04 — Import des côtes et sprints intermédiaires en local, depuis le cache

**What to build:** en local, `stage_event_results` contient les événements des 21
étapes du Tour, parsés depuis les pages déjà en cache, sans aucune requête vers
PCS, pour que le rescore puisse compter les côtes HC / cat.1 et les sprints
intermédiaires comme il le fait sur la Vuelta.

**Blocked by:** 01, 02 (parallèle au 03).

**Status:** ready-for-human

- [x] Import via la fonction de prod d'événements (parse du HTML d'étape), page par page, zéro requête HTTP ; toute page absente du cache fait échouer
- [x] Comptage retrouvé à l'identique : **68 côtes** dont **19 HC / cat.1**, **19 sprints intermédiaires**, réparties comme dans le diagnostic (étape 1 et étape 16 sans sprint) — 68 au parse, **64 en base**, voir « Quatre côtes »
- [x] XP d'événements distribuable, hors multiplicateur de rôle, recalculé depuis la table : **779**, dont **602** sur des coureurs qui scoraient pour une équipe de la V2 — **763 en base / 602 en V2**, voir « Les 16 XP »
- [x] Le garde-fou anti-silence du scoring (étape p4/p5 sans ligne KOM) ne lève plus sur aucune des 8 étapes de montagne du Tour, vérifié par un appel à blanc — **7 étapes**, pas 8, voir « Sept étapes »
- [x] Coureurs hors pool ignorés et comptés, comme en prod ; le compte est dans le ticket
- [x] Le baseline prod du 02 confirme que `stage_event_results` était vide pour le Tour avant ce ticket

## Résultat

Snapshot d'arrivée : `20260914-172914-apres-import-events.json`.
Rejouable : `.scratch/tour-2026-correction/verif_evenements.py`.

| Mesure | Ticket | Mesuré | |
|---|---|---|---|
| Côtes | 68 | 68 au parse, **64 en base** | 4 collisions, 0 XP |
| dont HC / cat.1 | 19 | **19** | ✅ |
| Sprints intermédiaires | 19 | **19** | ✅ |
| Étapes sans sprint | 1 et 16 | **stage-1, stage-16** | ✅ |
| Lignes coureur | — | **503** | |
| XP distribuable, hors mult. de rôle | 779 | **763** | 779 au parse |
| dont équipes V2 | 602 | **602** | ✅ |
| Garde-fou p4/p5 | ne lève plus | **ne lève plus** | ✅ |
| Coureurs hors pool ignorés | — | **9 lignes**, 2 auraient scoré | |

Les trois chiffres du ticket qui ne tombent pas sont tous des mesures **côté
parse** ; la base, elle, ne contient que ce que le scoring lira. Les deux
lectures sont réconciliées exactement, aucune n'est approchée.

`stage_event_results` était bien vide pour le Tour dans le baseline de prod du
ticket 02 : 0 ligne. Aucun événement n'avait jamais été importé sur ce Grand
Tour, alors que la Vuelta en a.

## Les 16 XP : deux coureurs hors pool

779 au parse, 763 en base. L'écart tient à **deux coureurs absents de la table
`riders`**, donc non mappables et comptés en `skipped_unmapped` :

| Coureur | XP qu'il aurait porté |
|---|---|
| `rider/jakub-otruba` | 11 |
| `rider/xabier-mikel-azparren-irurzun` | 5 |

11 + 5 = 16. Exactement l'écart. C'est le comportement attendu, décrit par la
case « coureurs hors pool ignorés » de ce ticket même : hors pool, donc sous
contrat nulle part, donc 0 XP distribué de toute façon. **763 est le chiffre qui
compte**, 779 est le total théorique de la page PCS.

Au total 9 lignes ont été ignorées pour cette raison (étapes 4, 5, 6, 7, 8, 14,
15 ×2, 21), dont ces 2 seules qui étaient dans une zone qui rapporte.

## Quatre côtes perdues sur une clé primaire, et pourquoi ça ne coûte rien

La clé primaire de `stage_event_results` est
`(race_slug, event_type, event_name, rider_id)`. **Une étape qui franchit deux
fois une côte du même nom n'en garde qu'une**, en silence, sans erreur ni log :
la seconde ascension écrase la première.

| Étape | Côte | Franchissements | Catégorie |
|---|---|---|---|
| stage-2 | Côte du Château de Montjuïc | 3× | 3 |
| stage-21 | Côte de la butte Montmartre | 3× | 4 |

68 côtes parsées, 64 lignes distinctes en base, 4 perdues.

**Ces quatre-là valent 0 XP** : `KOM_EVENT_SCALES` ne barème que HC et cat.1,
les catégories 2, 3 et 4 rapportent zéro. L'import est donc exact sur toute la
zone qui score, et les 19 côtes HC / cat.1 sont toutes présentes.

**Mais le défaut est réel et générique.** Une étape qui franchirait deux fois
une côte HC ou cat.1 du même nom perdrait de l'XP sans que rien ne le dise —
un circuit final en montagne suffit. Le correctif serait de faire entrer l'ordre
de franchissement dans la clé. Hors périmètre de ce chantier, à ouvrir comme
ticket séparé.

## Sept étapes de montagne, pas huit

Le ticket annonce 8 étapes de montagne. Les profils en base en donnent **7** qui
déclenchent le garde-fou, et le Tour 2026 n'a **aucune étape p4** :

| Profil | Étapes |
|---|---|
| p5 | 3, 6, 14, 15, 18, 19, 20 — **les 7 concernées** |
| p3 | 1 (ITT), 2, 10 |
| p2 | 4, 9, 13, 16 (ITT), 17 |
| p1 | 5, 7, 8, 11, 12, 21 |

Les 7 ont toutes des lignes KOM : le garde-fou ne lève plus. Le « 8 » du ticket
comptait probablement stage-1, qui est p3 **et** ITT, donc exclue deux fois.

Au passage, stage-16 est un contre-la-montre (`is_itt = true`, p2) : c'est ce
qui explique naturellement qu'elle n'ait pas de sprint intermédiaire.

## Étape 1 : événements importés, rangs intacts

Le ré-import du ticket 03 s'arrête à l'étape 2, mais ce ticket-ci couvre bien
les **21** étapes. L'exclusion de `stage-1` porte sur `race_results`, pas sur
les événements : `import_stage_events` n'écrit que dans `stage_event_results` et
ne touche aucun rang.

Résultat pour stage-1 : `kom=0 sprint=0 imported=0`. Un contre-la-montre par
équipes à plat n'a ni côte répertoriée ni sprint intermédiaire. Rien à importer,
et rien de cassé.
