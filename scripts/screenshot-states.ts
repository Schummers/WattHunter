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
