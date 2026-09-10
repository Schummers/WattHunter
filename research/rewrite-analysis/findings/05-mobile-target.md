# Axe 5 — Architecture cible mobile iOS et Android

> Lectures préalables faites : `docs/ARCHITECTURE.md`, `docs/ROADMAP_ET_REX.md`, `CLAUDE.md` racine,
> `docs/GAME_RULES.md` §11/§14/§19. Périmètre : lib/, routes de `apps/web/app/`, package.json (racine +
> `apps/web`), `docs/watthunter-design-system-v3.md`. Pas d'archéologie exhaustive du reste du repo.

---

## 0. Contexte factuel vérifié

- Stack web actuelle : Next.js 16 App Router + React 19.2.3, TypeScript strict, Tailwind v4, Supabase
  (`@supabase/ssr` 0.8.0, `@supabase/supabase-js` 2.97.0). `apps/web/package.json`.
- Design system : `docs/watthunter-design-system-v3.md` (2063 lignes), 189 custom properties CSS dans
  `apps/web/app/globals.css`. Palette Sky Blue Night + Cyan, dark-first, Geist Sans/Mono, Lucide +
  Phosphor. La couche 4 ("Mesh Gradient animé") est marquée **"Web only"** explicitement dans le doc
  (`docs/watthunter-design-system-v3.md:16`), implémentée en WebGL/OGL (makegradient.com) — ne portera
  pas telle quelle sur mobile natif.
- Aucun usage de Supabase Realtime dans le code (`grep -rn "realtime|\.channel(|postgres_changes"` sur
  `apps/web/app`, `lib`, `components`, `hooks` : 0 résultat), malgré `docs/ARCHITECTURE.md:18` qui liste
  Realtime "Prévu pour enchères live" — c'est une intention documentée, jamais implémentée. Le jeu
  fonctionne aujourd'hui en polling/revalidation à la navigation (`revalidatePath`), pas en push.
- Aucune infra de notification, ni email (ADR-013, supprimé définitivement) ni in-app (`docs/GAME_RULES`
  et `MEMORY.md` : "stratégie à définir"). Un seul hit du mot "notification" dans le code, dans
  `apps/web/app/(game)/league/[leagueId]/auction/page.tsx`, pas une infra.
- 185 fichiers de migration, 76 contiennent `SECURITY DEFINER` (`grep -rl "SECURITY DEFINER"
  supabase/migrations/*.sql | wc -l`). 17 noms de RPC distincts effectivement appelés depuis
  `apps/web/app` (`place_bid` n'apparaît pas dans ce grep car appelé depuis un autre chemin/fichier non
  couvert par le pattern — à vérifier si besoin, mais la liste inclut `validate_round`,
  `gt_add_to_squad`, `gt_assign_role`, `gt_swap_slot`, `gt_remove_from_squad`, `gt_claim_dnf_refund`,
  `gt_place_emergency_bid`, `place_tactic`, `release_rider`, `confirm_phase_setup`, `join_league_by_code`,
  `launch_first_auction`, `leave_league`, `set_starting_level`,
  `submit_conforming_drafts`, `auto_validate_unactionable_teams`,
  `close_remaining_rounds_if_complete`).

---

## 1. Point critique — la logique métier vit-elle vraiment dans Postgres ?

**Réponse mesurée : majoritairement oui, avec deux exceptions significatives et documentées comme
telles dans le code lui-même.** Chiffrage sur les 15 `actions.ts` de `apps/web/app` (2677 lignes total,
`find apps/web/app -name "actions.ts" | xargs wc -l`) :

