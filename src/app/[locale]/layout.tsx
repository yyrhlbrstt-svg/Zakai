import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { setRequestLocale, getMessages } from "next-intl/server";
import { Heebo, Suez_One, Manrope } from "next/font/google";
import { routing } from "@/i18n/routing";
import { dir, isLocale, type Locale } from "@/i18n/config";
import { Background } from "@/components/Background";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
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

  return (
    <html lang={locale} dir={dir[locale as Locale]}>
      <body className={`${body.variable} ${display.variable} ${wordmark.variable} font-body text-ink`}>
        {/* Mark JS as available before paint so scroll-reveal only hides content
            when it can actually reveal it (no-JS keeps everything visible). */}
        <script
          dangerouslySetInnerHTML={{
            __html: "document.documentElement.classList.add('js')",
          }}
        />
        <NextIntlClientProvider messages={messages}>
          <Background />
          <Header user={user ? { name: user.name } : null} />
          {children}
          <Footer />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
