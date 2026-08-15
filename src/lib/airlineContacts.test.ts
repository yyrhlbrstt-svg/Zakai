import { describe, expect, it } from "vitest";
import {
  KNOWN_AIRLINES,
  resolveAirlineContactEmail,
  resolveAirlineProviderKey,
} from "./airlineContacts";

describe("airlineContacts", () => {
  it("resolves known carriers", () => {
    expect(resolveAirlineContactEmail("EL AL")).toContain("@elal");
    expect(resolveAirlineProviderKey("אל על")).toBe("elal");
  });

  it("falls back empty without inventing an inbox", () => {
    expect(resolveAirlineContactEmail("Unknown Wings LLC")).toBe("");
  });

  /**
   * The picker offers these carriers by name, and the claim button stays
   * disabled until an address resolves. A label in the list that resolves to
   * nothing is therefore an option a passenger can select and then be stuck on
   * — which is the exact failure the picker exists to remove. Both alphabets,
   * because the Hebrew spellings were the half that silently resolved to "".
   */
  it("every offered carrier resolves to an address, in both languages", () => {
    for (const airline of KNOWN_AIRLINES) {
      expect(resolveAirlineContactEmail(airline.he), `he: ${airline.he}`).toContain("@");
      expect(resolveAirlineContactEmail(airline.en), `en: ${airline.en}`).toContain("@");
    }
  });

  /**
   * Same carrier, same counterparty key, whichever alphabet it was typed in.
   * Otherwise one airline's outcomes are split across two buckets and neither
   * ever clears the minimum sample the strategy engine needs to learn anything.
   */
  it("counts the same carrier under one key across languages", () => {
    for (const airline of KNOWN_AIRLINES) {
      expect(resolveAirlineProviderKey(airline.he), `he: ${airline.he}`).toBe(airline.key);
      expect(resolveAirlineProviderKey(airline.en), `en: ${airline.en}`).toBe(airline.key);
    }
  });
});
