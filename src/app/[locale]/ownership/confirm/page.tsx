"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { Button, Card } from "@/components/ui";

/**
 * Landing page for ownership magic links emailed to the user.
 * Verifies the token, then deep-links back to the Case (and attempts
 * express dispatch when a session exists) so the loop does not restart
 * from a bare /dashboard list.
 */
export default function OwnershipConfirmPage() {
  const locale = useLocale();
  const he = locale === "he" || locale === "ar";
  const tIapp_locale_ownership_confirm_page = useTranslations(
    "inline_app_locale_ownership_confirm_page",
  );
  const params = useSearchParams();
  const token = params.get("token") || "";
  const [state, setState] = useState<"loading" | "ok" | "already" | "sent" | "error">("loading");
  const [caseId, setCaseId] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setState("error");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/ownership/magic?token=${encodeURIComponent(token)}`);
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          already?: boolean;
          caseId?: string;
        };
        if (cancelled) return;
        if (!data.ok && !data.already) {
          setState("error");
          return;
        }
        const id = data.caseId ?? null;
        setCaseId(id);
        if (id) {
          // Session may exist in the same browser — finish Mandate send if ready.
          try {
            const dispatch = await fetch(`/api/cases/${id}/dispatch`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({}),
            });
            if (dispatch.ok) {
              if (!cancelled) setState("sent");
              return;
            }
          } catch {
            /* fall through to dashboard deep-link */
          }
        }
        if (!cancelled) setState(data.already ? "already" : "ok");
      } catch {
        if (!cancelled) setState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const dashHref = caseId ? `/dashboard?case=${caseId}` : "/dashboard";

  const title =
    state === "loading"
      ? he
        ? "מאמת בעלות…"
        : "Verifying ownership…"
      : state === "sent"
        ? he
          ? "✓ נשלח לספק"
          : "✓ Sent to provider"
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
    state === "sent"
      ? he
        ? "ה־Mandate נשלח. בדשבורד אפשר לעקוב ולרשום SavingsProof כשיגיע מענה בכתב."
        : "Mandate sent. On the dashboard, follow up and record SavingsProof when you get a written reply."
      : state === "ok" || state === "already"
        ? he
          ? "המשך בתיק — שליחת Mandate לספק בלחיצה אחת."
          : "Continue on this case — one-tap Mandate send."
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
        {(state === "ok" ||
          state === "already" ||
          state === "sent" ||
          state === "error") && (
          <div className="mt-6">
            <Link href={dashHref}>
              <Button className="w-full">
                {state === "sent"
                  ? he
                    ? "לתיק בדשבורד"
                    : "Open case"
                  : tIapp_locale_ownership_confirm_page("t_8217c487")}
              </Button>
            </Link>
          </div>
        )}
      </Card>
    </main>
  );
}
