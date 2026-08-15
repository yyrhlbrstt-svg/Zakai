import { describe, expect, it } from "vitest";
import { interpretBillExtraction, keepTransactionRows } from "./ai";

/**
 * The two functions that stand between an uploaded photograph and a demand
 * letter with a real person's name on it. Neither had a test.
 *
 * The founder found the gap the ordinary way: uploaded unrelated images and
 * watched the flow carry on regardless. These are that report, written down.
 */
describe("interpretBillExtraction", () => {
  const bill = {
    isBill: true,
    issuer: "סלקום",
    amount: 129.9,
    period: "אוגוסט 2026",
    vertical: "telecom",
    readable: true,
  };

  it("accepts a real bill", () => {
    const out = interpretBillExtraction(bill);
    expect(out.readable).toBe(true);
    expect(out.amountShekels).toBe(129.9);
    expect(out.vertical).toBe("telecom");
  });

  it("refuses a legible image that is not a bill", () => {
    // A price tag, a menu, a screenshot with a number on it: perfectly
    // readable, carries an amount, and is nobody's bill. This is the case
    // that used to open a case.
    const out = interpretBillExtraction({
      ...bill,
      isBill: false,
      issuer: "",
      amount: 1500,
    });
    expect(out.readable).toBe(false);
    expect(out.isBill).toBe(false);
  });

  it("refuses when the model never said whether it was a bill", () => {
    // Absence is refusal, not permission. Showing a message costs a retry;
    // accepting a non-bill sends a stranger a demand for money.
    const { isBill: _omitted, ...withoutFlag } = bill;
    expect(interpretBillExtraction(withoutFlag).readable).toBe(false);
  });

  it("refuses a bill with no legible amount", () => {
    expect(interpretBillExtraction({ ...bill, amount: null }).readable).toBe(false);
    expect(interpretBillExtraction({ ...bill, amount: 0 }).readable).toBe(false);
  });

  it("survives a response that is not an object at all", () => {
    expect(interpretBillExtraction(null).readable).toBe(false);
    expect(interpretBillExtraction("sorry, I cannot help with that").readable).toBe(false);
  });
});

describe("keepTransactionRows", () => {
  it("keeps real rows", () => {
    const raw = ["03/08/2026,ספוטיפיי,19.90", "1.7.26,NETFLIX,54"].join("\n");
    expect(keepTransactionRows(raw).split("\n")).toHaveLength(2);
  });

  it("drops prose the model wrote about the picture", () => {
    // This is the actual failure: the reply was pasted verbatim into the box
    // holding the person's own statement data, and the scan then found
    // nothing — indistinguishable from "it just moved on".
    const raw = [
      "I cannot see any transactions in this image.",
      "The image appears to show a dog on a beach.",
      "NONE",
    ].join("\n");
    expect(keepTransactionRows(raw)).toBe("");
  });

  it("keeps the transactions and drops the commentary around them", () => {
    const raw = [
      "Here are the transactions I found:",
      "03/08/2026,ספוטיפיי,19.90",
      "Total: 19.90",
      "",
      "Let me know if you need anything else.",
    ].join("\n");
    expect(keepTransactionRows(raw)).toBe("03/08/2026,ספוטיפיי,19.90");
  });

  it("drops a header row, which is not a transaction", () => {
    expect(keepTransactionRows("date,merchant,amount")).toBe("");
  });
});
