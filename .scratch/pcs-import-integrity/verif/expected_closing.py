"""Classements de cloture de la Vuelta 2026, transcrits des captures PCS
fournies par l'utilisateur en conversation le 2026-09-14.

ATTENTION : ces captures-la n'ont jamais ete sauvegardees comme fichiers, elles
n'existaient que dans le fil de discussion. Ce fichier est la SEULE trace qui
reste de leur contenu. Les captures d'etapes (4,7,10,13,16,19,20), elles, sont
dans ../captures/.

Source de verite pour le ticket 04. A NE PAS regenerer depuis le scraper.
Les listes s'arretent ou la capture s'arretait : c'est une transcription, pas un
classement complet, et on ne complete pas au jugé.
"""

# Etape 21 — rangs 1-31 (colonne Pnt = points PCS, utile au recoupement).
STAGE_21 = [
    (1,"Johannessen Tobias Halland",80),(2,"Romele Alessandro",50),(3,"Debruyne Ramses",35),
    (4,"Brennan Matthew",25),(5,"Tronchon Bastien",18),(6,"Bilbao Pello",15),
    (7,"Fisher-Black Finn",12),(8,"Laurance Axel",10),(9,"Marti Pau",8),
    (10,"Brenner Marco",6),(11,"Paret-Peintre Valentin",5),(12,"Buitrago Santiago",4),
    (13,"Nys Thibau",3),(14,"Widar Jarno",2),(15,"Bisiaux Leo",1),
    (16,"Van den Bossche Fabio",0),(17,"Vermaerke Kevin",0),(18,"Alleno Clement",0),
    (19,"Covi Alessandro",0),(20,"Cobo Ivan",0),(21,"Rota Lorenzo",0),
    (22,"Svestad-Bardseng Embret",0),(23,"Leemreize Gijs",0),(24,"Martin Guillaume",0),
    (25,"Skjelmose Mattias",0),(26,"Nordhagen Jorgen",0),(27,"Rodriguez Carlos",0),
    (28,"Almeida Joao",0),(29,"Cort Magnus",0),(30,"Weiss Fabian",0),
    (31,"Camprubi Marcel",0),
]

# GC final — rangs 1-36.
# NOTE : la base porte 6=Omrzel / 7=Onley, la capture dit l'inverse. Les temps
# tranchent (Onley 9:28, Omrzel 10:38) : la capture a raison, la base a tort.
GC_FINAL = [
    (1,"Mas Enric",400),(2,"Roglic Primoz",290),(3,"Gall Felix",240),
    (4,"Carapaz Richard",220),(5,"Kuss Sepp",200),(6,"Onley Oscar",190),
    (7,"Omrzel Jakob",180),(8,"Berthet Clement",170),(9,"Rodriguez Cristian",160),
    (10,"Tejada Harold",150),(11,"Martin Guillaume",140),(12,"Bisiaux Leo",130),
    (13,"Skjelmose Mattias",120),(14,"Aparicio Mario",110),(15,"Hirt Jan",100),
    (16,"Rodriguez Juan Felipe",90),(17,"Buitrago Santiago",85),(18,"Zana Filippo",80),
    (19,"Berrade Urko",75),(20,"Svestad-Bardseng Embret",70),(21,"Bouwman Koen",65),
    (22,"Garcia Pierna Raul",60),(23,"Widar Jarno",55),(24,"Haig Jack",50),
    (25,"Buchmann Emanuel",45),(26,"Johannessen Tobias Halland",40),(27,"Leemreize Gijs",35),
    (28,"Pickering Finlay",30),(29,"Vermaerke Kevin",25),(30,"Landa Mikel",20),
    (31,"Diaz Jose Manuel",20),(32,"Debruyne Ramses",20),(33,"Bilbao Pello",20),
    (34,"Paret-Peintre Valentin",20),(35,"Madouas Valentin",20),(36,"Rodriguez Carlos",20),
]

# Points final (maillot vert) — rangs 1-33, colonne = points du classement.
# NOTE : 6 et 7 sont a 115 points tous les deux, vrai ex aequo. La base les
# ordonne dans l'autre sens ; ce n'est PAS un ecart, ne pas "corriger".
POINTS_FINAL = [
    (1,"Van Aert Wout",326),(2,"Brennan Matthew",273),(3,"Romele Alessandro",216),
    (4,"Coquard Bryan",141),(5,"Meeus Jordi",116),(6,"Vermaerke Kevin",115),
    (7,"Debruyne Ramses",115),(8,"Leknessund Andreas",106),(9,"Johannessen Tobias Halland",104),
    (10,"Tronchon Bastien",103),(11,"Cort Magnus",90),(12,"Hayter Ethan",84),
    (13,"Fisher-Black Finn",77),(14,"Hofstetter Hugo",74),(15,"Miquel Pau",70),
    (16,"Laurance Axel",70),(17,"Mas Enric",63),(18,"Paret-Peintre Valentin",62),
    (19,"Buitrago Santiago",60),(20,"Albanese Vincenzo",59),(21,"Bisiaux Leo",58),
    (22,"Roglic Primoz",57),(23,"Gall Felix",54),(24,"Braet Vito",53),
    (25,"Widar Jarno",52),(26,"Rodriguez Cristian",51),(27,"Onley Oscar",48),
    (28,"Nys Thibau",48),(29,"Martin Guillaume",46),(30,"Berrade Urko",41),
    (31,"Dainese Alberto",41),(32,"Carapaz Richard",38),(33,"Skjelmose Mattias",38),
]

# KOM final et Youth final : voir ../finals-kom-youth.json (slugs PCS + rangs,
# deja resolus contre la table riders et valides sur la zone scoree 1-10).
