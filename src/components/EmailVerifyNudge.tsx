"use client";

import { useState } from "react";
import { useLocale } from "next-intl";
import { Button } from "@/components/ui";

/**
 * Unverified email blocks the fast Mandate path. One tap resends the link.
 */
export function EmailVerifyNudge() {
  const locale = useLocale();
  const he = locale === "he" || locale === "ar";
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState(false);

  async function resend() {
    setBusy(true);
    setErr(false);
    try {
      const res = await fetch(`/api/auth/verify-email?locale=${encodeURIComponent(locale)}`, {
        method: "PUT",
      });
      if (!res.ok) throw new Error("fail");
      setDone(true);
    } catch {
      setErr(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-[rgba(62,198,255,0.4)] bg-[rgba(62,198,255,0.08)] px-5 py-4 mb-5">
      <div className="font-extrabold text-[14.5px] text-[#3EC6FF]">
        {he ? "אמתו את המייל — שליחת Mandate בלחיצה אחת" : "Verify email — one-tap Mandate send"}
      </div>
      <p className="text-[13px] text-ink-soft leading-relaxed mt-1.5 mb-3">
        {he
          ? "בלי אימות מייל צריך קוד בעלות בכל תיק. אחרי אימות: אשר → שלח עם Mandate מיד."
          : "Without email verify you need ownership codes on every case. After verify: approve → send with Mandate immediately."}
      </p>
      <Button
        disabled={busy || done}
        className="!text-[13px] !py-2.5"
        onClick={() => void resend()}
      >
        {done
          ? he
            ? "נשלח — בדקו את המייל"
            : "Sent — check your inbox"
          : busy
            ? he
              ? "שולח…"
              : "Sending…"
            : he
              ? "שלח קישור אימות"
              : "Send verification link"}
      </Button>
      {err ? (
        <p className="text-[12px] text-amber mt-2 mb-0">
          {he ? "לא הצלחנו לשלוח. נסו שוב בעוד רגע." : "Could not send. Try again in a moment."}
        </p>
      ) : null}
    </div>
  );
}
