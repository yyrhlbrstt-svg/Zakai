import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui";

/** Self-serve CTA — never promises a human callback. */
export async function LeadCta({ vertical }: { vertical: string }) {
  const v = vertical.replace(/[^a-z-]/g, "").slice(0, 60);

  return (
    <div className="mt-12 rounded-2xl p-[1px] bg-[linear-gradient(105deg,#3fcb9b,#3ec6ff_55%,#8b5cf6)]">
      <div className="rounded-2xl bg-[#0a1119] px-6 py-7 text-center">
        <div className="font-display text-xl text-balance">התחל עכשיו — בלי להשאיר טלפון</div>
        <p className="text-ink-soft text-[14px] mt-2 max-w-[520px] mx-auto leading-relaxed">
          תשובה ופעולה בתוך זכאי. אין צוות שחוזר בטלפון.
        </p>
        <div className="flex flex-wrap gap-3 justify-center mt-5">
          <Link href={`/start?v=${v}`}>
            <Button>התחל</Button>
          </Link>
          <Link href="/check">
            <Button variant="ghost">בדיקת חיוב</Button>
          </Link>
          <Link href="/money">
            <Button variant="ghost">הכסף שלי</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
