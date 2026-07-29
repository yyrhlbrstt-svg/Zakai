"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Card, Input, Button } from "@/components/ui";
import { traceDormant, type DormantLead } from "@/lib/dormant/trace";
import { buildDormantLetter } from "@/lib/dormant/letters";
import type { DormantFacts } from "@/lib/dormant/sources";
import { SUBJECTS, signsOwnLetters, subjectProfile, type Subject } from "@/lib/dormant/forWhom";
import { OutcomeReport } from "@/components/OutcomeReport";

const FLAGS = [
  "changedBank",
  "hadStudyFund",
  "movedHome",
  "heldSecurities",
  "unreturnedDeposit",
  "workedAbroad",
  "preWarFamily",
] as const;

/**
 * Forgotten money, on screen.
 *
 * WHY THE HEADLINE IS A COUNT AND NOT A SUM
 *
 * Every other screen in this product can put a shekel figure at the top. This
 * one cannot honestly: a dormant account is nine shekels or ninety thousand,
 * and only the institution holding it can see which. So the number at the top
 * is how many bodies are under a duty to answer in writing — which is true,
 * checkable, and, unlike a guess, does not get quoted back at us later.
 *
 * WHY THE FIRST QUESTION IS HOW MANY JOBS
 *
 * Nobody can name the provident fund a former employer opened for them a decade
 * ago. Everybody knows roughly how many employers they have had, and that one
 * number expands into one demand per era. It is the highest-yield question in
 * the product per tap.
 */
export function DormantScreen() {
  const t = useTranslations("dormant");
  const [facts, setFacts] = useState<DormantFacts>({});
  const [started, setStarted] = useState(false);
  const [subject, setSubject] = useState<Subject>("self");

  const result = useMemo(() => traceDormant(facts), [facts]);
  const show = started && result.leads.length > 0;

  const chip = (active: boolean) =>
    `rounded-full px-4 py-2 text-[13px] font-bold cursor-pointer border transition-colors duration-200 ${
      active
        ? "bg-[rgba(63,203,155,0.14)] border-[rgba(63,203,155,0.5)] text-emerald"
        : "bg-[rgba(255,255,255,0.05)] border-[rgba(255,255,255,0.1)] text-ink-soft hover:border-[rgba(255,255,255,0.2)]"
    }`;

  return (
    <div>
      {/* Who this is for, before anything else.
          A share button asks somebody to advertise a money app, which almost
          nobody does — telling people you are chasing money you are owed is a
          status admission, and those with the most to claim are the least
          likely to make it. Doing it for a parent inverts that: a favour rather
          than a confession, one tap, possibly worth thousands. And the
          arithmetic agrees — forgotten money accumulates with job changes and
          house moves, so the person most likely to find something is the one
          least likely to install an app to look. */}
      <Card className="p-6 mb-5">
        <span className="text-[13px] text-ink-soft block mb-2">{t("forWhom")}</span>
        <div className="flex gap-2 flex-wrap" role="radiogroup" aria-label={t("forWhom")}>
          {SUBJECTS.map((sub) => (
            <button
              key={sub.id}
              type="button"
              role="radio"
              aria-checked={subject === sub.id}
              onClick={() => {
                setSubject(sub.id);
                setFacts((f) => ({
                  ...f,
                  // A suggestion, shown in the answer they can change. It is
                  // never used as an input on its own — a pre-filled guess that
                  // silently became an answer would be a guess in an answer's
                  // clothes.
                  pastEmployers: subjectProfile(sub.id)!.suggestedEmployers,
                  deceasedRelative: sub.id === "deceased",
                }));
                setStarted(true);
              }}
              className={chip(subject === sub.id)}
            >
              {t(`subjects.${sub.id}`)}
            </button>
          ))}
        </div>

        {/* Stated in the open, not in a disclaimer nobody reads. A demand
            arriving over a living parent's name without their knowledge is
            forgery however kindly meant. */}
        {!signsOwnLetters(subject) && (
          <p className="text-[12.5px] text-[#f0b45c] mt-3 mb-0 leading-relaxed">
            {t("theySign")}
          </p>
        )}
      </Card>

      <Card className="p-6">
        <span className="text-[13px] text-ink-soft block mb-2">
          {signsOwnLetters(subject) && subject === "self" ? t("jobsQuestion") : t("jobsQuestionOther")}
        </span>
        <div className="flex gap-2 flex-wrap" role="radiogroup" aria-label={t("jobsQuestion")}>
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={facts.pastEmployers === n}
              onClick={() => {
                setFacts((f) => ({ ...f, pastEmployers: n }));
                setStarted(true);
              }}
              className={chip(facts.pastEmployers === n)}
            >
              {n === 6 ? "6+" : n}
            </button>
          ))}
        </div>
        <p className="text-[11.5px] text-ink-soft mt-2 mb-0 leading-relaxed">{t("jobsWhy")}</p>
      </Card>

      {show && (
        <>
          <Card className="mt-5 p-6 border-[rgba(63,203,155,0.4)] bg-[rgba(63,203,155,0.06)]">
            <div className="font-display text-3xl" dir="ltr">
              {result.institutionCount}
            </div>
            <p className="text-[14px] font-extrabold m-0 mt-1 mb-1.5">{t("countTitle")}</p>
            <p className="text-ink-soft text-[13px] m-0 leading-relaxed">{t("countSub")}</p>
          </Card>

          <Card className="mt-5 p-6">
            <span className="text-[13px] text-ink-soft block mb-2">{t("moreTitle")}</span>
            <div className="flex gap-2 flex-wrap">
              {FLAGS.map((f) => (
                <button
                  key={f}
                  type="button"
                  aria-pressed={facts[f] === true}
                  onClick={() => setFacts((p) => ({ ...p, [f]: !p[f] }))}
                  className={chip(facts[f] === true)}
                >
                  {t(`facts.${f}`)}
                </button>
              ))}
            </div>

            {/* Separated, and phrased as a fact about institutions rather than
                about the person's family. Somebody who has just lost a parent
                should not meet this as a marketing prompt. */}
            <div className="mt-5 pt-5 border-t border-[rgba(255,255,255,0.08)]">
              <p className="text-[12.5px] m-0 mb-2 leading-relaxed">{t("heirIntro")}</p>
              <button
                type="button"
                aria-pressed={facts.deceasedRelative === true}
                onClick={() => setFacts((p) => ({ ...p, deceasedRelative: !p.deceasedRelative }))}
                className={chip(facts.deceasedRelative === true)}
              >
                {t("facts.deceasedRelative")}
              </button>
            </div>
          </Card>

          <div className="mt-6">
            <h2 className="text-[15px] font-extrabold mb-3">{t("lettersTitle")}</h2>
            <Card className="py-1">
              {result.leads.map((lead, i, arr) => (
                <div
                  key={`${lead.source.id}:${lead.employerIndex ?? 0}`}
                  className="px-5 py-3.5"
                  style={{
                    borderBottom:
                      i < arr.length - 1 ? "1px solid rgba(255,255,255,0.08)" : "none",
                  }}
                >
                  <LeadRow lead={lead} />
                </div>
              ))}
            </Card>
          </div>

          <p className="mt-6 text-[11.5px] text-ink-soft leading-relaxed">{t("disclaimer")}</p>
        </>
      )}
    </div>
  );
}

