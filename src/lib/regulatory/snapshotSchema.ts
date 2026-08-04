/** Stable public schema for GET /api/regulatory/snapshot — bump on breaking changes only. */
export const REGULATORY_SNAPSHOT_SCHEMA = "zakai-regulatory-snapshot";
export const REGULATORY_SNAPSHOT_VERSION = "2026-08-03";

export const REGULATORY_SNAPSHOT_CHANGELOG: readonly {
  version: string;
  date: string;
  note: string;
}[] = [
  {
    version: "2026-08-03",
    date: "2026-08-03",
    note: "Initial stable envelope: schema, market slice, inbound_pressure, fairness_scores, collective_intent, links.",
  },
];
