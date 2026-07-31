"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter, usePathname, Link } from "@/i18n/routing";
import { activeLocales, localeLabel, type Locale } from "@/i18n/config";
import { Logo } from "@/components/Logo";
import { PlanBadge } from "@/components/PlanBadge";
import { ToolIcon } from "@/components/ToolIcon";
import { Menu, X, ChevronDown } from "lucide-react";

const TOOLS = [
  { href: "/money", key: "money" },
  { href: "/incident", key: "incident" },
  { href: "/dormant", key: "dormant" },
  { href: "/vehicle-check", key: "vehicleCheck" },
  { href: "/leaks", key: "leaks" },
  { href: "/proofs", key: "proofs" },
  { href: "/cancel", key: "cancel" },
  { href: "/what-am-i-owed", key: "whatAmIOwed" },
  { href: "/credit-card", key: "creditcard" },
  { href: "/refund-chase", key: "refundchase" },
  { href: "/score", key: "score" },
  { href: "/scan", key: "scan" },
  { href: "/spending", key: "spending" },
  { href: "/check", key: "newCheck" },
  { href: "/vat", key: "vat" },
  { href: "/insurance-compare", key: "insurancecompare" },
  { href: "/debt-consolidation", key: "debt" },
  { href: "/lost-money", key: "lostmoney" },
  { href: "/compensation-claims", key: "compensation" },
  { href: "/class-action", key: "classaction" },
  { href: "/child-savings", key: "childsavings" },
  { href: "/arnona", key: "arnona" },
  { href: "/disability-benefits", key: "disability" },
  { href: "/construction-defects", key: "defects" },
  { href: "/car-value", key: "carvalue" },
  { href: "/mortgage-insurance", key: "mortins" },
  { href: "/duplicate-insurance", key: "dupinsurance" },
  { href: "/pension-fees", key: "pension" },
  { href: "/mortgage", key: "mortgage" },
  { href: "/deposit", key: "deposit" },
  { href: "/deals", key: "deals" },
  { href: "/entitlements", key: "entitlements" },
  { href: "/payslip", key: "payslip" },
  { href: "/severance", key: "severance" },
  { href: "/maternity", key: "maternity" },
  { href: "/taxrefund", key: "taxrefund" },
  { href: "/unemployment", key: "unemployment" },
  { href: "/olim", key: "olim" },
  { href: "/parking", key: "parking" },
  { href: "/transport-fine", key: "transportFine" },
  { href: "/baggage", key: "baggage" },
  { href: "/bank-fees", key: "bankfees" },
  { href: "/price-protection", key: "priceprotection" },
  { href: "/warranty", key: "warranty" },
  { href: "/miluim", key: "miluim" },
  { href: "/rights", key: "rights" },
  { href: "/electricity", key: "electricity" },
  { href: "/flights", key: "flights" },
  { href: "/contract-check", key: "contractCheck" },
  { href: "/overtime-backpay", key: "overtimeBackPay" },
  { href: "/late-payment", key: "latePayment" },
  { href: "/scam-check", key: "scamCheck" },
  { href: "/complaint-escalation", key: "complaintEscalation" },
] as const;

const EXTRA_LABELS: Record<string, { he: string; en: string }> = {
  money: { he: "הכסף שלי", en: "My money" },
  leaks: { he: "מפת נזילות", en: "Leaks map" },
  proofs: { he: "קיר חיסכונות", en: "Savings wall" },
  cancel: { he: "ביטול מנוי", en: "Cancel sub" },
  whatAmIOwed: { he: "מה מגיע לי", en: "What am I owed" },
  creditcard: { he: "ריבית כרטיס", en: "Card interest" },
  refundchase: { he: "החזר שלא הגיע", en: "Missing refund" },
  contractCheck: { he: "בדיקת חוזה", en: "Contract check" },
  overtimeBackPay: { he: "שעות נוספות", en: "Unpaid overtime" },
  latePayment: { he: "לקוח לא משלם", en: "Late-paying client" },
  scamCheck: { he: "זה עוקץ?", en: "Is this a scam?" },
  complaintEscalation: { he: "התלונה לא נענתה", en: "Complaint ignored" },
};

