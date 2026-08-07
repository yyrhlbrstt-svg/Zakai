import { NextResponse } from "next/server";
import { requireCronAuth } from "@/lib/security/cronAuth";
import { reportError } from "@/lib/report-error";
import { sendEmail } from "@/lib/messaging";
import { FOUNDER_EMAIL } from "@/lib/contact";
import { DATED_FACTS, factAgeMonths, factsDueSoon, staleFacts } from "@/lib/factFreshness";

export const dynamic = "force-dynamic";

/**
 * The recurring look at whether Zakai's facts are still facts.
 *
 * Every figure the product quotes — the VAT rate, a deposit deadline, an
 * electricity discount — was true when a person checked it. Nothing makes
 * them stay true, and a stale one is Zakai asserting something false to a
 * bank or a tax office in a user's name. `factFreshness.ts` gives every such
 * figure an age and a leash; this is what actually goes looking.
 *
 * It reports; it does not edit. Handing a model a search engine and write
 * access to a tax rate would eventually rewrite one wrongly and silently,
 * which is the fabrication the product forbids wearing the costume of
 * automation. Noticing something is due is machine work. Reading what the law
 * now says is not.
 *
 * Monthly is the right cadence: the shortest leash here is six months, so a
 * monthly look guarantees several warnings before anything lapses, while
 * staying quiet enough that the mail still means something when it arrives.
 */
export async function GET(request: Request) {
  const unauthorized = requireCronAuth(request);
  if (unauthorized) return unauthorized;

  try {
    const stale = staleFacts();
    const dueSoon = factsDueSoon();

    // Silence when everything is in date. A monthly "all fine" is a mail
    // people learn to delete unread, and then miss the one that matters.
    if (stale.length === 0 && dueSoon.length === 0) {
      return NextResponse.json({ ok: true, checked: DATED_FACTS.length, stale: 0, dueSoon: 0 });
    }

    const line = (f: (typeof DATED_FACTS)[number]) =>
      `• ${f.what}\n  ${factAgeMonths(f)} months since verification (limit ${f.maxAgeMonths})\n  ${f.module}\n  ${f.source}`;

    const body = [
      stale.length ? `נדרשת בדיקה עכשיו — ${stale.length} עובדות עברו את התאריך:` : "",
      ...stale.map(line),
      stale.length && dueSoon.length ? "" : "",
      dueSoon.length ? `מתקרבות לתאריך — ${dueSoon.length}:` : "",
      ...dueSoon.map(line),
      "",
      "פתחו את המקור, ודאו שהמספר עדיין נכון, ועדכנו את שדה verified באותו commit.",
      "אל תאריכו את maxAgeMonths כדי לסגור את ההתראה — זה הופך מספר שלא נבדק למספר שגוי בשקט.",
    ]
      .filter((l) => l !== undefined)
      .join("\n");

    await sendEmail({
      to: FOUNDER_EMAIL,
      subject: `זכאי — ${stale.length} עובדות דורשות אימות מחדש${dueSoon.length ? `, ${dueSoon.length} מתקרבות` : ""}`,
      body,
    });

    return NextResponse.json({
      ok: true,
      checked: DATED_FACTS.length,
      stale: stale.map((f) => f.id),
      dueSoon: dueSoon.map((f) => f.id),
    });
  } catch (error) {
    await reportError(error, { path: "/api/cron/fact-freshness" });
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