function LeadRow({ lead }: { lead: DormantLead }) {
  const t = useTranslations("dormant");
  const tc = useTranslations("claim");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [letter, setLetter] = useState<{ subject: string; body: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const set = (k: string, v: string) => {
    setFields((f) => ({ ...f, [k]: v }));
    setLetter(null);
  };

  const text = (key: string, max = 80) => (
    <label key={key} className="block">
      <span className="text-[12px] text-ink-soft block mb-1">{t(`fields.${key}`)}</span>
      <Input value={fields[key] ?? ""} onChange={(e) => set(key, e.target.value)} maxLength={max} />
    </label>
  );

  async function copy() {
    if (!letter) return;
    try {
      await navigator.clipboard.writeText(`${letter.subject}\n\n${letter.body}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Selectable on screen already.
    }
  }

  const title = lead.employerIndex
    ? t(`sources.${lead.source.id}`) + ` — ${t("era", { n: lead.employerIndex })}`
    : t(`sources.${lead.source.id}`);

  return (
    <details>
      <summary className="cursor-pointer flex items-center gap-3 flex-wrap list-none">
        <span className="font-extrabold text-[14.5px] flex-1 basis-[200px]">{title}</span>
        {lead.as === "heir" && (
          <span className="text-[11px] font-extrabold text-[#f0b45c] bg-[rgba(240,180,92,0.1)] border border-[rgba(240,180,92,0.3)] rounded-full px-2.5 py-1">
            {t("heirBadge")}
          </span>
        )}
      </summary>

      <div className="mt-3 rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-4">
        <p className="text-[12.5px] m-0 mb-2 leading-relaxed">{lead.source.whyYou}</p>
        <p className="text-[11.5px] text-ink-soft m-0 mb-1 leading-relaxed">
          <span className="font-extrabold">{t("needs")}: </span>
          {lead.source.needs.join(" · ")}
        </p>
        <p className="text-[11.5px] text-ink-soft m-0 mb-3 leading-relaxed">
          <span className="font-extrabold">{t("duty")}: </span>
          {lead.source.duty}
        </p>

        <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))]">
          {text("name")}
          {text("id", 20)}
          {text("counterparty")}
          {lead.employerIndex !== null && text("employer")}
          {lead.employerIndex !== null && text("period", 24)}
          {lead.as === "heir" && text("deceasedName")}
          {lead.as === "heir" && text("deceasedId", 20)}
          {lead.as === "heir" && text("relationship", 30)}
        </div>

        <Button className="mt-3.5" onClick={() => setLetter(buildDormantLetter(lead, fields))}>
          {t("generate")}
        </Button>

        {letter && (
          <div className="mt-4">
            <div className="text-[13px] font-extrabold mb-2">{letter.subject}</div>
            <pre className="whitespace-pre-wrap font-sans text-[13px] leading-relaxed bg-[rgba(0,0,0,0.25)] rounded-xl p-4 m-0 max-h-80 overflow-auto">
              {letter.body}
            </pre>
            <div className="mt-3 flex gap-2 flex-wrap">
              <Button onClick={copy}>{copied ? tc("copied") : tc("copy")}</Button>
              <Button variant="ghost" onClick={() => window.print()}>
                {tc("print")}
              </Button>
            </div>
            {/* Directly under the letter, because the moment somebody knows the
                answer is when they open the reply — not when they next log in
                to a summary screen. */}
            <OutcomeReport
              vertical="dormant"
              counterparty={lead.source.holder}
              variantId={lead.source.id}
            />
          </div>
        )}
      </div>
    </details>
  );
}
