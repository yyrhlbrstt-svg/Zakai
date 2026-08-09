import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * A module nothing imports, with green tests, is worse than no module.
 *
 * It reads as working code. It gets counted as coverage. And the failures it
 * was written to prevent go on happening in the surface that was never wired
 * to it — which is not hypothetical here: the contract checker reminded people
 * on the date their contract had already renewed while noticeWindow.ts sat
 * unimported beside it with seventeen passing tests, and the pricing page
 * recommended the pricier plan while planForSaving.ts, which computes the
 * honest answer, was imported by nothing.
 *
 * Some modules are legitimately ahead of their surface. The problem is not
 * that they exist, it is that nothing tells them apart from code somebody
 * forgot. So each is named here with its reason, and anything unnamed fails —
 * which makes the next orphan a decision rather than an accident.
 */

/**
 * Deliberately not yet imported. Adding a name here is a claim that somebody
 * decided this — not a way to silence the test.
 */
const INTENTIONAL: Record<string, string> = {
  redactLetter:
    "Precondition for storing the letter text behind a documented saving, so the " +
    "outcome graph can learn which phrasings actually recovered money. It ships " +
    "before that feature on purpose: pasting raw letter bodies beside " +
    "StrategyOutcome would defeat the de-identification rule that makes the " +
    "table publishable, so the redactor has to exist and be trusted first.",
};

const SRC = join(process.cwd(), "src");
const LIB = join(SRC, "lib");

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sourceFiles(full));
    else if (/\.(ts|tsx|mts)$/.test(entry.name)) out.push(full);
  }
  return out;
}

/**
 * Which files import each module, by the last segment of the specifier — so
 * "@/lib/x", "./x" and "../../lib/x" all count, which a narrower pattern got
 * wrong once already and under-reported the problem.
 */
function importersByModule(): Map<string, string[]> {
  const map = new Map<string, string[]>();
  const re = /(?:from|import)\s*\(?\s*["']([^"']+)["']/g;
  for (const file of sourceFiles(SRC)) {
    const src = readFileSync(file, "utf8");
    for (const m of src.matchAll(re)) {
      const base = m[1].split("/").pop();
      if (!base) continue;
      const list = map.get(base);
      if (list) list.push(file);
      else map.set(base, [file]);
    }
  }
  return map;
}

/** A module's own file and its own test are not callers. */
function isWired(base: string, importers: Map<string, string[]>): boolean {
  return (importers.get(base) ?? []).some(
    (f) => !f.endsWith(`/lib/${base}.ts`) && !f.endsWith(`/lib/${base}.test.ts`),
  );
}

function libModules(): string[] {
  return readdirSync(LIB)
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts") && !f.endsWith(".d.ts"))
    .map((f) => f.replace(/\.ts$/, ""));
}

describe("no module is wired to nothing by accident", () => {
  it("every unimported lib module is named with a reason", () => {
    const importers = importersByModule();
    const unexplained = libModules()
      .filter((base) => !isWired(base, importers))
      .filter((base) => !(base in INTENTIONAL));

    expect(
      unexplained,
      unexplained.length
        ? `Imported by nothing: ${unexplained.join(", ")}. Wire it to a real surface, ` +
            "delete it, or name it in INTENTIONAL with the reason it ships ahead of its caller."
        : "",
    ).toEqual([]);
  });

  it("does not keep an exemption for a module that is now wired", () => {
    // An exemption that outlives its reason is the same failure one layer up.
    const importers = importersByModule();
    for (const base of Object.keys(INTENTIONAL)) {
      expect(isWired(base, importers), `${base} is imported now — remove it from INTENTIONAL`).toBe(
        false,
      );
    }
  });

  it("does not keep an exemption for a module that no longer exists", () => {
    const existing = new Set(libModules());
    for (const base of Object.keys(INTENTIONAL)) {
      expect(existing.has(base), `${base} was deleted — remove it from INTENTIONAL`).toBe(true);
    }
  });

  it("gives a real reason, not a placeholder", () => {
    for (const [name, reason] of Object.entries(INTENTIONAL)) {
      expect(reason.trim().length, `${name} needs a real reason`).toBeGreaterThan(60);
    }
  });
});
