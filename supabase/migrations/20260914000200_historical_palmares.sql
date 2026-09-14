-- Ticket 06 — Historical palmares of the group, 2017 to 2025.
--
-- GENERATED FILE. Source: research/laroutedutour/rankings.csv.
-- Regenerate with: python3 research/laroutedutour/generate_import_migration.py
--
-- The archive is closed: nine seasons that will never gain a row. A generated
-- migration beats a runtime importer — `supabase db reset` rebuilds it
-- identically, nothing has to run in production, and the idempotency is the
-- ON CONFLICT clause rather than a script someone has to remember to re-run
-- safely.
--
-- NEVER fake leagues or teams with this data. These seasons were played on
-- another game, with another scale; only ranks compare across the two eras,
-- which is why the raw category points are stored as they were and never
-- converted into XP.

-- 24 events retained out of 30 (one-week races excluded),
-- 187 results, 9 seasons.

create table if not exists public.historical_tours (
  -- The La Route du Tour tour id: the only stable key. Tour names repeat
  -- (two different tours are both called "C'est la reprise").
  tour_id integer primary key,
  season_year integer not null references public.seasons (year),
  event_type text not null check (event_type in ('classics', 'giro', 'tour-de-france', 'vuelta')),
  tour_name text not null,
  canonical_name text not null
);

comment on table public.historical_tours is
  'One row per event played on La Route du Tour, 2017-2025. One-week races excluded.';

create index if not exists idx_historical_tours_season on public.historical_tours (season_year);

create table if not exists public.historical_results (
  tour_id integer not null references public.historical_tours (tour_id) on delete cascade,
  -- Canonical player key, merged identities applied (kli_max = Klimax,
  -- Sandy Chazar = David Choncoutié). Aggregates key on this, never on the
  -- team name, which changed at every single event.
  player_key text not null,
  -- The WattHunter account name, which is what any screen displays.
  display_name text not null,
  -- Played before WattHunter and never opened an account.
  is_former_player boolean not null default false,
  team_name text not null,
  rank integer not null check (rank >= 1),
  -- Raw category points, exactly as the original game scored them.
  bonus integer not null default 0,
  combative integer not null default 0,
  mountain integer not null default 0,
  intermediate_sprint integer not null default 0,
  stage_finish integer not null default 0,
  stage_total integer not null default 0,
  gc_points integer not null default 0,
  young_rider integer not null default 0,
  sprinter integer not null default 0,
  climber integer not null default 0,
  general_total integer not null default 0,
  total integer not null default 0,
  primary key (tour_id, player_key)
);

comment on table public.historical_results is
  'One row per player per historical event: original rank, original team name, raw category points. Never converted to XP.';

create index if not exists idx_historical_results_player on public.historical_results (player_key);

-- The archived seasons have to exist before a tour can point at one.
insert into public.seasons (year) values
  (2017),
  (2018),
  (2019),
  (2020),
  (2021),
  (2022),
  (2023),
  (2024),
  (2025)
on conflict (year) do nothing;

insert into public.historical_tours (tour_id, season_year, event_type, tour_name, canonical_name) values
  (790, 2017, 'vuelta', 'Vuelta Gueule 2017', 'Vuelta 2017'),
  (822, 2018, 'classics', 'L''Enfer des classiques', 'Classiques 2018'),
  (900, 2018, 'tour-de-france', 'Le Tour de Chouffe', 'Tour de France 2018'),
  (1075, 2018, 'vuelta', 'La Vuelta des Grandes Canettes', 'Vuelta 2018'),
  (1151, 2019, 'classics', 'Les Classiques de l''Individualisme', 'Classiques 2019'),
  (1173, 2019, 'giro', 'Giroti Girosé, Lève la roue et puis CHUTE', 'Giro 2019'),
  (1264, 2019, 'tour-de-france', 'Le Chouffe Tour', 'Tour de France 2019'),
  (1523, 2019, 'vuelta', 'La Vuelta de las cervezas', 'Vuelta 2019'),
  (1625, 2020, 'tour-de-france', 'Le Tour des Anes Bâtes', 'Tour de France 2020'),
  (1901, 2020, 'giro', 'Gir''Aulas d''Italia', 'Giro 2020'),
  (2083, 2021, 'classics', 'C''est du classico classique', 'Classiques 2021'),
  (2143, 2021, 'giro', 'Olivier Giro d''Italia > Benzema', 'Giro 2021'),
  (2283, 2021, 'tour-de-france', 'Le Tour de France Beckenbauer', 'Tour de France 2021'),
  (2461, 2021, 'vuelta', 'La Vuelta ! Ta couleur et tes mots tout me va', 'Vuelta 2021'),
  (2536, 2022, 'classics', 'Classiques Haribo', 'Classiques 2022'),
  (2553, 2022, 'giro', 'Le Giro de Gino', 'Giro 2022'),
  (2661, 2022, 'tour-de-france', 'Le Tour de LA France', 'Tour de France 2022'),
  (2909, 2023, 'classics', 'Les Classiques de l''individualisme', 'Classiques 2023'),
  (2953, 2023, 'giro', 'Giro de P***', 'Giro 2023'),
  (3099, 2023, 'tour-de-france', 'TdF 2023 - La vengeance de Pogi ?', 'Tour de France 2023'),
  (3332, 2023, 'vuelta', 'Vuelta 2023', 'Vuelta 2023'),
  (3447, 2024, 'giro', 'Le Giro de Pogi', 'Giro 2024'),
  (3577, 2024, 'tour-de-france', 'Euro TDF JO Routes du Champ', 'Tour de France 2024'),
  (3826, 2025, 'vuelta', 'Vuelta 2k25', 'Vuelta 2025')
