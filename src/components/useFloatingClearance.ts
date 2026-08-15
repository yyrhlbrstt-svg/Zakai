"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Keep a floating banner off the things people came to press.
 *
 * WHY THIS IS SHARED CODE AND NOT A RULE IN A REVIEW CHECKLIST
 *
 * There are two of these banners, they are pinned to the bottom of the
 * viewport, and both got it wrong in the same way independently. The install
 * prompt had a hand-written list of five routes where it was known to hurt,
 * out of a hundred and thirty-six. The push prompt had nothing at all: four
 * seconds after any signed-in page loaded, it appeared over whatever happened
 * to be there. On the homepage that was "start with my money" — the single
 * button the entire product funnels toward. It had been that way for as long
 * as both features existed, and no screenshot showed it, because a screenshot
 * of a banner sitting on a button looks exactly like a banner.
 *
 * Neither author was careless. Route lists rot the moment a route is added,
 * and there is no amount of care that keeps one correct. So the question is
 * asked of the browser instead: does this rectangle overlap a rectangle
 * somebody needs? That has an answer, it is the same answer the browser uses
 * for hit-testing, and it stays right for pages nobody has written yet.
 *
 * Retreat is one-way per page view. A banner that came back as soon as the
 * obstruction scrolled past would blink on and off down the length of a long
 * page, which is its own kind of unusable.
 */

/** Everything a person can press, type in or drag. */
const INTERACTIVE =
  'button,a[href],input:not([type="hidden"]),select,textarea,[role="button"],[role="radio"],[role="checkbox"]';

/**
 * Banners mark themselves so they do not evict each other. Two of them stacked
 * is a separate judgement about how much to ask of somebody at once; it is not
 * the "you cannot press the thing" defect this exists to stop.
 */
export const FLOATING_BANNER_ATTR = "data-floating-banner";

function overlapsSomethingUsable(banner: HTMLElement): boolean {
  const b = banner.getBoundingClientRect();
  if (b.width === 0 || b.height === 0) return false;
  for (const el of document.querySelectorAll<HTMLElement>(INTERACTIVE)) {
    if (banner.contains(el)) continue;
    if (el.closest(`[${FLOATING_BANNER_ATTR}]`)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) continue;
    if (r.bottom < 0 || r.top > window.innerHeight) continue;
    const style = getComputedStyle(el);
    if (style.visibility === "hidden" || style.display === "none" || style.opacity === "0") {
      continue;
    }
    if (r.left < b.right && r.right > b.left && r.top < b.bottom && r.bottom > b.top) return true;
  }
  return false;
}

export interface FloatingClearance {
  /** Put this on the banner's outermost element. */
  ref: React.RefObject<HTMLDivElement | null>;
  /**
   * False until the banner has been measured and found to be covering nothing.
   * Render it hidden until then — a rectangle needs a render before it can be
   * measured, and without this it flashes into view over the button it is
   * about to get out of the way of.
   */
  clear: boolean;
}

export function useFloatingClearance(shown: boolean, retreat: () => void): FloatingClearance {
  const ref = useRef<HTMLDivElement>(null);
  const [clear, setClear] = useState(false);
  const leave = useCallback(() => {
    setClear(false);
    retreat();
  }, [retreat]);

  useEffect(() => {
    if (!shown) {
      setClear(false);
      return;
    }
    const el = ref.current;
    if (!el) return;

    const check = () => {
      if (overlapsSomethingUsable(el)) leave();
      else setClear(true);
    };
    check();

    let queued = 0;
    const onMove = () => {
      window.clearTimeout(queued);
      queued = window.setTimeout(check, 120);
    };
    window.addEventListener("scroll", onMove, { passive: true });
    window.addEventListener("resize", onMove);
    // Someone started filling something in. Whatever else is true, they are
    // not shopping for an app right now.
    const onFocusIn = () => leave();
    document.addEventListener("focusin", onFocusIn);
    // Cards that expand, results that render — anything that puts a new
    // control under the banner without a scroll or resize to announce it.
    const observer = new MutationObserver(onMove);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      window.clearTimeout(queued);
      window.removeEventListener("scroll", onMove);
      window.removeEventListener("resize", onMove);
      document.removeEventListener("focusin", onFocusIn);
      observer.disconnect();
    };
  }, [shown, leave]);

  return { ref, clear };
}
