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

// Robust date: accept from args, or fall back to hardcoded value
const DATE = (args && typeof args === 'object' && args.date) ? String(args.date) : '2026-06-11'
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
  'F5-ranking-rider':   { files: 'apps/web/app/(game)/league/[leagueId]/ranking, apps/web/app/(game)/league/[leagueId]/rider, apps/web/app/(game)/league/[leagueId]/achievements', axes: ['frontend-ds','performance','data','architecture'] },
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
// optional axis filter: args.axes = ['security','data','business-rules']
const axesFilter = (args && Array.isArray(args.axes)) ? args.axes : null

phase('Map')
await agent(`${WH}
Map the WattHunter repo at a high level. Do NOT judge. List the real entry points, where the
Supabase client is instantiated (client/server/service_role), where business rules live, and any
obvious duplicated modules. Write the map to ${OUT}/map.md using the Write tool and return a 5-line summary.`,
  { label: 'cartographer', phase: 'Map' })

// build the cell list from the sparse matrix
const cells = []
for (const [sid, s] of Object.entries(SURFACES)) {
  if (onlyFilter && !onlyFilter.includes(sid)) continue
  for (const axis of s.axes) {
    if (axesFilter && !axesFilter.includes(axis)) continue
    cells.push({ sid, files: s.files, axis })
  }
}
log(`Matrix: ${cells.length} cells (surfaces: ${onlyFilter ? onlyFilter.join(',') : 'all'}; axes: ${axesFilter ? axesFilter.join(',') : 'all'})`)

phase('Review')
// SKIP_VERIFY=true: skip adversarial verification to save tokens; all findings treated as confirmed
const SKIP_VERIFY = (args && args.skip_verify === true)

const perCell = await pipeline(
  cells,
  (cell) => agent(`${WH}
AUDIT one axis on one surface. Axis: ${cell.axis}. Surface: ${cell.sid}. Files: ${cell.files}.
Review ONLY this axis on ONLY these files. Be specific and concrete. Return findings using StructuredOutput.`,
    { label: `review:${cell.sid}:${cell.axis}`, phase: 'Review', agentType: AXIS_AGENT[cell.axis], schema: FINDINGS_SCHEMA }),
  (review, cell) => {
    const all = (review && review.findings) ? review.findings : []
    if (SKIP_VERIFY) {
      return Promise.resolve(all.map(f => ({ ...f, surface: cell.sid, axis: cell.axis, confirmed: true })))
    }
    // v2 (AUDIT_PLAYBOOK §3): adversarial verify on P0 only; P1/P2 pass through tagged unverified
    const pass = all.filter(f => f.severity !== 'P0').map(f => ({ ...f, surface: cell.sid, axis: cell.axis, confirmed: true, verified: false }))
    const hi = all.filter(f => f.severity === 'P0')
    if (hi.length === 0) return Promise.resolve(pass)
    return parallel(hi.map(f => () =>
      agent(`${WH}
Adversarially VERIFY this finding. Read the cited file:line to check if the issue actually exists.
Default to real=false unless you find concrete evidence at the cited location.

Finding: ${JSON.stringify(f)}

YOU MUST call the StructuredOutput tool with fields: real (boolean) and reason (string).`,
        { label: `verify:${cell.sid}:${f.id}`, phase: 'Verify', schema: VERDICT_SCHEMA })
        .then(v => ({ ...f, surface: cell.sid, axis: cell.axis, confirmed: v ? v.real !== false : false, verified: true, verdict: v }))
    )).then(verified => [...verified, ...pass])
  }
)

const confirmed = perCell.flat().filter(Boolean).filter(f => f.confirmed)
log(`Confirmed findings: ${confirmed.length}`)

phase('Synthesize')

// Step 1: persist raw findings to disk (avoids giant inline JSON in synthesis prompts)
await agent(`Using the Write tool, write the following JSON to ${OUT}/findings_staged.json.
Do not output the content as text — ONLY write the file using the Write tool.
Content:
${JSON.stringify(confirmed)}`,
  { label: 'stage-findings', phase: 'Synthesize' })

// Step 2: write per-surface annex files in parallel
const surfaceIds = [...new Set(confirmed.map(f => f.surface))]
log(`Writing ${surfaceIds.length} surface annex files…`)
await parallel(surfaceIds.map(surface => () => {
  const sf = confirmed.filter(f => f.surface === surface)
  return agent(`${WH}
Read review/WH_CONTEXT.md. Then using the Write tool, write ${OUT}/findings/${surface}__all.md.
Content must be a markdown table with columns: ID | Severity | Effort | Lane | Axis | file:line | Issue | Fix.
Include these ${sf.length} findings:
${JSON.stringify(sf)}
Do NOT output content as text — use the Write tool only.`,
    { label: `write-annex:${surface}`, phase: 'Synthesize' })
}))

// Step 3: global REPORT.md
await agent(`${WH}
You have write tools. Read all files in ${OUT}/findings/ directory (annex files written in the previous step).
Also read ${OUT}/map.md for context.
Produce ${OUT}/REPORT.md:
- Section "## Top 10 to fix first" at the very top: pick the 10 most impactful findings, one line each with rationale.
- Section "## Global Findings Table" — ONE table: ID | Severity | Effort | Lane | Surface | Axis | file:line | Issue | Fix.
- Deduplicate: if same file+issue flagged by multiple axes, merge into one row (highest severity, list all axes).
- Sort: P0 first, then P1, then P2; within each severity sort by Effort S→M→L.
- Counts summary at the bottom: total P0 / P1 / P2, Lane A vs Lane B.
Use the Write tool to write ${OUT}/REPORT.md. IMPORTANT: the file MUST be written, not output as text.`,
  { label: 'synthesis-report', phase: 'Synthesize', model: 'opus' })

phase('Simplify')
await agent(`${WH}
You have write tools. Read ${OUT}/REPORT.md and ${OUT}/map.md.
Produce ${OUT}/SIMPLIFY.md with:
- Ordered cut-plan table: ID | Action(DELETE/MERGE/FLATTEN/KILL) | Risk(Low/Med/High) | LOC saved (approx) | file:line | What | Why safe | Safety-net test needed.
- Sort low-risk + high-LOC-saved first.
- "Rule consolidation map" section: each duplicated business rule -> the ONE canonical location it should live.
- NEVER recommend a High-risk deletion without naming the characterization test to add first.
Use the Write tool to write ${OUT}/SIMPLIFY.md. IMPORTANT: the file MUST be written, not output as text.`,
  { label: 'simplify', phase: 'Simplify', model: 'opus' })

return { cells: cells.length, confirmed: confirmed.length, date: DATE, report: `${OUT}/REPORT.md`, simplify: `${OUT}/SIMPLIFY.md` }
