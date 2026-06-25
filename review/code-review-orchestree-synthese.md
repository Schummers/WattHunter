# Code review orchestrée d'une codebase — Synthèse

> Stack cible : Next.js (App Router) + TypeScript + Supabase + Tailwind + shadcn/ui + pnpm.
> Projets concernés : WattHunter, Valoris (et autres repos).

---

## 1. Ce que je cherche à faire

Auditer **l'intégralité d'une codebase** pour l'améliorer sur tous les axes à la fois —
performance, optimisation des pipelines/services, business rules, incohérences,
cohérence du design system et des composants, sécurité, data engineering, front, back,
architecture — **et** profiter de l'exercice pour **assainir le produit** : réduire la
complexité accidentelle pour avoir moins de chemins d'exécution, donc moins de bugs.

Objectif final retenu : **un rapport d'audit one-shot priorisé**, produit par un
**système orchestré sur Claude Code** où plusieurs reviewers tournent en parallèle, leurs
findings sont consolidés par un orchestrateur, priorisés ensemble, puis transformés en
plan d'amélioration.

Contrainte personnelle : direct, actionnable, itératif. Pas de réinvention de la roue si
ça existe déjà.

---

## 2. Le principe méthodologique (le plus important)

**On ne reviewe jamais "tout" en un seul prompt.** Une review monolithique sature le
contexte et produit du feedback générique. La méthode solide repose sur 3 leviers :

1. **Une passe = un axe = un contexte isolé.** Chaque axe a ses propres critères et son
   propre regard. Les mélanger dilue la qualité.
2. **Inventaire avant jugement.** On cartographie d'abord (modules, dépendances, points
   d'entrée, hot paths) *avant* de juger quoi que ce soit.
3. **Output = artefact actionnable, pas un essai.** Chaque passe produit des findings
   priorisés (severity × effort), pas un pavé descriptif.

### Les axes, dans l'ordre qui compte

