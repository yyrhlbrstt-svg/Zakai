import { Link } from "@/i18n/routing";
import { formatAgorot } from "@/lib/money";
import type { Locale } from "@/i18n/config";
import { bcp47 } from "@/i18n/config";

/**
 * Personal documented-savings portfolio — trust + switching cost.
 * Only real SavingsProof amounts (never estimates / self-reported).
 */
export function PersonalProofStrip({
  locale,
  documentedCount,
  documentedMonthlyAgorot,
  pendingFeeAgorot,
}: {
  locale: Locale;
  documentedCount: number;
  documentedMonthlyAgorot: number;
  pendingFeeAgorot: number;
}) {
  if (documentedCount <= 0 && pendingFeeAgorot <= 0) return null;
  const he = locale === "he" || locale === "ar";
  const loc = bcp47[locale];

  return (
    <div className="mb-6 rounded-2xl border border-[rgba(63,203,155,0.4)] bg-[rgba(63,203,155,0.08)] px-4 py-3.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <div className="text-[11px] font-extrabold uppercase tracking-wide text-emerald">
            {he ? "התיק המתועד שלכם" : "Your documented ledger"}
          </div>
          <div className="font-display text-[clamp(22px,4vw,28px)] grad-text leading-none mt-1">
            {documentedMonthlyAgorot > 0
              ? formatAgorot(documentedMonthlyAgorot, loc)
              : he
                ? "ממתין לחיסכון מתועד"
                : "Awaiting documented saving"}
          </div>
          <p className="text-[12.5px] text-ink-soft mt-1.5 mb-0">
            {he
              ? `${documentedCount} SavingsProof מתועדים · רק מספרים אמיתיים · עמלה רק אחרי תיעוד`
              : `${documentedCount} documented SavingsProofs · real numbers only · fee only after proof`}
          </p>
        </div>
        <div className="flex flex-col gap-1.5 items-stretch sm:items-end">
          {pendingFeeAgorot > 0 ? (
            <span className="text-[12.5px] font-extrabold text-emerald">
              {he
                ? `עמלה ממתינה · ${formatAgorot(pendingFeeAgorot, loc)}`
                : `Fee due · ${formatAgorot(pendingFeeAgorot, loc)}`}
            </span>
          ) : null}
          <Link href="/proofs" className="text-[12.5px] font-bold text-[#3EC6FF] no-underline">
            {he ? "קיר הוכחות ציבורי →" : "Public proofs wall →"}
          </Link>
        </div>
      </div>
    </div>
  );
}
