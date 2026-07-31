"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { Card, Input, Button, Textarea, RadioChips } from "@/components/ui";
import { matchCovers } from "@/lib/incident/match";
import { buildIncidentLetter } from "@/lib/incident/letters";
import type { CoverMatch } from "@/lib/incident/match";
import type { IncidentKind, IncidentFacts } from "@/lib/incident/sources";
import { OutcomeReport } from "@/components/OutcomeReport";

const KINDS: IncidentKind[] = [
  "sport",
  "work",
  "commute",
  "road",
  "school",
  "home",
  "military",
  "abroad",
  "medical",
];

const EXTRAS = [
  "minor",
  "employed",
  "hasPension",
  "registeredAthlete",
  "vehicleInvolved",
  "lostWorkDays",
  "neededTreatment",
  "hasSupplementaryHealth",
] as const;

/**
 * "Something happened to me" → every payer at once.
 *
 * WHY THE RESULT COMES BEFORE THE QUESTIONS
 *
 * One tap on what happened is enough to name real payers, so that is what the
 * first tap does. The refinements sit underneath the answer, where a person can
 * see what each one is for. The opposite order — nine questions, then a result —
 * is the intake form every claims company already uses, and it is the reason
 * people abandon them.
 *
 * WHY NO SHEKEL FIGURE APPEARS ANYWHERE
 *
 * Every sum in this category is a function of a disability percentage that a
 * doctor has not yet assessed. A confident number here would be the most
 * damaging thing the product could print, and the one most likely to be
 * repeated back to us later.
 *
 * WHY isIsraeli GATES THE WHOLE THING
 *
 * Every source in incident/sources.ts — basis, whoHasIt, needs, statute — is
 * written once, in Hebrew, against a named Israeli statute (Bituach Leumi,
 * the Road Accident Victims Compensation Law, and the rest). There is no
 * per-locale version of that content, only a translated kind label around it.
 * A non-Israeli visitor got exactly that: an English page title over
 * untranslated Hebrew cover descriptions and a letter citing a law that does
 * not apply to them. Same fix as VehicleCheckScreen and for the same reason —
 * machine-translating text that quotes a specific statute risks stating a
 * legal claim untrue where the visitor actually lives.
 */
