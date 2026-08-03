import { Card } from "@/components/ui";
import { loadPipeNetworkVolume } from "@/lib/pipe/loadPipeNetwork";
import { formatAgorot } from "@/lib/money";

/**
 * Live de-identified pipe scoreboard — empty is honest.
 */
export async function PipeNetworkLive({
  locale,
  bcp47,
}: {
  locale: string;
  bcp47: string;
}) {
  const he = locale === "he" || locale === "ar";
  const n = await loadPipeNetworkVolume();

  const tierLabel =
    n.gravity_tier === "network"
      ? he
        ? "רשת"
        : "network"
      : n.gravity_tier === "gravity"
        ? he
          ? "כבידה"
          : "gravity"
        : n.gravity_tier === "signal"
          ? he
            ? "סיגנל"
            : "signal"
          : he
            ? "ריק (כנה)"
            : "empty (honest)";

  return (
    <Card className="p-5 mb-6 border-[rgba(63,203,155,0.35)]">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
        <h2 className="font-extrabold text-[15px] m-0">
          {he ? "נפח הצינור (חי)" : "Pipe volume (live)"}
        </h2>
        <span className="font-mono text-[12.5px] text-emerald" dir="ltr">
          gravity_tier={tierLabel}
        </span>
      </div>
      <p className="text-[13px] text-ink-soft leading-relaxed m-0 mb-4">
        {he ? n.gravity_note_he : n.gravity_note}
      </p>
      <ul className="list-none p-0 m-0 grid grid-cols-2 sm:grid-cols-4 gap-3 text-[13px]">
        <Stat label={he ? "Mandates" : "Mandates"} value={String(n.mandatesIssued)} />
        <Stat label={he ? "SENT+" : "SENT+"} value={String(n.casesSent)} />
        <Stat label={he ? "SavingsProofs" : "Proofs"} value={String(n.savingsProofs)} />
        <Stat
          label={he ? "מתועד/חודש" : "Documented/mo"}
          value={formatAgorot(n.verifiedRecoveredMinor, bcp47)}
        />
      </ul>
      <p className="text-[11px] text-ink-soft mt-3 mb-0 leading-relaxed">
        {he
          ? "אגרגטים בלבד, בלי זהות. ריק = עוד אין נפח — לא מספר שיווקי."
          : "Aggregates only, no identities. Empty = no volume yet — not a marketing number."}
      </p>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <li className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(0,0,0,0.2)] px-3 py-2.5">
      <div className="text-[11px] text-ink-soft font-bold">{label}</div>
      <div className="font-extrabold text-[16px] mt-0.5 font-mono" dir="ltr">
        {value}
      </div>
    </li>
  );
}
