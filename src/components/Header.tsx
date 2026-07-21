"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter, usePathname, Link } from "@/i18n/routing";
import { activeLocales, localeLabel, type Locale } from "@/i18n/config";
import { Logo } from "@/components/Logo";
import { PlanBadge } from "@/components/PlanBadge";

/** The public tools, grouped under one "Tools" menu so the bar stays calm. */
const TOOLS = [
  { href: "/lost-money", key: "lostmoney", icon: "⛰️" },
  { href: "/deals", key: "deals", icon: "🎟️" },
  { href: "/entitlements", key: "entitlements", icon: "🎯" },
  { href: "/payslip", key: "payslip", icon: "🧾" },
  { href: "/severance", key: "severance", icon: "📄" },
  { href: "/maternity", key: "maternity", icon: "👶" },
  { href: "/taxrefund", key: "taxrefund", icon: "💸" },
  { href: "/unemployment", key: "unemployment", icon: "🧭" },
  { href: "/olim", key: "olim", icon: "🇮🇱" },
  { href: "/parking", key: "parking", icon: "🅿️" },
  { href: "/transport-fine", key: "transportFine", icon: "🚌" },
  { href: "/baggage", key: "baggage", icon: "🧳" },
  { href: "/bank-fees", key: "bankfees", icon: "🏦" },
  { href: "/price-protection", key: "priceprotection", icon: "🏷️" },
  { href: "/miluim", key: "miluim", icon: "🎖️" },
  { href: "/rights", key: "rights", icon: "📚" },
  { href: "/electricity", key: "electricity", icon: "⚡" },
  { href: "/flights", key: "flights", icon: "✈️" },
] as const;

