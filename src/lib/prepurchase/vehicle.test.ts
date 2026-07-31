import { describe, expect, it } from "vitest";
import {
  DISCLOSURE_STATUTE,
  VEHICLE_DISCLOSURE,
  buildDisclosureDemand,
  disclosureItem,
} from "./vehicle";

describe("the checklist is written to be read under pressure", () => {
  it("gives every item a consequence, not just a label", () => {
    // This is read in a car park by somebody being pushed to close today. A
    // checklist without consequences gets skimmed.
    for (const d of VEHICLE_DISCLOSURE) {
      expect(d.why.trim().length).toBeGreaterThan(40);
    }
  });

  it("says what a refusal means for every item", () => {
    // Refusal is information. Treating it as merely inconvenient is the mistake
    // that costs somebody thirty thousand shekels.
    for (const d of VEHICLE_DISCLOSURE) {
      expect(d.ifRefused.trim().length).toBeGreaterThan(25);
    }
  });

  it("covers the failure that loses both the car and the money", () => {
    // A lien is the only item here where you can pay in full and own nothing.
    const lien = disclosureItem("liens")!;
    expect(lien.why).toMatch(/גם את הרכב וגם את הכסף/);
    expect(lien.ifRefused).toMatch(/לעצור עסקה/);
  });

  it("covers the most common forgery in the market", () => {
    const odo = disclosureItem("odometer")!;
    expect(odo.why).toMatch(/מד אוץ/);
    // The historical readings are what expose it — a single current number
    // proves nothing.
    expect(odo.demand).toMatch(/קריאות קודמות/);
  });

  it("has no duplicate ids and resolves each one", () => {
    const ids = VEHICLE_DISCLOSURE.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const d of VEHICLE_DISCLOSURE) expect(disclosureItem(d.id)).toBe(d);
    expect(disclosureItem("nope")).toBeUndefined();
  });
});

describe("the demand rests on a statute, not on a favour", () => {
  it("names the law rather than paraphrasing it", () => {
    // A buyer quoting the law by name is treated differently from a buyer
    // asking nicely, and that difference is most of the value of knowing it.
    expect(DISCLOSURE_STATUTE).toMatch(/חוק מכירת רכב משומש/);
    expect(buildDisclosureDemand().body).toContain(DISCLOSURE_STATUTE);
  });

  it("asks for every item on the list", () => {
    const body = buildDisclosureDemand().body;
    for (const d of VEHICLE_DISCLOSURE) expect(body).toContain(d.demand);
  });

  it("is not accusatory", () => {
    // The purpose is to obtain a document, and the fastest way to fail is to
    // make an honest seller feel accused before they have done anything.
    const body = buildDisclosureDemand().body;
    expect(body).toMatch(/אינה טענה כלפיכם/);
    expect(body).not.toMatch(/רמאות|הונאה|שקר|תרמית/);
  });

  it("leaves visible blanks rather than reading fine without them", () => {
    const body = buildDisclosureDemand().body;
    expect(body).toContain("[מספר רישוי]");
    expect(body).toContain("[שם הקונה]");
  });

  it("uses what it was given", () => {
    const l = buildDisclosureDemand({
      buyerName: "נועה בר",
      buyerId: "012345678",
      sellerName: "משה",
      plate: "12-345-67",
    });
    expect(l.subject).toContain("12-345-67");
    expect(l.body).toContain("נועה בר");
    expect(l.body).toContain("012345678");
    expect(l.body).toContain("משה");
    expect(l.body).not.toContain("[שם הקונה]");
  });

  it("states no valuation and no verdict on any particular car", () => {
    // It has never seen the vehicle. "This one looks fine" would be the most
    // expensive sentence this product could print.
    const body = buildDisclosureDemand().body;
    expect(body).not.toMatch(/₪|שווה|מומלץ לקנות|לא לקנות/);
  });
});
