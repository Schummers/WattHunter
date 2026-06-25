# WattHunter Audit System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the read-only orchestrated audit system that fans out a sparse `surface × axis` matrix over WattHunter and produces one prioritized report + a simplification plan.

**Architecture:** A single `Workflow` script drives 5 phases (map → review matrix → adversarial verify → synthesize → simplify). Review cells are read-only VoltAgent reviewers (already installed, hardened to `Read, Grep, Glob`) that return *structured* findings; a separate writer agent (full tools) writes all markdown. A `/audit` slash-command triggers the workflow. No code is ever modified — this subsystem is pure diagnosis.

**Tech Stack:** Claude Code `Workflow` tool (JS scripts), custom subagents in `.claude/agents/`, slash-command in `.claude/commands/`.

**Scope note:** This is subsystem 2 of 3 (golden-master, **audit**, fix). It ships and runs independently. The fix subsystem (auto-fix Voie A / diagnostic Voie B) and the golden-master oracle get their own plans — they are NOT in this plan.

**TDD note:** Classic unit-TDD does not fit an orchestration script (its output is agent reasoning, not deterministic returns). Validation here = (a) the script parses and runs on a 2-cell subset without error, (b) the expected files are written, (c) a manual quality spot-check of the report. This is stated explicitly per task instead of fake unit tests.

---

## File Structure

| File | Responsibility |
|------|----------------|
| `review/WH_CONTEXT.md` | Single source of domain context injected into every reviewer prompt: stack conventions + known failure modes. |
| `.claude/workflows/wh-audit.js` | The orchestration script. Owns the matrix, the 5 phases, the schemas. |
| `.claude/commands/audit.md` | Slash-command `/audit` that launches the workflow with today's date as `args`. |
| `.claude/agents/*-reviewer.md` | The 7 read-only reviewers. **Already installed.** Not modified here. |
| `review/runs/<date>/` | Output: `map.md`, `findings/*.md`, `REPORT.md`, `SIMPLIFY.md`. Generated at run time. |

---

## Task 1: Write the WattHunter context block

**Files:**
- Create: `review/WH_CONTEXT.md`

- [ ] **Step 1: Create the context file**

Create `review/WH_CONTEXT.md` with exactly this content:

```markdown
# WattHunter — Audit Context (injected into every reviewer)

## Stack & hard conventions
- Next.js 16 App Router, TypeScript strict, Tailwind v4 + shadcn, Turborepo, pnpm.
- Supabase Postgres. **Web app uses the anon key only — RLS must protect every table.**
- `service_role` key MUST NEVER reach the browser/client.
- Server actions pattern is MANDATORY: Zod validation → `supabase.rpc(...)` → error forwarding. No business logic in TS server actions.
- DB changes go through migrations only (`supabase/migrations/`). 159 migrations exist.
- Money is granular to 1000€; salaries = pts_PCS × 2000 / 12 (no cap).
- Design System v3: typography via `text-[length:var(--type-*)]`, colors via semantic tokens, never hardcode px/hex.
- Python pipelines in `services/pcs-sync/` run locally; Zod v4 (`zod/v4`).
- All user-facing app text is English.

## Known failure modes (recurring bug classes — look for MORE of these)
- **Idempotency in pipelines**: `credit_sponsor_bonuses` once re-credited treasury ×6 (+400k€ phantom) on reruns. Any pipeline that writes treasury/XP must be idempotent on reruns.
- **PostgREST 1000-row cap**: unpaginated `.select()` silently truncates at 1000 rows. `goal_evaluator.py` missed an ITT payout this way. Any GT-wide fetch must paginate (`_fetch_all`).
- **Rescore drift**: re-running scoring on an old stage drifts OTHER teams' XP (code drift). Snapshot/diff all teams before/after.
- **Temporal squad checks**: sponsor/goal bonuses must check squad membership AT race time (cutoff 11:00 CET), not at run time.
- **No-cumul rule**: a rider triggering a one-time goal loses the base bonus on the same race (GAME_RULES §18).
- **RLS scoping**: `rider_xp_daily`/`sponsor_bonuses` are team-grained; a `rider_id`-only query leaks demo data as duplicates. Scope via `teams!inner(league_id)`.

## Reporting rules for every finding
- Cite real `file:line`. Never invent. If unsure a thing is load-bearing, mark it UNSURE, do not assert.
- Assign Lane: **A** = provable & low-risk (a failing test can be written) ; **B** = correctness/scoring/treasury/RLS or anything where a test can't prove the fix.
- Output language: English.
```

- [ ] **Step 2: Verify the file exists and is non-empty**