L'ordre n'est pas neutre : sécu et data avant perf (inutile d'optimiser un endpoint qui fuit).

1. **Cartographie** (préalable, pas un jugement)
2. **Architecture & boundaries**
3. **Sécurité** (RLS Supabase = piège n°1 du stack)
4. **Business rules & cohérence**
5. **Data engineering** (schéma, index, N+1, migrations, types générés)
6. **Back / API** (server actions, route handlers, error handling)
7. **Front & design system** (cohérence shadcn/Tailwind, tokens, composants dupliqués)
8. **Performance** (bundle, RSC streaming, fetch waterfalls, cache)

> **Assainissement en dernier** : la simplification s'appuie sur la compréhension
> construite par les autres passes. On sait quelles règles sont *essentielles* (inhérentes
> au domaine) vs *accidentelles* (ajoutées par notre code) seulement après avoir
> cartographié archi + data.

---

## 3. L'architecture du système Claude Code

**Le fait technique central :** chaque subagent a son propre context window, tourne
indépendamment, renvoie ses résultats au main agent (= l'orchestrateur), qui synthétise.

**Le piège :** si chaque reviewer renvoie sa table complète dans le contexte principal,
l'orchestrateur sature → priorisation nulle.

**La solution :** chaque reviewer **écrit ses findings dans un fichier** (`.review/findings/<axe>.md`)
et ne renvoie qu'un **résumé de 3 lignes**. L'orchestrateur lit ensuite les fichiers pour
synthétiser. C'est ce qui rend le système scalable.

### Le flow (parallèle vs séquentiel)

```
PHASE 0  [séquentiel]   cartographer ──► writes .review/map.md
                                          (tous les axes en dépendent)
                            │
PHASE 1  [PARALLÈLE]   ┌────┼────┬────────┬────────┐
   chacun lit map.md   ▼    ▼    ▼        ▼        ▼
   écrit son fichier  archi sécu data  front-ds  perf
   renvoie 3 lignes    │    │    │        │        │
                       └────┴────┴───►.review/findings/*.md
                            │
PHASE 2  [BARRIÈRE]    orchestrator lit TOUS les findings/*.md
   (attend tout)       ──► dédoublonne, cross-link, prioritise
                       ──► writes .review/REPORT.md
                            │
PHASE 3  [synthèse]    assainissement raisonne SUR le REPORT
                       ──► writes .review/SIMPLIFY.md (plan de coupe)
                            │
PHASE 4  [humain + write] tu choisis → fix agents (SÉRIE/worktree)
```

> **Règle d'or sur le parallélisme :** les reviewers sont **read-only** → paralléliser est
> safe (aucun conflit de fichiers). Dès qu'on passe en **écriture** (Phase 4, les fixes),
> on ne parallélise plus librement : on sérialise, ou on isole chaque agent dans son
> worktree git. Ne jamais mélanger les deux régimes.

### Coût & escalade
- Les subagents restent le mode le plus économe en tokens (ils tournent dans la session
  parente). Mais N reviewers Opus en parallèle, ça chiffre → **Sonnet partout où le
  raisonnement n'est pas critique**, Opus pour archi / sécu / business rules.
- Si ça déborde malgré les fichiers : mode **Agent Teams** (research preview, Claude Code
  v2.1.32, fév. 2026) — chaque teammate a son worktree + task lists partagées. Plus
  puissant mais plus cher. Overkill pour un audit read-only.
- Pour durcir : passe **adversarial verify** — pour chaque finding, spawn N sceptiques
  chargés de le réfuter ; on le tue sauf si une majorité survit. Élimine les findings
  plausibles-mais-faux.

---

## 4. Les briques construites (réutilisables)

### Le skill orchestrateur — `.claude/skills/codebase-review/SKILL.md`

```markdown
---
name: codebase-review
description: |
  Full multi-axis codebase audit. Use when the user asks to review the
  whole repo, do a code audit, or "assainir" the codebase. Orchestrates
  parallel review subagents and synthesizes a prioritized report.
---
# Full codebase review — orchestration

You are the ORCHESTRATOR. You do NOT review code yourself. You dispatch
subagents, then synthesize. Follow phases strictly.

## Phase 0 — Map (sequential)
Run the repo-cartographer subagent. Wait for .review/map.md to exist.
Show me its 5-line summary and let me correct it before continuing.

## Phase 1 — Review (PARALLEL)
Dispatch these subagents IN PARALLEL (single message, multiple Task calls):
security-reviewer, architecture-reviewer, data-reviewer,
frontend-ds-reviewer, performance-reviewer.
Each reads .review/map.md, writes .review/findings/<axis>.md, returns
only a short summary. Do NOT pull their full tables into your context.

## Phase 2 — Synthesize (barrier — wait for ALL)
Read every .review/findings/*.md. Then:
- Deduplicate findings flagged by multiple axes — merge, keep highest severity.
- Cross-link: note where one axis's finding explains another's.
- Produce .review/REPORT.md: ONE global table sorted by Severity then Effort,
  with an axis column. Top of file = "Top 5 to fix first" with rationale.

## Phase 3 — Simplify
Run the simplification pass reasoning OVER .review/REPORT.md + map.md.
Write .review/SIMPLIFY.md as an ordered, reversible cut-plan. Never recommend a
High-risk deletion without naming the characterization test to add first.

## Phase 4 — STOP
Present the prioritized plan. Do NOT fix anything yet. Wait for me to pick items.
Fixes run later, serialized or in isolated worktrees — never parallel edits.
```

### Le cartographe — `.claude/agents/repo-cartographer.md`

```markdown
---
name: repo-cartographer
description: Maps repo structure before any review. Read-only. Run first.
tools: Read, Glob, Grep
model: sonnet
---
Build an inventory of this Next.js + TypeScript + Supabase codebase.
Do NOT judge anything. Just map:
- Top-level structure and what each area owns
- Entry points: route handlers, server actions, RSC vs client components
- Data access: where the Supabase client is instantiated (client/server/service_role)
- Where business rules live (UI / actions / lib / DB triggers / RLS)
- Shared/duplicated modules and external boundaries
Write the full map to .review/map.md.
Return to me ONLY: a 5-line summary + confirmation the file is written.
```

### Template reviewer (à cloner par axe) — ex. `security-reviewer.md`

```markdown
---
name: security-reviewer
description: Security & RLS audit. Read-only. Needs .review/map.md.
tools: Read, Glob, Grep
model: opus
---
First read .review/map.md for context.
Then audit SECURITY ONLY. [coller les CHECK de l'axe concerné]
For each finding cite real file:line, never invent.
Write the full findings table to .review/findings/security.md
using columns: ID | Severity(P0/P1/P2) | Effort(S/M/L) | file:line | Issue | Fix.
Return to me ONLY: count by severity + the single worst P0 in one line.
```

### La commande pour tout lancer

```
Use the codebase-review skill on this repo. Run the cartographer first,
let me validate the map, then fan out all five reviewers in parallel,
then synthesize into a prioritized report and a simplification plan.
Write everything under .review/. Final report in French, technical terms in English.
```

---

## 5. Les critères par axe (résumé)

| Axe | À checker (l'essentiel) |
|-----|--------------------------|
| **Architecture** | Layer boundaries (data-access qui fuit dans les composants), server/client boundary (`use client` mal placé, risque secrets), couplage / deps circulaires, patterns data-access dupliqués, error handling cohérent, ownership du state |
| **Business rules** | Single source of truth (même règle client+server+DB qui divergent), règles contradictoires/mortes, magic numbers qui encodent une policy, règles sans test, invariants non garantis côté serveur, validation manquante sur les mutations |
| **Sécurité + RLS** | RLS sur chaque table (désync policy ↔ requête client = P0 fréquent), `service_role` jamais côté client, IDOR/authz avant write, validation zod sur chaque input, secrets non leakés, sessions/cookies, RPC/CORS |
| **Data engineering** | Index sur colonnes filtrées/jointes, N+1, contraintes FK/NOT NULL/unique/check, drift types générés ↔ usage, migrations réversibles, sur-fetch (`select('*')`) |
| **Assainissement** | Complexité accidentelle vs essentielle, règles dupliquées à fusionner, code mort / branches inatteignables, abstractions à usage unique, knobs de config jamais variés → classer en DELETE / MERGE / FLATTEN / KILL / UNSURE |

> **Filet pour l'assainissement :** jamais de suppression *High-risk* sans d'abord écrire
> un **test de caractérisation** qui fige le comportement actuel. C'est ce qui transforme
> "assainir" d'un pari en opération sûre.

---

## 6. Ne pas réinventer la roue : les repos existants

| Repo | Pour quoi | Verdict |
|------|-----------|---------|
| **`wshobson/agents`** | Orchestration complète multi-agents (84 plugins, 192 agents, 156 skills). A déjà un security-assessment multi-agents + workflow chaîné 7 agents + Agent Teams + Tech Debt Finder. | **1er choix turnkey** — le plus proche de ce qu'on a construit à la main |
| **`VoltAgent/awesome-claude-code-subagents`** | Catalogue propre de 100+ subagents : architect-reviewer, code-reviewer, security-audit-expert, performance-profiler, technical-debt-analyst (catégorie `04-quality-security`). Reviewers en read-only, champ `model` pour le routing coût/qualité. | **Choix "contrôle"** — drop les reviewers + garder notre orchestrateur 30 lignes |
| **`anthropics/claude-code-security-review`** | GitHub Action sécu qui analyse les diffs de PR. | Pour la sécu **en continu sur les PR** |
| **`obra/superpowers`** (~90k ⭐) | Méthodo SDLC complète (brainstorm → design → subagents → TDD → review 2 temps). | Pour **construire** des features, pas auditer. À garder pour la phase de fixes |

### Le verdict, no bullshit
Pas besoin de réinventer les **agents**. Mais le truc qu'aucun catalogue ne donne tel
quel, c'est l'orchestrateur "findings → fichiers → barrière → rapport priorisé unique".
Donc le combo optimal :

- **Turnkey** → `wshobson/agents` (installer les plugins review + workflow, adapter à Supabase).
- **Contrôle** → reviewers **VoltAgent** dans `.claude/agents/` + garder notre **skill
  orchestrateur** (c'est lui qui produit le rapport priorisé consolidé).

### Deux avertissements avant de cloner
1. **Supply chain.** VoltAgent fournit les subagents "as is", sans audit de sécurité.
   Lire chaque définition avant install, surtout celles avec `Write`/`Bash`. Pour de la
   review, forcer `tools: Read, Grep, Glob` et rien d'autre.
2. **L'orchestration est la couche dure.** Attends-toi à de la config/debug ; commence
   simple (subagents read-only) avant Agent Teams.

---

## 7. Prochaines étapes possibles

- [ ] Cloner `VoltAgent` ou `wshobson` et inspecter les définitions réelles des reviewers,
      décider lesquels prendre + quoi adapter pour Next/Supabase.
- [ ] Générer les 5 fichiers reviewers complets (critères collés) prêts à drop dans `.claude/agents/`.
- [ ] Détailler la **Phase 4** : enchaîner proprement priorisation → fixes en série/worktree
      sans casser le repo.
- [ ] Affiner le prompt **assainissement** pour les règles métier de WattHunter (scoring
      fantasy cycling = forte accumulation de complexité accidentelle).
- [ ] Lancer une 1re passe sur **un** repo, ajuster les critères selon ce qui remonte.
