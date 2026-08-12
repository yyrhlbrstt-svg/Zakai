"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter, usePathname, Link } from "@/i18n/routing";
import { activeLocales, localeLabel, type Locale } from "@/i18n/config";
import { Logo } from "@/components/Logo";
import { PlanBadge } from "@/components/PlanBadge";
import { ToolIcon } from "@/components/ToolIcon";
import { Menu, X, ChevronDown } from "lucide-react";

import { FEATURED_TOOLS } from "@/lib/toolsCatalog";
import { TOOL_EXTRA_LABELS } from "@/lib/toolLabels";

export function Header({ user }: { user: { name: string; plan?: string } | null }) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const he = locale === "he" || locale === "ar";
  const tIcomponents_Header = useTranslations("inline_components_Header");

  useEffect(() => setMobileOpen(false), [pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMobileOpen(false);
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [mobileOpen]);

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
            className="bg-[rgba(255,255,255,0.06)] text-ink border border-[rgba(255,255,255,0.1)] rounded-[10px] px-3 py-1.5 text-body font-bold cursor-pointer min-w-[40px] hover:border-[rgba(63,203,155,0.35)] transition-colors"
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
      className="flex items-center gap-2 no-underline rounded-full ps-1.5 pe-3 py-1 bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.1)] hover:border-[rgba(63,203,155,0.45)] transition-colors duration-200"
      aria-label={t("nav.settings")}
    >
      <span className="account-avatar w-6 h-6 rounded-full grad-bg text-[#06121A] inline-flex items-center justify-center text-[12px] font-black">
        {user.name.trim().charAt(0)}
      </span>
      <span className="text-ink text-[13.5px] font-bold max-w-[110px] truncate">{user.name}</span>
      <PlanBadge plan={user.plan} />
    </Link>
  );

  function toolLabel(href: string, key: string) {
    const extra = TOOL_EXTRA_LABELS[key];
    if (extra) return he ? extra.he : extra.en;
    try {
      return t(`nav.${key}`);
    } catch {
      return key;
    }
  }

  return (
    <header
      className={`sticky top-0 z-40 transition-[background-color,border-color,backdrop-filter,box-shadow] duration-200 ${{
        true: "bg-[rgba(7,11,18,0.82)] backdrop-blur-xl border-b border-[rgba(255,255,255,0.08)] shadow-[0_8px_32px_rgba(0,0,0,0.35)]",
        false: "bg-transparent border-b border-transparent",
      }[String(scrolled) as "true" | "false"]}`}
    >
      <div className="max-w-[1080px] mx-auto px-5 py-3.5">
        <div className="flex justify-between items-center gap-3">
          <Link href="/" className="flex items-center no-underline" aria-label={t("brand")}>
            <Logo height={22} />
          </Link>

          <nav className="hidden md:flex gap-1 items-center flex-wrap justify-end">
            <NavLink href="/" pathname={pathname}>{t("nav.home")}</NavLink>
            <Link
              href="/money#zakai-money-scan"
              className="no-underline rounded-full px-4 py-2 text-[13.5px] font-extrabold text-[#06121A] bg-emerald hover:opacity-90 transition-opacity"
            >
              {tIcomponents_Header("t_bd4c0905")}
            </Link>
            <NavLink href="/cancel" pathname={pathname}>{tIcomponents_Header("t_a7c55a8d")}</NavLink>
            <NavLink href="/what-am-i-owed" pathname={pathname}>{tIcomponents_Header("t_81a5a2c8")}</NavLink>
            <NavLink href="/leaks" pathname={pathname}>{tIcomponents_Header("t_5fcd3b9b")}</NavLink>
            <NavLink href="/proofs" pathname={pathname}>{tIcomponents_Header("t_67f9ea4b")}</NavLink>
            {user ? (
              <>
                <NavLink href="/assistant" pathname={pathname}>{t("nav.assistant")}</NavLink>
                <NavLink href="/dashboard" pathname={pathname}>{t("nav.dashboard")}</NavLink>
                <ToolsMenu label={t("nav.tools")} toolLabel={toolLabel} allToolsLabel={t("nav.allTools")} />
                <NavLink href="/check" pathname={pathname}>{t("nav.newCheck")}</NavLink>
                {accountChip}
              </>
            ) : (
              <>
                <ToolsMenu label={t("nav.tools")} toolLabel={toolLabel} allToolsLabel={t("nav.allTools")} />
                <NavLink href="/business" pathname={pathname}>{tIcomponents_Header("t_79771be3")}</NavLink>
                {/* Neither of these was reachable from the desktop nav at all:
                    /agents from nowhere, /institutions from mobile only. The
                    protocol is the long-term asset and it had no door on the
                    surface most integrators arrive on. */}
                <NavLink href="/agents" pathname={pathname}>{t("nav.agents")}</NavLink>
                <NavLink href="/institutions" pathname={pathname}>{t("nav.institutions")}</NavLink>
                <NavLink href="/pricing" pathname={pathname}>{t("nav.pricing")}</NavLink>
                <NavLink href="/login" pathname={pathname}>{t("nav.login")}</NavLink>
                <NavLink href="/signup" pathname={pathname}>{t("nav.signup")}</NavLink>
              </>
            )}
            <div className="ms-1">{langButtons}</div>
          </nav>

          <div className="flex md:hidden items-center gap-2.5">
            {user && (
              <Link href="/pricing" aria-label={t("nav.pricing")} className="no-underline">
                <PlanBadge plan={user.plan} />
              </Link>
            )}
            <button
              type="button"
              onClick={() => setMobileOpen((v) => !v)}
              aria-expanded={mobileOpen}
              aria-label={t("nav.menu")}
              className="w-10 h-10 flex items-center justify-center rounded-xl border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.06)] text-ink hover:border-[rgba(63,203,155,0.4)] transition-colors"
            >
              {mobileOpen ? <X size={20} aria-hidden /> : <Menu size={20} aria-hidden />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t("nav.menu")}
            className="md:hidden mt-3 rounded-2xl border border-[rgba(255,255,255,0.1)] bg-[#0c1420]/95 backdrop-blur-xl shadow-[0_24px_60px_rgba(0,0,0,0.55)] max-h-[calc(100dvh-96px)] flex flex-col"
          >
            {/* Pinned outside the scrollable list — on a long tools grid, a
                language switcher buried at the bottom of the scroll is one
                nobody finds. */}
            <div className="flex justify-end px-3 pt-3 pb-2 border-b border-[rgba(255,255,255,0.08)] shrink-0">
              {langButtons}
            </div>
            <div className="p-3 flex flex-col gap-1 overflow-y-auto">
            <MobileLink href="/" pathname={pathname}>{t("nav.home")}</MobileLink>
            <MobileLink href="/money" pathname={pathname}>{tIcomponents_Header("t_bd4c0905")}</MobileLink>
            <MobileLink href="/cancel" pathname={pathname}>{tIcomponents_Header("t_bc18d8da")}</MobileLink>
            <MobileLink href="/what-am-i-owed" pathname={pathname}>{tIcomponents_Header("t_81a5a2c8")}</MobileLink>
            <MobileLink href="/leaks" pathname={pathname}>{tIcomponents_Header("t_16c6cdf1")}</MobileLink>
            <MobileLink href="/proofs" pathname={pathname}>{tIcomponents_Header("t_60a18677")}</MobileLink>
            {user && (
              <>
                <MobileLink href="/assistant" pathname={pathname}>{t("nav.assistant")}</MobileLink>
                <MobileLink href="/dashboard" pathname={pathname}>{t("nav.dashboard")}</MobileLink>
                <MobileLink href="/check" pathname={pathname}>{t("nav.newCheck")}</MobileLink>
              </>
            )}

            <div className="text-[11px] font-extrabold text-ink-soft uppercase tracking-wide px-3 pt-3 pb-1">
              {t("nav.tools")}
            </div>
            <div className="grid grid-cols-2 gap-1">
              {FEATURED_TOOLS.map((tool) => (
                <Link
                  key={tool.href + tool.key}
                  href={tool.href}
                  className="flex items-center gap-2 no-underline rounded-xl px-3 py-2.5 text-ink-soft hover:text-ink hover:bg-[rgba(63,203,155,0.1)] transition-colors"
                >
                  <ToolIcon name={tool.key} size={17} className="text-emerald shrink-0" />
                  <span className="text-body font-bold leading-tight">{toolLabel(tool.href, tool.key)}</span>
                </Link>
              ))}
            </div>
            <MobileLink href="/tools" pathname={pathname}>{t("nav.allTools")}</MobileLink>

            <div className="h-px bg-[rgba(255,255,255,0.08)] my-2" />
            {user ? (
              <MobileLink href="/settings" pathname={pathname}>{t("nav.settings")}</MobileLink>
            ) : (
              <>
                <MobileLink href="/business" pathname={pathname}>{tIcomponents_Header("t_b4265709")}</MobileLink>
                <MobileLink href="/agents" pathname={pathname}>{t("nav.agents")}</MobileLink>
                <MobileLink href="/institutions" pathname={pathname}>{tIcomponents_Header("t_8886b51f")}</MobileLink>
                <MobileLink href="/pricing" pathname={pathname}>{t("nav.pricing")}</MobileLink>
                <MobileLink href="/login" pathname={pathname}>{t("nav.login")}</MobileLink>
                <MobileLink href="/signup" pathname={pathname}>{t("nav.signup")}</MobileLink>
              </>
            )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

function ToolsMenu({
  label,
  toolLabel,
  allToolsLabel,
}: {
  label: string;
  toolLabel: (href: string, key: string) => string;
  allToolsLabel: string;
}) {
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
          open ? "text-ink bg-[rgba(255,255,255,0.1)]" : "text-ink-soft hover:text-ink hover:bg-[rgba(255,255,255,0.09)]"
        }`}
      >
        {label}
        <ChevronDown
          size={14}
          aria-hidden
          className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute top-[calc(100%+8px)] end-0 z-50 w-[320px] max-h-[70vh] overflow-y-auto p-2 rounded-2xl border border-[rgba(255,255,255,0.1)] bg-[#0c1420]/98 backdrop-blur-xl shadow-[0_24px_60px_rgba(0,0,0,0.55)] grid grid-cols-2 gap-1"
        >
          {FEATURED_TOOLS.map((tool) => (
            <Link
              key={tool.href + tool.key}
              href={tool.href}
              role="menuitem"
              className="flex items-center gap-2.5 no-underline rounded-xl px-3 py-2.5 text-ink-soft hover:text-ink hover:bg-[rgba(63,203,155,0.12)] transition-colors"
            >
              <ToolIcon name={tool.key} size={18} className="text-emerald shrink-0" />
              <span className="text-body font-bold leading-tight">{toolLabel(tool.href, tool.key)}</span>
            </Link>
          ))}
          <Link
            href="/tools"
            role="menuitem"
            className="col-span-2 mt-1 flex items-center justify-center gap-2 no-underline rounded-xl px-3 py-2.5 text-emerald font-extrabold text-body border border-[rgba(63,203,155,0.4)] bg-[rgba(63,203,155,0.1)] hover:bg-[rgba(63,203,155,0.16)]"
          >
            {allToolsLabel}
          </Link>
        </div>
      )}
    </div>
  );
}

function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/" || pathname === "";
  return pathname === href || pathname.startsWith(href + "/");
}

function NavLink({
  href,
  children,
  pathname,
}: {
  href: string;
  children: React.ReactNode;
  pathname: string;
}) {
  const active = isActivePath(pathname, href);
  return (
    <Link
      href={href}
      className={`no-underline rounded-[10px] px-3.5 py-2 text-sm font-bold transition-colors ${
        active
          ? "text-emerald bg-[rgba(63,203,155,0.12)]"
          : "text-ink-soft hover:text-ink hover:bg-[rgba(255,255,255,0.09)]"
      }`}
    >
      {children}
    </Link>
  );
}

function MobileLink({
  href,
  children,
  pathname,
}: {
  href: string;
  children: React.ReactNode;
  pathname: string;
}) {
  const active = isActivePath(pathname, href);
  return (
    <Link
      href={href}
      className={`block no-underline rounded-xl px-3 py-2.5 text-[15px] font-bold transition-colors ${
        active
          ? "text-emerald bg-[rgba(63,203,155,0.12)]"
          : "text-ink hover:bg-[rgba(255,255,255,0.06)]"
      }`}
    >
      {children}
    </Link>
  );
}
