export type AutopilotFinding = {
  kind: string;
  severity: "critical" | "warning" | "note";
  message: string;
  meta?: Record<string, unknown>;
};

export type AutopilotJobResult = {
  ok: boolean;
  summary: string;
  findings: AutopilotFinding[];
};
