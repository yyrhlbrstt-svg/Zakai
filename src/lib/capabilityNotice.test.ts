import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  agentCanDeliver,
  capabilityNotices,
  primaryNotice,
  type Capabilities,
} from "./capabilityNotice";

const all: Capabilities = { mail: true, ai: true };

describe("capabilityNotices", () => {
  it("says nothing when everything works", () => {
    // The common case in a healthy production; a permanent banner there would
    // train people to ignore the one that matters.
    expect(capabilityNotices(all)).toEqual([]);
    expect(primaryNotice(all)).toBeNull();
  });

  it("names outbound mail being off, which is the state production was in", () => {
    const n = primaryNotice({ ...all, mail: false });
    expect(n?.id).toBe("mailOff");
    expect(n?.severity).toBe("blocking");
  });

  it("treats a missing AI provider as degraded, not blocking", () => {
    // Manual entry produces the same case, letter and mandate — calling that
    // blocking would overstate it and push people away from a working path.
    const n = primaryNotice({ ...all, ai: false });
    expect(n?.id).toBe("aiOff");
    expect(n?.severity).toBe("degraded");
  });

  it("puts the blocking notice first when both are off", () => {
    const notices = capabilityNotices({ mail: false, ai: false });
    expect(notices.map((n) => n.id)).toEqual(["mailOff", "aiOff"]);
    expect(primaryNotice({ mail: false, ai: false })?.id).toBe("mailOff");
  });

  /**
   * The property that makes this a handover rather than an apology. A dead end
   * announced is still a dead end; every notice has to carry somewhere to go.
   */
  it("never emits a notice without an alternative", () => {
    for (const caps of [
      { mail: false, ai: true },
      { mail: true, ai: false },
      { mail: false, ai: false },
    ]) {
      for (const n of capabilityNotices(caps)) {
        expect(n.alternativeKey, `${n.id} has no alternative`).toBeTruthy();
      }
    }
  });

  it("returns keys, never sentences, so nothing here can invent copy", () => {
    for (const n of capabilityNotices({ mail: false, ai: false })) {
      expect(n.headlineKey).toMatch(/^capability\./);
      expect(n.alternativeKey).toMatch(/^capability\./);
    }
  });
});

describe("agentCanDeliver", () => {
  it("is false exactly when mail is off", () => {
    expect(agentCanDeliver(all)).toBe(true);
    expect(agentCanDeliver({ ...all, mail: false })).toBe(false);
    // A missing AI provider does not stop delivery of a manually entered case.
    expect(agentCanDeliver({ mail: true, ai: false })).toBe(true);
  });
});

describe("copy exists for every notice", () => {
  /**
   * A missing key renders as the raw key — the "leaking i18n keys" failure
   * this project has hit before, and it would land on the screen of someone
   * already being told something did not work.
   */
  const he = JSON.parse(readFileSync("src/messages/he.json", "utf8")) as {
    capability?: Record<string, { headline?: string; alternative?: string }>;
  };

  it("has Hebrew copy for every notice's headline and alternative", () => {
    const missing: string[] = [];
    for (const n of capabilityNotices({ mail: false, ai: false })) {
      const entry = he.capability?.[n.id];
      if (!entry?.headline) missing.push(`${n.id}.headline`);
      if (!entry?.alternative) missing.push(`${n.id}.alternative`);
    }
    expect(missing, `missing Hebrew copy: ${missing.join(", ")}`).toEqual([]);
  });
});
