"use client";

import { useState } from "react";
import { useLocale } from "next-intl";
import { Button } from "@/components/ui";
import { heEn } from "@/lib/heEn";

type ResendState = "idle" | "delivered" | "queued" | "accepted";

/**
 * Unverified email blocks the fast Mandate path. One tap resends the link.
 * Never claim "נשלח" unless Outbox actually SENT.
 */
export function EmailVerifyNudge() {
  const locale = useLocale();
  const he = locale === "he" || locale === "ar";
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<ResendState>("idle");
  const [err, setErr] = useState(false);

  async function resend() {
    setBusy(true);
    setErr(false);
    try {
      const res = await fetch(`/api/auth/verify-email?locale=${encodeURIComponent(locale)}`, {
        method: "PUT",
      });
      if (!res.ok) throw new Error("fail");
      const data = (await res.json().catch(() => ({}))) as {
        delivered?: boolean;
        queued?: boolean;
      };
      if (data.delivered === true) setState("delivered");
      else if (data.queued === true) setState("queued");
      else setState("accepted");
    } catch {
      setErr(true);
    } finally {
      setBusy(false);
    }
  }

  const done = state !== "idle";

  /**
   * What happened, once something has. This is a sentence about the system's
   * state, not a thing to press — which is why it stops being rendered inside
   * a Button below.
   */
  const status =
    state === "delivered"
      ? heEn(he, "נשלח — בדקו את המייל", "Sent — check your inbox")
      : state === "queued"
        ? heEn(
            he,
            "בתור שליחה — עדיין לא יצא מהמערכת",
            "Queued — has not left the system yet",
          )
        : state === "accepted"
          ? heEn(he, "בוצע — בדקו את המייל או רעננו", "Done — check inbox or refresh")
          : null;

  const label = busy
    ? heEn(he, "שולח…", "Sending…")
    : heEn(he, "שלח קישור אימות", "Send verification link");

  return (
    <div className="rounded-2xl border border-[rgba(62,198,255,0.4)] bg-[rgba(62,198,255,0.08)] px-5 py-4 mb-5">
      <div className="font-extrabold text-[14.5px] text-[#3EC6FF]">
        {heEn(he, "אמתו את המייל — שליחת Mandate בלחיצה אחת", "Verify email — one-tap Mandate send")}
      </div>
      <p className="text-[13px] text-ink-soft leading-relaxed mt-1.5 mb-3">
        {he
          ? "בלי אימות מייל צריך קוד בעלות בכל תיק. אחרי אימות: אשר → שלח עם Mandate מיד."
          : "Without email verify you need ownership codes on every case. After verify: approve → send with Mandate immediately."}
      </p>
      {/* A finished action stops being a control.

          This used to stay a full-width primary Button, disabled, with the
          status sentence as its label — so the most prominent green element
          on the page was permanently unpressable and said "has not left the
          system yet". That reads as a broken button, which is exactly the
          complaint this pattern keeps generating.

          It matters most in the state nobody tested: with no SMTP configured
          every send is queued, so every reader reached that dead button and
          none of them reached the working one. */}
      {done && status ? (
        <p role="status" className="text-body font-bold text-[#3EC6FF] m-0">
          {status}
        </p>
      ) : (
        <Button disabled={busy} className="!text-[13px] !py-2.5" onClick={() => void resend()}>
          {label}
        </Button>
      )}
      {err ? (
        <p className="text-[12px] text-amber mt-2 mb-0">
          {heEn(he, "לא הצלחנו לשלוח. נסו שוב בעוד רגע.", "Could not send. Try again in a moment.")}
        </p>
      ) : null}
    </div>
  );
}
