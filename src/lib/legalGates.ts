import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The human gates — Master Build Prompt v2, constraint 11.
 *
 * Four capabilities ship dark because turning them on is a legal event, not
 * a deploy: collecting the success fee, putting an assignment-of-rights
 * clause into letters, routing institution payments through a trust
 * account, and purchasing claims outright. Each is blocked here until BOTH:
 *
 *  1. its LEGAL-TODO.md item is marked complete (`- [x] LT-n`) — a human
 *     statement of fact about work done outside this repository, and
 *  2. its attestation env var carries the item's id — a deliberate,
 *     environment-level second signal, so a stray checkbox edit in a doc
 *     cannot arm a gate by itself, and a copied env file cannot either.
 *
 * requireLegalGate() throws on anything less. Features behind a gate MUST
 * route through it — that is the convention this module turns into code:
 * the gate call sits inside the feature, so force-enabling the feature flag
 * without the legal work hard-fails instead of quietly working.
 *
 * No agent may complete an item or set an attestation (Master Prompt §10:
 * "Never enable a dark flag yourself — surface it, explain the blocking
 * LEGAL-TODO item, stop.").
 */

export type LegalGateName =
  | "fee_collection"
  | "assignment_of_rights"
  | "trust_remittance"
  | "claim_purchase";

export const LEGAL_GATES: Record<
  LegalGateName,
  { legalTodoId: string; attestEnv: string; summary: string }
> = {
  fee_collection: {
    legalTodoId: "LT-1",
    attestEnv: "LEGAL_ATTEST_FEE_COLLECTION",
    summary: "Charging the success fee (pre-authorized method, verified SavingsProof).",
  },
  assignment_of_rights: {
    legalTodoId: "LT-2",
    attestEnv: "LEGAL_ATTEST_ASSIGNMENT",
    summary: "Assignment-of-rights clause in outbound letters (counsel-drafted only).",
  },
  trust_remittance: {
    legalTodoId: "LT-3",
    attestEnv: "LEGAL_ATTEST_TRUST",
    summary: "Directing institution payments to the partner-lawyer trust account.",
  },
  claim_purchase: {
    legalTodoId: "LT-4",
    attestEnv: "LEGAL_ATTEST_CLAIM_PURCHASE",
    summary: "Purchasing a consumer claim outright (licensed partner required).",
  },
};

export class LegalGateError extends Error {
  constructor(
    readonly gate: LegalGateName,
    readonly reason: "todo_incomplete" | "not_attested" | "todo_file_unreadable",
  ) {
    const g = LEGAL_GATES[gate];
    super(
      `legal gate "${gate}" is closed (${reason}). ` +
        `Complete LEGAL-TODO.md item ${g.legalTodoId} and set ${g.attestEnv}=${g.legalTodoId}. `,
    );
    this.name = "LegalGateError";
  }
}

/** Read LEGAL-TODO.md; injectable for tests. */
function readLegalTodo(): string {
  return readFileSync(join(process.cwd(), "LEGAL-TODO.md"), "utf8");
}

function todoItemComplete(todo: string, legalTodoId: string): boolean {
  // Exactly the checked form: "- [x] LT-n" (case-insensitive x). An
  // unchecked "- [ ] LT-n" or any other mention does not count.
  const re = new RegExp(`^-\\s*\\[[xX]\\]\\s*${legalTodoId}\\b`, "m");
  return re.test(todo);
}

export function legalGateStatus(
  gate: LegalGateName,
  deps: { todoText?: string; env?: Record<string, string | undefined> } = {},
): { open: boolean; reason?: LegalGateError["reason"] } {
  const g = LEGAL_GATES[gate];
  const env = deps.env ?? process.env;

  let todo: string;
  try {
    todo = deps.todoText ?? readLegalTodo();
  } catch {
    // The gate file missing is a closed gate, never an open one.
    return { open: false, reason: "todo_file_unreadable" };
  }

  if (!todoItemComplete(todo, g.legalTodoId)) {
    return { open: false, reason: "todo_incomplete" };
  }
  if (env[g.attestEnv]?.trim() !== g.legalTodoId) {
    return { open: false, reason: "not_attested" };
  }
  return { open: true };
}

/**
 * The enforcement point. Call this at the top of any code path that
 * implements a gated capability. Throws LegalGateError while the gate is
 * closed — loudly, with the exact unblocking steps in the message.
 */
export function requireLegalGate(
  gate: LegalGateName,
  deps?: { todoText?: string; env?: Record<string, string | undefined> },
): void {
  const status = legalGateStatus(gate, deps);
  if (!status.open) throw new LegalGateError(gate, status.reason!);
}
