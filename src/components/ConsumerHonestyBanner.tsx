import { getTranslations } from "next-intl/server";
import { paymentsFullyLive } from "@/lib/deploy/releaseGate";

/**
 * Shown site-wide while subscription billing is not connected — so nobody
 * discovers "we don't charge yet" only buried in privacy legalese.
 */
export async function ConsumerHonestyBanner() {
  if (paymentsFullyLive()) return null;
  const t = await getTranslations("opsBanner");
  return (
    <div
      role="status"
      className="max-w-[1080px] mx-auto px-5 pt-3"
    >
      <p className="m-0 rounded-xl border border-[rgba(240,180,92,0.35)] bg-[rgba(240,180,92,0.08)] px-4 py-3 text-[12.5px] text-ink-soft leading-relaxed text-center">
        {t("preBilling")}
      </p>
    </div>
  );
}
