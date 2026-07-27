"use client";

import { useState } from "react";
import { useLocale } from "next-intl";
import { Link } from "@/i18n/routing";
import { Button, Input, Textarea, FieldError } from "@/components/ui";

type Action = { href: string; labelHe: string; labelEn: string };

const PLAYBOOK: Record<string, { headlineHe: string; headlineEn: string; actions: Action[] }> = {
  "mortgage-insurance": {
    headlineHe: "ביטוח משכנתא — מה עושים עכשיו",
    headlineEn: "Mortgage insurance — act now",
    actions: [
      { href: "/duplicate-insurance", labelHe: "בדוק ביטוח כפול (מיידי)", labelEn: "Check duplicate cover" },
      { href: "/mortgage", labelHe: "מחשבון משכנתא", labelEn: "Mortgage calculator" },
      { href: "/assistant", labelHe: "הסוכן: נסח פנייה לחברת הביטוח", labelEn: "Agent: draft insurer letter" },
      { href: "/check", labelHe: "בדיקת חיוב / משא ומתן", labelEn: "Bill check / negotiate" },
    ],
  },
  "construction-defects": {
    headlineHe: "ליקויי בנייה — מה עושים עכשיו",
    headlineEn: "Construction defects — act now",
    actions: [
      { href: "/assistant", labelHe: "נסח מכתב ליזם / קבלן", labelEn: "Draft letter to developer" },
      { href: "/what-am-i-owed", labelHe: "זכויות נוספות", labelEn: "Other rights" },
    ],
  },
  "car-value": {
    headlineHe: "ירידת ערך רכב — מה עושים עכשיו",
    headlineEn: "Car value — act now",
    actions: [
      { href: "/assistant", labelHe: "נסח ערעור מול הביטוח", labelEn: "Draft insurer appeal" },
      { href: "/compensation-claims", labelHe: "מסלולי פיצוי", labelEn: "Compensation paths" },
    ],
  },
  general: {
    headlineHe: "מה אפשר לעשות עכשיו בזכאי",
    headlineEn: "What you can do in Zakai now",
    actions: [
      { href: "/money", labelHe: "הכסף שלי — מה יורד כל חודש", labelEn: "My money — monthly charges" },
      { href: "/check", labelHe: "בדוק חשבון והורד מחיר", labelEn: "Check bill & lower price" },
      { href: "/assistant", labelHe: "שאל את הסוכן", labelEn: "Ask the agent" },
      { href: "/what-am-i-owed", labelHe: "מה מגיע לי", labelEn: "What am I owed" },
    ],
  },
};

function book(vertical: string) {
  return PLAYBOOK[vertical] || PLAYBOOK.general;
}

export function LeadForm({ vertical }: { vertical: string; title?: string }) {
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
        <div className="font-extrabold text-[16.5px]">{he ? pb.headlineHe : pb.headlineEn}</div>
        <p className="text-ink-soft text-[13.5px] mt-1.5 leading-relaxed">
          {he
            ? "אין צוות שחוזר בטלפון. לוחצים על כפתור — מקבלים פעולה מיידית בתוך זכאי."
            : "No call-back team. Tap a button — act inside Zakai now."}
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
          className="bg-transparent border-0 text-ink-soft text-[13px] font-bold cursor-pointer"
        >
          {he ? "שמירת פרטים לעתיד (אופציונלי — לא חובה)" : "Optional contact for later (not required)"}
        </button>
      )}

      {showContact && state !== "done" && (
        <form
          onSubmit={onSubmit}
          className="rounded-2xl border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)] p-5"
        >
          <div className="font-extrabold text-[15px]">
            {he ? "פרטים (לא מבטיחים שיחה חזרה)" : "Details (no promised callback)"}
          </div>
          <div className="flex flex-col gap-3 mt-3">
            <Input name="name" placeholder={he ? "שם מלא" : "Full name"} autoComplete="name" maxLength={120} />
            <Input name="phone" type="tel" inputMode="tel" placeholder={he ? "טלפון" : "Phone"} autoComplete="tel" maxLength={40} />
            <Textarea name="note" rows={3} placeholder={he ? "פרטים (לא חובה)" : "Notes (optional)"} maxLength={1000} />
          </div>
          {err && <FieldError>{he ? "נא למלא שם וטלפון" : "Name and phone required"}</FieldError>}
          <Button type="submit" disabled={state === "sending"} className="w-full mt-4" variant="ghost">
            {state === "sending" ? (he ? "שולח…" : "Sending…") : he ? "שמור" : "Save"}
          </Button>
          {state === "error" && <FieldError>{he ? "שגיאה" : "Error"}</FieldError>}
        </form>
      )}

      {state === "done" && (
        <div className="rounded-2xl border border-[rgba(63,203,155,0.4)] bg-[rgba(63,203,155,0.07)] p-6 text-center">
          <div className="font-display text-xl">{he ? "נשמר" : "Saved"}</div>
          <div className="text-ink-soft text-[14px] mt-2">
            {he ? "המשך בכלים למעלה — שם מקבלים תוצאה." : "Continue with the tools above."}
          </div>
        </div>
      )}
    </div>
  );
}
