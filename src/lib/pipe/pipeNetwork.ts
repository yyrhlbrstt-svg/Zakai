/**
 * De-identified pipe volume — the Visa scoreboard.
 * Empty totals are honest; filled totals are the only institutional marketing.
 */

export interface PipeNetworkVolume {
  mandatesIssued: number;
  casesSent: number;
  savingsProofs: number;
  verifiedRecoveredMinor: number;
}

export function scorePipeGravity(v: PipeNetworkVolume): {
  tier: "empty" | "signal" | "gravity" | "network";
  note: string;
} {
  if (v.mandatesIssued === 0 && v.casesSent === 0 && v.savingsProofs === 0) {
    return {
      tier: "empty",
      note: "Rails are live; volume is zero — deploy SMTP and run real cases.",
    };
  }
  if (v.savingsProofs >= 50 && v.mandatesIssued >= 200) {
    return {
      tier: "network",
      note: "Enough documented outcomes that ignoring Mandate verify is operationally expensive.",
    };
  }
  if (v.casesSent >= 20 || v.mandatesIssued >= 20) {
    return {
      tier: "gravity",
      note: "Outbound Mandate volume is accumulating — desks will start noticing.",
    };
  }
  return {
    tier: "signal",
    note: "First real Mandates/SENT cases exist — keep pushing IL loop volume.",
  };
}
