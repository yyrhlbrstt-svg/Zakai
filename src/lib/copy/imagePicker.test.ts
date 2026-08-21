import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * No image input may force the camera.
 *
 * WHAT IT COST
 *
 * Every file input that takes an image in this product carried
 * `capture="environment"`. That attribute is not a hint — it tells the browser
 * to open the rear camera directly and skip the picker, so on Android the
 * gallery is unreachable.
 *
 * The button it sat behind says "העלה צילום מסך" — upload a screenshot — under
 * a card that says "הכי קל: צילום מסך מאפליקציית הבנק": go to your bank app and
 * take a screenshot. A screenshot is in the gallery by definition. There is no
 * way to photograph one.
 *
 * So the single action this entire product funnels into was impossible to
 * complete on the most common phone. Everything upstream of it — the homepage
 * hero, the sixteen links, the anchor that was moved to land on this exact
 * card — delivered somebody to a camera pointed at their desk.
 *
 * It was reported as "I press it and it only lets me photograph, it won't let
 * me upload a screenshot", which is precisely what it did.
 *
 * WHY REMOVING IT LOSES NOTHING
 *
 * Without `capture` the OS shows its normal picker, which offers the gallery
 * *and* the camera. Photographing a paper bill still works. The only thing
 * that changes is that the primary path stops being impossible.
 */

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (entry.endsWith(".tsx")) out.push(full);
  }
  return out;
}

describe("uploading an image never forces the camera", () => {
  const files = walk(join(process.cwd(), "src"));

  it("found components to examine", () => {
    // Guards against this suite quietly passing on an empty list after a
    // directory move — the failure mode that makes a ratchet worthless.
    expect(files.length).toBeGreaterThan(50);
  });

  it("has no capture attribute on any file input", () => {
    const offenders: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      for (const [i, line] of source.split("\n").entries()) {
        /**
         * Matches the attribute as it is actually written — on its own line,
         * followed by a value. Looking for the bare word `capture` instead
         * flagged the comment in MoneyHub explaining why the attribute is
         * absent, which would have taught the next person that this test
         * cries wolf. A ratchet that has to be ignored once gets ignored
         * always.
         */
        if (/^\s*capture\s*=\s*["'{]/.test(line)) {
          offenders.push(`${file.replace(process.cwd() + "/", "")}:${i + 1} ${line.trim()}`);
        }
      }
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });

  it("still accepts images on the inputs that take them", () => {
    // The fix must not have been "delete the input". Every screen that reads
    // an image should still be able to.
    //
    // Matched as "includes image/*" rather than "equals image/*": the picker
    // was later widened to let PDFs be SELECTED — most Israeli bills arrive
    // as one, and filtering them out meant a person holding exactly the
    // document we asked for could not see their own file. They are answered
    // with an instruction, not silently accepted. Narrowing away from images
    // still fails this test, which is what it is here to prevent.
    const hub = readFileSync(join(process.cwd(), "src/components/MoneyHub.tsx"), "utf8");
    expect(hub).toMatch(/accept="[^"]*image\/\*[^"]*"/);
  });

  it("answers a PDF instead of failing silently", () => {
    // A dead end with no explanation is what made this look broken.
    const hub = readFileSync(join(process.cwd(), "src/components/MoneyHub.tsx"), "utf8");
    expect(hub).toMatch(/application\/pdf/);
    expect(hub).toMatch(/shotPdfTitle/);
  });
});
