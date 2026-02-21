-- Seed: 10 sponsors (5 tiers × 2 options)
-- Tier 1 — débloqué niveau 3 (~12k XP)
-- Tier 5 — débloqué niveau 10 (~245k XP)
-- Option A : paiement inconditionnel (plus faible)
-- Option B : paiement conditionnel (plus élevé si condition remplie, sinon Option A)

insert into public.sponsors (tier, option, name, description, monthly_payment, condition, condition_desc, bonus_payment) values
  -- Tier 1
  (1, 'A', 'VéloShop Basic',
   'Partenaire équipementier local. Paiement fixe mensuel.',
   8000, null, null, null),
  (1, 'B', 'VéloShop Performance',
   'Partenaire équipementier. Bonus si ton équipe marque des XP ce mois.',
   5000, 'team_scored_xp_this_month', 'Ton équipe doit avoir gagné au moins 1 XP ce mois-ci.', 6000),

  -- Tier 2
  (2, 'A', 'SportNutrition Pro',
   'Sponsor nutrition sportive. Paiement fixe mensuel.',
   18000, null, null, null),
  (2, 'B', 'SportNutrition Elite',
   'Sponsor nutrition. Bonus si un de tes coureurs termine dans le top 10 d''une course.',
   12000, 'top10_finish_this_month', 'Un coureur de ton équipe doit avoir un top 10 ce mois-ci.', 12000),

  -- Tier 3
  (3, 'A', 'CycleGear France',
   'Équipementier national. Paiement fixe mensuel.',
   35000, null, null, null),
  (3, 'B', 'CycleGear Champions',
   'Équipementier national. Bonus si ton équipe est dans le top 3 du classement.',
   22000, 'top3_standings', 'Ton équipe doit être dans le top 3 du classement de la ligue.', 20000),

  -- Tier 4
  (4, 'A', 'EuroBank Cycling',
   'Sponsor bancaire premium. Paiement fixe mensuel.',
   65000, null, null, null),
  (4, 'B', 'EuroBank Trophy',
   'Sponsor bancaire. Bonus si tu remportes une victoire d''étape en Grand Tour.',
   40000, 'grand_tour_stage_win', 'Un de tes coureurs doit gagner une étape de Grand Tour ce mois-ci.', 40000),

  -- Tier 5
  (5, 'A', 'TitanSport Global',
   'Sponsor élite mondial. Paiement fixe mensuel garanti.',
   110000, null, null, null),
  (5, 'B', 'TitanSport Legend',
   'Sponsor élite. Bonus si ton équipe est 1ère du classement en fin de mois.',
   70000, 'league_leader', 'Ton équipe doit être première du classement de la ligue ce mois-ci.', 70000)

on conflict (tier, option) do nothing;
