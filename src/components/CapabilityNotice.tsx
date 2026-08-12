"use client";

import { useTranslations } from "next-intl";
import { primaryNotice } from "@/lib/capabilityNotice";

/**
 * Say out loud when the agent cannot do a thing, instead of hiding the button.
 *
 * WHY THIS IS ITS OWN FILE NOW
 *
 * It was a private function inside MoneyHub, which meant /money and /check
 * told people that outbound mail was not configured, or that image reading
 * was off — and /scan, running the same screenshot upload against the same
 * key, simply removed the button. Nothing appeared in its place. From the
 * outside there is no difference between a feature that is switched off and a
 * feature that was never built, and this codebase already learned that lesson
 * once: an outside reviewer called the product "a directory of tools, not an
 * agent", because when the agent cannot execute it is invisible, and silence
 * reads as absence.
 */
export function CapabilityNotice({
  mailLive,
  aiLive,
  className = "",
}: {
  mailLive: boolean;
  aiLive: boolean;
  className?: string;
}) {
  const tc = useTranslations("capability");
  const notice = primaryNotice({ mail: mailLive, ai: aiLive });
  if (!notice) return null;
  // Keys arrive as "capability.mailOff.headline"; the namespace is already
  // bound, so drop the first segment rather than re-resolving the whole path.
  const key = (full: string) => full.split(".").slice(1).join(".");

  return (
    <div
      role="status"
      className={`rounded-xl border px-4 py-3 mb-4 ${
        notice.severity === "blocking"
          ? "border-[rgba(240,180,92,0.45)] bg-[rgba(240,180,92,0.08)]"
          : "border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.04)]"
      } ${className}`}
    >
      <div className="font-bold text-body">{tc(key(notice.headlineKey))}</div>
      <p className="text-caption text-ink-soft mt-1 mb-0 leading-relaxed">
        {tc(key(notice.alternativeKey))}
      </p>
    </div>
  );
}
