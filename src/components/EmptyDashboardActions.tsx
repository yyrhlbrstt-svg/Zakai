"use client";

import { PriorityActions } from "@/components/PriorityActions";

/** Shown when the user has zero cases — push into the closed loop immediately. */
export function EmptyDashboardActions() {
  return (
    <div className="mt-8 text-start">
      <PriorityActions limit={4} />
    </div>
  );
}
