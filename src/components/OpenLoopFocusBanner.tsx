import { Link } from "@/i18n/routing";
import { heEn } from "@/lib/heEn";

/**
 * When an open loop exists, /money must finish it — not invite a toolbox fork.
 */
export function OpenLoopFocusBanner({
  locale,
  href,
  label,
}: {
  locale: string;
  href: string;
  label: string;
}) {
  const he = locale === "he" || locale === "ar";
  return (
    <div className="mb-5 rounded-2xl border border-[rgba(63,203,155,0.45)] bg-[rgba(63,203,155,0.1)] px-4 py-3.5 flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="text-[11px] font-extrabold uppercase tracking-wide text-emerald">
          {heEn(he, "לולאה פתוחה", "Open loop")}
        </div>
        <p className="text-[14px] font-bold m-0 mt-0.5 leading-snug">{label}</p>
        <p className="text-[12px] text-ink-soft m-0 mt-1 leading-relaxed">
          {heEn(
            he,
            "סיימו את התיק לפני פתיחת בדיקה חדשה — כך נוצרים Mandates ו־SavingsProofs.",
            "Finish this case before opening a new check — that is how Mandates and SavingsProofs compound.",
          )}
        </p>
      </div>
      <Link
        href={href}
        className="shrink-0 no-underline rounded-full px-4 py-2 text-[13px] font-extrabold text-[#06121A] bg-emerald hover:opacity-90"
      >
        {heEn(he, "המשיכו עכשיו", "Continue now")}
      </Link>
    </div>
  );
}
