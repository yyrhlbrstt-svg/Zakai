"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { Card, Input, Button } from "@/components/ui";
import { VEHICLE_DISCLOSURE, buildDisclosureDemand } from "@/lib/prepurchase/vehicle";
import { withFooter } from "@/lib/letterFooter";

/**
 * Before you buy, rather than after you lost it.
 *
 * The list is open by default and the letter sits under it. That ordering is
 * the whole design: somebody reading this is standing next to a car with a
 * seller waiting, and the useful thing in that moment is knowing what to ask
 * and what a refusal means — not a form to fill in first.
 *
 * The letter matters for the case where they are not standing there yet, which
 * is the case where it still costs nothing to walk away.
 *
 * WHY isIsraeli GATES THE WHOLE THING
 *
 * Every `demand`/`why`/`ifRefused` string in VEHICLE_DISCLOSURE is written
 * once, in Hebrew, against a named Israeli statute — there is no per-locale
 * version of that content, only a translated title and labels around it. A
 * non-Israeli visitor used to get exactly that: an English page title over
 * eight paragraphs of untranslated Hebrew legal text and a letter citing a law
 * that does not apply to them. Silently machine-translating a demand letter
 * that quotes a statute would risk stating a legal claim that is not true
 * where they live, which this codebase does not do. Following the same
 * pattern as PotentialTotal, an honest "this one is Israel-specific" note
 * beats either of those.
 */
export function VehicleCheckScreen({ isIsraeli = true }: { isIsraeli?: boolean }) {
  const t = useTranslations("vehicleCheck");
  const tc = useTranslations("claim");
  const tp = useTranslations("potential");
  const [plate, setPlate] = useState("");
  const [buyerName, setBuyerName] = useState("");
  const [buyerId, setBuyerId] = useState("");
  const [sellerName, setSellerName] = useState("");
  const [letter, setLetter] = useState<{ subject: string; body: string } | null>(null);
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!letter) return;
    try {
      await navigator.clipboard.writeText(`${letter.subject}\n\n${letter.body}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // On screen and selectable already.
    }
  }

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
      <Card className="p-6 mb-5 border-[rgba(240,180,92,0.4)] bg-[rgba(240,180,92,0.06)]">
        <p className="text-[14px] font-extrabold m-0 mb-1.5">{t("statuteTitle")}</p>
        <p className="text-ink-soft text-[13px] m-0 leading-relaxed">{t("statuteSub")}</p>
      </Card>

      <h2 className="text-[15px] font-extrabold mb-3">{t("listTitle")}</h2>
      <Card className="py-1 mb-6">
        {VEHICLE_DISCLOSURE.map((d, i, arr) => (
          <details
            key={d.id}
            className="px-5 py-3.5"
            style={{
              borderBottom: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.08)" : "none",
            }}
          >
            <summary className="cursor-pointer font-extrabold text-[14px] list-none">
              {i + 1}. {t(`items.${d.id}`)}
            </summary>
            <p className="text-[13px] mt-2 mb-2 leading-relaxed">{d.demand}</p>
            <p className="text-[12.5px] text-ink-soft m-0 mb-2 leading-relaxed">
              <span className="font-extrabold">{t("why")}: </span>
              {d.why}
            </p>
            {/* Refusal is information. The person is being pushed to close
                today, and this is the line that makes walking away legible. */}
            <p className="text-[12.5px] text-[#f0b45c] m-0 leading-relaxed">
              <span className="font-extrabold">{t("ifRefused")}: </span>
              {d.ifRefused}
            </p>
          </details>
        ))}
      </Card>

      <Card className="p-6">
        <p className="text-[14px] font-extrabold m-0 mb-3">{t("letterTitle")}</p>
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))]">
          <label className="block">
            <span className="text-[12px] text-ink-soft block mb-1">{t("plate")}</span>
            <Input value={plate} onChange={(e) => setPlate(e.target.value)} maxLength={20} dir="ltr" />
          </label>
          <label className="block">
            <span className="text-[12px] text-ink-soft block mb-1">{tc("fields.name")}</span>
            <Input value={buyerName} onChange={(e) => setBuyerName(e.target.value)} maxLength={80} />
          </label>
          <label className="block">
            <span className="text-[12px] text-ink-soft block mb-1">{tc("fields.id")}</span>
            <Input value={buyerId} onChange={(e) => setBuyerId(e.target.value)} maxLength={20} dir="ltr" />
          </label>
          <label className="block">
            <span className="text-[12px] text-ink-soft block mb-1">{t("seller")}</span>
            <Input value={sellerName} onChange={(e) => setSellerName(e.target.value)} maxLength={80} />
          </label>
        </div>

        <Button
          className="mt-3.5"
          onClick={() => {
            const l = buildDisclosureDemand({ plate, buyerName, buyerId, sellerName });
            setLetter({ ...l, body: withFooter(l.body, "he") });
          }}
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
          </div>
        )}
      </Card>

      <p className="mt-6 text-[11.5px] text-ink-soft leading-relaxed">{t("disclaimer")}</p>
    </div>
  );
}
