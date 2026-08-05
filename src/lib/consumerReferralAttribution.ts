/** First-touch consumer referral code (?ref= on share links). */
export const CONSUMER_REF_COOKIE = "zakai_consumer_ref";
export const CONSUMER_REF_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

/** Normalise ?ref= from marketing / share URLs (not partner embed). */
export function consumerReferralFromSearchParams(params: URLSearchParams): string | null {
  const ref = params.get("ref")?.trim();
  if (!ref || ref.length > 64) return null;
  if (!/^[a-zA-Z0-9_-]+$/.test(ref)) return null;
  return ref;
}
