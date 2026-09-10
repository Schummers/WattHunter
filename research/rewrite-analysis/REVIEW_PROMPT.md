# Prompt — Contre-audit des findings rewrite-analysis (second avis)

> Usage : coller dans une NOUVELLE session Claude Code (modèle Fable, contexte
> vierge) à la racine du repo `~/AI OS/cycling/watthunter`. Session read-only.

---

## Ta mission

Tu es un contre-auditeur. Un premier audit multi-agents a produit 6 rapports
dans `research/rewrite-analysis/findings/` et une synthèse dans
`research/rewrite-analysis/SYNTHESIS.md`. Ce travail va décider des prochaines
semaines du fondateur (dev solo). Ton rôle n'est PAS de refaire l'audit, ni de
le paraphraser : c'est de le **casser s'il est cassable**.

Posture : adversariale. Pars du principe que chaque affirmation est fausse
jusqu'à preuve du contraire dans le code. Un finding que tu confirmes doit
l'être parce que tu as relu le fichier cité, pas parce que le rapport est
convaincant. Tu gagnes en trouvant des erreurs, pas en validant.

Contraintes :
- READ-ONLY. Aucune modification de code, aucune migration, aucun `pnpm` mutant.
  Tu peux lancer des commandes de lecture (grep, wc, git log, cat) et des
  requêtes en lecture seule.
- Ne lis PAS la synthèse en premier. Ordre imposé : d'abord tes propres
  vérifications (§A), puis les rapports d'axe, puis SYNTHESIS.md en dernier.
  Sinon tu vas ancrer ton jugement sur leurs conclusions.
- Chaque verdict cite fichier:ligne. Pas d'opinion non sourcée.

## A. Vérifications factuelles obligatoires (avant de lire les rapports)

Refais ces mesures toi-même, de zéro, et note tes chiffres :

1. **Périmètre manager-only du front** : combien de fichiers et de lignes sous
   `apps/web` sont strictement manager-only ? (Le rapport 03 dit ~30 fichiers,
   ~3834 lignes, 10-11 %.) Attention au piège inverse : GAME_RULES.md §19
   affirme que GT/tactics/scoring sont partagés, vérifie que c'est vrai dans le
   code et pas seulement dans la doc.
2. **`forceResolveRound`** : lis intégralement
   `apps/web/app/(game)/league/[leagueId]/auction/actions.ts`. Confirme ou
   infirme : ~275 lignes de logique métier, usage de `createAdminClient()`
   (service_role), non-atomicité (mutations séquentielles sans transaction),
   fonction partagée classic+manager. C'est LA pièce centrale du verdict : si
   elle est mal décrite, tout l'ordre des étapes recommandé tombe.
3. **Les deux invariants prétendument non gardés** :
   `recompute_underdog_eligibility` (migration `20260605000000`) peut-elle
   vraiment flaguer une équipe classic ? `gt_claim_dnf_refund` (migration
   `20260521000000`) peut-elle vraiment créditer une trésorerie classic ?
   Cherche des gardes ailleurs (côté TS appelant, côté Python, triggers, RLS)
   que le premier audit aurait ratées.
4. **Réutilisabilité de `lib/`** : le rapport 05 affirme ~5000-5500 lignes de
   TS pur portable sur 6367. Échantillonne 10 fichiers de `apps/web/lib/` et
   vérifie les imports réels. Compte aussi ce qui est manager-only dans ce
   total (un fichier "portable" qu'on va jeter ne compte pas comme un acquis).
5. **Doublon démo** : vérifie sur 3 des 5 fichiers cités que la part
   `renderDemo*` est bien de 37-42 % et que c'est une vraie duplication (même
   fetching + même affichage) et pas deux logiques légitimement différentes.
6. **`place_bid` redéfinie 10 fois, `validate_round` 9 fois** : recompte par
   grep sur `supabase/migrations/`. Vérifie aussi l'affirmation qu'aucune
   source canonique par RPC n'existe.
