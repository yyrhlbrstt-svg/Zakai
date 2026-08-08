/**
 * Turn the paths an assistant writes into links you can actually press.
 *
 * THE BUG THIS FIXES
 *
 * The playbook instructs the model to name in-app destinations as bare paths —
 * "/money?case=" — and the reply is Hebrew. Rendered as plain text inside an
 * RTL paragraph, bidi reordering rewrites `/money?case=cmsc5vwt9…` on screen as
 * `money?/case=cmsc5vwt9…`. So the agent finishes by saying "open your case"
 * and then prints a scrambled string that is not a link, cannot be tapped, and
 * does not look like an address.
 *
 * That is the last step of the loop. Someone who got that far has already
 * agreed to everything; they are stopped by a mangled URL.
 *
 * WHY IT IS FIXED HERE AND NOT IN THE PROMPT
 *
 * Asking the model to emit markdown, or to wrap paths in LTR marks, makes
 * correctness depend on a model following instructions in every language on
 * every turn. Product code can do it deterministically, so it does. The model
 * keeps naming destinations however it likes; this decides how they render.
 *
 * Only in-app paths are linked. An arbitrary http(s) URL from model output is
 * deliberately NOT turned into a clickable link — a model that hallucinated a
 * domain would otherwise become a one-tap route off the site.
 */

export type AssistantSegment =
  | { kind: "text"; value: string }
  | { kind: "link"; href: string; label: string };

/**
 * Paths the assistant is allowed to link to. A closed list, because this
 * decides where a tap can send someone.
 */
const LINKABLE_PREFIXES = [
  "/money",
  "/check",
  "/cancel",
  "/dashboard",
  "/bank-fees",
  "/electricity",
  "/water-bill",
  "/arnona",
  "/receipts",
  "/what-am-i-owed",
  "/tools",
  "/settings",
  "/authority",
] as const;

/**
 * Matches an in-app path with optional query. Stops before trailing sentence
 * punctuation so "open /money?case=abc." does not link the full stop, and
 * excludes the Hebrew maqaf and common closers that would otherwise be eaten.
 */
const PATH_RE = /\/[a-z][a-z0-9-]*(?:\/[a-z0-9-]+)*(?:\?[A-Za-z0-9_=&%-]+)?/g;

function isLinkable(path: string): boolean {
  const base = path.split("?")[0];
  return LINKABLE_PREFIXES.some((p) => base === p || base.startsWith(`${p}/`));
}

/** Trailing characters that belong to the sentence, not the URL. */
function trimTrailing(path: string): { path: string; rest: string } {
  const m = path.match(/[.,;:!?)\]}״"'׳]+$/);
  if (!m) return { path, rest: "" };
  return { path: path.slice(0, -m[0].length), rest: m[0] };
}

export function linkifyAssistantText(text: string): AssistantSegment[] {
  const out: AssistantSegment[] = [];
  let last = 0;

  for (const m of text.matchAll(PATH_RE)) {
    const raw = m[0];
    const at = m.index ?? 0;
    const { path, rest } = trimTrailing(raw);

    if (!isLinkable(path)) continue;

    if (at > last) out.push({ kind: "text", value: text.slice(last, at) });
    out.push({ kind: "link", href: path, label: path });
    if (rest) out.push({ kind: "text", value: rest });
    last = at + raw.length;
  }

  if (last < text.length) out.push({ kind: "text", value: text.slice(last) });
  // A message with no paths is one text segment, never an empty array.
  return out.length > 0 ? out : [{ kind: "text", value: text }];
}

/** True when there is at least one thing to press. */
export function hasLink(segments: readonly AssistantSegment[]): boolean {
  return segments.some((s) => s.kind === "link");
}