Run: `test -s review/WH_CONTEXT.md && echo OK`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add review/WH_CONTEXT.md
git commit -m "feat(audit): add WattHunter domain context block for reviewers"
```

---

## Task 2: Write the audit Workflow script

**Files:**
- Create: `.claude/workflows/wh-audit.js`

- [ ] **Step 1: Create the workflow script**

Create `.claude/workflows/wh-audit.js` with exactly this content:

```js
export const meta = {
  name: 'wh-audit',
  description: 'Read-only matrix audit of WattHunter -> prioritized REPORT.md + SIMPLIFY.md',
  phases: [
    { title: 'Map' },
    { title: 'Review' },
    { title: 'Verify' },
    { title: 'Synthesize' },
    { title: 'Simplify' },
  ],
}

const DATE = (args && args.date) || 'undated'
const OUT = `review/runs/${DATE}`

const WH = `WattHunter audit. First READ review/WH_CONTEXT.md for stack conventions and known
failure modes — apply them. Every finding MUST cite real file:line (never invent). Assign each
finding a Lane (A=provable/low-risk, B=correctness/scoring/treasury/RLS). Output English.`

// ---- sparse matrix: surface -> { files, axes } ----
const SURFACES = {
  'B1-scoring':         { files: 'services/pcs-sync/scoring.py, services/pcs-sync/tactics.py', axes: ['business-rules','data','techdebt','performance'] },
  'B2-sponsor-goals':   { files: 'services/pcs-sync/sponsor_bonus.py, services/pcs-sync/goal_evaluator.py, services/pcs-sync/reconcile_bonuses.py', axes: ['business-rules','data','techdebt'] },
  'B3-auction-economy': { files: 'services/pcs-sync/auction.py, services/pcs-sync/underdog.py', axes: ['business-rules','data','techdebt'] },
  'B4-gt-rescue':       { files: 'services/pcs-sync/resolve_gt_rescue.py, services/pcs-sync/dnf_detection.py, services/pcs-sync/gt_slug.py, services/pcs-sync/resolve_now.py', axes: ['business-rules','data','techdebt'] },
  'B5-sync-scraping':   { files: 'services/pcs-sync/sync.py, services/pcs-sync/sync_race.py, services/pcs-sync/browser_session.py, services/pcs-sync/enrich.py, services/pcs-sync/photo_storage.py, services/pcs-sync/run_pipeline.py', axes: ['architecture','performance','security','techdebt'] },
  'F1-auth':            { files: 'apps/web/app/(auth), apps/web/app/auth/callback', axes: ['security','business-rules','architecture'] },
  'F2-league-lobby':    { files: 'apps/web/app/(lobby), apps/web/app/(auth)/league', axes: ['security','business-rules','architecture'] },
  'F3-team-budget':     { files: 'apps/web/app/(game)/league/[leagueId]/team', axes: ['security','business-rules','frontend-ds','architecture'] },
  'F4-auction-ui':      { files: 'apps/web/app/(game)/league/[leagueId]/auction', axes: ['frontend-ds','business-rules','performance','architecture'] },
  'F5-ranking-rider':   { files: 'apps/web/app/(game)/league/[leagueId]/ranking, .../rider, .../achievements', axes: ['frontend-ds','performance','data','architecture'] },
  'F6-server-actions':  { files: 'apps/web/app/**/actions.ts, apps/web/app/api', axes: ['security','business-rules','architecture','techdebt'] },
  'F7-lib-ds':          { files: 'apps/web/lib, apps/web/components/ui', axes: ['frontend-ds','techdebt','architecture'] },
  'D1-schema-rls':      { files: 'supabase/migrations', axes: ['security','data','business-rules'] },
}

const AXIS_AGENT = {
  'architecture':   'architecture-reviewer',
  'security':       'security-reviewer',
  'data':           'data-reviewer',
  'business-rules': 'business-rules-reviewer',
  'frontend-ds':    'frontend-ds-reviewer',
  'performance':    'performance-reviewer',
  'techdebt':       'techdebt-reviewer',
}

const FINDINGS_SCHEMA = {
  type: 'object',
  required: ['findings'],
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id','severity','effort','file','issue','fix','lane'],
        properties: {
          id:       { type: 'string' },
          severity: { type: 'string', enum: ['P0','P1','P2'] },
          effort:   { type: 'string', enum: ['S','M','L'] },
          file:     { type: 'string' },
          line:     { type: 'string' },
          issue:    { type: 'string' },
          fix:      { type: 'string' },
          lane:     { type: 'string', enum: ['A','B'] },
          test_idea:{ type: 'string' },
        },
      },
    },
  },
}

const VERDICT_SCHEMA = {
  type: 'object',
  required: ['real','reason'],
  properties: {
    real:   { type: 'boolean' },
    reason: { type: 'string' },
  },
}

