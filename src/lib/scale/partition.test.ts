import { describe, expect, it } from "vitest";
import { outcomePartitionKey, parseOutcomePartitionKey } from "./partition";

describe("outcomePartitionKey", () => {
  it("normalises market and keys", () => {
    expect(outcomePartitionKey("il", "Telecom", "Cellcom")).toBe("IL:telecom:cellcom");
  });

  it("round-trips via parse", () => {
    const key = outcomePartitionKey("IL", "telecom", "cellcom");
    expect(parseOutcomePartitionKey(key)).toEqual({
      market: "IL",
      vertical: "telecom",
      counterparty: "cellcom",
    });
  });

  it("rejects invalid parse", () => {
    expect(parseOutcomePartitionKey("bad")).toBeNull();
  });
});
