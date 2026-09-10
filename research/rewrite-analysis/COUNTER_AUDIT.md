# Contre-audit des findings rewrite-analysis

> Second avis adversarial, 2026-08-27. Méthode : re-mesures indépendantes (§A du
> prompt) AVANT lecture des rapports, puis lecture 01→06, puis SYNTHESIS.md en
> dernier. En plus du code : requêtes SQL read-only sur la prod (pg_policy,
> comptages), l'angle mort que les six rapports déclaraient eux-mêmes.

## 1. Verdict global

**Fiable avec corrections.** Le verdict central (scénario B, backend conservé,
`forceResolveRound` comme blocage n°1) survit à toutes mes re-vérifications. Les
erreurs trouvées ne renversent pas la recommandation, mais deux d'entre elles
changent des choses concrètes : un P0 sécurité est ouvert en prod **aujourd'hui**
(pas "hérité et peut-être corrigé"), et le chiffre-clé qui fonde le classement
RN > Flutter est gonflé d'environ 2x.

## 2. Erreurs factuelles trouvées

| # | Affirmation | Où | Ce que dit réellement le code / la prod | Gravité |
|---|---|---|---|---|
| 1 | "~5000-5500 lignes de `lib/` portables sur 6367" | 05 §2, §4 ; SYNTHESIS §5 | `lib/` hors tests = **5672** lignes, dont **2040** générées (`database.types.ts`, régénérables en une commande), ~160 de wrappers Supabase Next-only, et **~556 manager-only qu'on va jeter** (`sponsors.ts` 160, `levels.ts` 113, `co-unlock.ts` 115, `boost.ts` 66, `gt-goals.ts` 54, `strategies.ts` 48). Logique écrite main, portable ET conservée : **~2 900 lignes** (dont `get-race-feed-data.ts` 478 à débarrasser de `import "server-only"` et `tactics.ts` à re-brancher sur lucide-react-native). Le rapport 03 §5 estimait lui-même "600-800 lignes" — les deux rapports se contredisent et la synthèse a repris le chiffre haut sans signaler le conflit. | Change un détail (le classement RN > Flutter tient, voir §4.5) |
| 2 | "La policy d'INSERT direct sur `auction_bids` (initiale, `20260221000000:358`) n'a jamais été droppée" | 06 §1.5 (D1-01) ; SYNTHESIS §3.6 | La policy citée (`auction_bids_insert_own`) **a été droppée** par `20260612000000` (en prod). Mais une **jumelle**, `auction_bids_insert` ([20260227000000:33](supabase/migrations/20260227000000_auction_rounds_and_scoring.sql:33)), n'a jamais été droppée nulle part — **vérifié vivante en prod** (pg_policy, INSERT pour `authenticated`). Le hardening de juin croyait avoir fermé le trou ("Drop the direct-INSERT policy") et n'en a fermé qu'un sur deux. Le finding est donc juste **par accident de citation**, et il est plus grave que le rapport ne le dit : bypass de `place_bid` (solvabilité, cooldown 7j, level gating, incrément) ouvert aujourd'hui, une migration d'une ligne le ferme. | **Change une priorité** : à droper maintenant, pas "au chantier" |
| 3 | "les 14 tests des 4 fichiers e2e sont `test.fixme`, donc 0 e2e exécuté" | 03 §3.7 ; SYNTHESIS §3.5 | 9 `test.fixme` sur 3 fichiers ; `e2e/smoke.spec.ts` contient **des tests actifs** (surface publique, console errors). Le point de fond (zéro e2e sur les flux de jeu, spec classic périmée 1.5M/cap 8 — celle-ci re-vérifiée exacte, [classic-mode.spec.ts:21](apps/web/e2e/classic-mode.spec.ts:21)) tient. | Cosmétique |
| 4 | "33 leagues classic" | 01 §5 | Prod : **1** ligue classic sur **4** ligues au total. | Cosmétique (mais réduit encore le risque données du scénario B : la "prod vivante" c'est 9 équipes d'une seule ligue) |
| 5 | "`forceResolveRound` sans vérif commissaire : fix connu depuis mai, jamais appliqué" (SEC-09) | 06 §1.5 | C'est une **décision produit**, pas un oubli : le code documente explicitement qu'un membre quelconque peut forcer ([actions.ts:463-466](apps/web/app/(game)/league/[leagueId]/auction/actions.ts:463)), la PR #70 (août) a précisément ouvert `open_due_auction` à tout membre, et `validateRound` appelle `forceResolveRound` au consensus. Le classer "dette non traitée depuis 3 mois" est faux. | Change un détail (à dé-prioriser) |
| 6 | Ratios d'effort A=1x, B=3-4x, C=6-8x | SYNTHESIS §1 | **Aucun des six rapports ne les dérive.** Ils apparaissent pour la première fois dans la synthèse, sans base. L'ordre (A<B<C) est défendable ; les multiplicateurs sont inventés. | Change un détail — ne pas planifier dessus (voir §5.3) |

