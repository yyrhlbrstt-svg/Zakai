/** Public share landing URL — rich OG preview when amount is known (verified savings only). */
export function buildShareLandingUrl(opts: {
  origin: string;
  locale: string;
  amountLabel?: string;
  kicker?: string;
  referralCode?: string;
  /** Fallback when there is no amount card (referral-only or generic). */
  fallbackPath?: string;
}): string {
  const amount = opts.amountLabel?.trim();
  if (amount) {
    const qs = new URLSearchParams({ amount });
    if (opts.kicker?.trim()) qs.set("kicker", opts.kicker.trim());
    if (opts.referralCode?.trim()) qs.set("ref", opts.referralCode.trim());
    return `${opts.origin}/${opts.locale}/share?${qs.toString()}`;
  }
  if (opts.referralCode?.trim()) {
    return `${opts.origin}/signup?ref=${encodeURIComponent(opts.referralCode.trim())}`;
  }
  const path = opts.fallbackPath ?? `/${opts.locale}`;
  return path.startsWith("http") ? path : `${opts.origin}${path.startsWith("/") ? path : `/${path}`}`;
}
