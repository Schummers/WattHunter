# Prompt — Analyse complète du codebase WattHunter (rewrite vs refactor, classic-only, mobile)

> Usage : coller ce prompt dans une nouvelle session Claude Code à la racine du repo
> (`~/AI OS/cycling/watthunter`), en mode plan ou avec orchestration multi-agents
> ("use a workflow" / "ultracode" pour débloquer l'orchestration). Budget indicatif :
> 6 subagents en parallèle + 1 synthèse.

---

## Contexte produit (à donner tel quel aux agents)

WattHunter est un jeu d'enchères cyclisme : Turborepo pnpm, Next.js 16 App Router
(apps/web, ~294 fichiers TS/TSX), Supabase (Postgres + Auth + Realtime, 186 migrations,
logique métier dans des RPCs SECURITY DEFINER), pipeline Python local de scraping
procyclingstats (services/pcs-sync, ~58 fichiers).

Décision produit actée (2026-07-04, voir `docs/ROADMAP_ET_REX.md` et la mémoire projet) :
- Le mode **manager** (budgets, levels, treasury, bonus financiers, finance par phase)
  est **condamné**. On assume de le casser.
- Le mode **classic** (budget plat 2M par phase, squad 10, XP-only) devient le mode unique.
- Une seule mécanique du manager est candidate à survivre : **les sponsors** (réorientés
  XP, plus de bonus financiers), avec les goals et la dimension nationalité.
- Cible long terme : app mobile iOS **et** Android.

## Question centrale

Si on repartait de zéro aujourd'hui, avec le savoir accumulé, que ferait-on ? Trois
sous-questions, dans cet ordre de priorité :

1. **Découplage** : à quel point classic et manager sont-ils entrelacés (schéma DB, RPCs,
   server actions, composants, pipeline Python) ? Peut-on garder le code classic existant
   et amputer le manager, ou le couplage rend-il l'amputation plus chère qu'une réécriture ?
2. **Qualité** : quelles sont les dettes structurelles qu'un rewrite éliminerait
   (et qu'un refactor n'éliminerait pas) ?
3. **Mobile** : quelle stack pour iOS + Android, et quelle part de l'existant survit
   (le backend Supabase et le pipeline Python sont a priori réutilisables tels quels,
   à vérifier) ?

## Lectures préalables obligatoires (chaque agent, avant de fouiller)

- `docs/ARCHITECTURE.md` (carte du code)
- `docs/GAME_RULES.md` §11 (constantes) + §14/§19 (règles classic)
- `docs/ROADMAP_ET_REX.md` (décision classic-only et refonte visée)
- `CLAUDE.md` racine (règles, stack, gotchas)

Tous les agents sont **read-only**. Aucune modification de code, aucune migration.

---

## Découpage en subagents

Chaque agent écrit son rapport dans `research/rewrite-analysis/findings/<slug>.md`,
avec ce format : constat (fichiers:lignes à l'appui), verdict garder / adapter / jeter,
coût estimé (S/M/L), risques. Pas de généralités : chaque affirmation cite du code.

### Agent 1 — Couplage classic/manager : base de données
Périmètre : `supabase/migrations/` (186 fichiers), schéma résultant.
- Lister les tables et colonnes qui n'existent QUE pour le manager (treasury, treasury_log,
  levels, finance, bonus financiers sponsors, anti-runaway, auction budgets manager).
- Lister les tables partagées où les deux modes cohabitent via des colonnes ou des valeurs
  (leagues.mode, teams, contracts, auction_bids, rider_xp_daily, sponsor_*).
- Pour les sponsors : séparer ce qui est réutilisable en XP-only (goals, tiers, nationalité)
  de ce qui est intrinsèquement financier (race result bonuses en euros, treasury credits).
- Livrable clé : le schéma cible minimal classic-only (liste de tables), et la liste des
  tables/colonnes à dropper.

### Agent 2 — Couplage classic/manager : RPCs et logique métier Postgres
Périmètre : les fonctions SQL dans les migrations (RPCs SECURITY DEFINER, triggers).
- Cartographier chaque RPC : classic-only, manager-only, ou branchée sur le mode
  (chercher les patterns `mode`, `is_classic`, `classic_`, gardes treasury).
- Identifier les RPCs où le chemin classic traverse du code manager (validation treasury,
  salaires, level curve) même quand le mode est classic.
- Livrable clé : pour chaque RPC partagée, le coût d'extraction du chemin classic pur.

### Agent 3 — Couplage classic/manager : frontend
Périmètre : `apps/web/` (23 fichiers avec branchement de mode explicite, 47 mentionnant
classic ; vérifier qu'il n'y en a pas plus via d'autres patterns).
- Cartographier les routes, server actions et composants : classic-only, manager-only,
  branchés. Inclure `computeClassicBudget` et les 4 surfaces budget connues.
- Évaluer la qualité structurelle du front indépendamment du mode : duplication,
  composants monolithiques, respect du design system v3, patterns server actions
  (Zod → rpc → forwarding), gestion d'erreurs.
- Livrable clé : si on supprime le manager, quel pourcentage du front tombe, et le front
  restant est-il une base saine ou un candidat au rewrite.

### Agent 4 — Pipeline Python pcs-sync
Périmètre : `services/pcs-sync/` (hors .venv).
- Cartographier les pipelines (init-riders, post-race, startlists, enrich, scoring,
  goal_evaluator, sponsor_bonus, tactics, rescue) : lesquels servent le classic,
  lesquels sont manager-only (sponsor_bonus en euros, finance).
- Évaluer la robustesse : gestion Cloudflare, idempotence, pagination `_fetch_all`,
  duplication du multiplicateur salaire avec le front (gotcha connu), tests pytest.
- Livrable clé : le pipeline survit-il tel quel à un rewrite de l'app (a priori oui,
  il ne parle qu'à Supabase), et sa liste de dettes propres.

### Agent 5 — Architecture cible mobile (iOS + Android)
Périmètre : recherche + confrontation à l'existant. Pas de fouille exhaustive du code,
mais lire `docs/watthunter-design-system-v3.md` et la structure des routes.
- Comparer honnêtement 4 options : (a) React Native / Expo + Supabase, (b) Flutter,
  (c) natif Swift + Kotlin, (d) PWA / web mobile-first en gardant Next.js.
  Critères : réutilisation du backend Supabase (auth, realtime, RLS), réutilisation
  des types et de la logique TS existante, un seul dev solo, notifications push
  (décision actée : pas d'emails, notifications in-app à définir), coût de maintien
  de 2 plateformes, distribution (App Store / Play Store vs web).
- Point critique : la logique métier est dans Postgres (RPCs), pas dans le client.
  Vérifier que ça tient, et ce que ça implique pour chaque option.
- Livrable clé : une recommandation classée, avec ce qui se jette et ce qui se garde
  de l'existant pour chaque option.

### Agent 6 — Dette transverse et "si on recommençait"
Périmètre : transversal, en s'appuyant sur l'historique (`MEMORY.md` projet, postmortems
dans `docs/runbooks/`, audits dans `review/`).
- Recenser les classes de bugs récurrentes (pagination PostgREST 1000 rows, idempotence
  treasury, calendriers divergents, drift de rescoring, gotchas RLS) et dire pour chacune :
  bug d'implémentation (un rewrite le referait) ou défaut d'architecture (un rewrite
  peut l'éliminer par construction).
- Juger les choix structurants avec le recul : logique métier en RPCs SQL vs services,
  186 migrations sans schéma déclaratif, scraping local-only, monorepo Turborepo pour
  une seule app, absence de couche API dédiée.
- Livrable clé : la liste courte des décisions d'architecture qu'on changerait vraiment,
  et celles qu'on garderait.

---

## Synthèse finale (agent 7 ou session principale, après lecture des 6 rapports)

Produire `research/rewrite-analysis/SYNTHESIS.md` :

1. **Verdict principal** avec trois scénarios chiffrés en gros effort relatif :
   - A. Amputation : garder le repo, supprimer le manager, nettoyer.
   - B. Rewrite backend-preserved : nouveau client (mobile-first), on garde Supabase
     (schéma nettoyé) et le pipeline Python.
   - C. Rewrite complet, y compris schéma DB reconstruit classic-only.
2. Un tableau croisé : composant existant × scénario → garder / adapter / jeter.
3. La recommandation, assumée, en une phrase, avec la première étape concrète.
4. Les 5 risques principaux du scénario recommandé.

Contraintes de la synthèse : pas de verdict "ça dépend". Trancher. Le lecteur est le
fondateur, solo, qui veut savoir quoi faire de ses prochaines semaines.
