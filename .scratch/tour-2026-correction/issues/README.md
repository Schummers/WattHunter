# Correction du Tour de France 2026 — rangs + rescore au barème actuel

Suite du diagnostic `.scratch/pcs-import-integrity/issues/09-diagnostic-tour-2026.md`
(branche `investigation/integrite-import-tour-2026`). Décision de l'utilisateur,
2026-09-14 : corriger les rangs faux **et** rescorer le Tour au code d'aujourd'hui,
finaux et événements compris. Tout se calcule et se valide sur une **base locale**,
copie de la prod ; la prod n'est touchée qu'au dernier ticket, par rejeu.

Deux conséquences produit acceptées en amont :

- le podium cumulé bouge (Peejee 2e → 3e, Klimax 2e), par effet de barème, pas de bug ;
- le Giro 2026 reste au barème de juin, le Tour passe à celui de septembre.

Le durcissement prévu par le handoff (outils hors de `.scratch/`, crosscheck
Wikipedia dans le runbook standard) est un chantier séparé, pas un ticket ici.

Ordre : 1 et 2 en parallèle, puis 3 et 4 (parallèles), puis 5, puis 6 après
validation humaine.
