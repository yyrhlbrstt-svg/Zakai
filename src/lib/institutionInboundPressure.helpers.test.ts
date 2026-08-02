import { describe, expect, it } from "vitest";
import {
  isOutboundCaseStatus,
  providerKeysForInstitution,
} from "./institutionInboundPressure";

describe("institution inbound helpers", () => {
  it("maps institution to provider keys", () => {
    expect(providerKeysForInstitution("bank-leumi")).toEqual(["leumi"]);
    expect(providerKeysForInstitution("unknown")).toEqual([]);
  });

  it("detects outbound statuses", () => {
    expect(isOutboundCaseStatus("SENT")).toBe(true);
    expect(isOutboundCaseStatus("ANALYZED")).toBe(false);
  });
});
