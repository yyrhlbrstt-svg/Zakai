"use client";

import { useEffect } from "react";

/** Scroll to a case row when landing from /flights or other deep links. */
export function CaseHighlightScroll({ caseId }: { caseId?: string | null }) {
  useEffect(() => {
    if (!caseId) return;
    const el = document.getElementById(`case-${caseId}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    el?.classList.add("ring-2", "ring-emerald/50", "rounded-xl");
  }, [caseId]);
  return null;
}
