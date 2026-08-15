"use client";

import { useState } from "react";
import { useLocale , useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { Button, Input, Textarea, FieldError } from "@/components/ui";

type Action = {
  href: string;
  labelHe: string;
  labelEn: string;
  /**
   * When set, the button's real destination is /assistant?ask=<this>, not
   * `href` — see the note above PLAYBOOK. Both languages required together:
   * an href with only one populated would silently drop the seed on a
   * locale switch.
   */
  askHe?: string;
  askEn?: string;
};

/**
 * A button labelled "Agent: draft insurer letter" that links to bare
 * `/assistant` isn't wrong exactly — the agent chat CAN draft that letter —
 * but it lands on an empty chat box with zero memory of which button was
 * clicked, so the user re-types the whole situation the label already
 * promised was understood. That gap ("I click something and it takes me
 * somewhere else entirely") is what real user feedback flagged. Every action
 * that names a SPECIFIC drafting task now carries `ask*`, which seeds and
 * auto-sends that exact request to the assistant (see assistant/page.tsx +
 * AssistantScreen.tsx). Actions that are honestly generic ("Ask the agent")
 * keep a bare href — there's nothing to seed.
 */
const PLAYBOOK: Record<string, { headlineHe: string; headlineEn: string; actions: Action[] }> = {
  "mortgage-insurance": {
    headlineHe: "ביטוח משכנתא — מה עושים עכשיו",
    headlineEn: "Mortgage insurance — act now",
    actions: [
      { href: "/duplicate-insurance", labelHe: "בדוק ביטוח כפול (מיידי)", labelEn: "Check duplicate cover" },
      { href: "/mortgage", labelHe: "מחשבון משכנתא", labelEn: "Mortgage calculator" },
      {
        href: "/assistant",
        labelHe: "הסוכן: נסח פנייה לחברת הביטוח",
        labelEn: "Agent: draft insurer letter",
        askHe: "יש לי ביטוח משכנתא שאני חושב שיקר או מיותר (כפול על ביטוח חיים קיים). תנסח לי פנייה לחברת הביטוח לבדיקת ביטול או הוזלה.",
        askEn: "I have mortgage insurance I think is overpriced or unnecessary (duplicates existing life insurance). Draft a letter to the insurer to check cancelling or lowering it.",
      },
      { href: "/check", labelHe: "בדיקת חיוב / משא ומתן", labelEn: "Bill check / negotiate" },
    ],
  },
  "debt-consolidation": {
    headlineHe: "איחוד הלוואות — מה עושים עכשיו",
    headlineEn: "Debt consolidation — act now",
    actions: [
      { href: "/money", labelHe: "מפה חיובים והלוואות (צילום בנק)", labelEn: "Map charges & loans (bank screenshot)" },
      { href: "/spending", labelHe: "לאן הכסף הולך", labelEn: "Where the money goes" },
      {
        href: "/assistant",
        labelHe: "הסוכן: איך מורידים ריבית",
        labelEn: "Agent: how to cut interest",
        askHe: "יש לי כמה הלוואות ו/או כרטיסי אשראי עם ריבית גבוהה. איך אני יכול להוריד את הריבית או לאחד אותן להלוואה אחת זולה יותר?",
        askEn: "I have several loans and/or credit cards with high interest. How can I lower the rate or consolidate them into one cheaper loan?",
      },
      { href: "/bank-fees", labelHe: "עמלות בנק — מכתב מוכן", labelEn: "Bank fees — ready letter" },
    ],
  },
  "compensation-claims": {
    headlineHe: "תביעות ביטוח — מה עושים עכשיו",
    headlineEn: "Insurance claims — act now",
    actions: [
      {
        href: "/assistant",
        labelHe: "הסוכן: נסח דרישה לחברת הביטוח",
        labelEn: "Agent: draft insurer demand",
        askHe: "יש לי תביעת ביטוח שלא הגשתי עדיין או שנדחתה. תעזור לי לנסח דרישה לחברת הביטוח.",
        askEn: "I have an insurance claim I haven't filed yet, or one that was denied. Help me draft a demand to the insurer.",
      },
      { href: "/what-am-i-owed", labelHe: "מה מגיע לי?", labelEn: "What am I owed?" },
      { href: "/lost-money", labelHe: "כסף אבוד / הר הביטוח", labelEn: "Lost money / insurance mountain" },
      { href: "/duplicate-insurance", labelHe: "בדוק כפל ביטוחי", labelEn: "Check duplicate cover" },
    ],
  },
  "insurance-compare": {
    headlineHe: "השוואת ביטוח — מה עושים עכשיו",
    headlineEn: "Insurance compare — act now",
    actions: [
      { href: "/duplicate-insurance", labelHe: "בדוק כפל ביטוחי (מיידי)", labelEn: "Check duplicate cover" },
      {
        href: "/assistant",
        labelHe: "הסוכן: איך משווים מחדש",
        labelEn: "Agent: how to re-shop",
        askHe: "אני משלם על כמה פוליסות ביטוח ולא בטוח שאני לא כפול. איך אני משווה בין החברות ומצמצם את מה שאני משלם?",
        askEn: "I pay for several insurance policies and I'm not sure I'm not doubled up. How do I compare providers and cut what I pay?",
      },
      { href: "/mortgage-insurance", labelHe: "ביטוח משכנתא מופקע", labelEn: "Overpriced mortgage insurance" },
      { href: "/money", labelHe: "הכסף שלי — מה יורד", labelEn: "My money — monthly charges" },
    ],
  },
  "construction-defects": {
    headlineHe: "ליקויי בנייה — מה עושים עכשיו",
    headlineEn: "Construction defects — act now",
    actions: [
      {
        href: "/assistant",
        labelHe: "נסח מכתב ליזם / קבלן",
        labelEn: "Draft letter to developer",
        askHe: "גיליתי ליקויי בנייה בדירה שלי. תעזור לי לנסח מכתב דרישה ליזם או לקבלן.",
        askEn: "I found construction defects in my apartment. Help me draft a demand letter to the developer or contractor.",
      },
      { href: "/what-am-i-owed", labelHe: "זכויות נוספות", labelEn: "Other rights" },
    ],
  },
  "car-value": {
    headlineHe: "ירידת ערך רכב — מה עושים עכשיו",
    headlineEn: "Car value — act now",
    actions: [
      {
        href: "/assistant",
        labelHe: "נסח ערעור מול הביטוח",
        labelEn: "Draft insurer appeal",
        askHe: "היה לי תאונה ואני חושב שהרכב שלי איבד ערך בגללה. תעזור לי לנסח ערעור מול חברת הביטוח.",
        askEn: "I had an accident and I think my car lost value because of it. Help me draft an appeal to the insurer.",
      },
      { href: "/compensation-claims", labelHe: "מסלולי פיצוי", labelEn: "Compensation paths" },
    ],
  },
  disability: {
    headlineHe: "קצבת נכות — מה עושים עכשיו",
    headlineEn: "Disability benefits — act now",
    actions: [
      { href: "/disability-benefits", labelHe: "סוגי קצבה ואיך מגישים", labelEn: "Benefit types & how to file" },
      { href: "/entitlements", labelHe: "זכויות נוספות שמגיעות לך", labelEn: "Other rights you're owed" },
      { href: "/assistant", labelHe: "שאל את הסוכן", labelEn: "Ask the agent" },
    ],
  },
  "class-action": {
    headlineHe: "תביעה ייצוגית — מה עושים עכשיו",
    headlineEn: "Class action — act now",
    actions: [
      { href: "/class-action", labelHe: "האם אתה נמנה עם התובענה", labelEn: "See if you're in scope" },
      { href: "/entitlements", labelHe: "זכויות נוספות שמגיעות לך", labelEn: "Other rights you're owed" },
    ],
  },
  "alimony-guarantee": {
    headlineHe: "מזונות מובטחים — מה עושים עכשיו",
    headlineEn: "Guaranteed alimony — act now",
    actions: [
      { href: "/alimony-guarantee", labelHe: "מי זכאי ואיך מגישים", labelEn: "Who's eligible & how to file" },
      { href: "/entitlements", labelHe: "זכויות נוספות שמגיעות לך", labelEn: "Other rights you're owed" },
      { href: "/assistant", labelHe: "שאל את הסוכן", labelEn: "Ask the agent" },
    ],
  },
  "business-compensation": {
    headlineHe: "פיצויי נזק עקיף — מה עושים עכשיו",
    headlineEn: "Business war-damage compensation — act now",
    actions: [
      { href: "/business-compensation", labelHe: "המסלולים ואיך מגישים השגה", labelEn: "Tracks & how to file an objection" },
      { href: "/entitlements", labelHe: "זכויות נוספות שמגיעות לך", labelEn: "Other rights you're owed" },
      { href: "/assistant", labelHe: "שאל את הסוכן", labelEn: "Ask the agent" },
    ],
  },
  "duplicate-insurance": {
    headlineHe: "ביטוח כפול — מה עושים עכשיו",
    headlineEn: "Duplicate insurance — act now",
    actions: [
      {
        href: "/assistant",
        labelHe: "הסוכן: נסח ביטול לביטוח המיותר",
        labelEn: "Agent: draft cancellation for the redundant policy",
        askHe: "יש לי כפל ביטוחי — משלם על שני ביטוחים שמכסים את אותו דבר. תעזור לי לנסח ביטול לפוליסה המיותרת.",
        askEn: "I have duplicate insurance coverage — paying for two policies covering the same thing. Help me draft a cancellation for the redundant one.",
      },
      { href: "/insurance-compare", labelHe: "השוואת ביטוח", labelEn: "Insurance compare" },
    ],
  },
  "bank-fees": {
    headlineHe: "עמלות בנק — מה עושים עכשיו",
    headlineEn: "Bank fees — act now",
    actions: [
      {
        href: "/assistant",
        labelHe: "הסוכן: נסח פנייה לבנק",
        labelEn: "Agent: draft letter to the bank",
        askHe: "יש לי עמלות בנק שנראות לי גבוהות מדי. תעזור לי לנסח פנייה לבנק לבדיקה והחזר.",
        askEn: "My bank fees look too high. Help me draft a letter to the bank to review and refund them.",
      },
      { href: "/check", labelHe: "בדיקת חיוב / משא ומתן", labelEn: "Bill check / negotiate" },
    ],
  },
  "pension-fees": {
    headlineHe: "דמי ניהול פנסיה — מה עושים עכשיו",
    headlineEn: "Pension fees — act now",
    actions: [
      {
        href: "/assistant",
        labelHe: "הסוכן: איך מורידים דמי ניהול",
        labelEn: "Agent: how to lower management fees",
        askHe: "אני חושב שדמי הניהול בקרן הפנסיה שלי גבוהים מדי. איך אני בודק ומוריד אותם?",
        askEn: "I think my pension fund's management fees are too high. How do I check and lower them?",
      },
      { href: "/entitlements", labelHe: "זכויות נוספות שמגיעות לך", labelEn: "Other rights you're owed" },
    ],
  },
  payslip: {
    headlineHe: "בדיקת תלוש שכר — מה עושים עכשיו",
    headlineEn: "Payslip check — act now",
    actions: [
      { href: "/severance", labelHe: "פיצויי פיטורים", labelEn: "Severance pay" },
      { href: "/assistant", labelHe: "שאל את הסוכן", labelEn: "Ask the agent" },
    ],
  },
  mortgage: {
    headlineHe: "מיחזור משכנתא — מה עושים עכשיו",
    headlineEn: "Mortgage refinance — act now",
    actions: [
      { href: "/mortgage-insurance", labelHe: "ביטוח משכנתא מופקע", labelEn: "Overpriced mortgage insurance" },
      { href: "/assistant", labelHe: "שאל את הסוכן", labelEn: "Ask the agent" },
    ],
  },
  taxrefund: {
    headlineHe: "החזר מס — מה עושים עכשיו",
    headlineEn: "Tax refund — act now",
    actions: [
      { href: "/advance-tax", labelHe: "הקטנת מקדמות מס", labelEn: "Reduce tax advances" },
      { href: "/assistant", labelHe: "שאל את הסוכן", labelEn: "Ask the agent" },
    ],
  },
  flights: {
    headlineHe: "פיצוי טיסה — מה עושים עכשיו",
    headlineEn: "Flight compensation — act now",
    actions: [
      { href: "/baggage", labelHe: "מזוודה שאבדה או התעכבה", labelEn: "Lost or delayed baggage" },
      { href: "/assistant", labelHe: "שאל את הסוכן", labelEn: "Ask the agent" },
    ],
  },
  severance: {
    headlineHe: "פיצויי פיטורים — מה עושים עכשיו",
    headlineEn: "Severance pay — act now",
    actions: [
      { href: "/unemployment", labelHe: "דמי אבטלה", labelEn: "Unemployment benefit" },
      { href: "/assistant", labelHe: "שאל את הסוכן", labelEn: "Ask the agent" },
    ],
  },
  arnona: {
    headlineHe: "הנחת ארנונה — מה עושים עכשיו",
    headlineEn: "Arnona discount — act now",
    actions: [
      { href: "/rights", labelHe: "כל הזכויות שמגיעות לך", labelEn: "All your rights, checked" },
      { href: "/assistant", labelHe: "שאל את הסוכן", labelEn: "Ask the agent" },
    ],
  },
  general: {
    headlineHe: "מה אפשר לעשות עכשיו בזכאי",
    headlineEn: "What you can do in Zakai now",
    actions: [
      { href: "/money", labelHe: "הכסף שלי — מה יורד כל חודש", labelEn: "My money — monthly charges" },
      { href: "/check", labelHe: "בדוק חשבון והורד מחיר", labelEn: "Check bill & lower price" },
      { href: "/cancel", labelHe: "בטל מנוי / בקש הנחה — הסוכן", labelEn: "Cancel / discount — agent" },
      { href: "/assistant", labelHe: "שאל את הסוכן", labelEn: "Ask the agent" },
    ],
  },
};

function book(vertical: string) {
  return PLAYBOOK[vertical] || PLAYBOOK.general;
}

export function LeadForm({ vertical }: { vertical: string; title?: string }) {
  const locale = useLocale();
  const he = locale === "he" || locale === "ar";
  const tIcomponents_LeadForm = useTranslations("inline_components_LeadForm");
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

  // The "general" playbook (no specific campaign/vertical tag) covers almost
  // the same ground as this page's own static button list above it — showing
  // both stacks two nearly-identical clusters of buttons on one screen, which
  // is exactly the kind of "too many choices, where do I even start" clutter
  // real user feedback flagged. A tagged vertical (e.g. ?v=mortgage-insurance)
  // still gets its own specific, non-duplicate action list.
  const showActionsCard = vertical !== "general";

  return (
    <div className="flex flex-col gap-5">
      {showActionsCard && (
        <div className="rounded-2xl border border-[rgba(63,203,155,0.35)] bg-[rgba(63,203,155,0.07)] p-5 sm:p-6">
          <div className="font-extrabold text-[16.5px]">{he ? pb.headlineHe : pb.headlineEn}</div>
          <p className="text-ink-soft text-[13.5px] mt-1.5 leading-relaxed">
            {tIcomponents_LeadForm("t_38bf6a70")}
          </p>
          <div className="flex flex-col gap-2.5 mt-4">
            {pb.actions.map((a) => {
              const ask = he ? a.askHe : a.askEn;
              const target = ask ? `/assistant?ask=${encodeURIComponent(ask)}` : a.href;
              return (
                <Link key={a.href + (ask ?? "")} href={target} className="no-underline">
                  <Button className="w-full !justify-start">{he ? a.labelHe : a.labelEn}</Button>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {!showContact && state !== "done" && (
        <button
          type="button"
          onClick={() => setShowContact(true)}
          className="bg-transparent border-0 text-ink-soft text-body font-bold cursor-pointer"
        >
          {tIcomponents_LeadForm("t_99e05b72")}
        </button>
      )}

      {showContact && state !== "done" && (
        <form
          onSubmit={onSubmit}
          className="rounded-2xl border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)] p-5"
        >
          <div className="font-extrabold text-[15px]">
            {tIcomponents_LeadForm("t_0a6f83fb")}
          </div>
          <div className="flex flex-col gap-3 mt-3">
            <Input name="name" placeholder={tIcomponents_LeadForm("t_cbdaff61")} autoComplete="name" maxLength={120} />
            <Input name="phone" type="tel" inputMode="tel" placeholder={tIcomponents_LeadForm("t_737232c2")} autoComplete="tel" maxLength={40} />
            <Textarea name="note" rows={3} placeholder={tIcomponents_LeadForm("t_35c9a071")} maxLength={1000} />
          </div>
          {err && <FieldError>{tIcomponents_LeadForm("t_e4eb04d6")}</FieldError>}
          <Button type="submit" disabled={state === "sending"} className="w-full mt-4" variant="ghost">
            {state === "sending" ? (he ? "שולח…" : "Sending…") : he ? "שמור" : "Save"}
          </Button>
          {state === "error" && <FieldError>{tIcomponents_LeadForm("t_e4cb6506")}</FieldError>}
        </form>
      )}

      {state === "done" && (
        <div className="rounded-2xl border border-[rgba(63,203,155,0.4)] bg-[rgba(63,203,155,0.07)] p-6 text-center">
          <div className="font-display text-xl">{tIcomponents_LeadForm("t_dd1b93c4")}</div>
          <div className="text-ink-soft text-[14px] mt-2">
            {tIcomponents_LeadForm("t_0f3bf18e")}
          </div>
        </div>
      )}
    </div>
  );
}
