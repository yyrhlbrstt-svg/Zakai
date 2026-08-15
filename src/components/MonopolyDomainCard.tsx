import { Card } from "@/components/ui";
import { Link } from "@/i18n/routing";
import type { ZakaiDomainDef } from "@/lib/protocol/domains";

export function MonopolyDomainCard({
  domain,
  tryItLabel,
  endpointsLabel,
  institutionHref,
  institutionLabel,
  developersHref,
  developersLabel,
}: {
  domain: ZakaiDomainDef;
  tryItLabel: string;
  endpointsLabel: string;
  institutionHref: string;
  institutionLabel: string;
  developersHref: string;
  developersLabel: string;
}) {
  const entries = Object.entries(domain.endpoints);
  return (
    <Card className="p-5 flex flex-col h-full">
      <div className="flex justify-between gap-2 mb-2">
        <h2 className="text-[16px] font-extrabold m-0">{domain.name}</h2>
        <span className="text-[10px] uppercase font-bold text-emerald shrink-0">{domain.status}</span>
      </div>
      <p className="text-body text-ink-soft m-0 mb-2">{domain.tagline}</p>
      <p className="text-[11.5px] text-ink-soft/80 m-0 mb-3 leading-relaxed flex-1">{domain.honesty}</p>
      <div className="text-[11px] font-extrabold text-ink-soft mb-1.5">{endpointsLabel}</div>
      <ul className="m-0 p-0 list-none flex flex-col gap-1 mb-3 max-h-28 overflow-auto">
        {entries.map(([key, url]) => (
          <li key={key}>
            <a
              href={url}
              className="text-[10.5px] font-mono text-emerald/90 no-underline hover:underline break-all"
              rel="noopener noreferrer"
            >
              {key}
            </a>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-3 mt-auto pt-2 border-t border-[rgba(255,255,255,0.06)]">
        {domain.reference_routes?.[0] && (
          <Link href={domain.reference_routes[0]} className="text-body font-bold text-emerald no-underline">
            {tryItLabel}
          </Link>
        )}
        <Link href={institutionHref} className="text-[12.5px] font-bold text-ink-soft no-underline hover:text-emerald">
          {institutionLabel}
        </Link>
        <Link href={developersHref} className="text-[12.5px] font-bold text-ink-soft no-underline hover:text-emerald">
          {developersLabel}
        </Link>
      </div>
    </Card>
  );
}