export function Header({ user }: { user: { name: string; plan?: string } | null }) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const he = locale === "he" || locale === "ar";
  const tIcomponents_Header = useTranslations("inline_components_Header");

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

  function toolLabel(href: string, key: string) {
    const extra = EXTRA_LABELS[key];
    if (extra) return he ? extra.he : extra.en;
    try {
      return t(`nav.${key}`);
    } catch {
      return key;
    }
  }

  return (
    <header className="max-w-[1080px] mx-auto px-5 py-4">
      <div className="flex justify-between items-center gap-3">
        <Link href="/" className="flex items-center no-underline" aria-label={t("brand")}>
          <Logo height={22} />
        </Link>

        <nav className="hidden md:flex gap-1.5 items-center flex-wrap justify-end">
          <NavLink href="/">{t("nav.home")}</NavLink>
          <NavLink href="/money">{tIcomponents_Header("t_bd4c0905")}</NavLink>
          <NavLink href="/cancel">{tIcomponents_Header("t_a7c55a8d")}</NavLink>
          <NavLink href="/what-am-i-owed">{tIcomponents_Header("t_81a5a2c8")}</NavLink>
          <NavLink href="/leaks">{tIcomponents_Header("t_5fcd3b9b")}</NavLink>
          <NavLink href="/proofs">{tIcomponents_Header("t_67f9ea4b")}</NavLink>
          {user ? (
            <>
              <NavLink href="/assistant">{t("nav.assistant")}</NavLink>
              <NavLink href="/dashboard">{t("nav.dashboard")}</NavLink>
              <ToolsMenu label={t("nav.tools")} toolLabel={toolLabel} />
              <NavLink href="/check">{t("nav.newCheck")}</NavLink>
              {accountChip}
            </>
          ) : (
            <>
              <ToolsMenu label={t("nav.tools")} toolLabel={toolLabel} />
              <NavLink href="/business">{tIcomponents_Header("t_79771be3")}</NavLink>
              <NavLink href="/pricing">{t("nav.pricing")}</NavLink>
              <NavLink href="/login">{t("nav.login")}</NavLink>
              <NavLink href="/signup">{t("nav.signup")}</NavLink>
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
            className="w-10 h-10 flex items-center justify-center rounded-xl border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.05)] text-ink"
          >
            {mobileOpen ? <X size={20} aria-hidden /> : <Menu size={20} aria-hidden />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden mt-3 rounded-2xl border border-[rgba(255,255,255,0.09)] bg-[#0c1420] p-3 flex flex-col gap-1 shadow-[0_24px_60px_rgba(0,0,0,0.5)]">
          <MobileLink href="/">{t("nav.home")}</MobileLink>
          <MobileLink href="/money">{tIcomponents_Header("t_bd4c0905")}</MobileLink>
          <MobileLink href="/cancel">{tIcomponents_Header("t_bc18d8da")}</MobileLink>
          <MobileLink href="/what-am-i-owed">{tIcomponents_Header("t_81a5a2c8")}</MobileLink>
          <MobileLink href="/leaks">{tIcomponents_Header("t_16c6cdf1")}</MobileLink>
          <MobileLink href="/proofs">{tIcomponents_Header("t_60a18677")}</MobileLink>
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
          <div className="grid grid-cols-2 gap-1 max-h-[50vh] overflow-y-auto">
            {TOOLS.map((tool) => (
              <Link
                key={tool.href + tool.key}
                href={tool.href}
                className="flex items-center gap-2 no-underline rounded-xl px-3 py-2.5 text-ink-soft hover:text-ink hover:bg-[rgba(63,203,155,0.1)] transition-colors"
              >
                <ToolIcon name={tool.key} size={17} className="text-emerald shrink-0" />
                <span className="text-[13px] font-bold leading-tight">{toolLabel(tool.href, tool.key)}</span>
              </Link>
            ))}
          </div>

          <div className="h-px bg-[rgba(255,255,255,0.08)] my-2" />
          {user ? (
            <MobileLink href="/settings">{t("nav.settings")}</MobileLink>
          ) : (
            <>
              <MobileLink href="/business">{tIcomponents_Header("t_b4265709")}</MobileLink>
              <MobileLink href="/institutions">{tIcomponents_Header("t_8886b51f")}</MobileLink>
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

function ToolsMenu({
  label,
  toolLabel,
}: {
  label: string;
  toolLabel: (href: string, key: string) => string;
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
          open ? "text-ink bg-[rgba(255,255,255,0.09)]" : "text-ink-soft hover:text-ink hover:bg-[rgba(255,255,255,0.09)]"
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
          className="absolute top-[calc(100%+8px)] end-0 z-50 w-[320px] max-h-[70vh] overflow-y-auto p-2 rounded-2xl border border-[rgba(255,255,255,0.1)] bg-[#0c1420] shadow-[0_24px_60px_rgba(0,0,0,0.55)] grid grid-cols-2 gap-1"
        >
          {TOOLS.map((tool) => (
            <Link
              key={tool.href + tool.key}
              href={tool.href}
              role="menuitem"
              className="flex items-center gap-2.5 no-underline rounded-xl px-3 py-2.5 text-ink-soft hover:text-ink hover:bg-[rgba(63,203,155,0.1)] transition-colors"
            >
              <ToolIcon name={tool.key} size={18} className="text-emerald shrink-0" />
              <span className="text-[13px] font-bold leading-tight">{toolLabel(tool.href, tool.key)}</span>
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
