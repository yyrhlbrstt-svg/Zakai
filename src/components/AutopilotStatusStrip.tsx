import { prisma } from "@/lib/prisma";
import { AUTOPILOT_JOBS } from "@/lib/autopilot/types";
import { SITE_URL } from "@/lib/seo";

export async function AutopilotStatusStrip({
  title,
  sub,
  manifestLabel,
  lastRunLabel,
  neverLabel,
}: {
  title: string;
  sub: string;
  manifestLabel: string;
  lastRunLabel: string;
  neverLabel: string;
}) {
  const rows = await Promise.all(
    AUTOPILOT_JOBS.map(async (j) => {
      const row = await prisma.autopilotRun
        .findFirst({
          where: { jobId: j.id },
          orderBy: { createdAt: "desc" },
          select: { ok: true, createdAt: true },
        })
        .catch(() => null);
      return { id: j.id, title: j.title, last: row };
    }),
  );

  return (
    <section className="border-t border-[rgba(255,255,255,0.08)] pt-10 mb-10">
      <h2 className="text-lg font-extrabold mb-2">{title}</h2>
      <p className="text-body text-ink-soft mb-4 max-w-[640px] leading-relaxed">{sub}</p>
      <ul className="grid gap-2 sm:grid-cols-2 mb-4 m-0 p-0 list-none">
        {rows.map((r) => (
          <li
            key={r.id}
            className="rounded-xl border border-[rgba(255,255,255,0.08)] px-4 py-3 text-[12.5px]"
          >
            <span className="font-bold">{r.title}</span>
            <span className="text-ink-soft block mt-0.5">
              {r.last
                ? lastRunLabel
                    .replace("{ok}", r.last.ok ? "ok" : "err")
                    .replace("{at}", r.last.createdAt.toISOString().slice(0, 10))
                : neverLabel}
            </span>
          </li>
        ))}
      </ul>
      <a
        href={`${SITE_URL}/.well-known/zakai-autopilot.json`}
        className="text-body font-bold text-emerald no-underline"
        rel="noopener noreferrer"
      >
        {manifestLabel} →
      </a>
    </section>
  );
}
