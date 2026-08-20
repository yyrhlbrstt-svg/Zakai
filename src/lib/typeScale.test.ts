import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * A ratchet on ad-hoc font sizes.
 *
 * The product grew to 28 distinct font sizes across 2,104 usages, every one
 * written as an arbitrary bracket value. Among them: 12px, 12.5px, 13px and
 * 13.5px, all in heavy simultaneous use. Sizes that close together cannot
 * establish hierarchy — they just make a page feel unresolved in a way nobody
 * can point at.
 *
 * A named scale now exists in `tailwind.config.ts`. Migrating 2,104 call
 * sites in one change would be a diff no reviewer could honestly check, so
 * this does the next best thing: it freezes the count. Existing values keep
 * working; new ones cannot be added. Every screen that gets touched migrates
 * a few more, and the ceiling comes down with them.
 *
 * When this fails, do not raise CEILING. Use a scale token — `text-body`,
 * `text-title`, `text-h2` — which is what the failure is asking for.
 */
const CEILING = 1369; // lowered 2026-08-20: demo-path pages fully migrated (S2)

const ARBITRARY_SIZE = /text-\[[0-9.]+px\]/g;

function tsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...tsxFiles(full));
    else if (entry.endsWith(".tsx")) out.push(full);
  }
  return out;
}

describe("type scale", () => {
  const files = [...tsxFiles("src/components"), ...tsxFiles("src/app")];

  it("finds the component tree at all", () => {
    // Without this, a moved directory would leave the ratchet passing over
    // nothing — the silent no-op these guards exist to prevent.
    expect(files.length).toBeGreaterThan(100);
  });

  it("does not add new ad-hoc font sizes", () => {
    let count = 0;
    const worst: { file: string; n: number }[] = [];
    for (const file of files) {
      const n = (readFileSync(file, "utf8").match(ARBITRARY_SIZE) ?? []).length;
      if (n > 0) worst.push({ file, n });
      count += n;
    }
    worst.sort((a, b) => b.n - a.n);

    expect(
      count,
      count > CEILING
        ? `Ad-hoc text sizes rose to ${count} (ceiling ${CEILING}). Use a scale ` +
          `token from tailwind.config.ts — text-body, text-title, text-h2 — ` +
          `rather than a new px value. Heaviest files: ` +
          worst
            .slice(0, 3)
            .map((w) => `${w.file} (${w.n})`)
            .join(", ")
        : "",
    ).toBeLessThanOrEqual(CEILING);
  });

  it("keeps the ceiling honest — lower it when the count drops", () => {
    let count = 0;
    for (const file of files) {
      count += (readFileSync(file, "utf8").match(ARBITRARY_SIZE) ?? []).length;
    }
    // Slack, not a cliff: a normal migration commit should not have to edit
    // this file, but a large drop means the ceiling is stale and hiding
    // regressions underneath it.
    expect(
      count,
      `Ad-hoc sizes are down to ${count}; lower CEILING to match so the ratchet keeps biting.`,
    ).toBeGreaterThan(CEILING - 150);
  });
});
