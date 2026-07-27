import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui";

/**
 * CTA for high-value verticals: send the user to immediate self-serve actions,
 * not a promise of a human callback.
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
    /* generic */
  }

  return (
    <div className="mt-12 rounded-2xl p-[1px] bg-[linear-gradient(105deg,#3fcb9b,#3ec6ff_55%,#8b5cf6)]">
      <div className="rounded-2xl bg-[#0a1119] px-6 py-7 text-center">
        <div className="font-display text-xl text-balance">{title}</div>
        <p className="text-ink-soft text-[14px] mt-2 max-w-[520px] mx-auto leading-relaxed">
          תשובה ופעולה בתוך זכאי — בדיקה, ניסוח פנייה, והורדת מחיר. בלי להמתין לשיחה חזרה.
        </p>
        <div className="flex flex-wrap gap-3 justify-center mt-5">
          <Link href={`/start?v=${v}`}>
            <Button>התחל עכשיו</Button>
          </Link>
          <Link href="/check">
            <Button variant="ghost">בדיקת חיוב / משא ומתן</Button>
          </Link>
          <Link href="/assistant">
            <Button variant="ghost">הסוכן</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
