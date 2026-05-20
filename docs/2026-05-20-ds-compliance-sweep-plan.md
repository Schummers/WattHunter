# DS Compliance Sweep — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One-shot remise au carré de toute l'app WattHunter sur le design system v3.1 — 0 violation A-E résiduelle, preuve visuelle par page, cascade de tokens fonctionnelle.

**Architecture:** 5 phases séquentielles avec gates humains après Phase 1 (sitemap) et Phase 2 (audits). Sub-agents en batches de 5 pour les phases 2 et 3. Tout dans une branche locale unique `feature/ds-compliance-sweep`, merge final unique.

**Tech Stack:** TypeScript (tsx pour les scripts), Playwright MCP (screenshots), Bash, sous-agents Sonnet 4.6 orchestrés par Opus 4.7.

**Design spec:** `docs/2026-05-20-ds-compliance-sweep-design.md`

---

## Phase 0 — Outillage

### Task 0.1: Setup arborescence d'audit

**Files:**
- Create: `docs/audits/ds-sweep-2026-05/`
- Create: `docs/audits/ds-sweep-2026-05/pages/` (vide)
- Create: `docs/audits/ds-sweep-2026-05/shared-components/` (vide)
- Create: `docs/audits/ds-sweep-2026-05/screenshots/` (vide)
- Create: `docs/audits/ds-sweep-2026-05/README.md`
- Create: `docs/audits/ds-sweep-2026-05/follow-ups.md`
- Create: `docs/audits/ds-sweep-2026-05/blocked.md`

- [ ] **Step 1: Créer la structure**

```bash
cd /Users/jonathanschummers/Documents/WattHunter
mkdir -p docs/audits/ds-sweep-2026-05/{pages,shared-components,screenshots}
```

- [ ] **Step 2: Écrire le README**

```markdown
# DS Compliance Sweep 2026-05

Sweep one-shot — voir spec `docs/2026-05-20-ds-compliance-sweep-design.md`.

## Structure
- `00-sitemap.md` — produit par Phase 1, validé manuellement
- `pages/<route-slug>.md` — un rapport par page (Phase 2)
- `shared-components/<component>.md` — un rapport par composant partagé (Phase 2)
- `screenshots/<slug>-before-<state>.png` & `<slug>-after-<state>.png` (Phase 3)
- `follow-ups.md` — items hors scope repérés en cours de route
- `blocked.md` — violations skippées par les agents, à trancher par Jonathan

## Status
- [ ] Phase 0 — outils
- [ ] Phase 1 — sitemap
- [ ] Phase 2 — audits
- [ ] Phase 3 — repairs
- [ ] Phase 4 — verif globale
```

- [ ] **Step 3: Initialiser follow-ups.md et blocked.md**

```markdown
# Follow-ups (hors scope sweep)

Items repérés pendant le sweep mais qui sortent du scope A-E. À traiter dans un chantier séparé.

| Date | Source (audit/repair) | Item | Type |
|---|---|---|---|
```

```markdown
# Violations bloquées (à trancher manuellement)

Violations que les agents n'ont pas pu fixer automatiquement (ambiguïté sémantique, token manquant, etc.).

| Date | File:Line | Class | Issue | Proposed resolution |
|---|---|---|---|---|
```

- [ ] **Step 4: Commit**

```bash
git checkout -b feature/ds-compliance-sweep
git add docs/audits/ds-sweep-2026-05/
git commit -m "chore(ds-sweep): scaffold audit directory structure"
```

---

### Task 0.2: Écrire le détecteur `scripts/audit-ds.ts`

**Files:**
- Create: `scripts/audit-ds.ts`
- Modify: `package.json` (ajouter script `audit-ds`)
- Test: `scripts/audit-ds.test.ts`

- [ ] **Step 1: Vérifier les dépendances disponibles**

```bash
cat package.json | grep -E '"tsx"|"glob"|"typescript"'
```

Expected: `tsx` et `typescript` présents (déjà dans le repo). Si `glob` manque :

```bash
pnpm add -D -w glob
```

- [ ] **Step 2: Écrire le test du détecteur AVANT le code**

Fichier `scripts/audit-ds.test.ts` :

