import { describe, it, expect } from "vitest";
import { buildArnonaAgentLetter, isArnonaAgentRight } from "./arnonaAppeal";

describe("arnonaAppeal", () => {
  it("recognises arnona right ids", () => {
    expect(isArnonaAgentRight("arnona_income")).toBe(true);
    expect(isArnonaAgentRight("telecom")).toBe(false);
  });

  it("builds a letter with municipality filled", () => {
    const letter = buildArnonaAgentLetter("arnona_income", {
      name: "ישראל ישראלי",
      id: "123456789",
      municipality: "תל אביב-יפו",
    });
    expect(letter?.subject).toContain("הנחה");
    expect(letter?.body).toContain("תל אביב-יפו");
    expect(letter?.body).toContain("ישראל ישראלי");
  });
});