| Fichier | Lignes | Appels `.rpc(` | Verdict |
|---|---|---|---|
| `auction/actions.ts` | 687 | 5 | **Thick** — voir 1.1 |
| `team/gt/actions.ts` | 432 | 8 | Fin — orchestration légère de RPCs |
| `league/create/actions.ts` | 268 | 0 | **Thick** — voir 1.3 |
| `team/gt/tactics/actions.ts` | 214 | 1 | Non lu en détail (hors échantillon) |
| `team/strategies/actions.ts` | 211 | 0 | **Thick** — voir 1.2, mais Manager-only |
| `auction/rounds/actions.ts` | 188 | 0 | Logique légère (dates), admin-only |
| `settings/actions.ts` | 136 | 1 | Fin |
| `league/join/actions.ts` | 115 | 1 | Fin |
| `team/budget/actions.ts` | 110 | 0 | Non lu en détail |
| `auction/market/actions.ts` | 101 | 1 | Fin |
| reste (5 fichiers, 36-48 lignes) | 215 | 5 | Fin |

### 1.1 `forceResolveRound` — le vrai bloc de dette (`apps/web/app/(game)/league/[leagueId]/auction/actions.ts:413-687`, ~275 lignes)

C'est le cœur de la résolution d'enchères (tri gagnant/perdants, level-gating par `pcs_rank`, garde
anti-doublon de contrat, création de contrat, nettoyage des draft_bids, ouverture du round suivant,
déclenchement de la cascade payday). Points vérifiés :

- Utilise `createAdminClient()` (service_role key, bypass RLS) — `apps/web/lib/supabase/admin.ts:1-27`,
  dont le commentaire dit explicitement : *"Used exclusively by mutation flows that mirror the Python
  pipeline (forceResolveRound). Do NOT add new callers without review."* C'est une exception assumée,
  pas un oubli.
- `docs/GAME_RULES.md:782` confirme : *"Round resolution (`forceResolveRound`) and scoring
  (`scoring.py`) are fully shared and never branch on mode."* — donc cette fonction sert Manager ET
  Classic, elle ne disparaît pas avec la bascule classic-only.
- Contredit littéralement la règle du CLAUDE.md racine du projet : *"NEVER mettre de logique métier
  dans une server action TS — pattern obligatoire : Zod validation → `supabase.rpc(...)` → error
  forwarding."* Cette règle a une exception non documentée dans le CLAUDE.md lui-même.
- **Conséquence directe pour le mobile** : cette fonction tourne côté serveur Next.js (server action),
  donc son code TypeScript n'a pas besoin d'être réécrit en Dart/Swift/Kotlin — mais elle n'est pas non
  plus appelable nativement par un client externe (RN, Flutter, Swift) sans passer par une Route Handler
  Next.js exposée en HTTP, car les Server Actions utilisent un protocole POST propriétaire lié au runtime
  Next. Un client mobile ne peut PAS non plus appeler Supabase directement pour reproduire cette logique,
  car elle exige la service_role key — que l'app mobile ne doit jamais détenir (règle CLAUDE.md
  "NEVER exposer la service_role key au browser/client", qui vaut a fortiori pour un binaire mobile
  décompilable). **Cette fonction doit soit rester derrière un backend Next.js/API route dédié, soit être
  portée en RPC Postgres SECURITY DEFINER** avant ou pendant le pivot mobile — c'est la seule des deux
  options qui permet à n'importe quel stack mobile (y compris natif pur) d'appeler Supabase directement
  avec l'anon key, exactement comme le font déjà les 17 RPC existants.

### 1.2 `saveStrategies` (`apps/web/app/(game)/league/[leagueId]/team/strategies/actions.ts:22-211`)

Vraie logique métier en TS : validation des unlocks par niveau, calcul du nombre de stratégies actives
projetées, état "immediate vs pending" selon qu'une enchère est ouverte, diff JSON de config, upsert
ligne par ligne sur `team_strategies` (pas de RPC). **Mais** : les stratégies sont une mécanique Manager
uniquement — `docs/GAME_RULES.md:709` : *"Policies / strategies | Yes | No"* (colonne Classic = No), et
`docs/ROADMAP_ET_REX.md:93` liste "le reste des stratégies (sauf nationalité)" dans "Ce qu'on jette".
**Ce fichier entier est un candidat JETER dans le cadre du pivot classic-only**, indépendamment du choix
de stack mobile — donc son coût de portage est nul si le rewrite suit la direction produit déjà actée.

### 1.3 `league/create/actions.ts` (268 lignes, 0 RPC)

