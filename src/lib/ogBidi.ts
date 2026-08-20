/**
 * Visual-order conversion for the OG share card.
 *
 * Satori (the renderer behind next/og) does not implement the Unicode bidi
 * algorithm: it lays glyphs out in logical order left-to-right, so Hebrew
 * text on the share card rendered REVERSED — "זכאי" came out "יאכז" on the
 * one image WhatsApp shows before anyone opens the app. `direction: rtl` in
 * the style is accepted and ignored.
 *
 * This converts a logical-order string to the visual order Satori will draw
 * correctly: split into maximal runs of RTL script vs everything else,
 * reverse the characters inside RTL runs, keep LTR runs (digits, Latin, ₪
 * amounts) intact, and mirror the run order. That is the standard visual
 * approximation for a predominantly-RTL line; it is NOT a full bidi
 * implementation — nested direction changes and bracket mirroring are out of
 * scope, which is fine for the short, controlled strings the card renders.
 *
 * Only for Satori. Never use this for HTML — browsers do real bidi.
 */

// Hebrew, Arabic, and their presentation forms.
const RTL_RANGE = "֐-ࣿיִ-﷿ﹰ-﻿";
const RTL_FIRST = new RegExp(`[${RTL_RANGE}]`, "u");
const RUNS = new RegExp(`[${RTL_RANGE}]+|[^${RTL_RANGE}]+`, "gu");

export function toVisualRtl(text: string): string {
  const runs = text.match(RUNS);
  if (!runs) return text;
  return runs
    .map((run) => (RTL_FIRST.test(run[0]!) ? [...run].reverse().join("") : run))
    .reverse()
    .join("");
}

/** Convert only when the string actually contains RTL script. */
export function toVisualIfRtl(text: string): string {
  return RTL_FIRST.test(text) ? toVisualRtl(text) : text;
}