on conflict (tour_id) do update set
  season_year = excluded.season_year,
  event_type = excluded.event_type,
  tour_name = excluded.tour_name,
  canonical_name = excluded.canonical_name;

insert into public.historical_results (tour_id, player_key, display_name, is_former_player, team_name, rank, bonus, combative, mountain, intermediate_sprint, stage_finish, stage_total, gc_points, young_rider, sprinter, climber, general_total, total) values
  (790, 'Klimax', 'Klimax', false, 'DiscoRoti Channel', 1, 4, 20, 123, 31, 482, 656, 629, 282, 147, 162, 1220, 1876),
  (790, 'PeeJee', 'Peejee', false, 'Team Sky-Coca', 2, 3, 0, 80, 11, 383, 473, 598, 154, 112, 93, 957, 1430),
  (790, 'Alpaga', 'Jonathan Schummers', false, 'Quick-Fuck', 3, 2, 15, 88, 75, 339, 517, 336, 67, 144, 15, 562, 1079),
  (790, 'Benny Lee', 'Dixon Hormous', false, 'AG2R La Chancla', 4, 1, 10, 43, 62, 237, 352, 397, 128, 11, 0, 536, 888),
  (790, 'Marseillais', 'Muscat Romain', false, 'Tchi-Mobile', 5, 0, 5, 32, 0, 216, 253, 322, 38, 39, 32, 431, 684),
  (822, 'Alpaga', 'Jonathan Schummers', false, 'Respectemonautorité', 1, 3, 0, 0, 0, 386, 386, 0, 0, 0, 0, 0, 386),
  (822, 'Benny Lee', 'Dixon Hormous', false, 'Guépard-Randonnée', 2, 2, 0, 0, 0, 377, 377, 0, 0, 0, 0, 0, 377),
  (822, 'Marseillais', 'Muscat Romain', false, 'Tchi mobile', 3, 1, 0, 0, 0, 288, 288, 0, 0, 0, 0, 0, 288),
  (822, 'Klimax', 'Klimax', false, 'DiscoRoti Channel', 4, 0, 0, 0, 0, 185, 185, 0, 0, 0, 0, 0, 185),
  (822, 'David Choncoutié', 'David Choncoutié', false, 'Allez mon petit, ne te retourne pas', 5, 2, 0, 0, 0, 84, 84, 0, 0, 0, 0, 0, 84),
  (822, 'PeeJee', 'Peejee', false, 'Les Petites Pédales', 6, 0, 0, 0, 0, 46, 46, 0, 0, 0, 0, 0, 46),
  (900, 'David Choncoutié', 'David Choncoutié', false, 'Allez mon petit, ne te retourne pas', 1, 4, 0, 91, 11, 520, 622, 462, 175, 86, 85, 808, 1430),
  (900, 'JibsEPAULE', 'JibsEPAULE', true, 'Les Grandes Pédales', 2, 4, 5, 374, 19, 402, 800, 118, 0, 132, 255, 505, 1305),
  (900, 'Benny Lee', 'Dixon Hormous', false, 'Ich ich', 3, 2, 5, 68, 69, 479, 621, 234, 85, 244, 59, 622, 1243),
  (900, 'Alpaga', 'Jonathan Schummers', false, 'Fkj', 4, 0, 0, 40, 5, 419, 464, 490, 0, 74, 53, 617, 1081),
  (900, 'Marino', 'Marino Alex', false, 'La Marinade', 5, 4, 10, 8, 0, 324, 342, 209, 0, 194, 0, 403, 745),
  (900, 'PeeJee', 'Peejee', false, 'AP2G Le Mangeur', 6, 4, 5, 8, 17, 261, 291, 301, 131, 5, 0, 437, 728),
  (900, 'Marseillais', 'Muscat Romain', false, 'Trek - Fais gaffe minot', 7, 3, 10, 48, 20, 348, 426, 154, 11, 4, 71, 240, 666),
  (900, 'Klimax', 'Klimax', false, 'DiscoRoti Channel', 8, 3, 0, 50, 16, 350, 416, 105, 31, 14, 11, 161, 577),
  (900, 'JoeDills', 'JoeDills', true, 'T-Molly', 9, 0, 15, 10, 18, 148, 191, 251, 0, 1, 0, 252, 443),
  (1075, 'PeeJee', 'Peejee', false, 'Avec vos shorts de PD, là', 1, 4, 5, 69, 30, 412, 516, 656, 262, 198, 74, 1190, 1706),
  (1075, 'Alpaga', 'Jonathan Schummers', false, 'Youssouf', 2, 0, 15, 164, 36, 430, 645, 406, 141, 152, 142, 841, 1486),
  (1075, 'Marino', 'Marino Alex', false, 'Los tacos pedeleandos', 3, 4, 15, 255, 44, 256, 570, 243, 144, 40, 352, 779, 1349),
  (1075, 'Marseillais', 'Muscat Romain', false, 'Muscatel - Muscadi', 4, 1, 5, 52, 5, 473, 535, 275, 29, 166, 5, 475, 1010),
  (1075, 'David Choncoutié', 'David Choncoutié', false, '¡ Anda tío, no te revuelvas !', 5, 0, 5, 31, 3, 118, 157, 229, 44, 21, 16, 310, 467),
  (1075, 'Benny Lee', 'Dixon Hormous', false, 'VariationsGoldberg', 6, 0, 0, 8, 3, 69, 80, 285, 22, 17, 0, 324, 404),
  (1075, 'Klimax', 'Klimax', false, 'DiscoRoti Channel', 7, 0, 5, 0, 16, 107, 128, 75, 2, 3, 0, 80, 208),
  (1151, 'David Choncoutié', 'David Choncoutié', false, 'Jupiler Cycling Team', 1, 1, 0, 0, 0, 435, 435, 0, 0, 0, 0, 0, 435),
  (1151, 'Marseillais', 'Muscat Romain', false, 'Muscatel Muscadji', 2, 1, 0, 0, 0, 328, 328, 0, 0, 0, 0, 0, 328),
  (1151, 'Klimax', 'Klimax', false, 'Klituscha', 3, 1, 0, 0, 0, 253, 253, 0, 0, 0, 0, 0, 253),
  (1151, 'Marino', 'Marino Alex', false, 'Los Mariachis Cabrones', 4, 2, 0, 0, 0, 163, 163, 0, 0, 0, 0, 0, 163),
  (1151, 'PeeJee', 'Peejee', false, 'God Save the Gouines', 5, 2, 0, 0, 0, 147, 147, 0, 0, 0, 0, 0, 147),
  (1151, 'Alpaga', 'Jonathan Schummers', false, 'Harissa', 6, 0, 0, 0, 0, 116, 116, 0, 0, 0, 0, 0, 116),
  (1151, 'Benny Lee', 'Dixon Hormous', false, 'CasseLaDémarche', 7, 0, 0, 0, 0, 97, 97, 0, 0, 0, 0, 0, 97),
  (1173, 'Marseillais', 'Muscat Romain', false, 'Muscatel Muscadji', 1, 4, 0, 46, 20, 682, 748, 338, 106, 345, 58, 847, 1595),
  (1173, 'Klimax', 'Klimax', false, 'Klituscha', 2, 4, 10, 28, 36, 552, 626, 541, 0, 181, 25, 747, 1373),
  (1173, 'Marino', 'Marino Alex', false, 'Don Marino', 3, 4, 20, 179, 100, 307, 605, 190, 141, 41, 378, 750, 1355),
  (1173, 'PeeJee', 'Peejee', false, 'God Save the Gouines', 4, 3, 33, 32, 34, 421, 518, 435, 15, 19, 79, 548, 1066),
  (1173, 'Alpaga', 'Jonathan Schummers', false, 'BigBLACKbooty', 5, 0, 0, 2, 16, 291, 309, 425, 138, 35, 2, 600, 909),
  (1173, 'David Choncoutié', 'David Choncoutié', false, 'Moretti Cycling Team', 6, 4, 10, 68, 60, 191, 329, 299, 94, 15, 58, 466, 795),
  (1173, 'Benny Lee', 'Dixon Hormous', false, 'C''est bon chui al', 7, 0, 0, 8, 40, 169, 217, 23, 33, 12, 0, 68, 285),
  (1264, 'JibsEPAULE', 'JibsEPAULE', true, 'Les Gainés', 1, 2, 5, 13, 0, 505, 523, 631, 0, 121, 12, 764, 1287),
  (1264, 'Marino', 'Marino Alex', false, 'Los Burritos Locos', 2, 4, 5, 40, 8, 348, 401, 415, 281, 30, 61, 787, 1188),
  (1264, 'PeeJee', 'Peejee', false, 'Gode Save The Gouine', 3, 3, 0, 74, 35, 296, 405, 139, 212, 256, 40, 647, 1052),
  (1264, 'Marseillais', 'Muscat Romain', false, 'Muskatel Muskadji', 4, 4, 5, 108, 16, 470, 598, 204, 56, 69, 90, 419, 1017),
  (1264, 'Klimax', 'Klimax', false, 'Klituscha', 5, 3, 15, 77, 26, 465, 583, 183, 0, 17, 108, 308, 891),
  (1264, 'Benny Lee', 'Dixon Hormous', false, 'Alkpote-monpote', 6, 2, 15, 165, 42, 133, 355, 31, 0, 150, 235, 416, 771),
  (1264, 'David Choncoutié', 'David Choncoutié', false, 'Ninkasi Cycling Team', 7, 4, 5, 26, 39, 314, 383, 165, 22, 115, 17, 319, 702),
  (1264, 'JoeDills', 'JoeDills', true, 'Quick Pet', 8, 1, 0, 51, 0, 171, 222, 292, 111, 0, 24, 427, 649),
  (1264, 'Alpaga', 'Jonathan Schummers', false, 'Colombia', 9, 0, 0, 12, 0, 97, 109, 356, 3, 0, 7, 366, 475),
  (1523, 'David Choncoutié', 'David Choncoutié', false, 'Estrella Galicia Equipo Ciclista', 1, 4, 10, 100, 28, 550, 688, 482, 387, 87, 74, 1030, 1718),
  (1523, 'Alpaga', 'Jonathan Schummers', false, 'LamBrecht4eVer', 2, 1, 0, 22, 38, 522, 581, 432, 0, 203, 57, 692, 1273),
  (1523, 'Marino', 'Marino Alex', false, 'Los Chulos Pendejos', 3, 4, 10, 93, 11, 191, 305, 378, 238, 22, 238, 876, 1181),
  (1523, 'Klimax', 'Klimax', false, 'Discoroti Channel', 4, 4, 15, 34, 25, 326, 400, 470, 0, 141, 0, 611, 1011),
  (1523, 'PeeJee', 'Peejee', false, 'Sco Pa Tu Manaa', 5, 0, 10, 42, 16, 303, 370, 348, 1, 103, 8, 460, 830),
  (1523, 'Marseillais', 'Muscat Romain', false, 'Muscatel Muscadji', 6, 0, 15, 75, 28, 304, 422, 179, 24, 26, 39, 268, 690),
  (1523, 'Benny Lee', 'Dixon Hormous', false, 'Borat-Hanz Gros Cul', 7, 0, 0, 37, 0, 177, 214, 89, 5, 0, 17, 111, 325),
  (1625, 'PeeJee', 'Peejee', false, 'Bora - Hans Le Malin', 1, 4, 5, 98, 51, 495, 649, 387, 230, 288, 255, 1160, 1809),
  (1625, 'Klimax', 'Klimax', false, 'DiscorotiChannel', 2, 4, 10, 125, 0, 426, 561, 626, 104, 0, 157, 887, 1448),
  (1625, 'Marseillais', 'Muscat Romain', false, 'Muscadel Muscadji', 3, 4, 5, 32, 51, 568, 656, 147, 31, 265, 12, 455, 1111),
  (1625, 'Marino', 'Marino Alex', false, 'MarinoStar Team', 4, 4, 10, 92, 52, 336, 490, 306, 0, 131, 71, 508, 998),
  (1625, 'David Choncoutié', 'David Choncoutié', false, 'Mont Ventoux Cubitainer Challenge', 5, 4, 15, 89, 8, 389, 501, 299, 79, 0, 67, 445, 946),
  (1625, 'Benny Lee', 'Dixon Hormous', false, 'Bâton Rouge', 6, 3, 0, 25, 0, 320, 345, 402, 47, 7, 10, 466, 811),
  (1625, 'Alpaga', 'Jonathan Schummers', false, 'Schleck4ever', 7, 4, 5, 26, 32, 182, 245, 391, 92, 16, 32, 531, 776),
  (1901, 'Klimax', 'Klimax', false, 'Discoroti Channel', 1, 4, 20, 109, 131, 440, 701, 417, 0, 227, 82, 726, 1427),
  (1901, 'David Choncoutié', 'David Choncoutié', false, 'Ast''âne Bâté Pro Team', 2, 4, 0, 25, 20, 428, 473, 596, 227, 100, 5, 928, 1401),
  (1901, 'Marino', 'Marino Alex', false, 'MovistAulas', 3, 3, 10, 96, 45, 366, 519, 380, 139, 6, 101, 626, 1145),
  (1901, 'Alpaga', 'Jonathan Schummers', false, 'MakeBobGreatAgain', 4, 1, 20, 14, 39, 320, 393, 273, 20, 109, 91, 493, 886),
  (1901, 'PeeJee', 'Peejee', false, 'Ineos GrosPaquet', 5, 2, 5, 70, 29, 234, 338, 49, 114, 1, 109, 273, 611),
  (1901, 'Marseillais', 'Muscat Romain', false, 'Muscatel Muscadji', 6, 2, 5, 5, 35, 312, 357, 32, 0, 204, 9, 245, 602),
  (1901, 'Benny Lee', 'Dixon Hormous', false, 'Tandoori Bicycle Club', 7, 0, 0, 23, 3, 30, 56, 30, 5, 20, 11, 66, 122),
  (2083, 'Marseillais', 'Muscat Romain', false, 'Muskatel Muscadji', 1, 2, 0, 0, 0, 801, 801, 0, 0, 0, 0, 0, 801),
  (2083, 'Klimax', 'Klimax', false, 'Discoroti Channel', 2, 2, 0, 0, 0, 750, 750, 0, 0, 0, 0, 0, 750),
  (2083, 'PeeJee', 'Peejee', false, 'Ça t''étonne, c''est les cétones', 3, 2, 0, 0, 0, 632, 632, 0, 0, 0, 0, 0, 632),
  (2083, 'Alpaga', 'Jonathan Schummers', false, 'SchleckCyclingFans', 4, 2, 0, 0, 0, 566, 566, 0, 0, 0, 0, 0, 566),
  (2083, 'Marino', 'Marino Alex', false, 'Marino Soudal', 5, 2, 0, 0, 0, 535, 535, 0, 0, 0, 0, 0, 535),
  (2083, 'bigdaddy', 'bigdaddy', false, 'Bristol.cc', 6, 1, 0, 0, 0, 319, 319, 0, 0, 0, 0, 0, 319),
  (2083, 'Benny Lee', 'Dixon Hormous', false, 'Corinthiens Cosmos Curry', 7, 2, 0, 0, 0, 294, 294, 0, 0, 0, 0, 0, 294),
  (2083, 'David Choncoutié', 'David Choncoutié', false, 'Gris de Gris, Solutions Cubis', 8, 1, 0, 0, 0, 234, 234, 0, 0, 0, 0, 0, 234),
  (2143, 'David Choncoutié', 'David Choncoutié', false, 'Gris de gris, Solution Cubi', 1, 4, 20, 146, 11, 462, 639, 411, 181, 189, 273, 1054, 1693),
  (2143, 'Klimax', 'Klimax', false, 'Discoroti Channel', 2, 4, 20, 78, 111, 409, 618, 448, 202, 54, 143, 847, 1465),
  (2143, 'Marseillais', 'Muscat Romain', false, 'Muskatel Muskadji', 3, 4, 5, 61, 8, 420, 494, 426, 70, 248, 35, 779, 1273),
  (2143, 'bigdaddy', 'bigdaddy', false, 'Bristol.cc', 4, 1, 10, 18, 12, 314, 354, 411, 86, 7, 5, 509, 863),
  (2143, 'Benny Lee', 'Dixon Hormous', false, 'On est pas bien là ?', 5, 2, 5, 59, 31, 212, 307, 330, 0, 4, 91, 425, 732),
  (2143, 'PeeJee', 'Peejee', false, 'Des étapes, des étapes, oui mais des Pantani', 6, 4, 5, 2, 30, 277, 314, 210, 94, 83, 1, 388, 702),
  (2143, 'Alpaga', 'Jonathan Schummers', false, 'Bobisoverrated', 7, 0, 5, 26, 13, 120, 164, 237, 109, 2, 24, 372, 536),
  (2143, 'Marino', 'Marino Alex', false, 'Chau Bello !', 8, 1, 5, 6, 10, 288, 309, 30, 8, 121, 0, 159, 468),
  (2283, 'PeeJee', 'Peejee', false, 'INEOS LBD', 1, 4, 5, 67, 47, 430, 549, 639, 163, 108, 103, 1013, 1562),
  (2283, 'Alpaga', 'Jonathan Schummers', false, 'Jeudemot', 2, 1, 0, 37, 5, 267, 309, 467, 240, 17, 74, 798, 1107),
  (2283, 'Marino', 'Marino Alex', false, 'MarIneos', 3, 2, 5, 90, 7, 388, 491, 335, 86, 102, 24, 547, 1038),
  (2283, 'Benny Lee', 'Dixon Hormous', false, 'KCorp', 4, 1, 5, 102, 0, 370, 477, 297, 0, 27, 158, 482, 959),
  (2283, 'bigdaddy', 'bigdaddy', false, 'Ventre Mou Racing Team', 5, 0, 5, 19, 16, 337, 377, 37, 150, 210, 61, 458, 835),
  (2283, 'Marseillais', 'Muscat Romain', false, 'Muskatel Muscadji', 6, 2, 5, 24, 5, 292, 326, 456, 0, 6, 19, 481, 807),
  (2283, 'Klimax', 'Klimax', false, 'Discoroti Channel', 7, 4, 15, 105, 20, 223, 363, 159, 0, 100, 109, 368, 731),
  (2283, 'David Choncoutié', 'David Choncoutié', false, 'GoudalEnergies', 8, 3, 0, 3, 24, 195, 222, 45, 108, 166, 0, 319, 541),
  (2461, 'Klimax', 'Klimax', false, 'Discoroti Channel', 1, 4, 0, 181, 8, 571, 760, 530, 34, 86, 235, 885, 1645),
  (2461, 'Marino', 'Marino Alex', false, 'MarinoStar Tritón', 2, 4, 10, 32, 46, 380, 468, 334, 499, 243, 15, 1091, 1559),
  (2461, 'David Choncoutié', 'David Choncoutié', false, 'GoudalEnergies', 3, 3, 20, 182, 4, 537, 743, 506, 1, 62, 180, 749, 1492),
  (2461, 'PeeJee', 'Peejee', false, 'Bahrain Defeatous', 4, 4, 0, 26, 0, 220, 246, 404, 25, 36, 42, 507, 753),
  (2461, 'Benny Lee', 'Dixon Hormous', false, 'Groupamamadou Sakho FDJ', 5, 0, 10, 93, 43, 231, 377, 71, 0, 76, 125, 272, 649),
  (2461, 'Alpaga', 'Jonathan Schummers', false, 'Leopard_Trek', 6, 0, 0, 26, 8, 231, 265, 317, 1, 5, 17, 340, 605),
  (2461, 'bigdaddy', 'bigdaddy', false, 'Ventre Mou Cycling Team', 7, 0, 0, 9, 10, 206, 225, 128, 0, 106, 14, 248, 473),
  (2461, 'Marseillais', 'Muscat Romain', false, 'Muskatel Muskadji', 8, 1, 0, 0, 5, 221, 226, 9, 52, 82, 0, 143, 369),
  (2536, 'Benny Lee', 'Dixon Hormous', false, 'La zigoune à Marius', 1, 1, 0, 0, 0, 723, 723, 0, 0, 0, 0, 0, 723),
  (2536, 'Klimax', 'Klimax', false, 'Discoroti Channel', 2, 1, 0, 0, 0, 639, 639, 0, 0, 0, 0, 0, 639),
  (2536, 'Marseillais', 'Muscat Romain', false, 'Muskatel Muscadji', 3, 1, 0, 0, 0, 483, 483, 0, 0, 0, 0, 0, 483),
  (2536, 'Alpaga', 'Jonathan Schummers', false, 'TotalEnergies', 4, 2, 0, 0, 0, 382, 382, 0, 0, 0, 0, 0, 382),
  (2536, 'bigdaddy', 'bigdaddy', false, 'PE - Priorité Éducation', 5, 1, 0, 0, 0, 269, 269, 0, 0, 0, 0, 0, 269),
  (2536, 'PeeJee', 'Peejee', false, 'APG2R La Timbale', 6, 2, 0, 0, 0, 83, 83, 0, 0, 0, 0, 0, 83),
  (2553, 'PeeJee', 'Peejee', false, 'Des étapes, des étapes, oui mais des Pantani', 1, 4, 0, 160, 60, 810, 1030, 343, 84, 129, 185, 741, 1771),
  (2553, 'Marino', 'Marino Alex', false, 'MaGik Rino', 2, 4, 0, 63, 43, 803, 909, 360, 276, 130, 53, 819, 1728),
  (2553, 'Marseillais', 'Muscat Romain', false, 'Muskatel Muscadji', 3, 4, 0, 71, 47, 882, 1000, 413, 77, 15, 9, 514, 1514),
  (2553, 'Alpaga', 'Jonathan Schummers', false, 'ParisGO', 4, 3, 0, 82, 29, 632, 744, 540, 0, 6, 116, 662, 1406),
  (2553, 'David Choncoutié', 'David Choncoutié', false, 'Panenka Cycling Team', 5, 3, 0, 33, 18, 749, 800, 352, 129, 35, 6, 522, 1322),
  (2553, 'Klimax', 'Klimax', false, 'Discoroti Channel', 6, 4, 0, 113, 60, 660, 833, 97, 0, 104, 111, 312, 1145),
  (2553, 'bigdaddy', 'bigdaddy', false, 'PE - Priorité Éducation', 7, 1, 0, 8, 27, 668, 703, 124, 5, 265, 11, 405, 1108),
  (2553, 'Benny Lee', 'Dixon Hormous', false, 'KC Wao sheesh', 8, 0, 0, 16, 27, 339, 382, 271, 6, 0, 6, 283, 665),
  (2661, 'PeeJee', 'Peejee', false, 'Team Attention Philippe, le PARAPET', 1, 4, 30, 78, 77, 1050, 1235, 400, 167, 249, 41, 857, 2092),
  (2661, 'Klimax', 'Klimax', false, 'Discoroti Channel', 2, 4, 0, 136, 0, 837, 973, 460, 304, 91, 119, 974, 1947),
  (2661, 'David Choncoutié', 'David Choncoutié', false, 'GoudalEnergies', 3, 4, 20, 77, 15, 856, 968, 381, 0, 42, 83, 506, 1474),
  (2661, 'Benny Lee', 'Dixon Hormous', false, 'Sheeeesh Kebab', 4, 4, 45, 53, 22, 644, 764, 597, 0, 16, 95, 708, 1472),
  (2661, 'bigdaddy', 'bigdaddy', false, 'PE - Priorité Éducation', 5, 1, 15, 70, 43, 695, 823, 232, 6, 124, 191, 553, 1376),
  (2661, 'Marseillais', 'Muscat Romain', false, 'Muskatel Muskadji', 6, 4, 0, 15, 27, 657, 699, 309, 0, 108, 4, 421, 1120),
  (2661, 'Marino', 'Marino Alex', false, 'Les MaMa Rhinos', 7, 4, 15, 92, 5, 501, 613, 113, 196, 27, 34, 370, 983),
  (2661, 'Alpaga', 'Jonathan Schummers', false, 'Lulu', 8, 1, 15, 25, 29, 358, 427, 85, 0, 0, 10, 95, 522),
  (2661, 'Fangio', 'Fangio', true, 'Speedy Burger Team', 9, 2, 5, 31, 21, 376, 433, 12, 0, 58, 11, 81, 514),
  (2909, 'Marseillais', 'Muscat Romain', false, 'Muskatel Muskadji', 1, 1, 0, 0, 0, 783, 783, 0, 0, 0, 0, 0, 783),
  (2909, 'Patron', 'TheAussieMate', false, 'Ineos Patroniers', 2, 4, 0, 0, 0, 597, 597, 0, 0, 0, 0, 0, 597),
  (2909, 'Alpaga', 'Jonathan Schummers', false, 'Leopard_Trek', 3, 1, 0, 0, 0, 499, 499, 0, 0, 0, 0, 0, 499),
  (2909, 'Benny Lee', 'Dixon Hormous', false, 'Aller Alain Philippe', 4, 1, 0, 0, 0, 466, 466, 0, 0, 0, 0, 0, 466),
  (2909, 'Marino', 'Marino Alex', false, 'Clásico Marisco', 5, 3, 0, 0, 0, 433, 433, 0, 0, 0, 0, 0, 433),
  (2909, 'Klimax', 'Klimax', false, 'Discoroti Channel', 6, 1, 0, 0, 0, 218, 218, 0, 0, 0, 0, 0, 218),
  (2909, 'David Choncoutié', 'David Choncoutié', false, 'GoudalEnergies', 7, 0, 0, 0, 0, 202, 202, 0, 0, 0, 0, 0, 202),
  (2909, 'PeeJee', 'Peejee', false, 'Alpecin-Quick-Step-KAMOULOX', 8, 2, 0, 0, 0, 181, 181, 0, 0, 0, 0, 0, 181),
  (2909, 'bigdaddy', 'bigdaddy', false, 'Priorité Éducation Cycliste Pro', 9, 0, 0, 0, 0, 89, 89, 0, 0, 0, 0, 0, 89),
  (2953, 'David Choncoutié', 'David Choncoutié', false, 'GoudalEnergies', 1, 4, 0, 82, 35, 774, 891, 154, 10, 144, 178, 486, 1377),
  (2953, 'Marseillais', 'Muscat Romain', false, 'Muskatel Muskadji', 2, 4, 0, 80, 16, 814, 910, 275, 59, 16, 75, 425, 1335),
  (2953, 'Alpaga', 'Jonathan Schummers', false, 'LuxTeam', 3, 4, 0, 6, 24, 741, 771, 222, 16, 241, 0, 479, 1250),
  (2953, 'PeeJee', 'Peejee', false, 'Squadra Pi-Giro', 4, 3, 0, 18, 30, 437, 486, 490, 232, 3, 17, 742, 1228),
  (2953, 'Benny Lee', 'Dixon Hormous', false, 'Tour De Tietema', 5, 3, 0, 76, 0, 560, 636, 436, 80, 34, 21, 571, 1207),
  (2953, 'bigdaddy', 'bigdaddy', false, 'PE - Priorité Éducation', 6, 1, 0, 39, 80, 518, 638, 313, 173, 66, 6, 558, 1196),
  (2953, 'Marino', 'Marino Alex', false, 'Los Marginos del Giro', 7, 4, 0, 33, 29, 569, 631, 312, 204, 12, 8, 536, 1167),
  (2953, 'Klimax', 'Klimax', false, 'Discoroti Channel', 8, 4, 0, 20, 57, 574, 651, 425, 1, 1, 21, 448, 1099),
  (2953, 'Patron', 'TheAussieMate', false, 'Ineos Patroniers', 9, 1, 0, 96, 16, 395, 507, 84, 0, 89, 97, 270, 777),
  (3099, 'Marino', 'Marino Alex', false, 'MarinoStar', 1, 4, 0, 48, 16, 725, 789, 440, 262, 59, 58, 819, 1608),
  (3099, 'David Choncoutié', 'David Choncoutié', false, 'GoudalEnergies', 2, 4, 15, 25, 3, 799, 842, 535, 170, 25, 13, 743, 1585),
  (3099, 'Klimax', 'Klimax', false, 'Discoroti Channel', 3, 4, 10, 52, 18, 649, 730, 573, 0, 40, 70, 683, 1413),
  (3099, 'Marseillais', 'Muscat Romain', false, 'Muskatel Muskadji', 4, 4, 5, 59, 24, 592, 680, 370, 22, 128, 54, 574, 1254),
  (3099, 'bigdaddy', 'bigdaddy', false, 'PE - Priorité Éducation', 5, 1, 20, 124, 53, 469, 667, 65, 91, 156, 275, 587, 1254),
  (3099, 'Patron', 'TheAussieMate', false, 'Ineos Patronier', 6, 3, 25, 48, 27, 580, 681, 317, 0, 65, 22, 404, 1085),
  (3099, 'Alpaga', 'Jonathan Schummers', false, 'LeopardTank', 7, 3, 0, 54, 43, 695, 792, 29, 0, 240, 6, 275, 1067),
  (3099, 'PeeJee', 'Peejee', false, 'Intermarché - Circus - Piji', 8, 3, 10, 208, 26, 450, 694, 52, 95, 0, 135, 282, 976),
  (3099, 'Benny Lee', 'Dixon Hormous', false, 'Abyssal Cycling Team', 9, 2, 0, 46, 3, 517, 566, 132, 84, 17, 35, 268, 834),
  (3099, 'Fangio', 'Fangio', true, 'Les Pédales', 10, 2, 0, 12, 19, 342, 373, 50, 0, 36, 0, 86, 459),
  (3332, 'Patron', 'TheAussieMate', false, 'Ineos Patroniers', 1, 4, 20, 290, 57, 873, 1240, 609, 111, 175, 218, 1113, 2353),
  (3332, 'David Choncoutié', 'David Choncoutié', false, 'GoudalEnergies', 2, 4, 0, 37, 19, 774, 830, 431, 333, 31, 14, 809, 1639),
  (3332, 'Alpaga', 'Jonathan Schummers', false, 'JoJo la menace', 3, 2, 0, 42, 16, 605, 664, 460, 25, 24, 30, 539, 1203),
  (3332, 'Klimax', 'Klimax', false, 'Discoroti Channel', 4, 4, 0, 81, 11, 598, 690, 354, 0, 79, 79, 512, 1202),
  (3332, 'Benny Lee', 'Dixon Hormous', false, 'Dakar Byers Club', 5, 0, 5, 75, 92, 531, 703, 11, 0, 244, 142, 397, 1100),
  (3332, 'bigdaddy', 'bigdaddy', false, 'PE - Priorité Éducation', 6, 1, 0, 11, 0, 641, 652, 234, 180, 20, 0, 434, 1086),
  (3332, 'Marino', 'Marino Alex', false, 'La Rotunda', 7, 4, 5, 28, 23, 532, 588, 206, 15, 72, 13, 306, 894),
  (3332, 'Marseillais', 'Muscat Romain', false, 'Muskatel Muskadji', 8, 0, 25, 79, 21, 534, 660, 10, 22, 8, 75, 115, 775),
  (3332, 'PeeJee', 'Peejee', false, 'La Team Lidl', 9, 3, 0, 50, 16, 350, 416, 58, 1, 4, 52, 115, 531),
  (3447, 'Marseillais', 'Muscat Romain', false, 'Muskatel Muskadji', 1, 3, 0, 27, 76, 960, 1063, 656, 213, 10, 8, 887, 1950),
  (3447, 'PeeJee', 'Peejee', false, 'Squadra Pi-Giro', 2, 4, 0, 144, 77, 876, 1097, 533, 30, 42, 241, 846, 1943),
  (3447, 'Patron', 'TheAussieMate', false, 'Groupatron FDJ', 3, 3, 0, 68, 76, 651, 795, 438, 15, 164, 154, 771, 1566),
  (3447, 'Alpaga', 'Jonathan Schummers', false, 'Leopard_Trek', 4, 3, 0, 40, 120, 707, 868, 350, 77, 81, 28, 536, 1404),
  (3447, 'Klimax', 'Klimax', false, 'Discoroti Channel', 5, 3, 0, 3, 84, 738, 825, 247, 0, 223, 0, 470, 1295),
  (3447, 'David Choncoutié', 'David Choncoutié', false, 'GoudalEnergies', 6, 4, 0, 111, 50, 664, 826, 143, 202, 1, 82, 428, 1254),
  (3447, 'Benny Lee', 'Dixon Hormous', false, 'Crédit Agricole à bois', 7, 0, 0, 12, 43, 681, 736, 124, 0, 181, 5, 310, 1046),
  (3447, 'bigdaddy', 'bigdaddy', false, 'PE - primo educazione', 8, 1, 0, 22, 25, 420, 467, 15, 10, 2, 61, 88, 555),
  (3447, 'Marino', 'Marino Alex', false, 'Magic Rino', 9, 0, 0, 1, 44, 283, 328, 0, 0, 26, 0, 26, 354),
  (3577, 'David Choncoutié', 'David Choncoutié', false, 'GoudalEnergies', 1, 4, 0, 69, 28, 1085, 1182, 574, 200, 187, 87, 1048, 2230),
  (3577, 'bigdaddy', 'bigdaddy', false, 'PE - Priorité Éducation', 2, 4, 5, 84, 8, 867, 964, 740, 0, 36, 120, 896, 1860),
  (3577, 'Marino', 'Marino Alex', false, 'Les Dauphins libérées', 3, 4, 0, 30, 3, 823, 857, 527, 304, 46, 57, 934, 1791),
  (3577, 'Patron', 'TheAussieMate', false, 'Pat', 4, 4, 10, 226, 29, 895, 1160, 265, 0, 172, 91, 528, 1688),
  (3577, 'PeeJee', 'Peejee', false, 'PG Tips', 5, 4, 10, 53, 35, 614, 712, 88, 116, 100, 36, 340, 1052),
  (3577, 'Marseillais', 'Muscat Romain', false, 'Muskatel Muskadji', 6, 2, 40, 44, 62, 491, 638, 26, 25, 44, 102, 197, 835),
  (3577, 'Klimax', 'Klimax', false, 'Discoroti Channel', 7, 3, 40, 72, 78, 404, 594, 28, 28, 79, 29, 164, 758),
  (3577, 'Benny Lee', 'Dixon Hormous', false, 'The Revenge', 8, 2, 0, 8, 0, 525, 533, 131, 0, 0, 0, 131, 664),
  (3577, 'Alpaga', 'Jonathan Schummers', false, 'Jon', 9, 0, 5, 45, 16, 211, 277, 148, 0, 0, 48, 196, 473),
  (3826, 'Alpaga', 'Jonathan Schummers', false, 'Vinaboy', 1, 4, 15, 133, 13, 884, 1045, 446, 0, 89, 223, 758, 1803),
  (3826, 'David Choncoutié', 'David Choncoutié', false, 'GoudalEnergies', 2, 4, 0, 61, 4, 919, 984, 476, 191, 35, 97, 799, 1783),
  (3826, 'PeeJee', 'Peejee', false, 'Meunier Tudor', 3, 3, 10, 61, 68, 733, 872, 464, 0, 318, 84, 866, 1738),
  (3826, 'Marseillais', 'Muscat Romain', false, 'Muskatel Muskadji', 4, 0, 10, 46, 22, 353, 431, 266, 190, 36, 5, 497, 928),
  (3826, 'Benny Lee', 'Dixon Hormous', false, 'DE Deceptive Education', 5, 0, 0, 22, 7, 445, 475, 161, 44, 127, 4, 336, 811),
  (3826, 'Patron', 'TheAussieMate', false, 'Pat’ Pat’ rouillé', 6, 0, 0, 20, 8, 335, 363, 296, 18, 15, 2, 331, 694)
on conflict (tour_id, player_key) do update set
  display_name = excluded.display_name,
  is_former_player = excluded.is_former_player,
  team_name = excluded.team_name,
  rank = excluded.rank,
  bonus = excluded.bonus,
  combative = excluded.combative,
  mountain = excluded.mountain,
  intermediate_sprint = excluded.intermediate_sprint,
  stage_finish = excluded.stage_finish,
  stage_total = excluded.stage_total,
  gc_points = excluded.gc_points,
  young_rider = excluded.young_rider,
  sprinter = excluded.sprinter,
  climber = excluded.climber,
  general_total = excluded.general_total,
  total = excluded.total;

alter table public.historical_tours enable row level security;
alter table public.historical_results enable row level security;

-- A closed archive of a game everyone in the group played: readable by all,
-- written by migrations only.
drop policy if exists historical_tours_select_all on public.historical_tours;
create policy historical_tours_select_all on public.historical_tours
  for select to anon, authenticated using (true);

drop policy if exists historical_results_select_all on public.historical_results;
create policy historical_results_select_all on public.historical_results
  for select to anon, authenticated using (true);

grant select on public.historical_tours to anon, authenticated;
grant select on public.historical_results to anon, authenticated;