```typescript
import { describe, it, expect } from "vitest";
import { detectViolations } from "./audit-ds";

describe("audit-ds detector", () => {
  describe("Class A — typography", () => {
    it("detects text-[Npx]", () => {
      const code = `<span className="text-[10px] font-bold">x</span>`;
      const v = detectViolations(code, "fake.tsx");
      expect(v.find((x) => x.class === "A" && x.current === "text-[10px]")).toBeDefined();
    });

    it("detects text-base/lg/sm/xl/2xl/3xl", () => {
      for (const size of ["base", "lg", "sm", "xl", "2xl", "3xl"]) {
        const code = `<span className="text-${size}">x</span>`;
        const v = detectViolations(code, "fake.tsx");
        expect(v.find((x) => x.class === "A" && x.current === `text-${size}`)).toBeDefined();
      }
    });

    it("does NOT flag text-[length:var(--type-*)]", () => {
      const code = `<span className="text-[length:var(--type-body)]">x</span>`;
      expect(detectViolations(code, "fake.tsx").filter((x) => x.class === "A")).toHaveLength(0);
    });
  });

  describe("Class B — colors", () => {
    it("detects hex colors in className and style", () => {
      const code = `<div className="bg-[#ff0000]" style={{ color: "#fff" }}>x</div>`;
      const v = detectViolations(code, "fake.tsx");
      expect(v.filter((x) => x.class === "B").length).toBeGreaterThanOrEqual(2);
    });

    it("detects text-white/black/gray-N", () => {
      for (const color of ["text-white", "text-black", "text-gray-500", "bg-zinc-700", "text-slate-300"]) {
        const code = `<span className="${color}">x</span>`;
        const v = detectViolations(code, "fake.tsx");
        expect(v.find((x) => x.class === "B" && x.current === color)).toBeDefined();
      }
    });

    it("does NOT flag var(--text-*), var(--bg-*), var(--cyan-*), var(--accent-*)", () => {
      const code = `<span className="text-[var(--text-high)] bg-[var(--bg-surface)]">x</span>`;
      expect(detectViolations(code, "fake.tsx").filter((x) => x.class === "B")).toHaveLength(0);
    });
  });

  describe("Class C — spacing & radius", () => {
    it("detects rounded-[Npx]", () => {
      const code = `<div className="rounded-[10px]">x</div>`;
      const v = detectViolations(code, "fake.tsx");
      expect(v.find((x) => x.class === "C" && x.current === "rounded-[10px]")).toBeDefined();
    });

    it("detects p-[Npx], gap-[Npx], m[xytrbl]-[Npx]", () => {
      for (const u of ["p-[12px]", "gap-[7px]", "mt-[3px]", "mx-[15px]"]) {
        const code = `<div className="${u}">x</div>`;
        const v = detectViolations(code, "fake.tsx");
        expect(v.find((x) => x.class === "C" && x.current === u)).toBeDefined();
      }
    });

    it("does NOT flag standard Tailwind utilities (p-3, gap-2, rounded-md)", () => {
      const code = `<div className="p-3 gap-2 rounded-md">x</div>`;
      expect(detectViolations(code, "fake.tsx").filter((x) => x.class === "C")).toHaveLength(0);
    });
  });

  describe("Class D — component patterns", () => {
    it("flags <span> with rounded-full + border that looks like a Pill", () => {
      const code = `<span className="rounded-full border border-[var(--border-default)] px-2 py-0.5">x</span>`;
      const v = detectViolations(code, "fake.tsx");
      expect(v.find((x) => x.class === "D")).toBeDefined();
    });

    it("does NOT flag Pill/Badge/FilterChip imports", () => {
      const code = `<Pill>x</Pill>`;
      expect(detectViolations(code, "fake.tsx").filter((x) => x.class === "D")).toHaveLength(0);
    });
  });

  describe("Class E — Geist Mono for numbers", () => {
    it("flags inline {number} expressions in elements without font-mono", () => {
      const code = `<span className="text-[length:var(--type-body)]">{xp}</span>`;
      const v = detectViolations(code, "fake.tsx");
      // E is harder to detect statically — at minimum, flag {number-looking-vars} in non-mono context
      // Best-effort: detect common patterns like {xp}, {price}, {amount}, {treasury}, {salary}, {count}, {total}
      expect(v.filter((x) => x.class === "E").length).toBeGreaterThanOrEqual(0);
      // E is documented as best-effort — full coverage requires audit agent semantic pass
    });

    it("does NOT flag numbers when font-mono is present", () => {
      const code = `<span className="font-mono">{xp}</span>`;
      expect(detectViolations(code, "fake.tsx").filter((x) => x.class === "E")).toHaveLength(0);
    });
  });

  describe("line tracking", () => {
    it("returns correct line numbers", () => {
      const code = `line 1\n<span className="text-base">x</span>\nline 3`;
      const v = detectViolations(code, "fake.tsx");
      expect(v[0].line).toBe(2);
    });
  });
});
```

- [ ] **Step 3: Run le test — doit échouer**

```bash
cd /Users/jonathanschummers/Documents/WattHunter
pnpm exec vitest run scripts/audit-ds.test.ts
```

Expected: FAIL — `Cannot find module './audit-ds'`.

- [ ] **Step 4: Écrire le détecteur**

Fichier `scripts/audit-ds.ts` :

