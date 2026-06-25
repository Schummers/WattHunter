# WattHunter — Système d'audit & remédiation orchestré (design)

> Statut : **design validé, en attente de plan d'implémentation**
> Stack : Next.js (App Router) + TypeScript + Supabase + Python (pcs-sync) + Turborepo.
> Moteur : tool `Workflow` de Claude Code. Agents : VoltAgent durcis (`.claude/agents/`).
> Tous les **rapports générés sont en anglais**. Ce doc de design est en français.

---

## 1. Objectif

Un système **orchestré, autonome, re-jouable** qui :
1. **Audite** l'intégralité de WattHunter via une matrice creuse `surface × axe` (read-only).
2. **Consolide** tous les findings en un rapport priorisé unique.
3. **Vérifie** chaque finding via un agent à contexte neuf (anti-biais).
4. **Corrige** automatiquement ce qui est *prouvable* (Voie A), laisse le reste en diagnostic (Voie B).
5. **N'écrit jamais sur `main`** : chaque fix = branche/worktree + PR. Merge = humain.

Finalité : réduire les bugs silencieux (correctness/idempotence) et la complexité accidentelle d'une codebase vibe-codée, sans casser la prod ni introduire de régression invisible.

---

## 2. Invariants non négociables

| # | Invariant | Pourquoi |
|---|-----------|----------|
| I1 | Phase audit = **read-only** (`tools: Read, Grep, Glob`) | Paralléliser N agents sans risque de conflit ni d'effet de bord |
| I2 | **Jamais d'auto-merge** | La PR est la porte humaine qui rend l'autonomie acceptable |
| I3 | Auto-fix **uniquement si test rouge→vert + suite verte** | "Bug fixé" doit être vérifiable par la machine, sinon = bug silencieux mergé |
| I4 | Correctness/scoring/treasury/RLS → **Voie B** (diagnostic, pas de fix auto) | C'est là que les fixes plausibles-mais-faux font le plus de dégâts |
| I5 | **Golden-master du scoring construit en premier** | L'oracle sans lequel aucun fix du pipeline ne peut être validé |
| I6 | Chaque fix dans son **worktree git isolé** | Si un agent fait n'importe quoi, `main` est intact |
| I7 | Reviewers VoltAgent **durcis read-only** avant usage | La plupart shippent avec `Write/Edit/Bash` (supply-chain) |

---

## 3. Les axes (7 lentilles)

| Axe | Agent (`.claude/agents/`) | Modèle | Focus WattHunter |
|-----|---------------------------|--------|------------------|
| Architecture | `architecture-reviewer` | opus | boundaries, server/client, couplage |
| Sécurité/RLS | `security-reviewer` | opus | RLS par table, service_role jamais client, Zod sur mutations |
| Data-engineering | `data-reviewer` | opus | index, N+1, pagination PostgREST 1000-rows, drift types générés |
| Business-rules | `business-rules-reviewer` | opus | idempotence pipelines, SSOT, invariants serveur |
| Front/Design-system | `frontend-ds-reviewer` | sonnet | tokens DS v3, composants dupliqués, hardcode px/hex |
| Performance | `performance-reviewer` | sonnet | bundle, RSC waterfalls, cache |
| Tech-debt/Assainissement | `techdebt-reviewer` | sonnet | code mort, sur-abstractions, flags fossiles |

---

## 4. Les surfaces (13 zones verticales)

**Back — Python (`services/pcs-sync/`)**
- `B1 scoring` — `scoring.py` (962 LOC), `tactics.py`
- `B2 sponsor-goals` — `sponsor_bonus.py`, `goal_evaluator.py` (739 LOC), `reconcile_bonuses.py`
- `B3 auction-economy` — `auction.py`, `underdog.py`
- `B4 gt-rescue` — `resolve_gt_rescue.py`, `dnf_detection.py`, `gt_slug.py`, `resolve_now.py`
- `B5 sync-scraping` — `sync.py`, `sync_race.py`, `browser_session.py`, `enrich.py`, `photo_storage.py`, `run_pipeline.py`

**Front — Next.js (`apps/web/`)**
- `F1 auth-onboarding` — `(auth)/`, `auth/callback`
- `F2 league-lobby` — `(lobby)/`, `(auth)/league`
- `F3 team-budget-strategies` — `(game)/league/[leagueId]/team`
- `F4 auction-ui` — `(game)/league/[leagueId]/auction`
- `F5 ranking-rider-achievements` — `(game)/.../ranking`, `rider`, `achievements`
- `F6 server-actions-api` — 16 `actions.ts` + `app/api/`
- `F7 shared-lib-ds` — `apps/web/lib/`, design-system components

