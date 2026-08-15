"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui";
import { formatAgorot } from "@/lib/money";
import { nextReferralMilestone } from "@/lib/referral";

/**
 * "Refer a friend" card for the settings screen. Shows the user's invite link
 * with a copy button, the reward terms, and any credit already earned. The
 * heavy lifting (granting/applying credit) is server-side; this is display +
 * clipboard only.
 */
export function ReferralCard({
  path,
  fallbackLink,
  creditAgorot,
  rewardAgorot,
  referralCount = 0,
  bcp47,
}: {
  /** Locale + code path, e.g. "/he/signup?ref=ABCD". */
  path: string;
  /** Absolute link used for SSR before the real origin is known. */
  fallbackLink: string;
  creditAgorot: number;
  rewardAgorot: number;
  /** How many successful referrals this user already has — drives the milestone line. */
  referralCount?: number;
  bcp47: string;
}) {
  const t = useTranslations("referral");
  const [copied, setCopied] = useState(false);
  // Build the absolute link from the actual origin the user is on, so the code
  // never depends on a build-time env var being set to the right domain.
  const [link, setLink] = useState(fallbackLink);
  useEffect(() => {
    setLink(window.location.origin + path);
  }, [path]);
  const reward = formatAgorot(rewardAgorot, bcp47);
  const milestone = nextReferralMilestone(referralCount);
  const remaining = milestone ? milestone.count - referralCount : 0;

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — link stays selectable in the field */
    }
  }

  return (
    <Card className="p-6">
      <div className="font-display text-lg">{t("title")}</div>
      <p className="text-ink-soft text-[13.5px] mt-2 leading-relaxed">
        {t("subtitle", { amount: reward })}
      </p>

      <div className="text-[12px] font-extrabold text-ink-soft mt-5 mb-1.5">
        {t("yourLink")}
      </div>
      <div className="flex gap-2 items-stretch flex-wrap">
        <input
          readOnly
          dir="ltr"
          value={link}
          onFocus={(e) => e.currentTarget.select()}
          className="flex-1 min-w-[200px] bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.12)] rounded-xl px-3.5 py-2.5 text-body text-ink font-mono"
        />
        <button
          type="button"
          onClick={copy}
          className="shrink-0 grad-bg text-[#06121A] font-extrabold text-[13.5px] rounded-xl px-4 py-2.5 cursor-pointer border-0"
        >
          {copied ? t("copied") : t("copy")}
        </button>
      </div>

      <div
        className="mt-5 pt-4 flex justify-between items-center gap-3"
        style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}
      >
        <span className="text-ink-soft text-sm">{t("creditLabel")}</span>
        <span className="text-[15px] font-bold text-emerald">
          {creditAgorot > 0
            ? t("creditValue", { amount: formatAgorot(creditAgorot, bcp47) })
            : t("creditNone")}
        </span>
      </div>

      <p className="text-[11.5px] text-ink-soft mt-3 leading-snug">{t("note")}</p>

      {milestone && (
        <div className="mt-3 rounded-xl border border-[rgba(63,203,155,0.3)] bg-[rgba(63,203,155,0.07)] px-3.5 py-2.5">
          <p className="text-[12.5px] font-bold text-emerald m-0 leading-snug">
            {t("milestoneProgress", {
              count: remaining,
              bonus: formatAgorot(milestone.bonusAgorot, bcp47),
            })}
          </p>
        </div>
      )}
    </Card>
  );
}
