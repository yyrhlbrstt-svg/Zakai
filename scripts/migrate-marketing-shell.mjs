#!/usr/bin/env node
/**
 * One-off: move standard kicker/title/sub heroes to VerticalPageShell.
 */
import fs from "fs";
import path from "path";

const ROOT = path.resolve(import.meta.dirname, "..");

const FILES = [
  "src/app/[locale]/lost-money/page.tsx",
  "src/app/[locale]/arnona/page.tsx",
  "src/app/[locale]/baggage/page.tsx",
  "src/app/[locale]/holocaust-survivors/page.tsx",
  "src/app/[locale]/duplicate-insurance/page.tsx",
  "src/app/[locale]/disability-benefits/page.tsx",
  "src/app/[locale]/alimony-guarantee/page.tsx",
  "src/app/[locale]/class-action/page.tsx",
  "src/app/[locale]/business-compensation/page.tsx",
  "src/app/[locale]/construction-defects/page.tsx",
  "src/app/[locale]/car-value/page.tsx",
  "src/app/[locale]/child-savings/page.tsx",
  "src/app/[locale]/warranty/page.tsx",
  "src/app/[locale]/price-protection/page.tsx",
  "src/app/[locale]/results/page.tsx",
  "src/app/[locale]/mortgage-insurance/page.tsx",
];

const HERO_RE =
  /<main className="max-w-\[820px\] mx-auto px-5 pb-24 pt-5">\s*<Reveal>\s*<div className="inline-block text-\[12\.5px\] font-extrabold text-emerald[^"]*"[^>]*>\s*\{t\("kicker"\)\}\s*<\/div>\s*<h1 className="font-display[^"]*"[^>]*>\s*\{t\("title"\)\}\s*<\/h1>\s*<p className="text-ink-soft text-\[16px\][^"]*"[^>]*>\{t\("sub"\)\}<\/p>\s*<\/Reveal>/s;

const SHELL_OPEN = `<VerticalPageShell
      heroGlow
      width="wide"
      className="max-w-[820px] mx-auto px-5 pb-24 pt-5 relative"
      kicker={t("kicker")}
      title={t("title")}
      sub={t("sub")}
    >`;

const GRADIENT_CTA_RE =
  /<div className="mt-12 rounded-2xl p-\[1px\] bg-\[linear-gradient\(105deg,#3fcb9b,#3ec6ff_55%,#8b5cf6\)\]">\s*<div className="rounded-2xl bg-\[#0a1119\] px-6 py-7 text-center">([\s\S]*?)<\/div>\s*<\/div>/g;

const GRADIENT_WRAP = (inner) =>
  `<GradientCtaCard>${inner.trim()}</GradientCtaCard>`;

function ensureImports(src) {
  let out = src;
  const needs = [];
  if (out.includes("<VerticalPageShell") && !out.includes('from "@/components/VerticalPageShell"')) {
    needs.push('import { VerticalPageShell } from "@/components/VerticalPageShell";');
  }
  if (out.includes("<GradientCtaCard") && !out.includes('from "@/components/GradientCtaCard"')) {
    needs.push('import { GradientCtaCard } from "@/components/GradientCtaCard";');
  }
  if (out.includes("<NumberedStepList") && !out.includes('from "@/components/NumberedStepList"')) {
    needs.push('import { NumberedStepList } from "@/components/NumberedStepList";');
  }
  if (needs.length === 0) return out;
  const insertAfter = out.match(/^import .+;\n/m);
  if (!insertAfter) return out;
  const idx = out.indexOf(insertAfter[0]) + insertAfter[0].length;
  return out.slice(0, idx) + needs.join("\n") + "\n" + out.slice(idx);
}

for (const rel of FILES) {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) {
    console.warn("skip missing", rel);
    continue;
  }
  let src = fs.readFileSync(file, "utf8");
  if (src.includes("VerticalPageShell")) {
    console.log("already shell", rel);
    continue;
  }
  if (!HERO_RE.test(src)) {
    console.warn("no hero match", rel);
    continue;
  }
  src = src.replace(HERO_RE, SHELL_OPEN);
  src = src.replace(/\n    <\/main>\n(\s*\);\n})/, "\n    </VerticalPageShell>\n$1");
  src = src.replace(GRADIENT_CTA_RE, (_, inner) => GRADIENT_WRAP(inner));
  src = ensureImports(src);
  fs.writeFileSync(file, src);
  console.log("migrated", rel);
}
