"use client";

import { useMemo, useState } from "react";
import { Link } from "@/i18n/routing";

export interface CompanyListItem {
  provider: string;
  displayName: string;
  sampleLabel: string;
  savedRateLabel: string;
  avgLabel: string;
  fairnessLabel?: string;
}

/**
 * `/companies` is meant to be checked *before* someone deals with a company,
 * not just after a complaint — so the entry point is a search box, the way
 * you'd look up a credit score or a review, not a browse-the-whole-list page.
 */
export function CompanySearch({
  items,
  placeholder,
  noResults,
}: {
  items: CompanyListItem[];
  placeholder: string;
  noResults: string;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => i.displayName.toLowerCase().includes(q));
  }, [items, query]);

  return (
    <div className="flex flex-col gap-4">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.04)] px-5 py-3.5 text-[15px] text-ink placeholder:text-ink-soft focus:outline-none focus:border-[rgba(63,203,155,0.5)] transition-colors"
      />

      {filtered.length === 0 ? (
        <p className="text-body text-ink-soft text-center py-6">{noResults}</p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {filtered.map((s) => (
            <Link
              key={s.provider}
              href={`/companies/${s.provider}`}
              className="flex items-center gap-4 flex-wrap rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] px-5 py-4 no-underline text-ink hover:border-[rgba(63,203,155,0.35)] transition-colors"
            >
              <div className="flex-1 basis-[160px] font-extrabold text-[15.5px]">{s.displayName}</div>
              <div className="text-body text-ink-soft">{s.sampleLabel}</div>
              <div className="text-body text-ink-soft">{s.savedRateLabel}</div>
              <div className="text-[14px] font-extrabold text-emerald">{s.avgLabel}</div>
              {s.fairnessLabel && (
                <div className="text-[12px] text-ink-soft w-full basis-full">{s.fairnessLabel}</div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
