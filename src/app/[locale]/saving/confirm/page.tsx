"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale } from "next-intl";
import { Link } from "@/i18n/routing";
import { Button, Card } from "@/components/ui";
import { heEn } from "@/lib/heEn";

/**
 * Landing for inbound "confirm savings" magic links.
 * User click records SavingsProof — never auto-charge without this tap.
 */
export default function SavingConfirmPage() {
  const locale = useLocale();
  const he = locale === "he" || locale === "ar";
  const params = useSearchParams();
  const token = params.get("token") || "";
  const [state, setState] = useState<"loading" | "ok" | "already" | "error">("loading");
  const [caseId, setCaseId] = useState<string | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setState("error");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/saving/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          caseId?: string;
          alreadySettled?: boolean;
          checkoutUrl?: string;
        };
        if (cancelled) return;
        if (!res.ok || !data.ok) {
          setState("error");
          return;
        }
        setCaseId(data.caseId ?? null);
        if (data.checkoutUrl) setCheckoutUrl(data.checkoutUrl);
        setState(data.alreadySettled ? "already" : "ok");
      } catch {
        if (!cancelled) setState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <main className="min-h-[70vh] flex items-center justify-center px-4 py-10">
      <Card className="max-w-md w-full p-6">
        {state === "loading" ? (
          <p className="m-0 text-[14px] text-ink-soft">
            {heEn(he, "מאשרים את החיסכון…", "Confirming your saving…")}
          </p>
        ) : null}
        {state === "ok" || state === "already" ? (
          <>
            <h1 className="font-display text-[22px] m-0 mb-2">
              {state === "already"
                ? heEn(he, "החיסכון כבר מתועד", "Saving already recorded")
                : heEn(he, "✓ חיסכון מתועד", "✓ Saving recorded")}
            </h1>
            <p className="text-[13.5px] text-ink-soft leading-relaxed mb-4">
              {heEn(
                he,
                "אפשר לשלם עמלת הצלחה (אם יש) ולשתף — הכול ב״הכסף שלי״.",
                "You can pay the success fee (if due) and share — all in Money.",
              )}
            </p>
            <div className="flex flex-col gap-2">
              {checkoutUrl ? (
                <Button
                  className="w-full"
                  onClick={() => {
                    window.location.href = checkoutUrl;
                  }}
                >
                  {heEn(he, "לתשלום עמלת ההצלחה", "Pay success fee")}
                </Button>
              ) : null}
              <Link href={caseId ? `/money?case=${caseId}` : "/money"}>
                <Button variant={checkoutUrl ? "ghost" : undefined} className="w-full">
                  {heEn(he, "להכסף שלי", "Open Money")}
                </Button>
              </Link>
            </div>
          </>
        ) : null}
        {state === "error" ? (
          <>
            <h1 className="font-display text-[22px] m-0 mb-2">
              {heEn(he, "הקישור לא תקף", "Link is not valid")}
            </h1>
            <p className="text-[13.5px] text-ink-soft mb-4">
              {heEn(
                he,
                "בקשו קישור חדש דרך ״הכסף שלי״ או העבירו שוב את מייל הספק.",
                "Request a new link from Money, or forward the provider email again.",
              )}
            </p>
            <Link href="/money">
              <Button className="w-full">{heEn(he, "להכסף שלי", "Open Money")}</Button>
            </Link>
          </>
        ) : null}
      </Card>
    </main>
  );
}
