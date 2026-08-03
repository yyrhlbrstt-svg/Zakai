import type { LoopVolumeSnapshot } from "@/lib/services/loopVolume";
import { heEn } from "@/lib/heEn";

function fmtPct(n: number | null): string {
  return n === null ? "—" : `${n}%`;
}

/**
 * Founder/ops instrument: Mandates sent, SavingsProofs, completion by vertical.
 * No vanity metrics.
 */
export function LoopVolumePanel({
  snap,
  locale,
}: {
  snap: LoopVolumeSnapshot;
  locale: string;
}) {
  const he = locale === "he" || locale === "ar";

  const smtpOff = !snap.smtpConfigured;

  return (
    <section
      className={`rounded-2xl border px-5 py-5 mb-6 ${
        smtpOff
          ? "border-[rgba(240,138,107,0.45)] bg-[rgba(240,138,107,0.07)]"
          : "border-[rgba(63,203,155,0.45)] bg-[rgba(63,203,155,0.07)]"
      }`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
        <h2 className="font-display text-xl m-0">
          {heEn(he, "נפח לולאה — המספרים היחידים", "Loop volume — the only numbers")}
        </h2>
        <span className="text-[11.5px] text-ink-soft font-bold">
          {heEn(he, "פנימי · בלי vanity", "Internal · no vanity")}
        </span>
      </div>
      <p className="text-[13px] text-ink-soft mt-0 mb-4 leading-relaxed">
        {he
          ? "Mandates שנשלחו · SavingsProof מתועד · אחוז השלמה לוורטיקל. הערכות self-reported לא נספרות."
          : "Mandates sent · documented SavingsProof · completion per vertical. Self-reported estimates do not count."}
      </p>

      {smtpOff && (
        <p className="text-[12.5px] text-[#F08A6B] font-bold mb-4 leading-relaxed">
          {he
            ? "⚠ SMTP לא מלא (HOST+USER+PASS) — HOST לבד לא מספיק. SENT+ כאן = סטטוס באפליקציה, לא מייל לספק."
            : "⚠ SMTP incomplete (HOST+USER+PASS) — HOST alone is not enough. SENT+ here = in-app status, not mail to the provider."}
        </p>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
        <Metric
          label={heEn(he, "תיקים שנשלחו (SENT+)", "Cases sent (SENT+)")}
          value={String(snap.mandatesSent)}
          sub={
            he
              ? `Mandates פעילים ${snap.mandatesActive} · הונפקו 7י׳ ${snap.mandatesIssued7d}`
              : `ACTIVE Mandates ${snap.mandatesActive} · issued 7d ${snap.mandatesIssued7d}`
          }
          hero
        />
        <Metric
          label={heEn(he, "SavingsProof מתועד", "SavingsProofs recorded")}
          value={String(snap.proofsDocumented)}
          sub={heEn(he, `7 ימים: ${snap.proofsDocumented7d}`, `last 7d: ${snap.proofsDocumented7d}`)}
          hero
        />
        <Metric
          label={heEn(he, "השלמה SENT+ → Proof", "Completion SENT+ → Proof")}
          value={fmtPct(snap.overallProofRatePct)}
          sub={
            he
              ? `שליחה מפתיחה: ${fmtPct(snap.overallSendRatePct)} · ממתין ל־Proof: ${snap.sentWaitingProof}`
              : `open→sent: ${fmtPct(snap.overallSendRatePct)} · waiting proof: ${snap.sentWaitingProof}`
          }
          hero
        />
      </div>

      <h3 className="text-[13px] font-extrabold text-ink-soft uppercase tracking-wide m-0 mb-2">
        {heEn(he, "השלמה לפי וורטיקל ראשי", "Completion by main vertical")}
      </h3>
      <div className="rounded-xl border border-[rgba(255,255,255,0.08)] overflow-hidden bg-[rgba(0,0,0,0.15)]">
        <div
          className="grid gap-2 px-3 py-2 text-[11px] font-bold text-ink-soft border-b border-[rgba(255,255,255,0.07)]"
          style={{ gridTemplateColumns: "1.4fr repeat(5, minmax(0, 1fr))" }}
        >
          <span>{heEn(he, "מסלול", "Vertical")}</span>
          <span className="text-end">{heEn(he, "נפתחו", "Opened")}</span>
          <span className="text-end">SENT+</span>
          <span className="text-end">Proof</span>
          <span className="text-end">{heEn(he, "→שליחה", "→send")}</span>
          <span className="text-end">{heEn(he, "→Proof", "→Proof")}</span>
        </div>
        {snap.byVertical.map((v) => (
          <div
            key={v.id}
            className="grid gap-2 px-3 py-2.5 text-[13px] border-t border-[rgba(255,255,255,0.06)] items-center"
            style={{ gridTemplateColumns: "1.4fr repeat(5, minmax(0, 1fr))" }}
          >
            <span className="font-bold truncate">{he ? v.labelHe : v.labelEn}</span>
            <span className="text-end tabular-nums text-ink-soft">{v.opened}</span>
            <span className="text-end tabular-nums font-extrabold">{v.mandatesSent}</span>
            <span className="text-end tabular-nums font-extrabold text-emerald">
              {v.proofsDocumented}
            </span>
            <span className="text-end tabular-nums text-ink-soft">{fmtPct(v.sendRatePct)}</span>
            <span className="text-end tabular-nums font-extrabold text-emerald">
              {fmtPct(v.proofRatePct)}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function Metric({
  label,
  value,
  sub,
  hero,
}: {
  label: string;
  value: string;
  sub?: string;
  hero?: boolean;
}) {
  return (
    <div className="rounded-xl border border-[rgba(255,255,255,0.1)] bg-[rgba(6,12,18,0.55)] px-3.5 py-3">
      <div className="text-[11.5px] text-ink-soft font-bold leading-snug">{label}</div>
      <div
        className={`tabular-nums mt-1 ${
          hero ? "font-display grad-text text-[clamp(28px,5vw,36px)] leading-none" : "font-extrabold text-2xl"
        }`}
      >
        {value}
      </div>
      {sub ? <div className="text-[11px] text-ink-soft mt-1.5 leading-snug">{sub}</div> : null}
    </div>
  );
}
