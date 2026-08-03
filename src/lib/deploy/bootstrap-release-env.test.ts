import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

describe("bootstrap-release-env", () => {
  it("prints generated loop secrets and the founder fill-in sections", () => {
    const out = spawnSync(process.execPath, [join(process.cwd(), "scripts/bootstrap-release-env.mjs")], {
      encoding: "utf8",
      cwd: process.cwd(),
      env: process.env,
    });
    expect(out.status).toBe(0);
    expect(out.stdout).toMatch(/CRON_SECRET=/);
    expect(out.stdout).toMatch(/INBOUND_EMAIL_SECRET=/);
    expect(out.stdout).toMatch(/MANDATE_SIGNING_JWK=/);
    expect(out.stdout).toMatch(/PAYMENT_PROVIDER=payplus/);
    expect(out.stdout).toMatch(/SMTP_HOST=/);
    expect(out.stdout).toMatch(/You must fill/);
  });
});
