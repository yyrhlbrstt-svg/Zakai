import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * A disabled button must say what would enable it.
 *
 * WHY THIS IS A TEST AND NOT A CODE REVIEW NOTE
 *
 * Roughly twenty tools gate their primary action behind a compound predicate
 * — three or four fields ANDed together, sometimes with a threshold nobody
 * could guess from outside (`fault.trim().length >= 3`). Fill every field but
 * one and the button is simply inert: no error, no highlight, nothing. From
 * the user's side that is indistinguishable from a broken app, and it is what
 * the founder hit on the flight claim: the airline's email address would not
 * resolve for the spelling they used, so the button that files the claim sat
 * dead with nothing on screen about it.
 *
 * `MissingFields` exists to answer exactly that, and the only reason it was
 * absent from five tools is that nobody was counting. Now something is.
 *
 * The rule: a component that disables a control on a readiness predicate must
 * also render `MissingFields`, or be named here with a reason.
 */

/** `disabled={!canGenerate}`, `{!ready}`, `{!formComplete}` — a readiness gate. */
const READINESS_GATE = /disabled=\{!\s*(can[A-Z]\w*|ready|formComplete|isReady|complete)\b/;

/**
 * Gates whose missing ingredient is a single obvious thing the surrounding
 * copy already names, where a field checklist would be noise rather than help.
 */
/*
 * MoneyHub left this list on 2026-08-20: its scan button is no longer disabled
 * at all. Testers tapped the greyed-out primary action of the main page,
 * nothing happened, and they reported that the product does not work — an
 * explanation in small text below a dead button does not reach anybody. The
 * button now always responds and points at the box it needs.
 */
const EXPLAINED_ANOTHER_WAY: Record<string, string> = {
  "StatementScan.tsx": "same scan button, same copy",
  "BusinessExpenseAudit.tsx": "one textarea; the placeholder is the instruction",
  "UniversalCancelTool.tsx": "one textarea of charges; the empty state explains it",
};

function componentFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...componentFiles(full));
    else if (entry.endsWith(".tsx")) out.push(full);
  }
  return out;
}

describe("a disabled primary action explains itself", () => {
  const files = componentFiles("src/components");

  it("finds the component tree at all", () => {
    // Without this a moved directory leaves the guard passing over nothing.
    expect(files.length).toBeGreaterThan(50);
  });

  it("every readiness-gated control names what is missing", () => {
    const silent: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, "utf8");
      if (!READINESS_GATE.test(src)) continue;
      if (src.includes("MissingFields")) continue;
      const base = file.split("/").pop()!;
      if (EXPLAINED_ANOTHER_WAY[base]) continue;
      silent.push(base);
    }
    expect(
      silent,
      silent.length
        ? `These disable a control on a readiness predicate and never say why: ` +
          `${silent.join(", ")}. Render <MissingFields items={…} /> above the button, ` +
          `or add the file to EXPLAINED_ANOTHER_WAY with the reason.`
        : "",
    ).toEqual([]);
  });

  it("the exemption list stays honest", () => {
    // An exemption for a file that no longer has a gate is a stale excuse that
    // would silently cover a future one.
    for (const [base, reason] of Object.entries(EXPLAINED_ANOTHER_WAY)) {
      const file = files.find((f) => f.endsWith(`/${base}`));
      expect(file, `${base} is exempted but does not exist`).toBeTruthy();
      expect(READINESS_GATE.test(readFileSync(file!, "utf8")), `${base}: ${reason}`).toBe(true);
    }
  });
});
