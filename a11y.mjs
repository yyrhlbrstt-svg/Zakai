import { chromium } from "playwright";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const BASE = "src/app/[locale]";
function routes(dir, acc = []) {
  for (const e of readdirSync(dir)) {
    const f = join(dir, e);
    if (statSync(f).isDirectory()) routes(f, acc);
    else if (e === "page.tsx") {
      const rel = relative(BASE, dir);
      if (!rel.includes("[")) acc.push(rel === "" ? "/" : "/" + rel.split(sep).join("/"));
    }
  }
  return acc;
}
const axe = readFileSync("node_modules/axe-core/axe.min.js", "utf8");
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH });
const p = await (await b.newContext({ viewport: { width: 390, height: 900 } })).newPage();

const tally = new Map();
const examples = new Map();
const list = routes(BASE).sort();
let checked = 0;
for (const r of list) {
  const url = `http://127.0.0.1:3000/he${r === "/" ? "" : r}`;
  try {
    await p.goto(url, { waitUntil: "networkidle", timeout: 25000 });
    await p.waitForTimeout(400);
    await p.evaluate(axe);
    const res = await p.evaluate(async () =>
      await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a","wcag2aa","wcag21a","wcag21aa"] } }));
    checked++;
    for (const v of res.violations) {
      tally.set(v.id, (tally.get(v.id) ?? 0) + v.nodes.length);
      if (!examples.has(v.id)) {
        examples.set(v.id, { impact: v.impact, help: v.help, route: r, sample: v.nodes[0]?.html?.slice(0,120) ?? "" });
      }
    }
  } catch { /* nav issues are the main sweep's job */ }
}
console.log(`checked ${checked}/${list.length} routes\n`);
const rows = [...tally.entries()].sort((a,b)=>b[1]-a[1]);
console.log(`distinct violation rules: ${rows.length}, total nodes: ${rows.reduce((s,r)=>s+r[1],0)}\n`);
for (const [id, n] of rows) {
  const e = examples.get(id);
  console.log(`${String(n).padStart(5)}  [${e.impact}] ${id}`);
  console.log(`       ${e.help}`);
  console.log(`       first seen ${e.route}: ${e.sample}`);
}
await b.close();