export function Header({ user }: { user: { name: string; plan?: string } | null }) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => setMobileOpen(false), [pathname]);

  function switchLocale(next: Locale) {
    router.replace(pathname, { locale: next });
  }

  const langButtons = (
    <div className="flex gap-1">
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
  );

  const accountChip = user && (
    <Link
      href="/settings"
      className="flex items-center gap-2 no-underline rounded-full ps-1.5 pe-3 py-1 bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.09)] hover:border-[rgba(63,203,155,0.4)] transition-colors duration-200"
      aria-label={t("nav.settings")}
    >
      <span className="account-avatar w-6 h-6 rounded-full grad-bg text-[#06121A] inline-flex items-center justify-center text-[12px] font-black">
        {user.name.trim().charAt(0)}
      </span>
      <span className="text-ink text-[13.5px] font-bold max-w-[110px] truncate">{user.name}</span>
      <PlanBadge plan={user.plan} />
    </Link>
  );

  return (
    <header className="max-w-[1080px] mx-auto px-5 py-4">
      <div className="flex justify-between items-center gap-3">
        <Link href="/" className="flex items-center no-underline" aria-label={t("brand")}>
          <Logo height={22} />
        </Link>

        {/* Desktop nav (md and up) */}
        <nav className="hidden md:flex gap-1.5 items-center flex-wrap justify-end">
          <NavLink href="/">{t("nav.home")}</NavLink>
          {user ? (
            <>
              <NavLink href="/assistant">{t("nav.assistant")}</NavLink>
              <NavLink href="/dashboard">{t("nav.dashboard")}</NavLink>
              <ToolsMenu label={t("nav.tools")} />
              <NavLink href="/check">{t("nav.newCheck")}</NavLink>
              {accountChip}
            </>
          ) : (
            <>
              <ToolsMenu label={t("nav.tools")} />
              <NavLink href="/pricing">{t("nav.pricing")}</NavLink>
              <NavLink href="/login">{t("nav.login")}</NavLink>
              <NavLink href="/signup">{t("nav.signup")}</NavLink>
            </>
          )}
          <div className="ms-1">{langButtons}</div>
        </nav>

        {/* Mobile: compact plan badge + hamburger */}
        <div className="flex md:hidden items-center gap-2.5">
          {user && <PlanBadge plan={user.plan} />}
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-expanded={mobileOpen}
            aria-label={t("nav.menu")}
            className="w-10 h-10 flex items-center justify-center rounded-xl border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.05)] text-ink text-xl"
          >
            {mobileOpen ? "✕" : "☰"}
          </button>
        </div>
      </div>

      {/* Mobile panel */}
      {mobileOpen && (
        <div className="md:hidden mt-3 rounded-2xl border border-[rgba(255,255,255,0.09)] bg-[#0c1420] p-3 flex flex-col gap-1 shadow-[0_24px_60px_rgba(0,0,0,0.5)]">
          <MobileLink href="/">{t("nav.home")}</MobileLink>
          {user && (
            <>
              <MobileLink href="/assistant">{t("nav.assistant")}</MobileLink>
              <MobileLink href="/dashboard">{t("nav.dashboard")}</MobileLink>
              <MobileLink href="/check">{t("nav.newCheck")}</MobileLink>
            </>
          )}

          <div className="text-[11px] font-extrabold text-ink-soft uppercase tracking-wide px-3 pt-3 pb-1">
            {t("nav.tools")}
          </div>
          <div className="grid grid-cols-2 gap-1">
            {TOOLS.map((tool) => (
              <Link
                key={tool.key}
                href={tool.href}
                className="flex items-center gap-2 no-underline rounded-xl px-3 py-2.5 text-ink-soft hover:text-ink hover:bg-[rgba(63,203,155,0.1)] transition-colors"
              >
                <span className="text-[16px]" aria-hidden>{tool.icon}</span>
                <span className="text-[13px] font-bold leading-tight">{t(`nav.${tool.key}`)}</span>
              </Link>
            ))}
          </div>

          <div className="h-px bg-[rgba(255,255,255,0.08)] my-2" />
          {user ? (
            <MobileLink href="/settings">{t("nav.settings")}</MobileLink>
          ) : (
            <>
              <MobileLink href="/pricing">{t("nav.pricing")}</MobileLink>
              <MobileLink href="/login">{t("nav.login")}</MobileLink>
              <MobileLink href="/signup">{t("nav.signup")}</MobileLink>
            </>
          )}
          <div className="px-3 pt-2">{langButtons}</div>
        </div>
      )}
    </header>
  );
}

/** Accessible click-dropdown listing every public tool (desktop only). */
function ToolsMenu({ label }: { label: string }) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={`inline-flex items-center gap-1 no-underline rounded-[10px] px-3.5 py-2 text-sm font-bold transition-colors ${
          open ? "text-ink bg-[rgba(255,255,255,0.09)]" : "text-ink-soft hover:text-ink hover:bg-[rgba(255,255,255,0.09)]"
        }`}
      >
        {label}
        <span className={`text-[10px] transition-transform duration-200 ${open ? "rotate-180" : ""}`} aria-hidden>
          ▾
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute top-[calc(100%+8px)] end-0 z-50 w-[320px] p-2 rounded-2xl border border-[rgba(255,255,255,0.1)] bg-[#0c1420] shadow-[0_24px_60px_rgba(0,0,0,0.55)] grid grid-cols-2 gap-1"
        >
          {TOOLS.map((tool) => (
            <Link
              key={tool.key}
              href={tool.href}
              role="menuitem"
              className="flex items-center gap-2.5 no-underline rounded-xl px-3 py-2.5 text-ink-soft hover:text-ink hover:bg-[rgba(63,203,155,0.1)] transition-colors"
            >
              <span className="text-[17px]" aria-hidden>{tool.icon}</span>
              <span className="text-[13px] font-bold leading-tight">{t(`nav.${tool.key}`)}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
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

function MobileLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="block no-underline rounded-xl px-3 py-2.5 text-[15px] font-bold text-ink hover:bg-[rgba(255,255,255,0.06)]"
    >
      {children}
    </Link>
  );
}
