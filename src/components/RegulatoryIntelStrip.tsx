import { Link } from "@/i18n/routing";
import { SITE_URL } from "@/lib/seo";

export function RegulatoryIntelStrip({
  title,
  body,
  snapshotCta,
  pressureCta,
  networkCta,
}: {
  title: string;
  body: string;
  snapshotCta: string;
  pressureCta: string;
  networkCta: string;
}) {
  const base = SITE_URL.replace(/\/+$/, "");
  return (
    <div className="rounded-2xl border border-[rgba(63,203,155,0.35)] bg-[rgba(63,203,155,0.06)] p-5 mb-8">
      <h2 className="text-[16px] font-extrabold m-0 mb-2">{title}</h2>
      <p className="text-[13.5px] text-ink-soft leading-relaxed m-0 mb-4">{body}</p>
      <div className="flex flex-wrap gap-3 text-[13px] font-bold">
        <a
          href={`${base}/api/regulatory/snapshot?market=IL`}
          className="text-emerald no-underline"
          rel="noopener noreferrer"
        >
          {snapshotCta}
        </a>
        <a
          href={`${base}/api/institution/inbound-pressure`}
          className="text-ink-soft no-underline hover:text-emerald"
          rel="noopener noreferrer"
        >
          {pressureCta}
        </a>
        <Link href="/network-proof" className="text-ink-soft no-underline hover:text-emerald">
          {networkCta}
        </Link>
      </div>
    </div>
  );
}
