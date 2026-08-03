import type { AgentNote } from "../types";

/** Business-day heuristic — no provider API required. */
export function runTimingAgent(now = new Date()): AgentNote {
  const day = now.getUTCDay();
  const hour = now.getUTCHours();
  const isMidWeek = day >= 2 && day <= 4;
  const isMorningIl = hour >= 6 && hour <= 11;
  const send =
    isMidWeek && isMorningIl
      ? "Tuesday–Thursday morning (IL business hours) — typical call-center capacity."
      : "Prefer Tuesday–Thursday 09:00–12:00 Israel time for first written outreach.";

  return {
    agent: "timing",
    summary: send,
    confidence: "medium",
    data: { utc_day: day, utc_hour: hour },
  };
}
