"use client";

import { useMemo, useState } from "react";
import { Link } from "@/i18n/routing";
import { entitlementSlug, IL_RIGHT_SLUGS } from "@/lib/rightsSeo";

type ItemCopy = { title?: string };

export function RightsGuideSearch({
  locale,
  titlesById,
  categoryLabels,
  idsByCategory,
}: {
  locale: string;
  titlesById: Record<string, string>;
  categoryLabels: Record<string, string>;
  idsByCategory: Record<string, string[]>;
}) {
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!needle) return null;
    const out: Array<{ id: string; title: string; cat: string }> = [];
    for (const [cat, ids] of Object.entries(idsByCategory)) {
      for (const id of ids) {
        const title = titlesById[id];
        if (!title) continue;
        if (title.toLowerCase().includes(needle) || id.includes(needle)) {
          out.push({ id, title, cat });
        }
      }
    }
    return out;
  }, [needle, idsByCategory, titlesById]);

  const placeholder =
    locale === "he" || locale === "ar"
      ? "חיפוש במדריך הזכויות…"
      : "Search rights guides…";

  return (
    <div className="mt-4 mb-6">
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.04)] px-4 py-2.5 text-[14px] text-ink"
        aria-label={placeholder}
      />
      {filtered && (
        <ul className="mt-3 m-0 p-0 list-none flex flex-col gap-1.5 max-h-64 overflow-auto">
          {filtered.length === 0 ? (
            <li className="text-body text-ink-soft">—</li>
          ) : (
            filtered.map(({ id, title, cat }) => (
              <li key={id}>
                <Link
                  href={`/rights/${entitlementSlug(id)}`}
                  className="text-[13.5px] text-ink-soft hover:text-emerald no-underline"
                >
                  <span className="text-[11px] text-emerald me-2">{categoryLabels[cat]}</span>
                  {title}
                </Link>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

/** Precomputed id list for static SEO guides section. */
export const RIGHTS_GUIDE_IDS = IL_RIGHT_SLUGS;
