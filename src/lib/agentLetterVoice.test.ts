import { describe, expect, it } from "vitest";
import { agentLetterCloseHe, agentLetterOpenHe } from "./agentLetterVoice";

describe("agentLetterVoice", () => {
  it("discloses Mandate agent identity", () => {
    const open = agentLetterOpenHe("דנה");
    expect(open).toMatch(/זכאי/);
    expect(open).toMatch(/Mandate|הרשאתו/);
    expect(open).toMatch(/אינני הלקוח/);
    expect(open).toContain("דנה");
  });

  it("asks for written reply only", () => {
    expect(agentLetterCloseHe("דנה")).toMatch(/בכתב בלבד/);
  });
});
