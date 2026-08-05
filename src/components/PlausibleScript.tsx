"use client";

import Script from "next/script";

/**
 * Privacy-friendly analytics (no cookies). Loads only when
 * NEXT_PUBLIC_PLAUSIBLE_DOMAIN is set — keeps "no tracker cookies" true otherwise.
 */
export function PlausibleScript() {
  const domain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN?.trim();
  if (!domain) return null;

  return (
    <Script
      defer
      data-domain={domain}
      src="https://plausible.io/js/script.js"
      strategy="afterInteractive"
    />
  );
}