Le flux de création de ligue (`createLeague`, `signupAndCreateLeague`) fait 4+ `.insert()` bruts
successifs non transactionnels (league, team, league_member, team_sponsors) — orchestration multi-étapes
en TS, pas atomique côté DB. Risque de ligue partiellement créée en cas d'échec réseau à mi-parcours.
Même remarque que 1.1 sur la portabilité serveur : ce n'est pas un problème de langage client, mais ça
reste un candidat à convertir en RPC transactionnel (`create_league_with_team`, déjà repéré comme dette
existante dans `MEMORY.md` : *"2 RLS-via-RPC (`set_team_sponsor`/`create_league_with_team`)"*).

### Verdict global de l'axe critique

Sur 2677 lignes de server actions, environ **275 lignes (`forceResolveRound`) portent une vraie dette
d'architecture bloquante pour le mobile** (usage service_role + logique non-RPC pour une fonction
partagée Manager/Classic qui survit au pivot), et **~211 lignes (`saveStrategies`) sont de la dette qui
s'annule d'elle-même** avec la décision produit déjà actée. Le reste (~2200 lignes) suit correctement le
pattern Zod → RPC ou fait de la lecture/agrégation légère. **Le client est globalement mince** : le
risque de "changement de stack cliente coûteux" ne vient pas de la logique métier dupliquée dans le
client web, il vient d'une seule fonction serveur à statut spécial qui doit être traitée avant le rewrite
mobile, quel que soit le stack choisi.

---

## 2. Réutilisabilité de `apps/web/lib/`

Vérifié par grep systématique (`grep -c "next/\|@/lib/supabase" apps/web/lib/*.ts`, `wc -l`, lecture des
imports en tête de fichier) sur les 42 fichiers non-test de `apps/web/lib/` (6367 lignes total,
`wc -l apps/web/lib/*.ts apps/web/lib/supabase/*.ts`).

### Réutilisable tel quel (fonctions pures / types, zéro import Next ou client Supabase concret)

30 fichiers sur 32 candidats n'importent ni `next/*` ni un client Supabase concret. Les plus gros et les
plus significatifs :

- `get-race-feed-data.ts` (478 lignes) — le plus gros fichier de logique métier lecture. Vérifié :
  prend un `SupabaseClient` générique en paramètre (`import type { SupabaseClient } from
  "@supabase/supabase-js"`, `apps/web/lib/get-race-feed-data.ts:2`), pas le client Next spécifique.
  Pattern d'injection de dépendance : **portable presque tel quel** vers un client RN/Expo qui utilise
  aussi `@supabase/supabase-js`. Contient `import "server-only"` en ligne 1 — à retirer pour réutilisation
  côté client mobile, ou à découper en une variante "core" sans cette contrainte.
- `rider-detail-data.ts` (509 lignes) — même pattern DI (`SupabaseClient` injecté), même portabilité.
- `format.ts` (90 lignes) — `calcMinSalary`, `formatMoney`, `countryCodeToFlag`, `smartCountdown` : pur,
  zéro dépendance. Directement réutilisable.
- `levels.ts`, `phases.ts`, `gt-phases.ts`, `gt-stage-schedule.ts`, `gt-stages.ts`, `gt-goals.ts`,
  `gt-roles.ts`, `tactics.ts`, `sponsors.ts`, `strategies.ts`, `budget.ts`, `achievements.ts`,
  `boost.ts`, `calendar.ts`, `league-mode.ts`, `classic-phases.ts`, `demo-constants.ts`,
  `wt-race-slugs.ts`, `tour-jerseys.ts`, `race-feed-helpers.ts`, `race-feed-types.ts`,
  `ranking-race-name.ts`, `grand-tour-completion.ts`, `supabase-pagination.ts`, `default-league.ts` :
  tous sans import Next ni client concret — constantes de jeu, calculs, helpers de formatage. Le
  générateur de types `database.types.ts` (2040 lignes) est lui aussi directement réutilisable (types
  TypeScript purs générés par le CLI Supabase, indépendants du framework).

### Non réutilisable tel quel (couplé web)

