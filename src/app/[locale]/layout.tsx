import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { cookies, headers } from "next/headers";
import { NextIntlClientProvider } from "next-intl";
import { setRequestLocale, getMessages, getTranslations } from "next-intl/server";
import { Heebo, Suez_One, Manrope } from "next/font/google";
import { routing } from "@/i18n/routing";
import { dir, isLocale, type Locale } from "@/i18n/config";
import { ogImageUrl } from "@/lib/seo";
import { Background } from "@/components/Background";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { organizationJsonLd } from "@/lib/structuredData";
import { InstallPrompt } from "@/components/InstallPrompt";
import { EnablePush } from "@/components/EnablePush";
import { PlausibleScript } from "@/components/PlausibleScript";
import { LangSuggest, LANG_SUGGEST_COOKIE } from "@/components/LangSuggest";
import { getCurrentUser } from "@/lib/auth/user";
import { OpenLoopResumeBar } from "@/components/OpenLoopResumeBar";
import { HideOnRoutes } from "@/components/HideOnRoutes";
import { NON_CONSUMER_ROUTES } from "@/lib/nonConsumerRoutes";
import "../globals.css";

const body = Heebo({
  subsets: ["hebrew", "latin"],
  // 500 was here and `font-medium` appears zero times in 1,284 source files —
  // two font files, in two subsets, downloaded on the critical path of every
  // first visit for a weight nothing renders in.
  weight: ["400", "700", "800"],
  variable: "--font-body",
  display: "swap",
});

const display = Suez_One({
  subsets: ["hebrew", "latin"],
  weight: "400",
  variable: "--font-display",
  display: "swap",
});

/**
 * Geometric bold face for the "ZAKAI" wordmark.
 *
 * Not preloaded. It renders the logo and the splash — nothing a person is
 * reading — and preloading it put it in the critical path of the one page
 * every visitor lands on, competing for a 1.6 Mbps pipe against the CSS and
 * the body font that decide when anything appears at all. With `display: swap`
 * the wordmark shows in the system face for a moment and settles.
 */
