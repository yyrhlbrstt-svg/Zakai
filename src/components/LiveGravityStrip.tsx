import { Link } from "@/i18n/routing";
import { formatAgorot } from "@/lib/money";

export type LiveGravityStripProps = {
  localeBcp47: string;
  verifiedMinor: number;
  verifiedCount: number;
  sentCount: number;
  mandateCount: number;
  labels: {
    title: string;
    sent: string;
    mandates: string;
    proofs: string;
    empty: string;
    ledger: string;
  };
};

/**
 * Honest public counters — zeros are shown, never invented.
 * Gravity only compounds when these numbers are real and visible.
 */
export function LiveGravityStrip({
  localeBcp47,
  verifiedMinor,
  verifiedCount,
  sentCount,
  mandateCount,
  labels,
}: LiveGravityStripProps) {
  const hasProof = verifiedCount > 0 && verifiedMinor > 0;

  return (
    <section
      className="rounded-2xl border border-[rgba(63,203,155,0.28)] bg-[rgba(63,203,155,0.06)] px-5 py-5"
      aria-label={labels.title}
    >
      <div className="text-[12px] font-extrabold text-emerald tracking-wide mb-3">
        {labels.title}
      </div>
      <div className="grid grid-cols-3 gap-3 text-center">
        <div>
          <div className="font-display text-[clamp(22px,5vw,30px)] leading-none tabular-nums">
            {sentCount}
          </div>
          <div className="text-[11px] text-ink-soft mt-1.5 leading-tight">{labels.sent}</div>
        </div>
        <div>
          <div className="font-display text-[clamp(22px,5vw,30px)] leading-none tabular-nums">
            {mandateCount}
          </div>
          <div className="text-[11px] text-ink-soft mt-1.5 leading-tight">{labels.mandates}</div>
        </div>
        <div>
          <div className="font-display grad-text text-[clamp(22px,5vw,30px)] leading-none tabular-nums">
            {hasProof ? formatAgorot(verifiedMinor, localeBcp47) : "0"}
          </div>
          <div className="text-[11px] text-ink-soft mt-1.5 leading-tight">
            {/* Already interpolated by next-intl at the call site. Doing it
                here with a manual replace left the {count} placeholder
                unfilled at t(), which next-intl reported as a FORMATTING_ERROR
                on every render in all six locales. */}
            {hasProof ? labels.proofs : labels.empty}
          </div>
        </div>
      </div>
      <div className="mt-4 text-center">
        <Link
          href="/network-proof"
          className="text-body font-extrabold text-emerald no-underline hover:underline"
        >
          {labels.ledger}
        </Link>
      </div>
    </section>
  );
}
