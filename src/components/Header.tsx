"use client";

import { useTranslations, useLocale } from "next-intl";
import { useRouter, usePathname, Link } from "@/i18n/routing";
import { activeLocales, localeLabel, type Locale } from "@/i18n/config";

export function Header({ user }: { user: { name: string } | null }) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();

  function switchLocale(next: Locale) {
    router.replace(pathname, { locale: next });
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/");
    router.refresh();
  }

  return (
    <header className="flex justify-between items-center px-5 py-4 max-w-[1080px] mx-auto flex-wrap gap-3">
      <Link href="/" className="font-display text-[22px] flex items-center gap-2 no-underline text-ink">
        <span className="w-7 h-7 rounded-[9px] grad-bg inline-flex items-center justify-center text-[#06121A] text-[15px] font-black">
          ₪
        </span>
        <span className="grad-text">{t("brand")}</span>
      </Link>

      <nav className="flex gap-1.5 items-center flex-wrap">
        <NavLink href="/">{t("nav.home")}</NavLink>
        {user ? (
          <>
            <NavLink href="/dashboard">{t("nav.dashboard")}</NavLink>
            <NavLink href="/check">{t("nav.newCheck")}</NavLink>
            <button
              onClick={logout}
              className="bg-transparent text-ink-soft border-0 rounded-[10px] px-3.5 py-2 text-sm font-bold cursor-pointer hover:text-ink"
            >
              {t("nav.logout")}
            </button>
          </>
        ) : (
          <>
            <NavLink href="/login">{t("nav.login")}</NavLink>
            <NavLink href="/signup">{t("nav.signup")}</NavLink>
          </>
        )}

        <div className="flex gap-1 ms-1">
          {activeLocales
            .filter((l) => l !== locale)
            .map((l) => (
              <button
                key={l}
                onClick={() => switchLocale(l)}
                className="bg-[rgba(255,255,255,0.06)] text-ink border border-[rgba(255,255,255,0.09)] rounded-[10px] px-3 py-1.5 text-[13px] font-bold cursor-pointer min-w-[40px]"
                aria-label={`Switch language to ${localeLabel[l]}`}
              >
                {localeLabel[l]}
              </button>
            ))}
        </div>
      </nav>
    </header>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="text-ink-soft no-underline rounded-[10px] px-3.5 py-2 text-sm font-bold hover:text-ink hover:bg-[rgba(255,255,255,0.09)]"
    >
      {children}
    </Link>
  );
}
