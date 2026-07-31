import { describe, expect, it } from "vitest";
import { burnPasswordComparison, hashPassword, verifyPassword } from "./password";

describe("password hashing", () => {
  it("verifies a correct password and rejects a wrong one", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(await verifyPassword("correct horse battery staple", hash)).toBe(true);
    expect(await verifyPassword("Correct horse battery staple", hash)).toBe(false);
  });

  it("produces a different hash each time for the same password", async () => {
    // Salted. Two users with the same password must not share a hash, or a
    // leaked table tells an attacker which accounts to try first.
    const a = await hashPassword("same");
    const b = await hashPassword("same");
    expect(a).not.toBe(b);
  });
});

describe("an account that does not exist costs the same as one that does", () => {
  it("always returns false, whatever it is given", async () => {
    expect(await burnPasswordComparison("anything")).toBe(false);
    expect(await burnPasswordComparison("")).toBe(false);
  });

  it("takes comparable time to a real verification", async () => {
    // Identical wording on the rejection is not enough on its own. bcrypt at
    // ten rounds takes on the order of a hundred milliseconds, and skipping it
    // for an address with no account makes the two cases distinguishable by how
    // fast the rejection arrives — a membership oracle for a service whose
    // membership is itself sensitive.
    //
    // The bound is loose on purpose: this asserts the work happens at all, not
    // a constant-time guarantee, because a shared CI runner cannot support the
    // latter and a tight bound here would be a flaky test pretending otherwise.
    const hash = await hashPassword("real password");

    const t0 = performance.now();
    await verifyPassword("wrong password", hash);
    const real = performance.now() - t0;

    const t1 = performance.now();
    await burnPasswordComparison("wrong password");
    const absent = performance.now() - t1;

    expect(absent).toBeGreaterThan(real / 5);
  });
});
