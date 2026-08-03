import { salesInboundEmail } from "@/lib/contact";

/**
 * Pull copy for desks that already receive Zakai volume.
 * Never claims partners or traction — invites them to email us.
 */

export function institutionSalesEmail(): string {
  return salesInboundEmail();
}

export function institutionPilotMailto(opts?: {
  institutionId?: string;
  subjectExtra?: string;
}): string {
  const email = salesInboundEmail();
  const aud = opts?.institutionId?.trim() || "";
  const subject = encodeURIComponent(
    opts?.subjectExtra?.trim() ||
      (aud
        ? `Mandate verify pilot — ${aud}`
        : "Mandate verify pilot — we want to automate inbound"),
  );
  const body = encodeURIComponent(
    [
      "Hello Zakai team,",
      "",
      "We receive Mandate-backed consumer requests and want to verify offline / automate intake.",
      aud ? `Our intended audience id: ${aud}` : "Our intended audience id: <bank-slug>",
      "",
      "Please point us at the pilot package and Reference Verifier wizard.",
      "",
      "—",
    ].join("\n"),
  );
  return `mailto:${email}?subject=${subject}&body=${body}`;
}

/** One short line for letter / email footers (must survive truncation). */
export function institutionPullFooterLine(locale: "he" | "en", origin: string): string {
  const base = origin.replace(/\/+$/, "");
  const email = salesInboundEmail();
  // Quickstart is the machine gate — not a marketing brochure.
  const page = `${base}/${locale === "he" ? "he" : "en"}/institutions/quickstart`;
  const decide = `${base}/api/mandate/decide`;
  if (locale === "he") {
    return `לגוף שמקבל פניות: Quickstart + POST ${decide} · ${page} · ${email}`;
  }
  return `Institutions: Quickstart + POST ${decide} · ${page} · ${email}`;
}

/**
 * Machine one-shot for desks / parsers — pipe accept + JWKS.
 * Keep under ~280 chars so mail truncation rarely drops it.
 */
export function institutionPipeMagnetLine(origin: string): string {
  const base = origin.replace(/\/+$/, "");
  return `Machine: POST ${base}/api/pipe/accept {mandate_jws,action} · JWKS ${base}/.well-known/zakai-jwks.json · pipe ${base}/.well-known/zakai-pipe.json`;
}

export function roiMailto(input: {
  volume: number;
  minutes: number;
  hourlyCost: number;
  hoursPerMonth: number;
  costPerYear: number;
}): string {
  const email = salesInboundEmail();
  const subject = encodeURIComponent("Mandate verify pilot — our ops numbers");
  const body = encodeURIComponent(
    [
      "Hello Zakai team,",
      "",
      "We ran your ROI calculator with our own numbers:",
      `- Authority checks / month: ${input.volume}`,
      `- Minutes per manual check: ${input.minutes}`,
      `- Fully loaded staff cost / hour: ${input.hourlyCost}`,
      `- Implied hours / month: ${Math.round(input.hoursPerMonth)}`,
      `- Implied cost / year: ${Math.round(input.costPerYear)}`,
      "",
      "We want the self-serve pilot (JWKS + inbound receive).",
      "",
      "—",
    ].join("\n"),
  );
  return `mailto:${email}?subject=${subject}&body=${body}`;
}
