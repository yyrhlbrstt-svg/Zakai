import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui";

/**
 * The commissionable call-to-action for high-value verticals: a gradient card
 * that sends the user to the lead form (/start?v=<vertical>). Drop it near the
 * bottom of a vertical page (after its calculator/guide) to turn a reader into
 * a qualified, monetisable lead. Server component — pulls copy from the `lead`
 * namespace so every vertical reads consistently.
 */
export async function LeadCta({ vertical }: { vertical: string }) {
  const t = await getTranslations("lead");
  const v = vertical.replace(/[^a-z-]/g, "").slice(0, 60);

  let title = t("ctaTitle");
  try {
    const key = `verticalTitles.${v}`;
    const candidate = t(key);
    if (candidate && candidate !== key) title = candidate;
  } catch {
    /* keep generic */
  }

  return (
    <div className="mt-12 rounded-2xl p-[1px] bg-[linear-gradient(105deg,#3fcb9b,#3ec6ff_55%,#8b5cf6)]">
      <div className="rounded-2xl bg-[#0a1119] px-6 py-7 text-center">
        <div className="font-display text-xl text-balance">{title}</div>
        <p className="text-ink-soft text-[14px] mt-2 max-w-[520px] mx-auto leading-relaxed">
          {t("ctaBody")}
        </p>
        <div className="flex justify-center mt-5">
          <Link href={`/start?v=${v}`}>
            <Button>{t("send")}</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
