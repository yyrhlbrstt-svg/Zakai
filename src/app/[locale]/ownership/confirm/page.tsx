"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale } from "next-intl";
import { Link } from "@/i18n/routing";
import { Button, Card } from "@/components/ui";

/**
 * Landing page for ownership magic links emailed to the user.
 * Verifies the token client-side against the API, then routes to dashboard.
 */
export default function OwnershipConfirmPage() {
  const locale = useLocale();
  const he = locale === "he" || locale === "ar";
  const params = useSearchParams();
  const token = params.get("token") || "";
  const [state, setState] = useState<"loading" | "ok" | "already" | "error">("loading");

  useEffect(() => {
    if (!token) {
      setState("error");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/ownership/magic?token=${encodeURIComponent(token)}`);
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (data.ok || data.already) setState(data.already ? "already" : "ok");
        else setState("error");
      } catch {
        if (!cancelled) setState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const title =
    state === "loading"
      ? he
        ? "מאמת בעלות…"
        : "Verifying ownership…"
      : state === "ok"
        ? he
          ? "✓ הבעלות אומתה"
          : "✓ Ownership verified"
        : state === "already"
          ? he
            ? "הבעלות כבר אומתה"
            : "Already verified"
          : he
            ? "הקישור לא תקף"
            : "Link invalid or expired";

  const sub =
    state === "ok" || state === "already"
      ? he
        ? "אפשר להמשיך בדשבורד ליצירת Mandate ושליחה לספק."
        : "Continue on the dashboard to create the Mandate and send."
      : state === "loading"
        ? he
          ? "רגע אחד."
          : "One moment."
        : he
          ? "בקש/י קישור חדש מהדשבורד (שלח קוד לנייד / מייל)."
          : "Request a new link from the dashboard.";

  return (
    <main className="max-w-[480px] mx-auto px-5 pb-20 pt-10">
      <Card className="p-8 text-center">
        <div className="font-display text-2xl">{title}</div>
        <p className="text-ink-soft text-[14px] mt-3 leading-relaxed">{sub}</p>
        {(state === "ok" || state === "already" || state === "error") && (
          <div className="mt-6">
            <Link href="/dashboard">
              <Button className="w-full">{he ? "לדשבורד" : "Dashboard"}</Button>
            </Link>
          </div>
        )}
      </Card>
    </main>
  );
}