- `co-unlock.ts` (115 lignes) — seul fichier de `lib/` à importer directement
  `@/lib/supabase/server` (`createClient` server-side), donc couplé Next SSR. **Mais** : c'est le
  mécanisme "Co-Unlock Rule" de l'Anti-Runaway System, une mécanique **Manager-only**
  (`docs/ROADMAP_ET_REX.md:89` : "Le mode manager entièrement" est dans "Ce qu'on jette"). Comme
  `saveStrategies`, ce couplage n'a pas besoin d'être résolu — le fichier disparaît avec le pivot
  classic-only.
- Tout `apps/web/lib/supabase/*.ts` (browser/server/admin/middleware clients) est par nature
  Next-spécifique (cookies SSR, `server-only`) — attendu, pas un problème : un client mobile a de toute
  façon besoin de son propre client Supabase (`@supabase/supabase-js` + adaptateur AsyncStorage pour RN,
  ou SDK Dart/Swift natif).

### Conclusion réutilisabilité

**Le ratio est très favorable** : sur ~6300 lignes de `lib/`, l'essentiel (types, constantes de jeu,
calculs de salaire/score/dates, formatage) est déjà écrit en TypeScript pur sans dépendance framework.
Le seul fichier couplé (`co-unlock.ts`) est un module qui doit de toute façon être supprimé pour des
raisons produit, pas techniques. C'est un signal fort en faveur d'un stack mobile qui peut exécuter du
TypeScript (React Native/Expo) : ce module de ~5000-5500 lignes de logique pure serait partageable via un
package monorepo (`packages/game-logic` ou équivalent Turborepo) sans réécriture. Un stack Flutter,
Swift+Kotlin ou même une PWA React perdrait cet acquis à des degrés divers (voir §3).

---

## 3. Comparaison des quatre options

### Critère : réutilisation du backend Supabase (auth, realtime, RLS, RPC)

- **RN/Expo** : SDK JS officiel `@supabase/supabase-js`, même lib que le web, RLS/RPC/Auth identiques,
  session storage via `@react-native-async-storage/async-storage`. Aucune divergence de comportement
  RLS attendue (RLS vit en DB, indépendant du client).
  Verdict : natif, zéro friction.
- **Flutter** : SDK officiel `supabase_flutter` (Dart), maintenu par Supabase, couvre Auth/Postgrest/
  Realtime/Storage. RLS et RPC fonctionnent identiquement (RPC = appel HTTP PostgREST, langage-agnostique).
  Verdict : bon, mais c'est un second SDK à suivre en parallèle du SDK JS pour le web (deux surfaces de
  bugs/versions au lieu d'une).
- **Swift + Kotlin natif** : SDK officiel `supabase-swift` et `supabase-kt`, tous deux maintenus, mais
  ce sont **deux SDK distincts en plus du SDK JS** — trois implémentations du même contrat RPC/RLS à
  maintenir en synchro pour un dev solo.
  Verdict : fonctionnellement correct, mais matériellement 3x la surface de maintenance côté client pour
  chaque évolution de RPC.
- **PWA/web mobile-first** : c'est déjà le SDK JS du web actuel. Zéro changement.
  Verdict : trivial par définition — mais ne répond pas à la demande explicite de `docs/ROADMAP_ET_REX.md
  :74` : *"Application mobile iOS (compte développeur en cours d'obtention). L'expérience mobile native
  sera bien plus agréable que la web app."* Le propriétaire a déjà tranché contre le web pur pour ce
  critère précis — voir §4.

### Critère : réutilisation des types TS et de la logique existante

- **RN/Expo** : réutilise directement `database.types.ts` et l'essentiel de `lib/` tel que quantifié en
  §2 (~5000+ lignes de TS pur). C'est le seul des quatre qui réutilise du code, pas seulement des
  concepts.
- **Flutter** : réécriture complète en Dart. Les *règles* portent (elles sont documentées dans
  `GAME_RULES.md`, indépendantes du langage), mais chaque ligne de `lib/*.ts` doit être retraduite à la
  main, avec le risque de dérive (ex. `calcMinSalary`, les seuils de niveau dans `levels.ts`, le calcul
  Paris-timezone de `auction/rounds/actions.ts`).
