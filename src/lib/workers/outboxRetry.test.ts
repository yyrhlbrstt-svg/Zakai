import { describe, expect, it } from "vitest";
import {
  formatOutboxFailure,
  isOutboxDeadLetter,
  MAX_OUTBOX_ATTEMPTS,
  parseOutboxAttempts,
} from "./outboxRetry";

describe("outboxRetry", () => {
  it("parses attempt markers", () => {
    expect(parseOutboxAttempts(null)).toBe(0);
    expect(parseOutboxAttempts("[attempts=3] SMTP timeout")).toBe(3);
    expect(parseOutboxAttempts(`${"[dead-letter]"} boom`)).toBe(MAX_OUTBOX_ATTEMPTS);
  });

  it("dead-letters at max attempts", () => {
    const err = formatOutboxFailure(MAX_OUTBOX_ATTEMPTS, "hard fail");
    expect(isOutboxDeadLetter(err)).toBe(true);
    expect(parseOutboxAttempts(err)).toBe(MAX_OUTBOX_ATTEMPTS);
  });

  it("increments without dead-letter below max", () => {
    const err = formatOutboxFailure(2, "temp");
    expect(isOutboxDeadLetter(err)).toBe(false);
    expect(parseOutboxAttempts(err)).toBe(2);
  });
});
