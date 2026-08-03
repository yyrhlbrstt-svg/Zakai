import { describe, expect, it } from "vitest";
import {
  REGULATORY_SNAPSHOT_SCHEMA,
  REGULATORY_SNAPSHOT_VERSION,
  REGULATORY_SNAPSHOT_CHANGELOG,
} from "./snapshotSchema";

describe("regulatory snapshot schema", () => {
  it("has stable ids", () => {
    expect(REGULATORY_SNAPSHOT_SCHEMA).toBe("zakai-regulatory-snapshot");
    expect(REGULATORY_SNAPSHOT_VERSION.length).toBeGreaterThan(5);
    expect(REGULATORY_SNAPSHOT_CHANGELOG.length).toBeGreaterThan(0);
  });
});
