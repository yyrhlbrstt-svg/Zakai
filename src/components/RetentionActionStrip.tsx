"use client";

import { Link } from "@/i18n/routing";
import { Card } from "@/components/ui";
import {
  retentionCopy,
  retentionStripTitle,
  type RetentionSignal,
} from "@/lib/monopoly/retentionEngine";

export function RetentionActionStrip({
  locale,
  actions,
}: {
  locale: string;
  actions: RetentionSignal[];
}) {
  if (actions.length === 0) return null;
  return (
    <Card className="p-5 mb-6 border border-[rgba(63,203,155,0.3)] bg-[rgba(63,203,155,0.06)]">
      <div className="text-[12px] font-extrabold text-emerald uppercase tracking-wide mb-3">
        {retentionStripTitle(locale)}
      </div>
      <ul className="m-0 p-0 list-none flex flex-col gap-2.5">
        {actions.map((a) => (
          <li key={a.reasonKey + a.href}>
            <Link
              href={a.href}
              className="text-[14px] font-bold text-ink no-underline hover:text-emerald"
            >
              {retentionCopy(locale, a.reasonKey)}
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
