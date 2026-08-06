import { describe, expect, it } from "vitest";
import { passwordField, signupSchema } from "./validation";

describe("passwordField", () => {
  it("accepts a real password", () => {
    expect(passwordField.safeParse("correct-horse-battery").success).toBe(true);
  });

  it("rejects short passwords", () => {
    expect(passwordField.safeParse("short1").success).toBe(false);
  });

  it("rejects common weak passwords that pass the length check", () => {
    for (const weak of ["12345678", "password", "PASSWORD1", "qwertyui", "11111111"]) {
      expect(passwordField.safeParse(weak).success, weak).toBe(false);
    }
  });
});

describe("signupSchema", () => {
  it("rejects signup with a common weak password", () => {
    const result = signupSchema.safeParse({
      name: "Test User",
      email: "test@example.com",
      password: "12345678",
      phone: "+972501234567",
    });
    expect(result.success).toBe(false);
  });
});
