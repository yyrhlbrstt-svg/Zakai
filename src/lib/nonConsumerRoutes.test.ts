import { describe, it, expect } from "vitest";
import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { NON_CONSUMER_ROUTES } from "@/lib/nonConsumerRoutes";

/**
 * The list stays a real map of the app, not a snapshot of the day it was written.
 *
 * The bug this file exists to catch: `/founder` existed for a long time before
 * anyone noticed the open-case resume pill floating over its release-gate
 * numbers, because nothing forced the two to be checked against each other.
 * This is that forcing function, in both directions —
 *
 *   1. every entry still names a route that exists (a renamed or deleted page
 *      would otherwise leave a dead string sitting here forever, silently
 *      protecting nothing), and
 *   2. `/authority` — checked by hand and confirmed to be a real, logged-in
 *      consumer page — never quietly ends up back on the list, because a
 *      future edit that added it here would have no way to know it was
 *      already ruled out on purpose.
 */
const APP_DIR = join(process.cwd(), "src/app/[locale]");

describe("NON_CONSUMER_ROUTES stays true", () => {
  it("is not empty — the whole point is a real, growing list", () => {
    expect(NON_CONSUMER_ROUTES.length).toBeGreaterThan(5);
  });

  it("every route names a directory that actually exists under src/app/[locale]", () => {
    const missing = NON_CONSUMER_ROUTES.filter((route) => {
      const segment = route.replace(/^\//, "");
      return !existsSync(join(APP_DIR, segment));
    });
    expect(missing, `these routes were removed or renamed: ${missing.join(", ")}`).toEqual([]);
  });

  it("never lists /authority — a real, login-gated consumer page, checked by hand", () => {
    // The one route this file's own comment names as deliberately excluded.
    // If this fails, someone re-added it without reading why it isn't here.
    expect(NON_CONSUMER_ROUTES).not.toContain("/authority");
  });

  it("never lists /money or /dashboard — already excluded by the caller directly", () => {
    // Both routes already show the loop status themselves; listing them here
    // too would just be two ways of saying the same thing.
    expect(NON_CONSUMER_ROUTES).not.toContain("/money");
    expect(NON_CONSUMER_ROUTES).not.toContain("/dashboard");
  });

  it("/founder is on the list — the route the bug was found on", () => {
    expect(NON_CONSUMER_ROUTES).toContain("/founder");
  });

  it("has no duplicate entries", () => {
    expect(new Set(NON_CONSUMER_ROUTES).size).toBe(NON_CONSUMER_ROUTES.length);
  });
});

describe("app directory pages that look admin/protocol-shaped are all accounted for", () => {
  /**
   * Not exhaustive — a name-based heuristic cannot replace reading a page,
   * which is how this list was actually built. What it catches is drift: a
   * new page named like the ones already here (a protocol/registry/status
   * word in the slug) that nobody added to the list at all. A hit here is a
   * prompt to go read the new page, the same way `/founder` was read, not an
   * instruction to add it blindly.
   */
  const ADMIN_SHAPED = /^(founder|admin|internal|ops)$/;

  it("no top-level route looks admin-shaped without being on the list", () => {
    const dirs = readdirSync(APP_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
    const unlisted = dirs.filter(
      (name) => ADMIN_SHAPED.test(name) && !NON_CONSUMER_ROUTES.includes(`/${name}`),
    );
    expect(unlisted, `check these and add them if they are admin-only: ${unlisted.join(", ")}`).toEqual(
      [],
    );
  });
});
