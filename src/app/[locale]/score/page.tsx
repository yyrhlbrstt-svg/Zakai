import { getTranslations } from "next-intl/server";
import { ZakaiScoreScreen } from "@/components/ZakaiScoreScreen";
import { VigilWatchCard } from "@/components/VigilWatchCard";
import { bcp47, isLocale, defaultLocale } from "@/i18n/config";
import { getSessionUserId } from "@/lib/auth/session";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "score" });
  return { title: t("title"), description: t("subtitle") };
}

export default async function ScorePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const tag = bcp47[isLocale(locale) ? locale : defaultLocale];
  const t = await getTranslations({ locale, namespace: "score" });
  /*
    The score itself is deliberately open to anyone — eight taps, no account,
    no upload. The watch-list card underneath it is not: it reads a signed-in
    profile. Mounting it regardless meant every signed-out visitor's browser
    fired a request that correctly came back 401, and the page logged a failed
    request it had no intention of using. The component swallowed it and
    rendered nothing, so the screen looked fine and the console did not; a page
    that quietly fails a request in front of a stranger is the opposite of the
    trust this product is asking for. Asked here, where the answer is free.
  */
  const signedIn = Boolean(await getSessionUserId());

  return (
    <main className="max-w-[760px] mx-auto px-5 py-10">
      <h1 className="font-display text-3xl mt-0 mb-2">{t("title")}</h1>
      <p className="text-ink-soft text-[14.5px] mt-0 mb-7 leading-relaxed">{t("subtitle")}</p>
      <ZakaiScoreScreen bcp47={tag} />
      {signedIn && <VigilWatchCard bcp47={tag} />}
    </main>
  );
}