- **Swift + Kotlin** : pire cas — deux réécritures indépendantes (Swift ET Kotlin) de la même logique,
  donc deux risques de dérive au lieu d'un, pour un dev solo.
- **PWA** : réutilisation totale par construction (même codebase).

### Critère : faisabilité pour un dev solo

- **RN/Expo** : une seule codebase pour iOS + Android, un seul langage (TS) déjà maîtrisé sur ce projet,
  Expo gère la chaîne de build/signing/OTA update sans nécessiter Xcode/Android Studio en continu.
  C'est objectivement l'option la moins coûteuse en effort humain pour un solo qui connaît déjà TS/React.
- **Flutter** : Dart est un nouveau langage à apprendre ; l'écosystème de widgets est mûr mais distinct
  du mental model React/Tailwind déjà internalisé sur ce projet. Faisable pour un solo motivé, mais coût
  d'apprentissage réel non négligeable en plus de la réécriture.
- **Swift + Kotlin** : deux nouveaux langages, deux toolchains, deux stores de composants UI à maintenir
  en parallèle. C'est l'option la plus lourde pour un solo — habituellement réservée à des équipes avec
  un dev iOS et un dev Android dédiés.
- **PWA** : le plus simple humainement (rien de nouveau), mais ne livre pas d'app installable sur les
  stores avec les capacités natives attendues (voir notifications push ci-dessous).

### Critère : notifications push (décision produit actée : pas d'emails, in-app à définir)