**DB**
- `D1 schema-migrations-rls` — `supabase/migrations/` (159 fichiers) + RLS policies

---

## 5. La matrice creuse (45 cellules)

Seules les paires `surface × axe` à risque réel. `BR`=business-rules, `DA`=data, `TD`=tech-debt, `PE`=perf, `AR`=archi, `SE`=sécu, `FE`=front-ds.

| Surface | Cellules (axes) |
|---------|-----------------|
| B1 scoring | BR · DA · TD · PE |
| B2 sponsor-goals | BR · DA · TD |
| B3 auction-economy | BR · DA · TD |
| B4 gt-rescue | BR · DA · TD |
| B5 sync-scraping | AR · PE · SE · TD |
| F1 auth | SE · BR · AR |
| F2 league-lobby | SE · BR · AR |
| F3 team-budget | SE · BR · FE · AR |
| F4 auction-ui | FE · BR · PE · AR |
| F5 ranking-rider | FE · PE · DA · AR |
| F6 server-actions-api | SE · BR · AR · TD |
| F7 lib-ds | FE · TD · AR |
| D1 schema-rls | SE · DA · BR |

**Total : 45 cellules.** Chaque cellule = 1 invocation `agent()`, contexte propre.

---

## 6. Injection de contexte WattHunter

Les reviewers VoltAgent sont génériques. Le workflow **préfixe le prompt de chaque cellule** avec un bloc partagé `WH_CONTEXT` :
- Stack + conventions (RLS anon-key, Zod→rpc, migrations-only, DS v3 tokens).
- **Failure modes connus** (extraits de MEMORY.md) : duplicate sponsor credits ×6, pagination PostgREST 1000-rows, rescore drift inter-équipes, remontada fragile aux recalculs, no-cumul rule, idempotence treasury.
- La surface ciblée (liste de fichiers) + l'axe + les critères de l'axe.

Effet : agent générique + cerveau domaine au moment de l'appel, sans éditer les fichiers agents.

---

## 7. Le moteur — script Workflow

Phases (déterministes, dans un seul script JS) :

```
PHASE 0  cartographe (1 agent) → review/runs/<date>/map.md
         (confirme surfaces + liste fichiers réelle ; pas de gate, autonome)

PHASE 1  matrice creuse — pipeline() sur les 45 cellules
         chaque cellule: agent(axisType, WH_CONTEXT + surface, schema=FINDINGS)
         → renvoie findings structurés (PAS d'écriture : reviewers read-only)

PHASE 1b verify adversarial — pour chaque finding P0/P1 :
         agent(verifier, contexte NEUF, "réfute ce finding")
         finding tué si non confirmé (anti faux-positif)

PHASE 2  synthèse (1 agent writer) lit tous les findings confirmés
         → review/runs/<date>/findings/<surface>__<axis>.md (annexes)
         → review/runs/<date>/REPORT.md (table priorisée unique, dédupliquée,
           cross-linkée, "Top 10 to fix first")

PHASE 3  assainissement (1 agent) raisonne sur REPORT.md
         → review/runs/<date>/SIMPLIFY.md (plan de coupe ordonné, réversible,
           test de caractérisation nommé avant chaque suppression risquée)

STOP (mode audit). Le mode fix est un workflow séparé déclenché ensuite.
```

Schéma `FINDINGS` (structured output, par cellule) :
`{ findings: [{ id, severity(P0/P1/P2), effort(S/M/L), file, line, issue, fix, lane(A/B), test_idea }] }`

Pourquoi read-only + structured output plutôt que "chaque agent écrit son MD" : garde les 45 reviewers strictement sans écriture (I1), et centralise l'écriture dans 1 agent writer auditable.

---

## 8. Le mode fix (workflow séparé)

Déclenché manuellement après lecture du REPORT. Pré-requis : **golden-master scoring déjà en place** (I5).

