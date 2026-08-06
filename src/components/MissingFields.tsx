"use client";

import { useTranslations } from "next-intl";

export type Requirement = { ok: boolean; label: string };

/**
 * Names what is still missing under a disabled primary CTA.
 *
 * THE GAP THIS CLOSES
 *
 * Roughly twenty vertical tools gate their "open a case with the agent"
 * button behind a compound `ready` predicate — three or four fields ANDed
 * together, sometimes with a threshold nobody could guess from the outside
 * (`fault.trim().length >= 3`, `monthlyAgorot >= 100`). Fill every field but
 * one and the button is simply inert: no error, no highlight, no hint about
 * which field is at fault. Pressing it does nothing, forever.
 *
 * That is indistinguishable, from the user's side, from a broken app — and it
 * is what the founder's family actually hit. A disabled control is only
 * honest when it also says what would enable it, so this renders exactly
 * that, and disappears the moment the requirements are met.
 */
export function MissingFields({ items }: { items: Requirement[] }) {
  const t = useTranslations("common");
  const missing = items.filter((i) => !i.ok).map((i) => i.label);
  if (missing.length === 0) return null;
  return (
    <p className="text-[12.5px] text-amber m-0 leading-relaxed">
      {t("stillNeeded", { fields: missing.join(" · ") })}
    </p>
  );
}
