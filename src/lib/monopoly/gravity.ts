import { assessFlywheel, type FlywheelInputs } from "./flywheel";

export interface ProtocolGravitySnapshot {
  assessedAt: string;
  inputs: FlywheelInputs;
  assessment: ReturnType<typeof assessFlywheel>;
  disclaimer: string;
}

export function buildGravitySnapshot(inputs: FlywheelInputs): ProtocolGravitySnapshot {
  return {
    assessedAt: new Date().toISOString(),
    inputs,
    assessment: assessFlywheel(inputs),
    disclaimer:
      "Gravity index is a logarithmic composite of real counters. It is not user count, revenue, or a promise of market share.",
  };
}