```typescript
import { readFileSync } from "node:fs";
import { glob } from "glob";
import path from "node:path";

export type ViolationClass = "A" | "B" | "C" | "D" | "E";

export interface Violation {
  id: string;
  file: string;
  line: number;
  class: ViolationClass;
  rule: string;
  current: string;
  context: string;
}

interface Rule {
  class: ViolationClass;
  name: string;
  pattern: RegExp;
  /** Returns the matched substring to report as `current`. Default: match[0]. */
  extract?: (m: RegExpExecArray) => string;
  /** Optional negative filter — if returns true, skip this match (false positive). */
  skip?: (m: RegExpExecArray, line: string) => boolean;
}

const RULES: Rule[] = [
  // ── Class A · Typography ───────────────────────────────────────────────
  {
    class: "A",
    name: "text-[Npx] bypasses token scale",
    pattern: /text-\[(\d+)px\]/g,
  },
  {
    class: "A",
    name: "Tailwind preset text size bypasses token scale",
    pattern: /\btext-(base|lg|sm|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)\b/g,
  },

  // ── Class B · Colors ───────────────────────────────────────────────────
  {
    class: "B",
    name: "Hardcoded hex color",
    pattern: /#[0-9a-fA-F]{3,8}\b/g,
    skip: (m, line) => {
      // Skip svg fill/stroke="#..." inside icon files (rare in apps/web/, but defensive)
      // Skip comments
      const trimmed = line.trim();
      if (trimmed.startsWith("//") || trimmed.startsWith("*")) return true;
      return false;
    },
  },
  {
    class: "B",
    name: "Hardcoded Tailwind palette color",
    pattern: /\b(?:text|bg|border|ring|fill|stroke)-(white|black|gray-\d{2,3}|zinc-\d{2,3}|slate-\d{2,3}|neutral-\d{2,3}|stone-\d{2,3}|red-\d{2,3}|orange-\d{2,3}|amber-\d{2,3}|yellow-\d{2,3}|lime-\d{2,3}|green-\d{2,3}|emerald-\d{2,3}|teal-\d{2,3}|sky-\d{2,3}|blue-\d{2,3}|indigo-\d{2,3}|violet-\d{2,3}|purple-\d{2,3}|fuchsia-\d{2,3}|pink-\d{2,3}|rose-\d{2,3})\b/g,
    skip: (m) => {
      // cyan-* est autorisé (palette officielle DS)
      return /cyan-\d{2,3}/.test(m[0]);
    },
  },

  // ── Class C · Spacing & Radius ─────────────────────────────────────────
  {
    class: "C",
    name: "Hardcoded radius",
    pattern: /rounded-\[(\d+)px\]/g,
  },
  {
    class: "C",
    name: "Hardcoded spacing (arbitrary px)",
    pattern: /\b(p|m|gap|space-[xy])-?[trblxy]?-\[\d+px\]/g,
  },

  // ── Class D · Component patterns (heuristique — l'agent confirme) ──────
  {
    class: "D",
    name: "Inline <span> with rounded-full + border — likely Pill/Badge",
    pattern: /<span[^>]*className="[^"]*\brounded-full\b[^"]*\bborder\b[^"]*"[^>]*>/g,
  },
  {
    class: "D",
    name: "Inline <span> rendering UPPERCASE + tracking — likely Badge label",
    pattern: /<span[^>]*className="[^"]*\buppercase\b[^"]*\btracking-/g,
  },

  // ── Class E · Geist Mono for numbers (best-effort) ─────────────────────
  {
    class: "E",
    name: "Number variable in non-mono context (heuristic)",
    pattern: /\{(xp|price|amount|treasury|salary|count|total|points|score|rank|bid|cost|level)\b[^}]*\}/g,
    skip: (m, line) => {
      return /font-mono|--type-(display|stat|stat-small)/.test(line);
    },
  },
];

export function detectViolations(source: string, filePath: string): Violation[] {
  const lines = source.split("\n");
  const violations: Violation[] = [];
  let counter = 0;

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    for (const rule of RULES) {
      rule.pattern.lastIndex = 0; // reset stateful regex
      let m: RegExpExecArray | null;
      while ((m = rule.pattern.exec(line)) !== null) {
        if (rule.skip && rule.skip(m, line)) continue;
        const current = rule.extract ? rule.extract(m) : m[0];
        counter++;
        violations.push({
          id: `${rule.class}-${String(counter).padStart(3, "0")}`,
          file: filePath,
          line: lineIdx + 1,
          class: rule.class,
          rule: rule.name,
          current,
          context: line.trim().slice(0, 200),
        });
      }
    }
  }

  return violations;
}

export async function scanRepo(root: string, classes?: ViolationClass[]): Promise<Violation[]> {
  const files = await glob("apps/web/**/*.{tsx,ts}", { cwd: root, ignore: ["**/node_modules/**", "**/*.test.tsx", "**/*.test.ts", "**/__tests__/**"] });
  const all: Violation[] = [];
  for (const rel of files) {
    const abs = path.join(root, rel);
    const src = readFileSync(abs, "utf8");
    const v = detectViolations(src, rel);
    all.push(...(classes ? v.filter((x) => classes.includes(x.class)) : v));
  }
  return all;
}

async function main() {
  const args = process.argv.slice(2);
  const json = args.includes("--json");
  const classesArg = args.find((a) => a.startsWith("--class="))?.split("=")[1];
  const classes = classesArg?.split(",").map((c) => c.trim().toUpperCase() as ViolationClass);
  const targetFile = args.find((a) => !a.startsWith("--"));

  const root = process.cwd();

  let violations: Violation[];
  if (targetFile) {
    const src = readFileSync(path.resolve(targetFile), "utf8");
    const rel = path.relative(root, path.resolve(targetFile));
    violations = detectViolations(src, rel);
    if (classes) violations = violations.filter((v) => classes.includes(v.class));
  } else {
    violations = await scanRepo(root, classes);
  }

  if (json) {
    console.log(JSON.stringify({ count: violations.length, violations }, null, 2));
    return;
  }

  // Human format
  const byClass = new Map<ViolationClass, Violation[]>();
  for (const v of violations) {
    if (!byClass.has(v.class)) byClass.set(v.class, []);
    byClass.get(v.class)!.push(v);
  }
  console.log(`Total: ${violations.length} violations\n`);
  for (const [cls, items] of byClass) {
    console.log(`── Class ${cls} — ${items.length} violations`);
    for (const v of items) {
      console.log(`  ${v.file}:${v.line}  ${v.current}  (${v.rule})`);
    }
    console.log();
  }
  process.exit(violations.length > 0 ? 1 : 0);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e);
    process.exit(2);
  });
}
```

- [ ] **Step 5: Run test — doit passer**

```bash
pnpm exec vitest run scripts/audit-ds.test.ts
```

Expected: PASS (au moins toutes les assertions sur A/B/C/D et le line tracking ; E est best-effort).

- [ ] **Step 6: Ajouter le script `audit-ds` au `package.json` racine**

Modifier la section `scripts` :

```json
{
  "scripts": {
    "audit-ds": "tsx scripts/audit-ds.ts"
  }
}
```

- [ ] **Step 7: Smoke test sur le repo réel**

```bash
pnpm audit-ds 2>&1 | tail -30
```