```
Pour chaque finding du REPORT, trié par (Voie A d'abord, severity) :

  VOIE A (prouvable) — pipeline par finding, worktree isolé :
    1. test-author écrit le test rouge qui reproduit le finding
    2. vérifie que le test échoue (rouge confirmé)
    3. ts-fixer / py-fixer applique le fix minimal
    4. run: test ciblé + pnpm typecheck + pnpm lint + pnpm test + pytest
    5. SI tout vert → commit + push branche fix/<id> + ouvre PR (draft)
       SINON → jette le worktree, reclasse le finding en Voie B
    → jamais de merge

  VOIE B (correctness/scoring/RLS, ou test impossible) :
    diagnostic approfondi + patch proposé en draft + test de caractérisation
    à écrire → review/runs/<date>/diagnostics/<id>.md → STOP
```

Isolation : chaque fix Voie A dans `agent({isolation: 'worktree'})`. Les worktrees inchangés sont auto-nettoyés.

---

## 9. Le "goal" autonome & conditions de succès

Le run tourne le plus longtemps possible sans intervention, et **se termine proprement** quand les conditions machine-checkables sont remplies :

- **Audit terminé** : `REPORT.md` + `SIMPLIFY.md` existent et non vides.
- **Fix terminé** :
  - tout finding Voie A → une PR ouverte avec suite verte, **ou** reclassé Voie B ;
  - tout finding Voie B → un `diagnostics/<id>.md` écrit.
- **Pas de cap budget** (choix utilisateur) : la boucle tourne tant que des findings restent à traiter, bornée par le backstop des **1000 agents** du Workflow. Les conditions ci-dessus sont la vraie sortie.

Mécanisme : boucle pilotée dans le script Workflow (loop-until-condition), pas de fix laissé à moitié. Le run est **resumable** : si interrompu, on relance avec `resumeFromRunId` (cache des cellules déjà faites).

---

## 10. Arborescence produite

```
review/
  audit-system-design.md         ← ce doc
  code-review-orchestree-synthese.md  ← ta synthèse méthodo
  runs/
    <YYYY-MM-DD>/
      map.md
      findings/<surface>__<axis>.md   (annexes brutes)
      REPORT.md                        (rapport priorisé unique)
      SIMPLIFY.md                      (plan d'assainissement)
      diagnostics/<finding-id>.md      (Voie B)
.claude/
  agents/                          ← 7 reviewers durcis (installés) + fixers
  workflows/ (ou skill)            ← scripts orchestrateurs audit + fix
  commands/audit.md                ← trigger /audit
```

---

## 11. Ordre d'implémentation

1. **Golden-master scoring** (oracle, I5) — rejouer le Giro figé, snapshot classement/treasury/XP.
2. **Reviewers durcis** — ✅ fait (7 agents dans `.claude/agents/`).
3. **Fixers** — copier `typescript-pro`/`python-pro`/`refactoring-specialist`/`test-automator`, garder écriture, usage worktree only.
4. **Bloc `WH_CONTEXT`** — extraire les failure modes de MEMORY.md.
5. **Script Workflow audit** (Phases 0→3) + schéma FINDINGS.
6. **Trigger `/audit`** (skill ou slash-command).
7. **Script Workflow fix** (Voie A/B) — après validation du 1er REPORT.
8. **Calibrage** : 1er run réel, ajuster WH_CONTEXT + prompts si bruit.

---

## 12. Risques & mitigations

| Risque | Mitigation |
|--------|------------|
| Rapport-fleuve (matrice = 45 cellules) | Synthèse dédup + cross-link + Top 10 ; annexes séparées |
| Findings plausibles-mais-faux | Phase 1b verify adversarial contexte-neuf |
| Fix qui casse silencieusement le scoring | Voie B forcée (I4) + golden-master (I5) |
| Régression mergée sans le voir | Jamais d'auto-merge (I2) ; suite verte obligatoire (I3) |
| Coût tokens | Sonnet par défaut, Opus sur axes critiques ; budget cap |
| Agents VoltAgent avec write/bash | Durcis read-only à l'install (I7) |

---

## 13. Décisions tranchées

- [x] **Golden-master** : Giro 2026 seul (classement final + treasury + XP par équipe).
- [x] **Trigger** : slash-command `/audit` (`.claude/commands/audit.md`) qui lance le Workflow.
- [x] **Budget** : aucun cap — boucle jusqu'aux conditions de succès, backstop 1000 agents.
- [x] **Voie B** : doc MD seul (`diagnostics/<id>.md` = diagnostic + patch proposé + test de caractérisation à écrire). Aucun fix auto, l'utilisateur pilote.
