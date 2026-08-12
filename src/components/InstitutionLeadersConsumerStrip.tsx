import { prisma } from "@/lib/prisma";
import { Card, Button } from "@/components/ui";
import { Link } from "@/i18n/routing";
import { getTranslations } from "next-intl/server";
import { institutionDisplayName } from "@/lib/referenceVerifier";
import { institutionPilotMailto } from "@/lib/institutionPull";

/** Consumer-facing: who opted in — or honest empty pressure to ask their bank. */
export async function InstitutionLeadersConsumerStrip({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "institutionLeader" });
  const he = locale === "he" || locale === "ar";

  let leaders: {
    institutionId: string;
    displayNameHe: string;
    displayNameEn: string;
    tier: string;
  }[] = [];
  try {
    leaders = await prisma.referenceVerifier.findMany({
      orderBy: { listedAt: "asc" },
      take: 8,
      select: {
        institutionId: true,
        displayNameHe: true,
        displayNameEn: true,
        tier: true,
      },
    });
  } catch {
    leaders = [];
  }

  if (leaders.length === 0) {
    const askBankSubject = encodeURIComponent(
      he
        ? "בקשה: תמיכה באימות Mandate של זכאי"
        : "Request: support Zakai Mandate verification",
    );
    const askBankBody = encodeURIComponent(
      he
        ? [
            "שלום,",
            "",
            "אני לקוח/ה. פניות שלי מגיעות עם Mandate חתום שניתן לאמת מול JWKS.",
            "אשמח אם תשלמו את אשף המוכנות ותופיעו בקיר המובילים:",
            "https://zakai-3uxj.vercel.app/he/institutions/leader",
            "",
            "זה לא אישור רגולטורי — רק סימן שאתם מאמתים offline במקום PDF ידני.",
            "",
            "תודה",
          ].join("\n")
        : [
            "Hello,",
            "",
            "I am a customer. My requests arrive with a signed Mandate verifiable against JWKS.",
            "Please complete the readiness wizard and list on the leaders wall:",
            "https://zakai-3uxj.vercel.app/en/institutions/leader",
            "",
            "This is not regulatory endorsement — only a signal that you verify offline instead of reading PDFs by hand.",
            "",
            "Thank you",
          ].join("\n"),
    );

    return (
      <Card className="p-5 mb-6 border-[rgba(63,203,155,0.25)]">
        <p className="text-body text-ink-soft m-0 mb-3 leading-relaxed">
          {t("consumerStripEmpty")}
        </p>
        <p className="text-[12px] text-ink-soft m-0 mb-4">{t("consumerStripEmptySlots")}</p>
        <div className="flex flex-wrap gap-3">
          <a
            href={`mailto:?subject=${askBankSubject}&body=${askBankBody}`}
            className="no-underline"
          >
            <Button variant="ghost" className="!text-body">
              {t("consumerAskBankCta")}
            </Button>
          </a>
          <Link href="/institutions/leader" className="no-underline">
            <Button className="!text-body">{t("leaderProgramCta")}</Button>
          </Link>
        </div>
        <p className="text-[11px] text-ink-soft mt-3 mb-0">{t("consumerStripDisclaimer")}</p>
      </Card>
    );
  }

  return (
    <Card className="p-5 mb-6 border-[rgba(63,203,155,0.25)]">
      <p className="text-body text-ink-soft m-0 mb-3 leading-relaxed">{t("consumerStripHint")}</p>
      <ul className="list-none p-0 m-0 flex flex-col gap-2">
        {leaders.map((r) => (
          <li key={r.institutionId} className="flex items-center justify-between gap-2 text-[14px]">
            <span className="font-bold">{institutionDisplayName(locale, r)}</span>
            <span className="text-[11px] text-emerald font-extrabold uppercase tracking-wide">
              {r.tier === "pioneer" ? t("tierPioneer") : t("tierReference")}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-ink-soft mt-3 mb-0">{t("consumerStripDisclaimer")}</p>
      <div className="flex flex-wrap gap-3 mt-3">
        <Link href="/institutions/leaders" className="text-emerald font-bold text-body no-underline">
          {t("seeLeaders")} →
        </Link>
        <a href={institutionPilotMailto()} className="text-ink-soft font-bold text-body no-underline">
          {t("institutionEmailUs")} →
        </a>
      </div>
    </Card>
  );
}
