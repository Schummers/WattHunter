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
