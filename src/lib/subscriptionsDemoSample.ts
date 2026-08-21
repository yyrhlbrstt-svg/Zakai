/**
 * Demo CSV for the universal-cancel UI.
 *
 * The Netflix side used to stop in April while the Cellcom side ran to May,
 * which no real export does: a statement covering March to May shows a monthly
 * subscription three times, not twice. That was an artefact of a fixture
 * written by hand, and it stayed invisible until the claim gate started
 * reading confidence — two sightings is a plausible coincidence and gets held
 * back, so the button offering "סלקום + נטפליקס" produced an actionable claim
 * about Cellcom alone.
 *
 * The honest fix is the missing row rather than a softer gate. Worth being
 * explicit about the order of reasoning, since it could easily have run the
 * other way: the demo is wrong because it does not look like a real statement,
 * and clearing the gate is a consequence of fixing that, not the reason for it.
 */
export const UNIVERSAL_CANCEL_DEMO_CSV = `תאריך עסקה,שם בית עסק,סכום עסקה,סכום חיוב
05/03/2026,סלקום בע"מ,89.90 ₪,89.90 ₪
05/04/2026,סלקום בע"מ,89.90 ₪,89.90 ₪
05/05/2026,סלקום בע"מ,89.90 ₪,89.90 ₪
12/03/2026,נטפליקס,54.90 ₪,54.90 ₪
12/04/2026,נטפליקס,54.90 ₪,54.90 ₪
12/05/2026,נטפליקס,54.90 ₪,54.90 ₪`;

/** Minimum pasted text before scan is meaningful (matches universal cancel). */
export const STATEMENT_SCAN_MIN_CHARS = 12;