// optional surface filter: args.only = ['B1-scoring', ...]
const onlyFilter = (args && Array.isArray(args.only)) ? args.only : null

phase('Map')
await agent(`${WH}
Map the WattHunter repo at a high level. Do NOT judge. List the real entry points, where the
Supabase client is instantiated (client/server/service_role), where business rules live, and any
obvious duplicated modules. Write the map to ${OUT}/map.md and return a 5-line summary.`,
  { label: 'cartographer', phase: 'Map' })

// build the cell list from the sparse matrix
const cells = []
for (const [sid, s] of Object.entries(SURFACES)) {
  if (onlyFilter && !onlyFilter.includes(sid)) continue
  for (const axis of s.axes) cells.push({ sid, files: s.files, axis })
}
log(`Matrix: ${cells.length} cells across ${onlyFilter ? onlyFilter.length : Object.keys(SURFACES).length} surfaces`)

phase('Review')
// each cell: review -> adversarially verify its P0/P1 findings (P2 pass through)
const perCell = await pipeline(
  cells,
  (cell) => agent(`${WH}
AUDIT one axis on one surface. Axis: ${cell.axis}. Surface: ${cell.sid}. Files: ${cell.files}.
Review ONLY this axis on ONLY these files. Be specific and concrete. Return findings.`,
    { label: `review:${cell.sid}:${cell.axis}`, phase: 'Review', agentType: AXIS_AGENT[cell.axis], schema: FINDINGS_SCHEMA }),
  (review, cell) => {
    const all = (review && review.findings) ? review.findings : []
    const p2 = all.filter(f => f.severity === 'P2').map(f => ({ ...f, surface: cell.sid, axis: cell.axis, confirmed: true }))
    const hi = all.filter(f => f.severity !== 'P2')
    return parallel(hi.map(f => () =>
      agent(`${WH}
Adversarially VERIFY this finding. Default to refuting it unless you can confirm it is real with
evidence at the cited location. Finding:
${JSON.stringify(f)}`,
        { label: `verify:${cell.sid}:${f.id}`, phase: 'Verify', model: 'sonnet', schema: VERDICT_SCHEMA })
        .then(v => ({ ...f, surface: cell.sid, axis: cell.axis, confirmed: v ? v.real !== false : false, verdict: v }))
    )).then(verified => [...verified, ...p2])
  }
)

const confirmed = perCell.flat().filter(Boolean).filter(f => f.confirmed)
log(`Confirmed findings: ${confirmed.length}`)

phase('Synthesize')
await agent(`${WH}
You are the synthesis writer (you have write tools). Confirmed findings as JSON:
${JSON.stringify(confirmed)}

Do all of this:
1. Write one annex file per cell: ${OUT}/findings/<surface>__<axis>.md with that cell's findings as a table.
2. Write ${OUT}/REPORT.md:
   - Deduplicate: merge findings flagged by multiple axes (same file+issue), keep highest severity, note all axes.
   - Cross-link: where one finding explains another, note it.
   - ONE global table: ID | Severity | Effort | Lane | Surface | Axis | file:line | Issue | Fix.
   - Sort by Severity (P0>P1>P2) then Effort (S>M>L).
   - At the very top: "Top 10 to fix first" with one-line rationale each.
All English. Confirm files written.`,
  { label: 'synthesis', phase: 'Synthesize', model: 'opus' })

phase('Simplify')
await agent(`${WH}
You have write tools. Read ${OUT}/REPORT.md and ${OUT}/map.md. Produce ${OUT}/SIMPLIFY.md:
an ordered, reversible cut-plan. Columns: ID | Action(DELETE/MERGE/FLATTEN/KILL) | Risk(Low/Med/High) |
LOC saved (approx) | file:line | What | Why safe | Safety-net test needed before cutting.
Sort low-risk + high-LOC first. Add a "rule consolidation map" (each duplicated business rule -> the
ONE place it should live). NEVER recommend a High-risk deletion without naming the characterization
test to add first. English.`,
  { label: 'simplify', phase: 'Simplify', model: 'opus' })

return { cells: cells.length, confirmed: confirmed.length, report: `${OUT}/REPORT.md`, simplify: `${OUT}/SIMPLIFY.md` }
```

- [ ] **Step 2: Verify the script is syntactically valid JS**

Run: `node --check .claude/workflows/wh-audit.js && echo OK`
Expected: `OK` (note: `node --check` validates syntax even though `args`/`agent` are runtime globals — `--check` does not execute, so undefined globals don't error).

- [ ] **Step 3: Commit**

```bash
git add .claude/workflows/wh-audit.js
git commit -m "feat(audit): add wh-audit matrix orchestration workflow"
```

---

## Task 3: Write the /audit slash-command

**Files:**
- Create: `.claude/commands/audit.md`

- [ ] **Step 1: Create the command**

Create `.claude/commands/audit.md` with exactly this content:

```markdown
---
description: Run the full read-only matrix audit of WattHunter (produces review/runs/<date>/REPORT.md)
---

