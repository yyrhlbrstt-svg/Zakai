"use client";

import { useState } from "react";
import { useLocale } from "next-intl";
import { Link } from "@/i18n/routing";
import { Button, Input, Textarea, FieldError } from "@/components/ui";

/**
 * Self-serve first. There is no call-center team — promising a callback is a lie.
 * The user gets concrete next steps in-app immediately; phone is optional only
 * if they want a human later when capacity exists.
 */

type Action = { href: string; labelHe: string; labelEn: string };

const PLAYBOOK: Record<string, { headlineHe: string; headlineEn: string; actions: Action[] }> = {
  "mortgage-insurance": {
    headlineHe: "מה אפשר לעשות עכשיו — בלי לחכות לאף אחד",
    headlineEn: "What you can do now — no waiting",
    actions: [
      { href: "/duplicate-insurance", labelHe: "בדוק ביטוח כפול (מיידי)", labelEn: "Check duplicate cover now" },
      { href: "/mortgage", labelHe: "חשב מחזור משכנתא", labelEn: "Mortgage refinance calculator" },
      { href: "/assistant", labelHe: "בקש מהסוכן ניסוח פנייה לחברת הביטוח", labelEn: "Ask the agent to draft the insurer letter" },
      { href: "/check", labelHe: "התחל בדיקת חיוב / משא ומתן", labelEn: "Start a bill check / negotiation" },
    ],
  },
  "construction-defects": {
    headlineHe: "מה אפשר לעשות עכשיו",
    headlineEn: "What you can do now",
    actions: [
      { href: "/assistant", labelHe: "נסח מכתב ליזם / קבלן עם הסוכן", labelEn: "Draft a letter to the developer" },
      { href: "/what-am-i-owed", labelHe: "בדוק זכויות נוספות", labelEn: "Check other rights" },
    ],
  },
  "car-value": {
    headlineHe: "מה אפשר לעשות עכשיו",
    headlineEn: "What you can do now",
    actions: [
      { href: "/assistant", labelHe: "נסח ערעור לירידת ערך מול הביטוח", labelEn: "Draft diminished-value appeal" },
      { href: "/compensation-claims", labelHe: "מסלולי פיצוי נוספים", labelEn: "More compensation paths" },
    ],
  },
  general: {
    headlineHe: "מה אפשר לעשות עכשיו בזכאי",
    headlineEn: "What you can do in Zakai now",
    actions: [
      { href: "/money", labelHe: "ראה מה יורד לך כל חודש", labelEn: "See monthly charges" },
      { href: "/check", labelHe: "בדוק חשבון והורד מחיר", labelEn: "Check a bill and lower the price" },
      { href: "/assistant", labelHe: "שאל את הסוכן מה כדאי",
        labelEn: "Ask the agent what to do" },
      { href: "/what-am-i-owed", labelHe: "מה מגיע לי", labelEn: "What am I owed" },
    ],
  },
};

function book(vertical: string) {
  return PLAYBOOK[vertical] || PLAYBOOK.general;
}

export function LeadForm({ vertical, title }: { vertical: string; title?: string }) {
  const locale = useLocale();
  const he = locale === "he" || locale === "ar";
  const pb = book(vertical);
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [err, setErr] = useState(false);
  const [showContact, setShowContact] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name") || "").trim();
    const phone = String(fd.get("phone") || "").trim();
    if (name.length < 1 || phone.length < 6) {
      setErr(true);
      return;
    }
    setErr(false);
    setState("sending");
    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vertical, name, phone, note: String(fd.get("note") || "") }),
      });
      setState(res.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-2xl border border-[rgba(63,203,155,0.35)] bg-[rgba(63,203,155,0.07)] p-5 sm:p-6">
        <div className="font-extrabold text-[16.5px]">
          {title || (he ? pb.headlineHe : pb.headlineEn)}
        </div>
        <p className="text-ink-soft text-[13.5px] mt-1.5 leading-relaxed">
          {he
            ? "אין צוות שחוזר בטלפון. זכאי נותן תשובה ופעולה כאן — כולל ניסוח פנייה והורדת מחיר במסלול הבדיקה."
            : "There is no call-back team. Zakai answers and acts here — including drafting outreach and price negotiation in the check flow."}
        </p>
        <div className="flex flex-col gap-2.5 mt-4">
          {pb.actions.map((a) => (
            <Link key={a.href} href={a.href} className="no-underline">
              <Button className="w-full !justify-start">{he ? a.labelHe : a.labelEn}</Button>
            </Link>
          ))}
        </div>
      </div>

      {!showContact && state !== "done" && (
        <button
          type="button"
          onClick={() => setShowContact(true)}
          className="bg-transparent border-0 text-ink-soft text-[13px] font-bold cursor-pointer underline-offset-2 hover:text-emerald"
        >
          {he ? "רוצה שנשמור פרטים ליצירת קשר בעתיד? (אופציונלי)" : "Optionally leave contact for later (not required)"}
        </button>
      )}

      {showContact && state !== "done" && (
        <form
          onSubmit={onSubmit}
          className="rounded-2xl border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)] p-5"
        >
          <div className="font-extrabold text-[15px]">
            {he ? "פרטי קשר (לא חובה כדי להתחיל)" : "Contact (not required to start)"}
          </div>
          <div className="text-ink-soft text-[12.5px] mt-1 mb-3 leading-relaxed">
            {he
              ? "לא מבטיחים שיחה חזרה. הפרטים נשמרים אם בעתיד יהיה מעקב אנושי."
              : "No promised callback. Stored only if human follow-up becomes available."}
          </div>
          <div className="flex flex-col gap-3">
            <Input name="name" placeholder={he ? "שם מלא" : "Full name"} autoComplete="name" maxLength={120} />
            <Input
              name="phone"
              type="tel"
              inputMode="tel"
              placeholder={he ? "טלפון" : "Phone"}
              autoComplete="tel"
              maxLength={40}
            />
            <Textarea
              name="note"
              rows={3}
              placeholder={he ? "פרטים על המקרה (לא חובה)" : "Case details (optional)"}
              maxLength={1000}
            />
          </div>
          {err && (
            <FieldError>{he ? "נא למלא שם וטלפון" : "Name and phone required"}</FieldError>
          )}
          <Button type="submit" disabled={state === "sending"} className="w-full mt-4" variant="ghost">
            {state === "sending"
              ? he
                ? "שולח…"
                : "Sending…"
              : he
                ? "שמור פרטים"
                : "Save contact"}
          </Button>
          {state === "error" && (
            <FieldError>{he ? "שגיאה — נסה שוב" : "Error — try again"}</FieldError>
          )}
        </form>
      )}

      {state === "done" && (
        <div className="rounded-2xl border border-[rgba(63,203,155,0.4)] bg-[rgba(63,203,155,0.07)] p-6 text-center">
          <div className="font-display text-xl">{he ? "נשמר" : "Saved"}</div>
          <div className="text-ink-soft text-[14px] mt-2">
            {he
              ? "בינתיים — תמשיך בכלים למעלה. זו הדרך לקבל תוצאה בלי לחכות."
              : "Meanwhile use the tools above — that is how you get a result without waiting."}
          </div>
        </div>
      )}
    </div>
  );
}
