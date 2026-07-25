import { describe, it, expect } from "vitest";
import { FAQ, FAQ_CATEGORIES, faqDigest, type FaqCategory } from "./faq";

/**
 * The FAQ is the single source of truth for both the public /faq page and the
 * assistant's vetted answers. These tests guard its integrity so a bad edit
 * (a duplicate id, a missing translation, an orphan category) can never ship.
 */
describe("faq data integrity", () => {
  it("has a non-trivial number of entries", () => {
    expect(FAQ.length).toBeGreaterThanOrEqual(10);
  });

  it("every entry id is unique", () => {
    const ids = FAQ.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every entry has both Hebrew and English question + answer", () => {
    for (const e of FAQ) {
      expect(e.q_he.trim().length, `q_he for ${e.id}`).toBeGreaterThan(0);
      expect(e.a_he.trim().length, `a_he for ${e.id}`).toBeGreaterThan(0);
      expect(e.q_en.trim().length, `q_en for ${e.id}`).toBeGreaterThan(0);
      expect(e.a_en.trim().length, `a_en for ${e.id}`).toBeGreaterThan(0);
    }
  });

  it("every entry's category is a declared category", () => {
    const known = new Set<FaqCategory>(FAQ_CATEGORIES.map((c) => c.key));
    for (const e of FAQ) {
      expect(known.has(e.category), `unknown category on ${e.id}: ${e.category}`).toBe(true);
    }
  });

  it("every declared category is used by at least one entry", () => {
    for (const c of FAQ_CATEGORIES) {
      expect(FAQ.some((e) => e.category === c.key), `empty category ${c.key}`).toBe(true);
    }
  });

  it("categories have both locale labels", () => {
    for (const c of FAQ_CATEGORIES) {
      expect(c.he.trim().length).toBeGreaterThan(0);
      expect(c.en.trim().length).toBeGreaterThan(0);
    }
  });
});

describe("faqDigest", () => {
  it("includes every question and answer so the assistant can align to them", () => {
    const digest = faqDigest();
    for (const e of FAQ) {
      expect(digest).toContain(e.q_he);
      expect(digest).toContain(e.a_he);
    }
  });

  it("is a single stable string (no dynamic values that would break caching)", () => {
    expect(faqDigest()).toBe(faqDigest());
  });
});