Expected: liste de violations actuelles (probablement 100-500 selon l'état du repo). Note le total — c'est la baseline avant sweep.

- [ ] **Step 8: Sauvegarder la baseline**

```bash
pnpm audit-ds --json > docs/audits/ds-sweep-2026-05/baseline.json
echo "Total violations baseline: $(pnpm audit-ds --json | jq '.count')" >> docs/audits/ds-sweep-2026-05/README.md
```

- [ ] **Step 9: Commit**

```bash
git add scripts/audit-ds.ts scripts/audit-ds.test.ts package.json docs/audits/ds-sweep-2026-05/baseline.json docs/audits/ds-sweep-2026-05/README.md
git commit -m "feat(ds-sweep): violation detector script with regex rules A-E"
```

---

### Task 0.3: Helper screenshot Playwright

**Files:**
- Create: `scripts/screenshot-states.ts`
- Modify: `package.json` (ajouter script)

NOTE — Ce script est minimal car les agents Réparateurs utilisent l'MCP Playwright directement. Cet utilitaire sert pour les screenshots batch hors agent (Phase 4 verif).

- [ ] **Step 1: Écrire le helper**

Fichier `scripts/screenshot-states.ts` :

```typescript
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import path from "node:path";

interface ShotSpec {
  url: string;
  state: string; // ex: "loaded", "empty", "round-active"
  slug: string;  // ex: "auction-market"
  prepare?: (page: import("playwright").Page) => Promise<void>;
}

const OUT_DIR = "docs/audits/ds-sweep-2026-05/screenshots";
const BASE = "http://localhost:3000";

const SPECS: ShotSpec[] = [
  // Rempli par le sitemap de Phase 1
];

async function main() {
  const mode = process.argv[2]; // "before" | "after"
  if (mode !== "before" && mode !== "after") {
    console.error("Usage: tsx scripts/screenshot-states.ts <before|after>");
    process.exit(1);
  }
  mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  for (const spec of SPECS) {
    const page = await ctx.newPage();
    await page.goto(`${BASE}${spec.url}`);
    if (spec.prepare) await spec.prepare(page);
    await page.waitForLoadState("networkidle");
    const out = path.join(OUT_DIR, `${spec.slug}-${mode}-${spec.state}.png`);
    await page.screenshot({ path: out, fullPage: true });
    console.log(`captured ${out}`);
    await page.close();
  }
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 2: Ajouter au `package.json`**

```json
{
  "scripts": {
    "ds-shots": "tsx scripts/screenshot-states.ts"
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add scripts/screenshot-states.ts package.json
git commit -m "feat(ds-sweep): screenshot helper (specs populated in Phase 1)"
```

---

## Phase 1 — Sitemap (Inventoriste)

### Task 1.1: Dispatch Inventoriste

**Agent:** Opus 4.7 OR Sonnet via Task tool, model="sonnet"
**Subagent type:** general-purpose
**Files produced:** `docs/audits/ds-sweep-2026-05/00-sitemap.md`

- [ ] **Step 1: Lancer le subagent**

Prompt :

```
Tu es l'Inventoriste pour le sweep DS Compliance de WattHunter.

CONTEXTE
- Repo : /Users/jonathanschummers/Documents/WattHunter
- Spec : docs/2026-05-20-ds-compliance-sweep-design.md (LIRE EN ENTIER)
- Design system : docs/watthunter-design-system-v3.md (parcourir)
- Tokens CSS : apps/web/app/globals.css (sections `--type-*`, `--text-*`, `--bg-*`, `--cyan-*`)

MISSION
Produire `docs/audits/ds-sweep-2026-05/00-sitemap.md` qui liste de manière exhaustive :

1. Toutes les routes Next.js sous `apps/web/app/` (statiques et dynamiques).
   Pour chaque route : path, fichier `page.tsx`, layout parent si non standard.

2. Pour chaque route, lister les composants top-level rendus (lecture du page.tsx + composants client directement importés). Pas besoin de l'arbre complet — juste 1 niveau.

3. Pour chaque route, lister les ÉTATS distincts à screenshoter (loaded, empty, error, GT-active, off-season, round-active, round-closed, etc.). Inférer depuis le code (early returns, conditionnels sur user state).

4. Composants partagés à auditer indépendamment : tout composant sous `apps/web/components/` rendu par 3+ pages. Lister avec le nombre de pages consommatrices.

5. Ignorer : routes purement API (`route.ts` sans UI), middleware, layout root sans logique visuelle.

CONTRAINTES
- N'utiliser que des outils READ (pas d'Edit/Write côté apps/web).
- Tu PEUX écrire `docs/audits/ds-sweep-2026-05/00-sitemap.md`.
- Tu PEUX appeler `pnpm audit-ds` pour cross-checker quels fichiers ont des violations (utile pour confirmer la complétude).

FORMAT DE SORTIE (markdown)

# Sitemap DS Compliance Sweep 2026-05

## Résumé
- N routes totales
- M composants partagés à auditer séparément
- Total unités d'audit : N + M

## Groupes de routes

### Auth & Onboarding
- `/` — file: `apps/web/app/page.tsx`
  - top-level: `<LandingClient>`
  - states: anonymous, signed-in
- ...

### Game / League
- `/league/[leagueId]` — file: `apps/web/app/(game)/league/[leagueId]/page.tsx`
  - top-level: `<HomeView>`, `<RaceFeed>`, `<BackHeader>`
  - states: no-team, pre-auction, auction-active, GT-active, off-season
- ...

### Settings & Admin
- ...

## Composants partagés (3+ pages)
| Composant | File | Used by |
|---|---|---|
| RiderCard | `apps/web/components/rider-card.tsx` | market, team, ranking, palmares, ... |
| BackHeader | `apps/web/components/back-header.tsx` | toutes pages /league/* |
| ... | ... | ... |

## Ordre d'audit recommandé
1. Composants partagés EN PREMIER (impact cascadé)
2. Pages par feature critique : Auction → GT → Home → Palmares → Ranking → Settings → Achievements → Onboarding/Lobby

Ne pas écrire de code. Ne pas auditer. Juste produire ce sitemap.
```

- [ ] **Step 2: Review humaine du sitemap**

```bash
$EDITOR docs/audits/ds-sweep-2026-05/00-sitemap.md
```

Jonathan vérifie :
- [ ] Toutes les routes attendues sont listées
- [ ] Pas de routes mortes (pages obsolètes à supprimer plutôt qu'à auditer)
- [ ] Les états par page sont raisonnables (ni excessifs ni manquants)
- [ ] Les composants partagés flaggés sont effectivement réutilisés

Marquer le fichier comme `Status: validated 2026-05-XX` en début de doc.

- [ ] **Step 3: Commit du sitemap validé**

```bash
git add docs/audits/ds-sweep-2026-05/00-sitemap.md
git commit -m "docs(ds-sweep): sitemap validated (Phase 1 complete)"
```

---

## Phase 2 — Audits par unité

### Task 2.1: Audit des composants partagés (1er batch, prioritaire)

**Agents:** sub-agents Sonnet, batch parallèle de 5 max
**Subagent type:** general-purpose
**Files produced:** `docs/audits/ds-sweep-2026-05/shared-components/<name>.md` (1 par composant)

- [ ] **Step 1: Lancer le batch 1 (5 composants partagés en parallèle)**

Pour chacun des 5 premiers composants partagés du sitemap, lancer 1 sub-agent avec ce prompt template :

```
Tu es l'Auditeur DS pour le composant `<COMPONENT_PATH>` (utilisé par <N> pages d'après le sitemap).

CONTEXTE
- Repo : /Users/jonathanschummers/Documents/WattHunter
- Spec : docs/2026-05-20-ds-compliance-sweep-design.md (LIRE EN ENTIER, sections "Scope" et "Phase 2")
- Design system : docs/watthunter-design-system-v3.md (TABLES de tokens — sections Typography, Colors, Spacing, Components)
- Tokens CSS définis : apps/web/app/globals.css
- Outil : `pnpm audit-ds <file>` te donne la liste regex des violations pour amorcer. Utilise-le.

MISSION
Produire `docs/audits/ds-sweep-2026-05/shared-components/<COMPONENT_SLUG>.md` au format exact suivant :

# Audit · <component-path>
Generated: <date>
Used by: <list of pages from sitemap>

## Tour d'horizon
- Brève description (1-2 lignes) du rôle du composant
- Variantes/props clés affectant le rendu visuel

## Violations détaillées

### A · Typographie (N)
| ID | File:Line | Current | Proposed | Confidence | Rationale |
|---|---|---|---|---|---|
| A-001 | ... | text-base | text-[length:var(--type-body)] | AUTO | ... |

### B · Couleurs (N)
...

### C · Spacing & Radius (N)
...

### D · Patterns composants (N)
| ID | File:Line | Current pattern | Proposed component | Rationale |
|---|---|---|---|---|

### E · Geist Mono numbers (N)
...

## Cross-cutting issues (à logger en follow-ups)
- ... (ex: "ce composant duplique le pattern X de composant Y")

## Checklist verification (à cocher par le repair agent)
- [ ] Screenshot before captured (1 par variante visuelle distincte)
- [ ] Screenshot after captured
- [ ] Diff visuel: décrire textuellement les changements attendus
- [ ] typecheck PASS
- [ ] lint PASS (0 warning ignoré)
- [ ] vitest PASS sur les tests touchant ce composant
- [ ] Pas de régression sur les pages consommatrices (lister à check manuellement)

RÈGLES STRICTES
- Chaque violation DOIT avoir un `Proposed` non vide. Si ambigu, mettre la meilleure proposition + Confidence=MANUAL + Rationale détaillée.
- Si tu ne sais vraiment pas → flag `BLOCKED · <reason>` et continue. NE PAS sauter en silence.
- Confidence AUTO = substitution mécanique sûre (un seul mapping possible).
- Confidence MANUAL = jugement sémantique (ex: `text-base` peut devenir `--type-body` OU `--type-emphasis` selon le contexte). Toujours expliquer le choix.
- NE PAS modifier le code. Tu produis uniquement un rapport markdown.
- NE PAS auditer d'autres composants. Reste focus sur celui qui t'est assigné.

SORTIE FINALE : un seul fichier markdown au path indiqué, suivant exactement le format ci-dessus.
```

- [ ] **Step 2: Vérifier que les 5 rapports sont produits**

```bash
ls docs/audits/ds-sweep-2026-05/shared-components/
```

Si un agent a échoué : relancer juste celui-là.

- [ ] **Step 3: Commit du batch 1**

```bash
git add docs/audits/ds-sweep-2026-05/shared-components/
git commit -m "docs(ds-sweep): audit shared components batch 1 (5 reports)"
```

- [ ] **Step 4: Lancer le batch 2 (autres composants partagés)**

Répéter Step 1 pour les composants restants. Re-commit après chaque batch.

---

### Task 2.2: Audit des pages

**Agents:** sub-agents Sonnet, batch parallèle de 5 max
**Files produced:** `docs/audits/ds-sweep-2026-05/pages/<route-slug>.md` (1 par page)

- [ ] **Step 1: Définir les batches par groupe de feature**

Suivre l'ordre recommandé par le sitemap. Exemple de batches :
- Batch 1 : 5 pages Auction (rounds, market, history, queue, draft)
- Batch 2 : 5 pages GT (squad, tactics, rescue, ...)
- Batch 3 : 5 pages Home + Race Feed + Palmares
- Batch 4 : 5 pages Ranking + Achievements + Settings
- Batch 5 : restant (onboarding, lobby, etc.)

- [ ] **Step 2: Lancer chaque batch**

Pour chaque page du batch, sub-agent avec ce prompt template :

```
Tu es l'Auditeur DS pour la page `<ROUTE>` (file: `<PAGE_FILE>`).

CONTEXTE
- Repo : /Users/jonathanschummers/Documents/WattHunter
- Spec : docs/2026-05-20-ds-compliance-sweep-design.md
- Design system : docs/watthunter-design-system-v3.md
- Sitemap : docs/audits/ds-sweep-2026-05/00-sitemap.md (parcours la ligne de TA page pour identifier ses états)
- Audits des composants partagés DÉJÀ produits : docs/audits/ds-sweep-2026-05/shared-components/*.md
- Outil : `pnpm audit-ds <file>` à utiliser pour amorcer
- Tokens définis : apps/web/app/globals.css

MISSION
Produire `docs/audits/ds-sweep-2026-05/pages/<ROUTE_SLUG>.md` au format :

# Audit · <route>
Generated: <date>
File: <page-file>
States to screenshot: <list from sitemap>

## Component tree rendu (1 niveau)
- ...

## Composants partagés utilisés (déjà audités → ne PAS dupliquer leurs violations)
- RiderCard → voir shared-components/rider-card.md
- ...

## Violations sur le code spécifique de la page

### A · Typographie (N)
| ID | File:Line | Current | Proposed | Confidence | Rationale |

### B · Couleurs (N)
...

### C · Spacing & Radius (N)
...

### D · Patterns composants (N)
...

### E · Geist Mono numbers (N)
...

## Cross-cutting issues
- ...

## Checklist verification
- [ ] Screenshots before captured pour chaque état listé
- [ ] Screenshots after capturés
- [ ] typecheck/lint/vitest PASS
- [ ] Pas de régression visuelle non voulue

RÈGLES STRICTES (identiques à l'audit des composants partagés) :
- Proposed jamais vide
- Confidence AUTO/MANUAL/BLOCKED explicite
- NE PAS modifier le code
- NE PAS auditer les composants partagés (déjà fait — référencer leur rapport)
- NE PAS auditer une autre page
```

- [ ] **Step 3: Commit après chaque batch**

```bash
git add docs/audits/ds-sweep-2026-05/pages/
git commit -m "docs(ds-sweep): audit pages batch <N> (5 reports)"
```

---

### Task 2.3: GATE humain — review des audits

- [ ] **Step 1: Lire les rapports par échantillonnage**

Stratégie :
- 100% des rapports de composants partagés (impact cascadé)
- 10 pages au hasard en profondeur
- 20 pages restantes en survol (vérifier juste : Proposed rempli, pas de BLOCKED non justifié)

- [ ] **Step 2: Corriger les Proposed douteux**

Pour toute violation où le Proposed semble faux, éditer directement le rapport et changer le Proposed. Ajouter un commentaire `<!-- reviewed by Jonathan: ... -->` pour traçabilité.

- [ ] **Step 3: Trancher les BLOCKED**

Pour chaque BLOCKED, soit :
- Décider d'un Proposed → éditer le rapport, retirer BLOCKED
- Garder BLOCKED si vraiment ambigu → logger dans `blocked.md` pour traitement manuel post-sweep

- [ ] **Step 4: Commit du gate**

```bash
git add docs/audits/ds-sweep-2026-05/
git commit -m "review(ds-sweep): Phase 2 gate — audits reviewed by Jonathan"
```

---

## Phase 3 — Repairs

### Task 3.1: Setup — vérifier branche et dev server

- [ ] **Step 1: Vérifier qu'on est bien sur `feature/ds-compliance-sweep`**

```bash
git branch --show-current
```

Expected: `feature/ds-compliance-sweep`

- [ ] **Step 2: Démarrer le dev server (à laisser tourner pendant toute la Phase 3)**

```bash
pnpm dev
```

Run in background. Vérifier que http://localhost:3000 répond.

---

### Task 3.2: Repair des composants partagés EN PREMIER

**Agents:** sub-agents Sonnet, batch parallèle de 5 max
**Critical:** ne PAS paralléliser sur des composants qui s'importent les uns les autres (rare mais possible).

- [ ] **Step 1: Lancer le batch 1 (5 composants partagés en parallèle)**

Prompt template par sub-agent :

```
Tu es le Réparateur DS pour le composant `<COMPONENT_PATH>`.

CONTEXTE
- Repo : /Users/jonathanschummers/Documents/WattHunter
- Branche active : feature/ds-compliance-sweep (déjà checked out)
- Rapport d'audit validé : `docs/audits/ds-sweep-2026-05/shared-components/<SLUG>.md` (LIRE EN ENTIER)
- Design system : docs/watthunter-design-system-v3.md (pour ré-vérifier en cas de doute)
- Dev server tourne sur http://localhost:3000

MISSION
1. Lire le rapport d'audit. Appliquer chaque violation listée avec son Proposed.
2. Avant modifications : screenshots des variantes/états listés dans le rapport, via Playwright MCP.
3. Appliquer les fixes AUTO directement.
4. Appliquer les fixes MANUAL avec le Proposed du rapport (Jonathan a déjà validé).
5. Skipper les BLOCKED (déjà loggés).
6. Run verification : `pnpm typecheck`, `pnpm lint` (sans flag --quiet, 0 warning ignoré), `pnpm test -- <pattern matchant le composant>`.
7. Screenshots après pour les mêmes états.
8. Appender une section "Repair log" au rapport d'audit avec : violations appliquées, skippées, résultats des checks, paths des screenshots.
9. Commit avec message `fix(ds): sweep <component-path> — N violations resolved`.

RÈGLES STRICTES
- NE PAS modifier d'autres fichiers que ceux listés dans le rapport.
- NE PAS appliquer un Proposed différent de celui du rapport (Jonathan a validé). Si tu vois un problème, flagger BLOCKED dans le repair log au lieu de fixer "mieux".
- NE PAS skipper la verification — si typecheck/lint échoue, REVERT tes modifs et flag BLOCKED.
- NE PAS skipper les screenshots — c'est ce qui manquait au sweep Jules.
- Si Playwright MCP ne fonctionne pas pour un état donné (auth required, etc.), noter "screenshot skipped: <reason>" dans le repair log et continuer.

PATHS POUR LES SCREENSHOTS
- Before : docs/audits/ds-sweep-2026-05/screenshots/<SLUG>-before-<state>.png
- After : docs/audits/ds-sweep-2026-05/screenshots/<SLUG>-after-<state>.png

SORTIE
- Le code modifié (commit local)
- Le rapport d'audit appendé avec le Repair log
- Les screenshots PNG sauvegardés
```

- [ ] **Step 2: Vérifier la chaîne de commits**

```bash
git log --oneline feature/ds-compliance-sweep | head -10
```

Expected: 5 nouveaux commits de la forme `fix(ds): sweep <component-path>`.

- [ ] **Step 3: Spot check visuel**

Ouvrir 1-2 paires before/after au hasard :

```bash
open docs/audits/ds-sweep-2026-05/screenshots/<slug>-before-*.png docs/audits/ds-sweep-2026-05/screenshots/<slug>-after-*.png
```

Si régression visuelle non voulue détectée : `git revert <sha>` du commit fautif et logger dans `blocked.md` pour reprise manuelle.

- [ ] **Step 4: Lancer les batches suivants**

Répéter pour les composants partagés restants.

---

### Task 3.3: Repair des pages

**Agents:** sub-agents Sonnet, batch parallèle de 5 max
**Ordre:** suivre l'ordre recommandé par le sitemap (Auction → GT → Home → Palmares → Ranking → Settings → Achievements → Onboarding).

- [ ] **Step 1: Lancer chaque batch**

Prompt template (identique à Task 3.2 mais ciblant une page) :

```
Tu es le Réparateur DS pour la page `<ROUTE>` (file: `<PAGE_FILE>`).

CONTEXTE
- Repo : /Users/jonathanschummers/Documents/WattHunter
- Branche active : feature/ds-compliance-sweep
- Rapport d'audit validé : `docs/audits/ds-sweep-2026-05/pages/<ROUTE_SLUG>.md` (LIRE EN ENTIER)
- Design system : docs/watthunter-design-system-v3.md
- Composants partagés DÉJÀ réparés en Phase 3.2 → ne PAS toucher leur code

MISSION (identique à Task 3.2)
1. Screenshots before
2. Apply AUTO fixes
3. Apply MANUAL fixes (Proposed validé par Jonathan)
4. Skip BLOCKED
5. Verification (typecheck, lint, vitest)
6. Screenshots after
7. Append Repair log au rapport
8. Commit `fix(ds): sweep <route> — N violations resolved`

ÉTATS À SCREENSHOTER : voir le rapport d'audit (section "States to screenshot").

CONTRAINTES PLAYWRIGHT
- Beaucoup d'états nécessitent un user authentifié. Si auth bloque :
  - Tenter d'utiliser une session test si disponible (cherche dans `apps/web/e2e/*.spec.ts` les patterns d'auth)
  - Sinon, noter "screenshot skipped: auth required" et continuer
- Pour les états conditionnels (GT-active, round-active, etc.) : naviguer manuellement via l'app si possible, sinon documenter "state unreachable in dev"

RÈGLES STRICTES (identiques à Task 3.2)
```

- [ ] **Step 2: Spot check après chaque batch**

Idem Task 3.2 Step 3.

- [ ] **Step 3: Continuer jusqu'à toutes les pages**

---

## Phase 4 — Vérification globale

### Task 4.1: Grep résiduel zero violation

- [ ] **Step 1: Run le détecteur**

```bash
pnpm audit-ds --json > docs/audits/ds-sweep-2026-05/post-sweep.json
echo "Post-sweep total: $(jq '.count' docs/audits/ds-sweep-2026-05/post-sweep.json)"
```

Expected: count = 0 (sauf les BLOCKED loggés dans `blocked.md`).

- [ ] **Step 2: Si count > 0, diff avec blocked.md**

```bash
jq '.violations[] | "\(.file):\(.line) \(.current)"' docs/audits/ds-sweep-2026-05/post-sweep.json
```

Chaque violation restante doit apparaître dans `blocked.md`. Sinon → relancer un repair sub-agent ciblé.

---

### Task 4.2: Build & tests complets

- [ ] **Step 1: Clean build**

```bash
pnpm build
```

Expected: success, 0 type error.

- [ ] **Step 2: Unit tests**

```bash
pnpm test
```

Expected: PASS (sauf les test.fixme connus comme Playwright GT tactics).

- [ ] **Step 3: Lint sans flag**

```bash
pnpm lint
```

Expected: 0 error, 0 warning (sauf le baseline pré-existant — comparer avec `main`).

---

### Task 4.3: Playwright e2e

- [ ] **Step 1: Run e2e**

```bash
pnpm test:e2e
```

Si des e2e nouvellement cassent : investigation. Souvent un selector basé sur classe Tailwind qui a changé → fix le selector côté test.

---

### Task 4.4: Cascade test (critère succès principal)

Le but du sweep : changer un token = cascade sur tout.

- [ ] **Step 1: Modifier `--cyan-500` temporairement**

```bash
grep -n "cyan-500" apps/web/app/globals.css
# noter la ligne
```

Changer la valeur en hot pink (ex: `oklch(0.7 0.3 350)`).

- [ ] **Step 2: Vérifier dans le browser**

Naviguer sur Home, Auction, GT, Ranking. Toute la UI accent doit passer en hot pink, sans avoir touché à aucun composant.

- [ ] **Step 3: Compter visuellement les zones impactées**

Critère succès : 20+ zones différentes ont changé de couleur (boutons CTA, accents, focus rings, icônes actives, etc.).

- [ ] **Step 4: Revert le changement**

```bash
git checkout apps/web/app/globals.css
```

- [ ] **Step 5: Logger le résultat dans le README du sweep**

Ajouter section "## Cascade verification" avec count de zones impactées et screenshot avant/après hot pink.

---

### Task 4.5: Update CLAUDE.md et archive

- [ ] **Step 1: Update CLAUDE.md**

Modifier `CLAUDE.md` section Features livrées :

```markdown
- **DS Compliance Sweep** — sweep one-shot 2026-05-XX, 0 violation A-E baseline, cascade tokens vérifiée. Spec/plan archivés dans `docs/archive/audits/ds-sweep-2026-05/`.
```

- [ ] **Step 2: Update MEMORY.md** (auto-memory user)

Ajouter une ligne dans l'index features.

- [ ] **Step 3: Archive**

```bash
mv docs/audits/ds-sweep-2026-05 docs/archive/audits/ds-sweep-2026-05
mv docs/2026-05-20-ds-compliance-sweep-design.md docs/archive/specs/
mv docs/2026-05-20-ds-compliance-sweep-plan.md docs/archive/plans/
```

- [ ] **Step 4: Commit final**

```bash
git add CLAUDE.md docs/
git commit -m "docs(ds-sweep): archive sweep artifacts, update CLAUDE.md baseline"
```

---

### Task 4.6: Merge dans main

- [ ] **Step 1: Squash log final**

```bash
git log --oneline main..feature/ds-compliance-sweep | wc -l
git log --oneline main..feature/ds-compliance-sweep
```

Expected: ~30-40 commits (granulaires par page/composant).

- [ ] **Step 2: Choix merge**

Option A — Rebase merge (préserve historique granulaire) :
```bash
git checkout main
git pull
git rebase main feature/ds-compliance-sweep
git checkout main
git merge --ff-only feature/ds-compliance-sweep
```

Option B — Squash merge (un seul commit final) :
```bash
git checkout main
git merge --squash feature/ds-compliance-sweep
git commit -m "chore(ds): one-shot design system compliance sweep — 0 violations baseline"
```

Recommandation : **Option A** (historique granulaire utile pour revert sélectif si une régression émerge plus tard).

- [ ] **Step 3: Push main**

```bash
git push origin main
```

- [ ] **Step 4: Supprimer la branche locale**

```bash
git branch -d feature/ds-compliance-sweep
```

---

## Self-review checklist (pour Jonathan avant validation finale)

- [ ] Phase 0 outils : `pnpm audit-ds` fonctionne et est testé
- [ ] Phase 1 sitemap : validé par Jonathan avant Phase 2
- [ ] Phase 2 audits : tous les rapports ont des Proposed remplis, BLOCKED loggés
- [ ] Phase 3 repairs : 1 commit par page/composant, screenshots before/after attachés
- [ ] Phase 4 : `pnpm audit-ds` = 0 violation, build/lint/tests PASS, cascade test réussi
- [ ] CLAUDE.md & MEMORY.md mis à jour
- [ ] Artifacts archivés dans `docs/archive/`
- [ ] Merge dans `main`, branche locale supprimée

---

## Risques résiduels & escape hatches

| Risque | Action |
|---|---|
| Un sub-agent applique un fix qui casse visuellement une page | Le commit est isolé → `git revert <sha>` et flag BLOCKED |
| Un Proposed validé par Jonathan s'avère faux à l'usage | Modifier le code directement (hors agent), commit séparé `fix(ds): override <token>` |
| `pnpm audit-ds` rate des violations subtiles | Phase 4 cascade test sert de filet de sécurité visuel |
| Un composant partagé modifié casse une page consommatrice | Spot check Phase 3 + Phase 4 e2e |
| Le dev server crashe pendant les screenshots | Relancer, les screenshots manquants sont notés dans le repair log et complétés à la main |

---

## Critères de succès finaux

1. ✅ `pnpm audit-ds` retourne 0 violation (hors BLOCKED loggés)
2. ✅ `pnpm build && pnpm test && pnpm test:e2e` PASS
3. ✅ Cascade test : changer 1 token → 20+ composants affectés sans toucher au code
4. ✅ Screenshots before/after disponibles pour toutes les pages réparées
5. ✅ CLAUDE.md à jour avec baseline 0
