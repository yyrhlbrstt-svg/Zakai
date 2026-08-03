import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui";

/** Self-serve CTA — money-first; never promises a human callback. */
export async function LeadCta({ vertical }: { vertical: string }) {
  void vertical; // retained for call-site compatibility; entry is always /money

  return (
    <div className="mt-12 rounded-2xl p-[1px] bg-[linear-gradient(105deg,#3fcb9b,#3ec6ff_55%,#8b5cf6)]">
      <div className="rounded-2xl bg-[#0a1119] px-6 py-7 text-center">
        <div className="font-display text-xl text-balance">התחל מהכסף שלי — בלי להשאיר טלפון</div>
        <p className="text-ink-soft text-[14px] mt-2 max-w-[520px] mx-auto leading-relaxed">
          צילום מסך → תיק → Mandate. תשובה ופעולה בתוך זכאי. אין צוות שחוזר בטלפון.
        </p>
        <div className="flex flex-wrap gap-3 justify-center mt-5">
          <Link href="/money#zakai-money-scan">
            <Button>הכסף שלי</Button>
          </Link>
          <Link href="/check">
            <Button variant="ghost">בדיקת חיוב סלולר</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