- **RN/Expo** : Expo Push Notifications (service géré, APNs + FCM unifiés derrière une seule API) est le
  chemin le plus direct pour livrer enfin la stratégie de notification "à définir" citée dans
  `CLAUDE.md` (*"Définir la stratégie de notifications in-app (pas d'emails)"*, item encore ouvert dans
  "Blockers ouverts avant alpha"). Aucune infra existante à remplacer (confirmé §0 : zéro notification
  code aujourd'hui), donc pas de dette à migrer, juste une brique à ajouter.
- **Flutter** : Firebase Cloud Messaging + APNs, bien supporté (`firebase_messaging`), un peu plus de
  configuration native de part et d'autre (certificats APNs, google-services.json).
- **Swift + Kotlin** : APNs et FCM configurés séparément par plateforme — le plus de travail, mais aussi
  le plus de contrôle fin si un jour le produit a des besoins de notification avancés (ex. live activity
  iOS pour un round d'enchères qui se termine).
- **PWA** : Web Push fonctionne sur Android (Chrome), mais **reste très limité/absent sur iOS Safari**
  historiquement (Apple a ouvert le Web Push iOS en 16.4+ mais seulement pour les PWA ajoutées à l'écran
  d'accueil, avec un taux d'adoption utilisateur incertain). Pour un jeu dont le driver produit est
  justement "l'app mobile iOS", la PWA est le choix le plus fragile sur exactement ce critère.

### Critère : coût de maintien de deux plateformes (iOS + Android)

- **RN/Expo** : une codebase, un pipeline EAS Build, deux stores. Le coût "deux plateformes" est
  quasiment absorbé — c'est le point fort structurel de l'option.
- **Flutter** : même proposition de valeur (une codebase Dart, deux plateformes), légèrement moins mature
  que RN sur l'écosystème de libs tierces mais très solide pour de l'UI standard.
- **Swift + Kotlin** : coût plein x2 par construction — deux codebases, deux cycles de QA, deux surfaces
  de bugs pour chaque feature. C'est la définition même du problème que ce critère pose.
- **PWA** : coût "deux plateformes" nul par construction, mais au prix de l'expérience native que le
  produit vise explicitly.

### Critère : distribution App Store / Play Store vs distribution web

- **RN/Expo, Flutter, Swift+Kotlin** : tous les trois passent par les stores, donc soumis à review Apple/
  Google, aux règles de paiement in-app (pertinent si le modèle d'abonnement + revenue-share évoqué en
  `docs/ROADMAP_ET_REX.md:104` se concrétise — Apple/Google prennent leur commission sur les achats
  numériques via leurs propres systèmes de paiement, contrainte à anticiper si un abonnement payant est
  vendu depuis l'app).
- **PWA** : distribution web instantanée, aucune review, mais aucune présence dans les stores — moins de
  découvrabilité pour "l'outil d'animation de communauté cyclisme" visé à terme.

### Critère : maturité des SDK Supabase par stack

Classement par maturité observée (communauté, fréquence de release, couverture Realtime/Storage) :
**JS (`supabase-js`, utilisé par RN/Expo et PWA) > Dart (`supabase_flutter`) > Swift/Kotlin natifs.** Le
SDK JS est le SDK de référence de Supabase (celui sur lequel les nouvelles features sortent en premier).
Les SDK Swift et Kotlin sont officiels et actifs, mais historiquement en retard de fonctionnalités par
rapport au SDK JS dans l'écosystème Supabase.

### Critère : portabilité du design system v3

- **RN/Expo** : Tailwind ne porte pas nativement, mais **NativeWind** (Tailwind pour React Native)
  permet de réutiliser une bonne partie du vocabulaire de classes et, surtout, la **structure des tokens
  déjà définis en CSS custom properties** (189 tokens dans `globals.css`) peut être reprojetée en objets
  JS/theme RN sans avoir à redéfinir la logique de palette (Sky Blue Night 200°, Cyan accent, radius-as-
  affordance). Geist Sans/Mono sont des fichiers de police embarquables tels quels sur RN. Lucide a une
  version React Native (`lucide-react-native`) ; Phosphor a `phosphor-react-native`. Seule la couche 4
  (Mesh Gradient WebGL, déjà marquée "Web only" dans le doc lui-même) ne porte pas et devrait être
  remplacée par un dégradé statique ou une animation native légère pour les écrans marketing/onboarding.
  **C'est le seul stack où le design system v3 survit presque intégralement.**
- **Flutter** : les tokens (couleurs, spacing, radius) sont réexprimables en `ThemeData` Dart, mais c'est
  une retraduction manuelle complète des 189 valeurs et de leur hiérarchie sémantique (3 niveaux :
  primitives → semantic → component, cf. `docs/watthunter-design-system-v3.md`). Geist et Lucide/Phosphor
  existent en package Flutter (`google_fonts` pour Geist si listé, `phosphor_flutter`), mais rien n'est
  repris automatiquement du code existant.
- **Swift + Kotlin** : même retraduction manuelle, en double (SwiftUI `Color`/`Font` assets d'un côté,
  Compose `MaterialTheme`/tokens Kotlin de l'autre). Coût de portage le plus élevé, dupliqué.
- **PWA** : portabilité totale par construction (c'est la même web app), au prix de ne pas être une app
  "native" au sens où le propriétaire l'entend dans `docs/ROADMAP_ET_REX.md:75`.

---

## 4. Recommandation classée

### #1 — React Native + Expo (recommandation retenue)

**Ce qui se garde tel quel** : `database.types.ts` (2040 lignes), l'essentiel de `apps/web/lib/*.ts`
identifié comme pur en §2 (~5000-5500 lignes sur 6367 — constantes de jeu, calcul salaire/XP/dates,
formatage), le SDK `@supabase/supabase-js` (mêmes appels RPC, même RLS), la structure des 189 tokens du
design system (réexprimables en thème NativeWind sans refaire le travail de calibration des couleurs/
contrastes déjà fait en v3), Lucide et Phosphor (existent en variante React Native). **Ce qui se jette
ou se réécrit** : toute la couche JSX/Tailwind web (composants `apps/web/components/*.tsx`, ~294 fichiers
TS/TSX au total pour le repo web selon le contexte produit) doit être redessinée en composants RN — un
`<div className="...">` ne devient pas un `<View>` automatiquement, c'est un vrai travail d'UI, mais avec
un vocabulaire de design déjà tranché à réutiliser plutôt qu'à inventer. La couche 4 Mesh Gradient WebGL
est à remplacer par un équivalent natif ou un asset statique. `forceResolveRound` et le flux
`league/create` doivent être portés en RPC Postgres avant que le client mobile puisse les appeler en
direct (cf. §1.1, §1.3) — ce travail est nécessaire **quel que soit le stack mobile choisi**, ce n'est pas
un coût spécifique à RN.

**Premier pas concret** : avant tout code d'app, porter `forceResolveRound` en RPC Postgres SECURITY
DEFINER (le pattern existe déjà 76 fois dans les migrations, c'est une extension du même mécanisme, pas
une nouvelle architecture) — ce geste seul rend l'ensemble du backend appelable en direct avec l'anon key
depuis n'importe quel client, mobile ou web, et lève le blocage identifié en §1.1 pour les quatre options,
pas seulement RN.

### #2 — PWA / web mobile-first (Next.js conservé)

**Ce qui se garde** : tout, à 100 %. **Ce qui se jette** : rien. **Premier pas concret** : ajouter un
manifest + service worker à `apps/web`, tester l'installabilité iOS/Android. C'est l'option la moins
chère et la moins risquée techniquement — mais elle échoue sur le critère que le propriétaire a
explicitement mis en avant (*"L'expérience mobile native sera bien plus agréable que la web app"*,
`docs/ROADMAP_ET_REX.md:75`) et sur les notifications push iOS (§3), qui sont précisément le chantier
produit ouvert le plus cité (in-app notifications). À garder en tête comme **filet de sécurité** si le
budget temps pour RN s'avère insuffisant, pas comme cible principale.

### #3 — Flutter

Viable techniquement (SDK Supabase officiel mûr, une seule codebase Dart pour les deux plateformes), mais
jette la totalité de l'acquis quantifié en §2 (~5000 lignes de logique TS pure) et impose l'apprentissage
d'un nouveau langage à un dev solo qui a déjà tout son capital de compétence en TypeScript sur ce projet
précis. À ne considérer que si une raison technique spécifique à Flutter apparaissait (ex. besoin de perf
graphique que RN ne couvrirait pas) — rien dans le contexte produit actuel (jeu de gestion d'enchères,
pas de rendu temps réel lourd) ne le justifie.

### #4 — Natif Swift + Kotlin

Écarté pour un dev solo. Coût x2 structurel sur toute feature future (§3, "coût de maintien de deux
plateformes"), deux réécritures indépendantes de la logique métier au lieu d'une, deux SDK Supabase à
suivre en plus du SDK JS déjà utilisé côté web. Le seul avantage réel (contrôle fin des capacités
plateforme, ex. Live Activities iOS) ne pèse pas assez face au contexte d'un solo founder avec un jeu de
niche qui a déjà, par sa propre RÉX, un historique documenté de "feature-creep" et de "sous-estimation du
coût de maintenance technique" (`docs/ROADMAP_ET_REX.md:37-43`) — choisir le stack le plus coûteux à
maintenir répéterait exactement l'erreur diagnostiquée.

---

## 5. Realtime et mode hors-ligne — ce que les enchères à fenêtre temporelle imposent

Constat de départ (§0) : **le jeu n'utilise pas Realtime aujourd'hui**, malgré l'intention documentée
dans `ARCHITECTURE.md`. Le modèle actuel est poll-on-navigation (`revalidatePath` après chaque mutation,
pas de push serveur→client). C'est une simplification bienvenue pour le mobile : il n'y a pas
d'abonnement Realtime existant à porter ou à casser.

Mais les enchères ont bien des contraintes temporelles dures, vérifiées dans le code :
- `auction/rounds/actions.ts` gère des `closes_at`/`opens_at` en timezone Europe/Paris explicite
  (`toParisIso`, `getParisOffset`), avec un mécanisme de "lazy-open" (le round ne s'ouvre pas par un cron,
  il s'ouvre à la prochaine requête après l'heure prévue).
- `GAME_RULES.md` et `MEMORY.md` documentent un `role_cutoff` (11h CET) qui verrouille les squads GT, et
  au moins un incident vécu (Vuelta 2026 étape 1) où deux équipes ont scoré 0 XP car leur squad était
  verrouillée après le cutoff sans qu'elles en aient été alertées — cité dans `MEMORY.md` comme "action
  à envisager : alerter les joueurs avant le cutoff".

**Conséquences concrètes pour le client mobile, quel que soit le stack :**

1. **Le calcul de "temps restant avant cutoff" ne doit jamais faire confiance à l'horloge locale de
   l'appareil.** Un joueur avec une horloge mal réglée (fréquent sur mobile, fuseau auto désactivé) qui
   voit un compte à rebours calculé côté client sur `Date.now()` peut croire avoir du temps alors que le
   serveur a déjà fermé le round. Le pattern déjà en place côté web (`smartCountdown` dans `format.ts`,
   90 lignes, pur donc réutilisable tel quel sur RN) doit rester alimenté par une heure serveur ou au
   minimum un delta serveur/client calculé au chargement, jamais par l'horloge locale seule — ce n'est
   pas un problème nouveau introduit par le mobile, mais le mobile aggrave le risque (appareils voyageant
   entre fuseaux, horloge auto désactivée plus courante que sur desktop).
2. **C'est précisément le cas d'usage qui justifie d'ajouter enfin les notifications push** (§3) : un
   rappel "ton round ferme dans 1h" ou "le cutoff squad approche" est plus fiable qu'un compte à rebours
   dans une app que le joueur n'a pas ouverte. C'est un gain produit direct du passage au natif, pas
   seulement un nice-to-have.
3. **Mode hors-ligne : ne pas viser l'écriture hors-ligne.** Une enchère est par nature une compétition à
   somme nulle entre joueurs sur une fenêtre de temps commune (`auction_bids`, résolution sealed-bid par
   round) — permettre à un client de composer une mise hors-ligne et de la soumettre plus tard créerait
   une incohérence avec l'état serveur au moment de la resoumission (montant plus/moins valide, round
   déjà fermé, coureur déjà pris). La bonne cible n'est pas l'offline-first mais un **cache de lecture
   optimiste + retry réseau** (afficher les données déjà chargées quand la connexion tombe, mais bloquer
   ou avertir clairement toute action de mise en attendant la reconnexion) — un besoin standard bien
   couvert par les libs de cache RN habituelles (TanStack Query, déjà idiomatique dans l'écosystème RN/
   Expo), pas un besoin de sync bidirectionnelle façon CRDT.
4. **Realtime vaut la peine d'être ajouté au moment du rewrite**, mais seulement pour la lecture (statut
   du round, mises adverses visibles en direct) — pas pour l'écriture. `supabase-js` sur RN gère les
   canaux Realtime de façon identique au web ; ce serait la première vraie utilisation de la fonctionnalité
   promise depuis `ARCHITECTURE.md` mais jamais construite.

---

## Résumé exécutable

1. **Choix : React Native + Expo.** Classement complet : RN/Expo > PWA (filet de sécurité) > Flutter >
   Swift+Kotlin (écarté).
2. **Premier geste, indépendant du choix de stack** : porter `forceResolveRound`
   (`apps/web/app/(game)/league/[leagueId]/auction/actions.ts:413-687`) en RPC Postgres SECURITY DEFINER.
   C'est un blocage réel et documenté (service_role key, logique non-RPC), pas une hypothèse.
3. **Acquis à ne pas perdre** : ~5000-5500 lignes de `apps/web/lib/` sont déjà du TypeScript pur,
   découplé de Next.js (souvent via injection de `SupabaseClient` en paramètre) — un choix RN les
   récupère quasi tel quel dans un package partagé.
4. **Dette qui s'annule d'elle-même avec le pivot classic-only** : `co-unlock.ts` et
   `team/strategies/actions.ts` (326 lignes cumulées de logique Manager-only) n'ont pas besoin d'être
   portés, ils disparaissent avec le mode manager.
5. **Realtime** : jamais implémenté malgré l'intention documentée — à construire en lecture seule au
   moment du rewrite, pas en écriture (les enchères sealed-bid ne supportent pas l'offline-write).
