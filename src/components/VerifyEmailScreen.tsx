"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Card, Button } from "@/components/ui";

type State = "working" | "ok" | "expired" | "used" | "invalid" | "error";

/**
 * The page a verification link lands on.
 *
 * Consumes the token on arrival rather than behind a button. The person already
 * expressed intent by opening the link from their own mailbox, and asking them
 * to confirm that they meant to click the thing they just clicked is friction
 * that protects nobody.
 *
 * The three failures are kept apart on purpose. "Expired" and "already used"
 * mean the link was genuinely ours, so the useful instruction is to ask for
 * another one; "invalid" means it never was, and offering a resend there would
 * send somebody looking for a problem that is not theirs.
 */
export function VerifyEmailScreen() {
  const t = useTranslations("verifyEmail");
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [state, setState] = useState<State>("working");
  const [resent, setResent] = useState(false);

  useEffect(() => {
    if (!token) {
      setState("invalid");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.ok) setState("ok");
        else if (data.error === "expired" || data.error === "used" || data.error === "invalid") {
          setState(data.error);
        } else setState("error");
      } catch {
        if (!cancelled) setState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function resend() {
    try {
      await fetch("/api/auth/verify-email", { method: "PUT" });
      setResent(true);
    } catch {
      // The button says what it did; a failure here leaves it unsaid rather
      // than claiming a message went out that did not.
    }
  }

  // Only offered where it helps. On an invalid token the link was never ours,
  // and a resend button there points somebody at the wrong problem.
  const canResend = state === "expired" || state === "used";

  return (
    <Card className="p-7 text-center">
      <p className="text-[15px] leading-relaxed m-0">
        {state === "working" ? t("working") : t(`state.${state}`)}
      </p>

      {canResend && (
        <Button className="mt-5" onClick={resend} disabled={resent}>
          {resent ? t("resent") : t("resend")}
        </Button>
      )}

      {state === "ok" && (
        <p className="text-ink-soft text-[13px] mt-4 mb-0 leading-relaxed">{t("okNote")}</p>
      )}
    </Card>
  );
}