## 3. Confirmations importantes (re-vérifiées ligne à ligne, elles tiennent)

1. **`forceResolveRound`** : exactement comme décrit. 275 lignes
   ([actions.ts:413-687](apps/web/app/(game)/league/[leagueId]/auction/actions.ts:413)),
   `createAdminClient()` ligne 440, mutations séquentielles sans transaction
   (lock optimiste + try/catch par coureur en compensation, admis en
   commentaire), partagée classic+manager (branche mode dans la cascade payday,
   lignes 325-358), dupliquée avec `auction.py`. La pièce centrale du verdict
   est solide.
2. **`place_bid` redéfinie 10 fois, `validate_round` 9 fois** (hors
   `_rollback/`), recomptées par grep. Aucune source canonique par RPC,
   `supabase/functions/` n'existe pas. La triplication du purchasing power et
   ses 3 migrations de fix des 19-21 août sont réelles.
3. **Realtime jamais utilisé** : re-grep `\.channel(|postgres_changes` sur tout
   `apps/web` (y compris `hooks/`, qui ne contient qu'un
   `use-scroll-direction.ts`) : zéro.
4. **Doublon démo** : re-mesuré sur 3 fichiers — ranking 40,5 %, market 37,4 %,
   team 41,9 % — et c'est bien du fetching + rendu recopiés avec la source
   hardcodée `DEMO_LEAGUE_ID`, pas deux logiques légitimes.
5. **Périmètre manager-only du front** : les comptes par dossier tombent au
   chiffre près (budget 1154, strategies 849, levels 280) ; le gating nav est
   bien dans `sidebar.tsx`/`bottom-nav.tsx` ; et le piège inverse est écarté :
   GT squad, tactics, scoring sont **réellement partagés dans le code** (pas
   seulement dans GAME_RULES §19) — `gt-team-client.tsx` ne branche que la
   section sponsors et le rôle underdog, `place_tactic` et la page tactics ne
   lisent jamais le mode. ~10-13 % est le bon ordre de grandeur.
6. **Findings A/B (invariants non gardés)** : confirmés dans le code.
   `recompute_underdog_eligibility` boucle sur toutes les ligues sans filtre de
   mode ; `gt_claim_dnf_refund` crédite `treasury` sans aucune garde de mode ni
   dans la RPC, ni dans son appelant TS
   ([gt/actions.ts:217](apps/web/app/(game)/league/[leagueId]/team/gt/actions.ts:217)),
   ni dans `gt-dnf-card.tsx` (rendu en classic). **Vérification prod que les
   rapports demandaient** : 0 équipe classic flaguée, 0 `gt_dnf_refund` classic
   dans `treasury_log`, 0 trésorerie classic > 2M. Latent, pas matérialisé —
   mais la Vuelta tourne, les squads GT classic existent, et un claim de refund
   est à un clic. Le B est un risque **vivant** pendant 3 semaines, pas
   théorique.

