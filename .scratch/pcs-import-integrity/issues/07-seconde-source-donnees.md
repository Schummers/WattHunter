# 07 — Trouver une seconde source de résultats, indépendante de PCS

Status: `ready-for-agent`
Created: 2026-09-14
Sert: `02-harnais-verification-source-externe.md` (lui fournit sa table de référence)

## Problème

Le harnais du ticket 02 compare la base à une table de référence rang → coureur.
Aujourd'hui cette table vient de captures d'écran prises à la main par
l'utilisateur. Ça marche — c'est comme ça que les 13 écarts ont été trouvés — mais
ça ne passe pas à l'échelle : 21 étapes par Grand Tour, trois Grands Tours par an,
et une vérification qui dépend de la disponibilité d'un humain.

Une seconde source automatisable rendrait la vérification systématique, et
permettrait au passage de trancher H1 : si deux sources indépendantes s'accordent
entre elles et divergent de ce que notre scraper reçoit de PCS, H1 est démontrée.

## Ce dont on a besoin, exactement

**Pas** un second pipeline d'import. Juste, par étape, une table **rang → coureur**.
Ni points, ni km d'échappée, ni profil, ni classements annexes. Le barème et le
reste viennent de chez nous. C'est un besoin beaucoup plus modeste que l'import
complet, et ça ouvre le champ des sources acceptables.

## Contrainte non négociable : l'indépendance

Une source qui republie les données de PCS ne corrobore rien. Avant d'en retenir
une, établir qu'elle collecte ses résultats elle-même (chronométrage officiel,
fédération, organisateur) et non par reprise de PCS. Sans ça, on croira vérifier
alors qu'on comparera une donnée à elle-même.

## Pistes à évaluer

**firstcycling.com** — proposé par l'utilisateur, `race.php?r=23&y=2026` pour la
Vuelta. **Première sonde le 2026-09-14 : bloqué par un challenge Cloudflare, non
résolu après 16s dans le navigateur piloté.** À reprendre : le blocage peut venir
du navigateur automatisé et non du site, un accès depuis un navigateur normal ou
via la session du pipeline peut très bien passer. Vérifier aussi, si l'accès
s'ouvre, l'origine réelle de ses données — c'est un site de statistiques, le
risque de reprise de PCS est à écarter explicitement.

**Les pistes suivantes ne sont pas vérifiées**, elles sont listées comme candidates
à instruire, pas comme solutions :
- le site de l'organisateur (`lavuelta.es`, `letour.fr`, `giroditalia.it`), qui
  publie les résultats officiels et est indiscutablement indépendant de PCS ;
- les données officielles UCI ;
- Wikipédia / Wikidata, qui couvrent les Grands Tours étape par étape et sont
  alimentées indépendamment.

Critère de choix, par ordre : indépendance réelle > accessibilité sans lutte
anti-bot > fraîcheur le soir d'étape > facilité de parse.

## Signal d'alerte déjà présent

Deux sites de statistiques cyclisme sur deux sont derrière une protection anti-bot
agressive. Si l'évaluation confirme que toutes les sources gratuites le sont, la
conclusion à remonter n'est pas technique mais produit : **la fiabilité des données
de WattHunter repose sur des sources qui ne veulent pas être lues par une machine.**
C'est un risque structurel du jeu, pas un incident. À arbitrer avec le ticket 01 en
main.

## Livrable

Une note de comparaison des sources évaluées — accès, indépendance, fraîcheur,
format — et une recommandation. Pas d'implémentation dans ce ticket : le choix de
la source précède l'écriture du collecteur.

## Comments
