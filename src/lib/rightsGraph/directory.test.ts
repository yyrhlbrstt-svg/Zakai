import { describe, expect, it } from "vitest";
import {
  REGULATORS,
  getRegulator,
  resolveDirectoryRef,
  resolveProviderDemandEmail,
} from "./directory";
import { RIGHTS } from "./registry";

describe("recipient directory — regulator entries", () => {
  it("every entry is verified: https source, ISO verification date, both legal names", () => {
    for (const entry of REGULATORS) {
      expect(entry.ref, entry.ref).toMatch(/^regulator:[a-z0-9-]+$/);
      expect(entry.sourceUrl).toMatch(/^https:\/\//);
      expect(entry.lastVerifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(entry.legalName.he.length).toBeGreaterThan(0);
      expect(entry.legalName.en.length).toBeGreaterThan(0);
      expect(entry.supervises.he.length).toBeGreaterThan(0);
    }
  });

  it("demand channels are structurally sendable — a real address or a real https form", () => {
    for (const entry of REGULATORS) {
      if (!entry.demand) continue; // null is honest; malformed is not
      if (entry.demand.channel === "email") {
        expect(entry.demand.address, entry.ref).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
      } else {
        expect(entry.demand.url, entry.ref).toMatch(/^https:\/\//);
      }
    }
  });

  it("refs are unique", () => {
    const refs = REGULATORS.map((r) => r.ref);
    expect(new Set(refs).size).toBe(refs.length);
  });

  it("official bodies live on official domains — boi.org.il / gov.il, nothing else", () => {
    for (const entry of REGULATORS) {
      expect(entry.sourceUrl, entry.ref).toMatch(
        /^https:\/\/(www\.)?(boi\.org\.il|gov\.il|[a-z]+\.gov\.il|[a-z]+\.taxes\.gov\.il)\//,
      );
    }
  });
});

describe("resolveDirectoryRef", () => {
  it("resolves provider:self to the counterparty sentinel — no static address exists or should", () => {
    expect(resolveDirectoryRef("provider:self")).toEqual({ kind: "self" });
  });

  it("resolves a known regulator to its full entry", () => {
    const resolved = resolveDirectoryRef("regulator:boi-banking-supervision");
    expect(resolved?.kind).toBe("regulator");
    if (resolved?.kind === "regulator") {
      expect(resolved.entry.demand).toEqual({ channel: "email", address: "pz@boi.org.il" });
    }
  });

  it("returns null for anything it cannot vouch for — never a guessed entry", () => {
    expect(resolveDirectoryRef("regulator:does-not-exist")).toBeNull();
    expect(resolveDirectoryRef("provider:cellcom")).toBeNull();
    expect(resolveDirectoryRef("")).toBeNull();
    expect(getRegulator("nope")).toBeUndefined();
  });
});

describe("the registry ratchet — no right may point at a ref that resolves to nothing", () => {
  it("every directoryRef in RIGHTS (drafts included) resolves", () => {
    for (const right of RIGHTS) {
      expect(resolveDirectoryRef(right.obligor.directoryRef), `${right.id} obligor`).not.toBeNull();
      expect(
        resolveDirectoryRef(right.procedure.recipientDirectoryRef),
        `${right.id} recipient`,
      ).not.toBeNull();
    }
  });
});

describe("resolveProviderDemandEmail — one door to every provider dataset", () => {
  it("dispatches to the right vertical's dataset", () => {
    expect(resolveProviderDemandEmail("telecom", "cellcom")).toBe("service@cellcom.co.il");
    expect(resolveProviderDemandEmail("electricity", "חברת החשמל")).toBe("service@iec.co.il");
    expect(resolveProviderDemandEmail("insurance", "הראל")).toBe("service@harel-group.co.il");
    expect(resolveProviderDemandEmail("transport-fine", "אגד")).toBe("service@egged.co.il");
    expect(resolveProviderDemandEmail("flights", "אל על")).toBe("customerservice@elal.co.il");
  });

  it("never invents: unknown provider, unknown vertical, or empty name → null", () => {
    expect(resolveProviderDemandEmail("telecom", "חברה שלא קיימת")).toBeNull();
    expect(resolveProviderDemandEmail("parking", "cellcom")).toBeNull();
    expect(resolveProviderDemandEmail("telecom", "   ")).toBeNull();
    // Banks default to null on purpose — a bank@ that bounces is worse than
    // asking the person for the inbox on their statement.
    expect(resolveProviderDemandEmail("bank-fees", "בנק כלשהו")).toBeNull();
  });
});
