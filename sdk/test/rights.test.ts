import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchRightsCatalogPage, listRights, fetchRight, fetchEvaluationGuide, RightsApiError } from "../src/rights.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchRightsCatalogPage", () => {
  it("builds the request URL from market/category/locale/cursor", async () => {
    let requestedUrl = "";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL) => {
        requestedUrl = String(url);
        return {
          ok: true,
          json: async () => ({ zml_version: "1.0.0", api_version: "x", market: "IL", total: 0, rights: [] }),
        };
      }),
    );
    await fetchRightsCatalogPage({
      origin: "https://zakai.test",
      market: "il",
      category: "banking",
      locale: "he",
      cursor: "abc",
    });
    expect(requestedUrl).toContain("market=il");
    expect(requestedUrl).toContain("category=banking");
    expect(requestedUrl).toContain("locale=he");
    expect(requestedUrl).toContain("cursor=abc");
  });

  it("throws RightsApiError on a non-ok response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 429 })));
    await expect(fetchRightsCatalogPage({ origin: "https://zakai.test", market: "IL" })).rejects.toThrow(
      RightsApiError,
    );
  });

  it("throws RightsApiError when fetch itself fails (network down)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );
    await expect(fetchRightsCatalogPage({ origin: "https://zakai.test", market: "IL" })).rejects.toThrow(
      RightsApiError,
    );
  });
});

describe("listRights", () => {
  it("follows the next cursor until the catalog is exhausted", async () => {
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        calls += 1;
        if (calls === 1) {
          return {
            ok: true,
            json: async () => ({
              zml_version: "1.0.0",
              api_version: "x",
              market: "IL",
              total: 2,
              rights: [{ id: "a", category: "c", market: "IL", auto_eligible: false, _links: {} }],
              _links: { next: "/api/rights/catalog?market=IL&cursor=next1" },
            }),
          };
        }
        return {
          ok: true,
          json: async () => ({
            zml_version: "1.0.0",
            api_version: "x",
            market: "IL",
            total: 2,
            rights: [{ id: "b", category: "c", market: "IL", auto_eligible: false, _links: {} }],
          }),
        };
      }),
    );
    const rights = await listRights({ origin: "https://zakai.test", market: "IL" });
    expect(rights.map((r) => r.id)).toEqual(["a", "b"]);
    expect(calls).toBe(2);
  });

  it("stops after one page when there is no next cursor", async () => {
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        calls += 1;
        return {
          ok: true,
          json: async () => ({
            zml_version: "1.0.0",
            api_version: "x",
            market: "IL",
            total: 1,
            rights: [{ id: "a", category: "c", market: "IL", auto_eligible: false, _links: {} }],
          }),
        };
      }),
    );
    await listRights({ origin: "https://zakai.test", market: "IL" });
    expect(calls).toBe(1);
  });
});

describe("fetchRight", () => {
  it("requests ?full=1 and returns the raw document", async () => {
    let requestedUrl = "";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL) => {
        requestedUrl = String(url);
        return {
          ok: true,
          json: async () => ({
            id: "il_bank_loan_opening_commission_il",
            category: "banking",
            market: "IL",
            display_name: { en: "Loan fee" },
            source: { reference: "Real citation" },
          }),
        };
      }),
    );
    const right = await fetchRight("https://zakai.test", "il_bank_loan_opening_commission_il");
    expect(requestedUrl).toContain("/api/rights/catalog/il_bank_loan_opening_commission_il");
    expect(requestedUrl).toContain("full=1");
    expect(right.source.reference).toBe("Real citation");
  });

  it("throws RightsApiError with the id in the message on 404", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 404 })));
    await expect(fetchRight("https://zakai.test", "missing")).rejects.toThrow(/missing/);
  });
});

describe("fetchEvaluationGuide", () => {
  it("fetches the evaluation guide for a right id", async () => {
    let requestedUrl = "";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL) => {
        requestedUrl = String(url);
        return { ok: true, json: async () => ({ id: "il_bank_fees" }) };
      }),
    );
    const guide = await fetchEvaluationGuide("https://zakai.test", "il_bank_fees");
    expect(requestedUrl).toContain("/api/rights/evaluate/il_bank_fees");
    expect(guide.id).toBe("il_bank_fees");
  });
});
