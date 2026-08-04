/**
 * Demo revoke must never accept live consumer JTIs.
 * Only Reference Verifier readiness samples (`readiness_*`).
 */
export function isVerifierReadinessDemoJti(jti: string): boolean {
  return /^readiness_[a-z0-9]+$/i.test(jti.trim());
}
