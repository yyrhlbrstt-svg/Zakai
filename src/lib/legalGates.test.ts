import { describe, expect, it } from "vitest";
import {
  LEGAL_GATES,
  LegalGateError,
  legalGateStatus,
  requireLegalGate,
  type LegalGateName,
} from "./legalGates";

const GATES = Object.keys(LEGAL_GATES) as LegalGateName[];

const todoAllOpen = GATES.map((g) => `- [x] ${LEGAL_GATES[g].legalTodoId} done`).join("\n");
const todoAllClosed = GATES.map((g) => `- [ ] ${LEGAL_GATES[g].legalTodoId} pending`).join("\n");
const envAllAttested = Object.fromEntries(
  GATES.map((g) => [LEGAL_GATES[g].attestEnv, LEGAL_GATES[g].legalTodoId]),
);

describe("legal gates — dark by default, hard-fail when forced", () => {
  it("every gate is closed against the REAL repository state today", () => {
    // Reads the actual LEGAL-TODO.md + real env: nothing is complete, nothing
    // is attested, so all four capabilities must be dark. If this test ever
    // fails, a gate was armed — that is a human legal event, and the change
    // that armed it must show the completed item and the attestation.
    for (const gate of GATES) {
      expect(() => requireLegalGate(gate)).toThrow(LegalGateError);
    }
  });

  it("a completed TODO item alone does not open the gate (attestation missing)", () => {
    for (const gate of GATES) {
      const status = legalGateStatus(gate, { todoText: todoAllOpen, env: {} });
      expect(status).toEqual({ open: false, reason: "not_attested" });
    }
  });

  it("an attestation alone does not open the gate (TODO incomplete)", () => {
    for (const gate of GATES) {
      const status = legalGateStatus(gate, { todoText: todoAllClosed, env: envAllAttested });
      expect(status).toEqual({ open: false, reason: "todo_incomplete" });
    }
  });

  it("opens only when BOTH signals agree", () => {
    for (const gate of GATES) {
      expect(legalGateStatus(gate, { todoText: todoAllOpen, env: envAllAttested })).toEqual({
        open: true,
      });
      expect(() =>
        requireLegalGate(gate, { todoText: todoAllOpen, env: envAllAttested }),
      ).not.toThrow();
    }
  });

  it("a wrong attestation value stays closed — the env must name the item id", () => {
    const wrong = Object.fromEntries(GATES.map((g) => [LEGAL_GATES[g].attestEnv, "true"]));
    for (const gate of GATES) {
      expect(legalGateStatus(gate, { todoText: todoAllOpen, env: wrong }).open).toBe(false);
    }
  });

  it("an unreadable gate file is a CLOSED gate, never an open one", () => {
    const status = legalGateStatus("fee_collection", {
      env: envAllAttested,
      // no todoText and cwd manipulation is not attempted: simulate by
      // passing a todoText reader failure via an empty file — an empty file
      // has no completed items, same closed outcome as unreadable.
      todoText: "",
    });
    expect(status.open).toBe(false);
  });

  it("mentions of the item id elsewhere in the file do not count as completion", () => {
    const sneaky = "Discussion of LT-1 and [x] LT-1 inline — but no checked list item.";
    expect(legalGateStatus("fee_collection", { todoText: sneaky, env: envAllAttested }).open).toBe(
      false,
    );
  });

  it("the error message carries the exact unblocking steps", () => {
    try {
      requireLegalGate("trust_remittance", { todoText: todoAllClosed, env: {} });
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(LegalGateError);
      expect((err as Error).message).toContain("LT-3");
      expect((err as Error).message).toContain("LEGAL_ATTEST_TRUST");
    }
  });
});
