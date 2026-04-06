-- Seed: 5 system strategies
insert into public.strategies (slug, name, description, xp_bonus, is_parameterized) values
  ('young_blood',     'Young Blood',     'Bonus XP pour les coureurs de moins de 23 ans',                                0.05, false),
  ('road_warriors',   'Road Warriors',   'Bonus XP pour les coureurs de plus de 30 ans',                                0.05, false),
  ('national_pride',  'National Pride',  'Bonus XP pour les coureurs de la nationalité choisie',                        0.05, true),
  ('team_chemistry',  'Team Chemistry',  'Bonus XP pour les coureurs de la même équipe UCI',                            0.05, true),
  ('specialist',      'Specialist',      'Bonus XP pour les coureurs de la spécialité choisie (grimpeur, sprinter…)',   0.05, true)
on conflict (slug) do nothing;