export function IncidentScreen({ isIsraeli = true }: { isIsraeli?: boolean }) {
  const t = useTranslations("incident");
  const tp = useTranslations("potential");
  const [kind, setKind] = useState<IncidentKind | null>(null);
  const [when, setWhen] = useState("");
  const [facts, setFacts] = useState<Partial<IncidentFacts>>({});

  const occurredAt = useMemo(() => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(when)) return undefined;
    const d = new Date(`${when}T00:00:00Z`);
    return Number.isNaN(d.getTime()) ? undefined : d;
  }, [when]);

  const result = useMemo(() => {
    if (!kind) return null;
    return matchCovers({ ...facts, kind, occurredAt });
  }, [kind, facts, occurredAt]);

  const chip = (active: boolean) =>
    `rounded-full px-4 py-2 text-[13px] font-bold cursor-pointer border transition-colors duration-200 ${
      active
        ? "bg-[rgba(63,203,155,0.14)] border-[rgba(63,203,155,0.5)] text-emerald"
        : "bg-[rgba(255,255,255,0.05)] border-[rgba(255,255,255,0.1)] text-ink-soft hover:border-[rgba(255,255,255,0.2)]"
    }`;

  if (!isIsraeli) {
    return (
      <Card className="p-6 text-center">
        <p className="text-ink-soft text-[14px] leading-relaxed mb-4">{tp("notIsraelNote")}</p>
        <Link href="/rights">
          <Button>{tp("notIsraelCta")}</Button>
        </Link>
      </Card>
    );
  }

  return (
    <div>
      <Card className="p-6">
        <span className="text-[13px] text-ink-soft block mb-2">{t("whatHappened")}</span>
        <RadioChips
          value={kind ?? ""}
          onChange={(k) => setKind(k as IncidentKind)}
          ariaLabel={t("whatHappened")}
          options={KINDS.map((k) => ({ value: k, label: t(`kinds.${k}`) }))}
        />
      </Card>

      {result && (
        <>
          {/* The sentence that changes behaviour. People stop at the first
              payer believing the rest are now closed to them. */}
          {result.stackableCount > 1 && (
            <Card className="mt-5 p-6 border-[rgba(63,203,155,0.4)] bg-[rgba(63,203,155,0.06)]">
              <p className="text-[14px] font-extrabold m-0 mb-1.5">
                {t("stackTitle", { count: result.stackableCount })}
              </p>
              <p className="text-ink-soft text-[13px] m-0 leading-relaxed">{t("stackSub")}</p>
            </Card>
          )}

          <Card className="mt-5 p-6">
            <span className="text-[13px] text-ink-soft block mb-2">{t("whenHappened")}</span>
            <Input
              type="date"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
              dir="ltr"
              className="max-w-[220px]"
            />
            <p className="text-[11.5px] text-ink-soft mt-2 mb-4 leading-relaxed">{t("whenWhy")}</p>

            <span className="text-[13px] text-ink-soft block mb-2">{t("moreTitle")}</span>
            <div className="flex gap-2 flex-wrap">
              {EXTRAS.map((f) => (
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
          </Card>

          <div className="mt-6">
            <h2 className="text-[15px] font-extrabold mb-3">
              {t("resultTitle", { count: result.matches.length })}
            </h2>
            <Card className="py-1">
              {result.matches.map((m, i, arr) => (
                <div
                  key={m.source.id}
                  className="px-5 py-3.5"
                  style={{
                    borderBottom:
                      i < arr.length - 1 ? "1px solid rgba(255,255,255,0.08)" : "none",
                  }}
                >
                  <CoverRow match={m} occurredAt={occurredAt} />
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

function CoverRow({ match, occurredAt }: { match: CoverMatch; occurredAt?: Date }) {
  const t = useTranslations("incident");
  const tc = useTranslations("claim");
  const [letter, setLetter] = useState<{ subject: string; body: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [name, setName] = useState("");
  const [id, setId] = useState("");
  const [counterparty, setCounterparty] = useState("");
  const [what, setWhat] = useState("");

  const badge =
    match.urgency === "expired"
      ? { text: t("urgency.expired"), tone: "rgba(255,255,255,0.35)" }
      : match.daysLeft !== null
        ? {
            text: t("urgency.daysLeft", { days: match.daysLeft }),
            tone: match.urgency === "critical" ? "#f0b45c" : "rgba(255,255,255,0.55)",
          }
        : {
            text: t("urgency.window", { months: match.source.claimWindowMonths ?? 0 }),
            tone: "rgba(255,255,255,0.45)",
          };

  async function copy() {
    if (!letter) return;
    try {
      await navigator.clipboard.writeText(`${letter.subject}\n\n${letter.body}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Selectable on screen already; a blocked clipboard is not worth an alert.
    }
  }

  return (
    <details>
      <summary className="cursor-pointer flex items-center gap-3 flex-wrap list-none">
        <span className="font-extrabold text-[14.5px] flex-1 basis-[200px]">
          {t(`sources.${match.source.id}`)}
        </span>
        {match.stacks && (
          <span className="text-[11px] font-extrabold text-emerald bg-[rgba(63,203,155,0.1)] border border-[rgba(63,203,155,0.3)] rounded-full px-2.5 py-1">
            {t("stacksBadge")}
          </span>
        )}
        <span className="text-[11.5px] font-extrabold" style={{ color: badge.tone }}>
          {badge.text}
        </span>
      </summary>

      <div className="mt-3 rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-4">
        <p className="text-[12.5px] m-0 mb-2 leading-relaxed">{match.source.whoHasIt}</p>
        <p className="text-[12px] text-ink-soft m-0 mb-2 leading-relaxed">
          <span className="font-extrabold">{t("basis")}: </span>
          {match.source.basis}
        </p>
        <p className="text-[11.5px] text-ink-soft m-0 mb-1 leading-relaxed">
          <span className="font-extrabold">{t("needs")}: </span>
          {match.source.needs.join(" · ")}
        </p>
        <p className="text-[11.5px] text-ink-soft m-0 mb-3 leading-relaxed">
          <span className="font-extrabold">{t("statute")}: </span>
          {match.source.statute}
        </p>

        <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))]">
          <label className="block">
            <span className="text-[12px] text-ink-soft block mb-1">{tc("fields.name")}</span>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
          </label>
          <label className="block">
            <span className="text-[12px] text-ink-soft block mb-1">{tc("fields.id")}</span>
            <Input value={id} onChange={(e) => setId(e.target.value)} maxLength={20} dir="ltr" />
          </label>
          <label className="block">
            <span className="text-[12px] text-ink-soft block mb-1">{t("counterparty")}</span>
            <Input
              value={counterparty}
              onChange={(e) => setCounterparty(e.target.value)}
              maxLength={80}
            />
          </label>
        </div>
        <label className="block mt-3">
          <span className="text-[12px] text-ink-soft block mb-1">{t("describe")}</span>
          <Textarea
            value={what}
            onChange={(e) => setWhat(e.target.value)}
            maxLength={400}
            rows={3}
          />
        </label>

        <Button
          className="mt-3.5"
          onClick={() =>
            setLetter(
              buildIncidentLetter(match.source, {
                name: name || undefined,
                id: id || undefined,
                counterparty: counterparty || undefined,
                what: what || undefined,
                occurredAt,
              }),
            )
          }
        >
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
            {/* The moat is built here, not in the letter.
                Four surfaces generate letters and only one of them fed the
                outcome graph, so three quarters of the events that could teach
                us something produced nothing. A letter is a commodity — anybody
                can draft one. Knowing which wording this counterparty actually
                pays is the asset, and it only exists if the report sits where
                the reply arrives. */}
            <OutcomeReport
              vertical="incident"
              counterparty={match.source.payer}
              variantId={match.source.id}
            />
          </div>
        )}
      </div>
    </details>
  );
}
