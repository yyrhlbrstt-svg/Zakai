/**
 * Default throughput budgets per traffic class (tune per environment).
 * Used in docs, tests, and future autoscaling alerts — not enforced globally yet.
 */

export const TRAFFIC_CLASS = {
  A_PUBLIC_READ: "A",
  B_PUBLIC_WRITE: "B",
  C_AUTH_MUTATION: "C",
  D_INSTITUTION: "D",
} as const;

export type TrafficClass = (typeof TRAFFIC_CLASS)[keyof typeof TRAFFIC_CLASS];

export interface ThroughputBudget {
  class: TrafficClass;
  /** Suggested max sustained RPS per region before adding cache/replica/worker. */
  sustainedRpsPerRegion: number;
  /** Default rate-limit window for anonymous endpoints (seconds). */
  rateLimitWindowSeconds: number;
  /** Default max requests per window per IP (anonymous). */
  rateLimitPerIp: number;
}

export const DEFAULT_BUDGETS: Record<TrafficClass, ThroughputBudget> = {
  [TRAFFIC_CLASS.A_PUBLIC_READ]: {
    class: TRAFFIC_CLASS.A_PUBLIC_READ,
    sustainedRpsPerRegion: 50_000,
    rateLimitWindowSeconds: 60,
    rateLimitPerIp: 120,
  },
  [TRAFFIC_CLASS.B_PUBLIC_WRITE]: {
    class: TRAFFIC_CLASS.B_PUBLIC_WRITE,
    sustainedRpsPerRegion: 2_000,
    rateLimitWindowSeconds: 60,
    rateLimitPerIp: 30,
  },
  [TRAFFIC_CLASS.C_AUTH_MUTATION]: {
    class: TRAFFIC_CLASS.C_AUTH_MUTATION,
    sustainedRpsPerRegion: 5_000,
    rateLimitWindowSeconds: 86_400,
    rateLimitPerIp: 0,
  },
  [TRAFFIC_CLASS.D_INSTITUTION]: {
    class: TRAFFIC_CLASS.D_INSTITUTION,
    sustainedRpsPerRegion: 500,
    rateLimitWindowSeconds: 60,
    rateLimitPerIp: 0,
  },
};