Angles morts des rapports, comblés ici : prod DB (fait, ci-dessus), Edge
Functions Supabase (il n'y en a **aucune**), `hooks/` (1 fichier trivial),
cron (aucun — pg_cron indisponible sur le plan).

## 4. Mon avis sur le verdict

**Je ferais B, mais pas dans cet ordre-là, et pas maintenant.**

1. **Avant tout "chantier"** : deux gestes de quelques heures que la synthèse
   noie dans les étapes. (a) Droper `auction_bids_insert` (erreur #2) — P0
   prod, une migration. (b) Garder `gt_claim_dnf_refund` contre le mode classic
   (un `IF mode='classic' THEN return error` temporaire, ou masquer le bouton),
   parce que la Vuelta est en cours et que le redesign produit "refund en
   économie plate" viendra après.
2. **L'ordre amputation → portage → client est bon sur le fond** — l'argument
   "porter avant d'amputer = traduire en PL/pgSQL du code qu'on supprime la
   semaine suivante" est correct (le level gating lignes 528-540 et la cascade
   payday disparaissent ou se simplifient post-amputation). Mais le **calendrier
   l'inverse partiellement** : amputer la DB d'une prod qui fait tourner une
   Vuelta jusqu'à mi-septembre est le pire timing possible. Séquence corrigée :
   gardes (§4.1) tout de suite → décisions produit (DNF refund flat-budget,
   barème sponsors XP) + éventuelles maquettes RN sur le backend intact pendant
   la Vuelta → amputation DB/RPC après l'arrivée à Madrid → portage
   `forceResolveRound` → client. L'argument "client d'abord pour dérisquer
   l'UX" ne me convainc pas au-delà de ça : trois Grands Tours de playtest avec
   de vrais joueurs ont déjà validé la boucle de jeu ; le risque résiduel est
   côté backend, pas côté UX.
3. **Le scénario A/PWA n'est pas écarté "juste par préférence"** : le push iOS
   en PWA (16.4+, homescreen-only) est un argument technique réel, et les
   notifications sont LE trou produit documenté (2 équipes à 0 XP faute
   d'alerte cutoff). Mais la synthèse a raté le scénario qui neutralise cet
   argument : **Capacitor** (Next.js dans un shell natif) donne le push natif
   et la présence store en gardant 100 % du code, pour une fraction de
   l'effort. Il perd sur l'expérience native que le fondateur veut — c'est un
   vrai trade-off, mais il n'a jamais été instruit, et pour un solo dev c'est
   le fallback le plus rationnel si B dépasse son budget temps. Expo+RN-Web
   (une codebase pour les trois plateformes) mérite aussi une page avant de
   signer : sinon B laisse un web Next.js à maintenir EN PLUS de l'app RN.
4. **Les ratios d'effort sont inventés** (erreur #6). Ce qu'il faut au
   fondateur, ce n'est pas "3-4x", c'est un chiffrage absolu en semaines
   confronté à sa bande passante réelle — la Vuelta à faire tourner
   quotidiennement, et un objectif Q3 qui n'est pas WattHunter. Si B ne rentre
   pas, Capacitor est le plan B honnête, pas "B plus lentement".
5. **RN > Flutter tient malgré la correction du chiffre** : ~2 900 lignes
   portables + les types régénérables côté TS + le même SDK Supabase + le
   capital TypeScript du fondateur suffisent largement à écarter une
   réécriture Dart. C'est le chiffre qui était faux, pas le classement.

## 5. Ce qui manque encore avant de lancer le chantier

1. **Migration immédiate** : `DROP POLICY auction_bids_insert ON auction_bids`
   (après vérif rapide qu'aucun chemin app n'insère en direct — le hardening de
   juin l'avait déjà vérifié pour la jumelle).
2. **Garde classic sur `gt_claim_dnf_refund`** (et par prudence
   `gt_place_emergency_bid`) avant le premier abandon de la Vuelta, en
   attendant la vraie décision produit.
3. **Les deux décisions produit bloquantes** identifiées par la synthèse (DNF
   refund/emergency bid en économie plate ; barème sponsors XP-only) — à
   trancher pendant la Vuelta, elles ne demandent aucun code.
4. **Un chiffrage absolu** des étapes 0-2 (semaines, pas ratios) confronté au
   calendrier (fin de Vuelta ~13/09) et à la bande passante réelle du
   fondateur, plus une page sérieuse sur Capacitor et Expo+RN-Web avant
   d'acter RN pur.
5. **Régénérer `ARCHITECTURE.md`** depuis le code (un mois de retard confirmé)
   — c'est le document sur lequel le chantier s'appuiera.
