import { Card } from "@/components/ui";
import { Link } from "@/i18n/routing";
import { loadMonopolyReport } from "@/lib/services/monopolyReport";
import { heEn } from "@/lib/heEn";

/**
 * Monopoly execution board — P0 + rails + pipe tier from real counters.
 */
export async function MonopolyMissionControl({ locale }: { locale: string }) {
  const he = locale === "he" || locale === "ar";
  const report = await loadMonopolyReport();
  const { monopolyLoop: loop, pipe, rails, infrastructureScore, smtpConfigured } = report;
  const p0 = loop.p0;

  const tierLabel =
    pipe.gravity_tier === "network"
      ? he
        ? "רשת"
        : "network"
      : pipe.gravity_tier === "gravity"
        ? he
          ? "כבידה"
          : "gravity"
        : pipe.gravity_tier === "signal"
          ? he
            ? "סיגנל"
            : "signal"
          : he
            ? "ריק"
            : "empty";

  return (
    <Card className="p-5 mb-6 border-[rgba(240,138,107,0.4)] bg-[rgba(240,138,107,0.05)]">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
        <h2 className="font-extrabold text-[15px] m-0">
          {heEn(he, "מכונת מונופול", "Monopoly machine")}
        </h2>
        <span className="font-mono text-[12px] text-ink-soft" dir="ltr">
          rails={infrastructureScore}/100 · pipe={tierLabel}
          {!smtpConfigured ? " · SMTP=off" : ""}
        </span>
      </div>
      <p className="text-body text-ink-soft leading-relaxed m-0 mb-4">
        {he ? loop.thesisHe : loop.thesisEn}
      </p>

      <div className="rounded-xl border border-[rgba(63,203,155,0.3)] bg-[rgba(0,0,0,0.18)] px-4 py-3 mb-4">
        <div className="text-[11px] font-bold text-emerald mb-2">
          {he
            ? loop.irreversibilityReady
              ? "שלושת התנאים — מוכנים (תשתית אפשרית)"
              : "שלושת התנאים — עדיין לא בלתי־הפיכים"
            : loop.irreversibilityReady
              ? "Three conditions — met (infrastructure possible)"
              : "Three conditions — not yet irreversible"}
        </div>
        <ul className="list-none p-0 m-0 flex flex-col gap-2.5">
          {loop.irreversibility.map((c) => (
            <li key={c.id} className="text-[12.5px] leading-snug">
              <span className={c.met ? "text-emerald font-extrabold" : "text-[#F08A6B] font-extrabold"}>
                {c.met ? "✓" : "○"}{" "}
              </span>
              <span className="font-bold">{he ? c.titleHe : c.titleEn}</span>
              <span className="block text-[11.5px] text-ink-soft font-mono mt-0.5" dir="ltr">
                {he ? c.meterHe : c.meterEn}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-xl border border-[rgba(240,138,107,0.45)] bg-[rgba(0,0,0,0.22)] px-4 py-3 mb-4">
        <div className="text-[11px] font-bold text-[#F08A6B] mb-1">
          {heEn(he, "P0 עכשיו", "P0 now")}
        </div>
        <div className="font-extrabold text-[15px] mb-1">
          {he ? p0.titleHe : p0.titleEn}
        </div>
        <p className="text-[12.5px] text-ink-soft m-0 leading-relaxed">
          {he ? p0.whyHe : p0.whyEn}
        </p>
        {p0.href ? (
          <p className="mt-2 mb-0 text-[12.5px]">
            {p0.href.startsWith("/api/") ? (
              <a href={p0.href} className="text-emerald font-bold no-underline" rel="noopener noreferrer">
                {p0.href} →
              </a>
            ) : (
              <Link href={p0.href} className="text-emerald font-bold no-underline">
                {p0.href} →
              </Link>
            )}
          </p>
        ) : null}
      </div>

      <ul className="list-none p-0 m-0 mb-4 flex flex-col gap-2">
        {loop.moves
          .filter((m) => m.id !== "hold_phase_d")
          .slice(0, 4)
          .map((m) => (
            <li
              key={m.id}
              className="text-[12.5px] leading-snug border-b border-[rgba(255,255,255,0.06)] pb-2 last:border-0"
            >
              <span className="font-bold">{he ? m.titleHe : m.titleEn}</span>
              {m.blocksMonopoly ? (
                <span className="text-[#F08A6B] font-bold ms-2 text-[11px]">
                  {heEn(he, "חוסם", "blocks")}
                </span>
              ) : null}
            </li>
          ))}
      </ul>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
        {rails.map((r) => (
          <div
            key={r.id}
            className="rounded-lg border border-[rgba(255,255,255,0.08)] px-2.5 py-2"
            title={r.winCondition}
          >
            <div className="text-[10px] text-ink-soft font-mono truncate" dir="ltr">
              {r.id}
            </div>
            <div className="font-extrabold text-[14px] tabular-nums" dir="ltr">
              {r.score}
            </div>
            <div className="text-[10px] text-ink-soft">{r.maturity}</div>
          </div>
        ))}
      </div>

      <p className="text-[11px] text-ink-soft m-0 leading-relaxed">
        {he ? loop.disclaimerHe : loop.disclaimerEn}{" "}
        <a
          href="/api/network/monopoly"
          className="text-emerald font-mono no-underline"
          rel="noopener noreferrer"
        >
          /api/network/monopoly
        </a>
      </p>
    </Card>
  );
}
