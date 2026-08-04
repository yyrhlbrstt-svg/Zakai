"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations, useLocale } from "next-intl";

/** Prevent double /fee/checkout when two FeePayButton mounts both get autoStart. */
const autoStartedCases = new Set<string>();

/**
 * "Pay your success fee" — kicks off the PSP checkout for a case's pending fee
 * and redirects the payer to the hosted payment page. Until a real PSP is
 * configured the mock flow routes through the internal callback, so the button
 * works end-to-end today.
 */
export function FeePayButton({
  caseId,
  autoStart = false,
}: {
  caseId: string;
  autoStart?: boolean;
}) {
  const t = useTranslations("dashboard");
  const locale = useLocale();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [errorKind, setErrorKind] = useState<string | null>(null);
  const started = useRef(false);

  async function pay() {
    setBusy(true);
    setError(false);
    setErrorKind(null);
    try {
      const res = await fetch(`/api/cases/${caseId}/fee/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }
      // Already paid / nothing to collect — land on finish surface, don't look like a retry loop.
      if (data.error === "ALREADY_PAID") {
        window.location.href = `/${locale}/money?case=${encodeURIComponent(caseId)}&fee=paid`;
        return;
      }
      if (data.error === "NOTHING_TO_COLLECT" || data.error === "NO_FEE") {
        window.location.href = `/${locale}/money?case=${encodeURIComponent(caseId)}`;
        return;
      }
      setErrorKind(typeof data.error === "string" ? data.error : "generic");
      setError(true);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!autoStart || started.current) return;
    if (autoStartedCases.has(caseId)) return;
    autoStartedCases.add(caseId);
    started.current = true;
    void pay();
  }, [autoStart, caseId]);

  return (
    <button
      onClick={pay}
      disabled={busy}
      className="text-[12px] font-extrabold rounded-full px-3 py-1 bg-[rgba(63,203,155,0.14)] border border-[rgba(63,203,155,0.35)] text-emerald hover:bg-[rgba(63,203,155,0.22)] transition-colors disabled:opacity-60"
    >
      {busy
        ? t("feePaying")
        : error
          ? errorKind === "paymentUnavailable"
            ? t("feePayUnavailable")
            : errorKind === "MANDATE_REQUIRED"
              ? t("feeMandateRequired")
              : t("feePayError")
          : t("feePay")}
    </button>
  );
}