Run the WattHunter audit.

1. Get today's date: run `date +%Y-%m-%d` and capture it as DATE.
2. Invoke the `Workflow` tool with:
   - name: "wh-audit"
   - args: { "date": "<DATE>" }
   - To scope to specific surfaces only, add "only": ["B1-scoring", ...] (optional; default = all 13 surfaces / 45 cells).
3. The workflow is read-only — it never edits code. When it finishes, read `review/runs/<DATE>/REPORT.md`
   and present the "Top 10 to fix first" to the user. Do NOT start fixing anything.

$ARGUMENTS
```

- [ ] **Step 2: Verify the command file exists**

Run: `test -f .claude/commands/audit.md && echo OK`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add .claude/commands/audit.md
git commit -m "feat(audit): add /audit slash-command trigger"
```

---

## Task 4: Smoke-test the plumbing on a 2-cell subset

This is NOT the quality pilot the user declined — it only confirms the script runs end-to-end and writes files. One small surface, then we read the output to confirm the wiring.

**Files:** none created (produces `review/runs/<date>/` output).

- [ ] **Step 1: Run the workflow scoped to one surface**

Invoke the `Workflow` tool with:
- name: `wh-audit`
- args: `{ "date": "<today>", "only": ["B1-scoring"] }`

Expected: workflow completes; returns `{ cells: 4, confirmed: <n>, report: "...", simplify: "..." }`.

- [ ] **Step 2: Verify output files were written**

Run: `ls -1 review/runs/*/REPORT.md review/runs/*/SIMPLIFY.md review/runs/*/map.md && echo OK`
Expected: the three files listed + `OK`.

- [ ] **Step 3: Quality spot-check (manual)**

Read `review/runs/<date>/REPORT.md`. Confirm: findings cite real `file:line` in `scoring.py`/`tactics.py`, severities/lanes are assigned, and at least one finding reflects a known failure-mode class (idempotency, pagination, drift). If findings are generic or hallucinated → tune `review/WH_CONTEXT.md` and the cell prompt in `wh-audit.js`, re-run, do not proceed.

- [ ] **Step 4: Commit the smoke-run output**

```bash
git add review/runs
git commit -m "test(audit): smoke-run wh-audit on scoring surface"
```

---

## Task 5: Full audit run (all 45 cells)

**Files:** none created (produces full `review/runs/<date>/` output).

- [ ] **Step 1: Launch the full audit**

Run `/audit` (no `only` filter). This fans out all 45 cells, verifies P0/P1 findings, synthesizes the report, and writes the simplification plan. No token cap — it runs to completion.

- [ ] **Step 2: Verify completeness**

Run: `ls -1 review/runs/<date>/findings/ | wc -l`
Expected: up to 45 annex files (fewer if some cells returned zero findings).
Then confirm `review/runs/<date>/REPORT.md` and `SIMPLIFY.md` exist and are non-empty.

- [ ] **Step 3: Present + commit**

Present the "Top 10 to fix first" to the user. Then:

```bash
git add review/runs
git commit -m "docs(audit): full WattHunter audit report + simplification plan"
```

- [ ] **Step 4: STOP**

Do not fix anything. The fix subsystem is a separate plan, gated on the golden-master oracle.

---

## Self-Review (done by author)

- **Spec coverage:** matrix (Task 2 SURFACES = 45 cells ✓), read-only reviewers (already installed, used via agentType ✓), WH context injection (Task 1 + WH const ✓), 5 phases incl. adversarial verify (Task 2 ✓), structured findings → centralized writer (Task 2 ✓), REPORT + SIMPLIFY format (Task 2 synthesis/simplify prompts ✓), /audit trigger (Task 3 ✓), no auto-fix / STOP (Task 5 ✓). Golden-master + fix explicitly out of scope ✓.
- **Placeholders:** none — all file contents and commands are literal.
- **Type consistency:** agent names in `AXIS_AGENT` match the 7 installed files (`architecture-reviewer`, `security-reviewer`, `data-reviewer`, `business-rules-reviewer`, `frontend-ds-reviewer`, `performance-reviewer`, `techdebt-reviewer`). `OUT`/`DATE`/schemas referenced consistently.
- **Open risk:** `node --check` can't validate runtime globals; first real run (Task 4) is the true integration check — kept small on purpose.
```

