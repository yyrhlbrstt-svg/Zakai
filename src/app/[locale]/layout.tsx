import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { setRequestLocale, getMessages, getTranslations } from "next-intl/server";
import { Heebo, Suez_One, Manrope } from "next/font/google";
import { routing } from "@/i18n/routing";
import { dir, isLocale, type Locale } from "@/i18n/config";
import { Background } from "@/components/Background";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { InstallPrompt } from "@/components/InstallPrompt";
import { getCurrentUser } from "@/lib/auth/user";
import "../globals.css";

const body = Heebo({
  subsets: ["hebrew", "latin"],
  weight: ["400", "500", "700", "800"],
  variable: "--font-body",
  display: "swap",
});

const display = Suez_One({
  subsets: ["hebrew", "latin"],
  weight: "400",
  variable: "--font-display",
  display: "swap",
});

// Geometric bold face for the "ZAKAI" wordmark.
const wordmark = Manrope({
  subsets: ["latin"],
  weight: ["800"],
  variable: "--font-wordmark",
  display: "swap",
});

export const metadata: Metadata = {
  title: "זכאי — Zakai",
  description:
    "סוכן AI צרכני שמזהה חיובי סלולר מנופחים, פועל בשמך מול החברה, וגובה עמלה רק מחיסכון מתועד.",
  // PWA: iOS ignores the web manifest for install, so give Safari its own
  // "add to home screen" affordances explicitly.
  appleWebApp: {
    capable: true,
    title: "זכאי",
    statusBarStyle: "black-translucent",
  },
  icons: {
    apple: "/icons/icon-192.png",
  },
};

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

  return (
    <html lang={locale} dir={dir[locale as Locale]} data-plan={user?.plan ?? "FREE"}>
      <body className={`${body.variable} ${display.variable} ${wordmark.variable} font-body text-ink`}>
        {/* Mark JS as available before paint so scroll-reveal only hides content
            when it can actually reveal it (no-JS keeps everything visible). */}
        <script
          dangerouslySetInnerHTML={{
            __html: "document.documentElement.classList.add('js')",
          }}
        />

        {/* Branded boot splash — painted on the first frame, shown once per
            session. Server-rendered markup + a gate script that hides it on
            repeat navigations. Reduced-motion hides it via CSS. */}
        <div id="zakai-splash" aria-hidden>
          <svg className="splash-mark" viewBox="0 0 110 110" width="76" height="76">
            <rect x="4" y="4" width="102" height="102" rx="26" fill="#3FCB9B" />
            <path
              d="M 32 34 H 78 L 34 76 H 80"
              fill="none"
              stroke="#0E1F1A"
              strokeWidth="9"
              strokeLinecap="round"
              strokeLinejoin="round"
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
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var s=document.getElementById('zakai-splash');if(!s)return;if(sessionStorage.getItem('zk_splash')){s.className='splash-skip';}else{sessionStorage.setItem('zk_splash','1');}}catch(e){}})();",
          }}
        />
        <NextIntlClientProvider messages={messages}>
          <Background />
          <Header user={user ? { name: user.name, plan: user.plan } : null} />
          {children}
          <Footer />
          <InstallPrompt />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
