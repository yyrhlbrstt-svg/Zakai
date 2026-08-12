import type { FitTier, InstitutionFitHypothesis } from "@/lib/institutionBankFit";

export function InstitutionBankFitPanel({
  title,
  disclaimer,
  band,
  tierLabels,
  rows,
}: {
  title: string;
  disclaimer: string;
  band: string;
  tierLabels: Record<FitTier, string>;
  rows: { id: string; name: string; why: string; tier: FitTier }[];
}) {
  return (
    <section className="mt-12 mb-8 rounded-2xl border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.02)] p-6">
      <h2 className="font-display text-xl m-0 mb-2">{title}</h2>
      <p className="text-body text-ink-soft leading-relaxed m-0 mb-4">{disclaimer}</p>
      <ul className="list-none p-0 m-0 flex flex-col gap-3">
        {rows.map((row) => (
          <li
            key={row.id}
            className="rounded-xl border border-[rgba(255,255,255,0.08)] px-4 py-3.5"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-extrabold text-[14.5px]">{row.name}</span>
              <span className="text-[11px] font-bold uppercase tracking-wide text-emerald">
                {tierLabels[row.tier]}
              </span>
            </div>
            <p className="text-body text-ink-soft mt-1.5 mb-0 leading-relaxed">{row.why}</p>
          </li>
        ))}
      </ul>
      <p className="text-[12px] text-ink-soft mt-5 mb-0 leading-relaxed border-t border-[rgba(255,255,255,0.08)] pt-4">
        {band}
      </p>
    </section>
  );
}
