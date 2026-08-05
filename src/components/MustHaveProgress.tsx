"use client";

import { useEffect, useState } from "react";
import { Link } from "@/i18n/routing";
import { Card } from "@/components/ui";
import {
  STARTER_PACK,
  mustHavePageCopy,
  mustHaveToolCost,
  mustHaveToolTitle,
  type MustHaveTool,
} from "@/lib/monopoly/mustHaveKit";

const STORAGE_KEY = "zakai_must_have_v1";

function loadDone(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function saveDone(set: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
  } catch {
    /* private mode */
  }
}

export function MustHaveProgress({ locale }: { locale: string }) {
  const c = mustHavePageCopy(locale);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setDone(loadDone());
    setReady(true);
  }, []);

  function toggle(tool: MustHaveTool) {
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(tool.href)) next.delete(tool.href);
      else next.add(tool.href);
      saveDone(next);
      return next;
    });
  }

  const n = STARTER_PACK.filter((t) => done.has(t.href)).length;

  return (
    <Card className="p-5 mb-10 border border-[rgba(63,203,155,0.35)] bg-[rgba(63,203,155,0.06)]">
      <div className="font-extrabold text-[15px] mb-1">
        {c.progressTitle(ready ? String(n) : "—", STARTER_PACK.length)}
      </div>
      <p className="text-[12.5px] text-ink-soft m-0 mb-4 leading-relaxed">{c.progressSub}</p>
      <ul className="m-0 p-0 list-none flex flex-col gap-2">
        {STARTER_PACK.map((tool) => {
          const checked = done.has(tool.href);
          return (
            <li key={tool.href} className="flex items-start gap-2.5 text-[13.5px]">
              <input
                type="checkbox"
                className="mt-1 accent-[#3FCB9B]"
                checked={checked}
                onChange={() => toggle(tool)}
                aria-label={mustHaveToolTitle(tool, locale)}
              />
              <div className="flex-1">
                <Link
                  href={tool.href}
                  className={`font-bold no-underline ${checked ? "text-ink-soft line-through" : "text-ink hover:text-emerald"}`}
                >
                  {mustHaveToolTitle(tool, locale)}
                </Link>
                <div className="text-[12px] text-ink-soft mt-0.5">
                  {mustHaveToolCost(tool, locale)}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      {n === STARTER_PACK.length ? (
        <p className="text-[13px] font-bold text-emerald mt-4 mb-0">{c.progressDone}</p>
      ) : null}
      <p className="text-[11.5px] text-ink-soft mt-3 mb-0">{c.installHint}</p>
    </Card>
  );
}
