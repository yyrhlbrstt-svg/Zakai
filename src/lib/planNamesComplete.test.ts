import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The Plan enum and the plan-name catalogue must not drift apart.
 *
 * They did: BUSINESS was added to the schema and never to the messages, and
 * every BUSINESS user's /settings page threw instead of rendering. The page
 * is defensive now, but a plan with no name still shows a raw enum value to
 * a paying customer, so the real fix is that this can never ship again.
 */
const PLAN_ENUM = /enum Plan \{([^}]*)\}/;

function schemaPlans(): string[] {
  const schema = readFileSync(join(process.cwd(), "prisma/schema.prisma"), "utf8");
  const m = schema.match(PLAN_ENUM);
  if (!m) throw new Error("Plan enum not found in schema");
  return m[1]
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /^[A-Z_]+$/.test(l));
}

describe("every plan in the schema has a name people can read", () => {
  it.each(["he", "en"])("%s names every Plan enum value", (locale) => {
    const messages = JSON.parse(
      readFileSync(join(process.cwd(), `src/messages/${locale}.json`), "utf8"),
    );
    const names = messages?.settings?.planNames ?? {};
    const missing = schemaPlans().filter((p) => !names[p]);
    expect(
      missing,
      missing.length
        ? `${locale}.json settings.planNames is missing: ${missing.join(", ")}`
        : "",
    ).toEqual([]);
  });

  it("finds the plans it is supposed to be checking", () => {
    expect(schemaPlans()).toContain("BUSINESS");
    expect(schemaPlans().length).toBeGreaterThanOrEqual(4);
  });
});
