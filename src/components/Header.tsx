"use client";

import { useTranslations, useLocale } from "next-intl";
import { useRouter, usePathname, Link } from "@/i18n/routing";
import { activeLocales, localeLabel, type Locale } from "@/i18n/config";
import { Logo } from "@/components/Logo";
import { PlanBadge } from "@/components/PlanBadge";

export function Header({ user }: { user: { name: string; plan?: string } | null }) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();

  function switchLocale(next: Locale) {
    router.replace(pathname, { locale: next });
  }

  return (
    <header className="flex justify-between items-center px-5 py-4 max-w-[1080px] mx-auto flex-wrap gap-3">
      <Link href="/" className="flex items-center no-underline" aria-label={t("brand")}>
        <Logo height={22} />
      </Link>

      <nav className="flex gap-1.5 items-center flex-wrap">
        <NavLink href="/">{t("nav.home")}</NavLink>
        {user ? (
          <>
            <NavLink href="/assistant">{t("nav.assistant")}</NavLink>
            <NavLink href="/dashboard">{t("nav.dashboard")}</NavLink>
            <NavLink href="/check">{t("nav.newCheck")}</NavLink>
            <NavLink href="/scan">{t("nav.scan")}</NavLink>
            {/* Logged-in user's name — also the entry point to account settings. */}
            <Link
              href="/settings"
              className="flex items-center gap-2 no-underline rounded-full ps-1.5 pe-3 py-1 bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.09)] hover:border-[rgba(63,203,155,0.4)] transition-colors duration-200"
              aria-label={t("nav.settings")}
            >
              <span className="account-avatar w-6 h-6 rounded-full grad-bg text-[#06121A] inline-flex items-center justify-center text-[12px] font-black">
                {user.name.trim().charAt(0)}
              </span>
              <span className="text-ink text-[13.5px] font-bold max-w-[120px] truncate">
                {user.name}
              </span>
              <PlanBadge plan={user.plan} />
            </Link>
          </>
        ) : (
          <>
            <NavLink href="/entitlements">{t("nav.entitlements")}</NavLink>
            <NavLink href="/payslip">{t("nav.payslip")}</NavLink>
            <NavLink href="/severance">{t("nav.severance")}</NavLink>
            <NavLink href="/rights">{t("nav.rights")}</NavLink>
            <NavLink href="/miluim">{t("nav.miluim")}</NavLink>
            <NavLink href="/electricity">{t("nav.electricity")}</NavLink>
            <NavLink href="/flights">{t("nav.flights")}</NavLink>
            <NavLink href="/pricing">{t("nav.pricing")}</NavLink>
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
