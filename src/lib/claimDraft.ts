/**
 * Turning an entitlement into a finished document, in the app.
 *
 * The gap this closes: the rights list finds what you are owed and then the
 * primary action promises "Zakai will handle it from start to money in your
 * account" — while zero of the 188 rights have anything behind that button.
 * A promise with nothing behind it is worse than the external link it
 * replaced: the link at least worked.
 *
 * So every Israeli entitlement now resolves, on the same screen, to one of
 * three real things:
 *
 *   tool   — an in-app tool already does this end to end; route there
 *   letter — the finished application, generated here, ready to send
 *   agent  — the case pipeline runs it on the customer's behalf
 *
 * Nothing here links out. That is the product decision the whole app rests on
 * — the customer is never handed to somebody else's website — and it is also
 * the commercial one: a claim the customer files themselves teaches the
 * Strategy Engine nothing, so a right that leaves the building leaves with the
 * evidence too.
 *
 * Pure and deterministic, so the exact text a customer is about to send can be
 * shown to them before they send it, and reproduced afterwards.
 */

import { RECIPIENT_HE, RIGHT_ACTIONS, type FieldKey, type RightAction } from "./rightsActions";
import { withFooter } from "./letterFooter";

export interface ClaimDraft {
  subject: string;
  body: string;
}

export type ClaimFields = Partial<Record<FieldKey | "name" | "id", string>>;

/** What the UI must ask for before it can produce this document. */
export function requiredFields(rightId: string): FieldKey[] {
  return RIGHT_ACTIONS[rightId]?.fields ?? [];
}

export function actionKind(rightId: string): RightAction["kind"] | undefined {
  return RIGHT_ACTIONS[rightId]?.kind;
}

export function toolRoute(rightId: string): string | undefined {
  const action = RIGHT_ACTIONS[rightId];
  return action?.kind === "tool" ? action.tool : undefined;
}

/**
 * Fill a template. Missing values become a visible blank rather than being
 * dropped: a letter that quietly omits an account number reads as complete and
 * gets rejected, while a visible `____` gets filled in before it is sent.
 */
function fill(template: string, values: ClaimFields): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = values[key as keyof ClaimFields];
    return value && value.trim() ? value.trim() : "____";
  });
}

/**
 * Build the document for an entitlement. Returns null when the right has no
 * letter — a tool-backed right, or one outside the Israeli catalog — so a
 * caller can never accidentally render an empty letter as if it were real.
 */
export function buildClaimDraft(rightId: string, fields: ClaimFields): ClaimDraft | null {
  const action = RIGHT_ACTIONS[rightId];
  if (!action || action.kind !== "letter" || !action.subject || !action.body) return null;

  const recipient = action.recipient ? RECIPIENT_HE[action.recipient] : "";
  const today = new Date().toLocaleDateString("he-IL");
  const signature = `בכבוד רב,\n${fields.name?.trim() || "____"}\nת״ז ${fields.id?.trim() || "____"}\nתאריך: ${today}`;

  const body = [fill(recipient, fields), fill(action.body, fields), signature]
    .filter(Boolean)
    .join("\n\n");

  // Every letter carries it. This is the product's only distribution channel to
  // the institutions the protocol needs: each claim is a knock on a door,
  // delivered by that institution's own customer rather than by a salesperson.
  return { subject: fill(action.subject, fields), body: withFooter(body, "he") };
}

/**
 * Everything the UI needs to render one entitlement's action, resolved in one
 * call so a component never has to know the shape of the action catalog.
 */
export interface ResolvedAction {
  kind: RightAction["kind"];
  tool?: string;
  fields: FieldKey[];
  /** True when a document can be produced for this right. */
  drafts: boolean;
}

export function resolveAction(rightId: string): ResolvedAction | null {
  const action = RIGHT_ACTIONS[rightId];
  if (!action) return null;
  return {
    kind: action.kind,
    tool: action.tool,
    fields: action.fields ?? [],
    drafts: action.kind === "letter" && Boolean(action.subject && action.body),
  };
}