const wordmark = Manrope({
  subsets: ["latin"],
  weight: ["800"],
  variable: "--font-wordmark",
  display: "swap",
  preload: false,
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://zakai-3uxj.vercel.app";

// Metadata is localized per request so /en, /ar and /ru each ship their own
// <title>/description and share-preview text (not the Hebrew default).
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  const title = t("title");
  const description = t("desc");
  const ogImage = ogImageUrl({ locale, sub: description });
  return {
    metadataBase: new URL(SITE_URL),
    title,
    description,
    openGraph: {
      type: "website",
      siteName: "ZAKAI",
      title,
      description,
      url: `${SITE_URL}/${locale}`,
      images: [{ url: ogImage, width: 1200, height: 630, alt: "ZAKAI" }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
    // PWA: iOS ignores the web manifest for install, so give Safari its own
    // "add to home screen" affordances explicitly.
    appleWebApp: {
      capable: true,
      title: "ZAKAI",
      statusBarStyle: "black-translucent",
    },
    icons: {
      apple: "/icons/icon-192.png",
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#070B12",
  width: "device-width",
  initialScale: 1,
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  setRequestLocale(locale);
  const messages = await getMessages();
  const user = await getCurrentUser();
  const t = await getTranslations({ locale });
  // Set by middleware, per request — lets these two inline bootstrap scripts
  // run under the Content-Security-Policy's script-src without needing
  // 'unsafe-inline', which would otherwise allow any injected <script> tag.
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  /**
   * Decide the English nudge here, before anything is painted.
   *
   * Everything it needs is on the request: the Accept-Language header and a
   * dismissal cookie. Deciding it in the browser instead meant the banner
   * appeared after first paint, in the flow above <main>, and pushed every
   * page down — 0.0747 of layout shift on all eight pages measured, which was
   * 99% of the site's CLS.
   */
  const acceptLanguage = (await headers()).get("accept-language") ?? "";
  const dismissedLangSuggest = (await cookies()).get(LANG_SUGGEST_COOKIE)?.value === "1";
  const showLangSuggest =
    locale === "he" &&
    !dismissedLangSuggest &&
    // Only somebody who reads English and does not read Hebrew — a new
    // immigrant or a tourist, never an Israeli on the default site.
    /\ben\b|\ben-/i.test(acceptLanguage) &&
    !/\bhe\b|\bhe-|\biw\b/i.test(acceptLanguage);

  return (
    // `suppressHydrationWarning` covers the `class="js"` that the pre-paint
    // script below adds to <html>. We can't render it server-side (no-JS users
    // must not get it), so the mismatch is intentional and scoped to this tag.
    <html
      lang={locale}
      dir={dir[locale as Locale]}
      data-plan={user?.plan ?? "FREE"}
      suppressHydrationWarning
    >
      <body className={`${body.variable} ${display.variable} ${wordmark.variable} font-body text-ink`}>
        {/* Mark JS as available before paint so scroll-reveal only hides content
            when it can actually reveal it (no-JS keeps everything visible). */}
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: "document.documentElement.classList.add('js')",
          }}
        />

        {/* Branded boot splash — painted on the first frame, shown once per
            session. Server-rendered markup + a gate script that hides it on
            repeat navigations. Reduced-motion hides it via CSS. */}
        {/* `suppressHydrationWarning`: the gate script below sets
            className="splash-skip" on this node before React hydrates, so the
            client markup intentionally differs from the server markup. */}
        <div id="zakai-splash" aria-hidden suppressHydrationWarning>
          <svg className="splash-mark" viewBox="0 0 110 110" width="76" height="76">
            <defs>
              <linearGradient id="splashZg" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#3FCB9B" />
                <stop offset="0.5" stopColor="#3EC6FF" />
                <stop offset="1" stopColor="#8B5CF6" />
              </linearGradient>
            </defs>
            <rect x="4" y="4" width="102" height="102" rx="26" fill="url(#splashZg)" />
            <path
              d="M 32 32 H 78 L 34 72 H 80"
              fill="none"
              stroke="#0A1119"
              strokeWidth="9"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M 33 87 C 50 78, 62 78, 80 87"
              fill="none"
              stroke="#0A1119"
              strokeWidth="6"
              strokeLinecap="round"
              opacity="0.9"
            />
          </svg>
          <span className="splash-word" dir="ltr">ZAKAI</span>
          <svg className="splash-arc" viewBox="0 0 200 26" preserveAspectRatio="none">
            <path
              d="M 8 6 C 60 34, 140 34, 192 6"
              fill="none"
              stroke="currentColor"
              strokeWidth={6}
              strokeLinecap="round"
            />
          </svg>
          <span className="splash-tag">{t("home.title2")}</span>
        </div>
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var s=document.getElementById('zakai-splash');if(!s)return;if(sessionStorage.getItem('zk_splash')){s.className='splash-skip';}else{sessionStorage.setItem('zk_splash','1');}}catch(e){}})();",
          }}
        />
        <script
          type="application/ld+json"
          // Static, server-built object with no user input in it — the only
          // shape of dangerouslySetInnerHTML that is not a question.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd(locale)) }}
        />
        <NextIntlClientProvider messages={messages}>
          <Background />
          <Header user={user ? { name: user.name, plan: user.plan } : null} />
          <LangSuggest initialShow={showLangSuggest} />
          {children}
          {user ? (
            <HideOnRoutes substrings={["/dashboard", "/money", ...NON_CONSUMER_ROUTES]}>
              <OpenLoopResumeBar locale={locale} />
            </HideOnRoutes>
          ) : null}
          <Footer />
          <InstallPrompt />
          <EnablePush loggedIn={Boolean(user)} />
          <PlausibleScript />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