7. **Realtime jamais utilisé** : le rapport 05 dit zéro usage de
   `.channel(`/`postgres_changes` dans le front. Regrep toi-même, y compris
   dans `hooks/` et les composants client.
8. **La policy d'INSERT direct sur `auction_bids` jamais droppée** (finding
   RLS du rapport 06, hérité d'un audit de juin) : est-elle ENCORE là dans
   l'état final des migrations, ou a-t-elle été droppée depuis ? C'est un P0
   sécurité si vrai, et un bon test de la fraîcheur de l'audit.

## B. Lecture critique des rapports (findings/01 à 06)

Pour chaque rapport, produis : affirmations vérifiées (échantillon d'au moins
5 par rapport, en privilégiant celles qui portent le verdict), affirmations
fausses ou exagérées, angles morts (ce que le rapport aurait dû regarder et
n'a pas regardé). Signale toute affirmation invérifiable présentée comme un fait.

Angles morts à chercher activement, parce qu'un audit statique les rate
souvent : le contenu réel de la base de prod (les rapports n'ont fait que du
code), les Edge Functions Supabase s'il y en a, le dossier `apps/web/hooks/`,
les cron/scheduled jobs, le coût opérationnel réel du pipeline pendant une
Vuelta en cours (on est le 27 août 2026, la Vuelta tourne), et tout ce que les
rapports classent "non audité" sans y revenir.

## C. Challenge du verdict (SYNTHESIS.md, à lire en dernier)

La synthèse recommande : scénario B (rewrite client React Native + Expo,
backend Supabase et pipeline Python conservés), avec l'ordre amputation manager
en DB d'abord, portage de `forceResolveRound` en RPC ensuite, client mobile en
troisième. Questions auxquelles tu dois répondre frontalement :

1. L'ordre amputation → portage → client est-il le bon ? Argument inverse à
   instruire sérieusement : commencer par le client (maquettes RN sur le
   backend actuel) pour dérisquer l'UX d'abord, le backend ensuite.
2. Le scénario A (rester web, PWA) est-il écarté trop vite ? La synthèse
   s'appuie sur une phrase de ROADMAP_ET_REX pour dire que le fondateur veut
   du natif. Est-ce un argument technique ou juste une préférence déjà actée
   qu'on ne challenge pas ?
3. Les efforts relatifs (A=1x, B=3-4x, C=6-8x) sortent d'où ? Sont-ils
   défendables pour un dev solo qui doit aussi faire tourner la Vuelta en
   parallèle ?
4. Y a-t-il un scénario que personne n'a instruit ? (Exemples à évaluer, pas à
   adopter : Expo + expo-router en remplaçant AUSSI le web via React Native
   Web, une seule codebase pour les trois plateformes ; ou garder Next.js et
   n'ajouter qu'un shell natif type Capacitor.)
5. La recommandation React Native repose sur "~5000 lignes de lib/ portables".
   Si ta vérification A.4 réduit ce chiffre, le classement RN > Flutter
   tient-il encore ?

## D. Livrable

Écris `research/rewrite-analysis/COUNTER_AUDIT.md` :

1. **Verdict global en une phrase** : la synthèse est-elle fiable pour décider ?
   (fiable / fiable avec corrections / à refaire)
2. **Table des erreurs factuelles trouvées** : affirmation, où, ce que dit
   réellement le code, gravité (change le verdict / change un détail / cosmétique).
3. **Confirmations importantes** : les 5 findings les plus lourds que tu as
   revérifiés et qui tiennent.
4. **Ton propre avis sur le verdict** : si tu étais le fondateur, ferais-tu B
   dans cet ordre ? Si non, quoi à la place ? Tranche, pas de "ça dépend".
5. **Ce qui manque encore** avant de lancer le chantier (max 5 items).

Sois économe : un contre-audit de 150 lignes dense vaut mieux que 500 lignes
de paraphrase. Le fondateur lit le tien APRÈS l'autre, ne répète que ce que tu
contredis ou renforces.
