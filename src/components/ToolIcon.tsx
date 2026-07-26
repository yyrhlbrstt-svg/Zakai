import {
  Gauge,
  ScanLine,
  Wallet,
  ShieldCheck,
  ShieldHalf,
  ShieldAlert,
  CreditCard,
  Coins,
  LifeBuoy,
  Scale,
  PiggyBank,
  House,
  Accessibility,
  Hammer,
  Car,
  LineChart,
  Landmark,
  Building2,
  KeyRound,
  TicketPercent,
  Target,
  ReceiptText,
  FileText,
  Baby,
  Banknote,
  Compass,
  PlaneLanding,
  SquareParking,
  Bus,
  Luggage,
  Tag,
  Wrench,
  Medal,
  BookOpen,
  Zap,
  Plane,
  Smartphone,
  Repeat,
  Calculator,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

/**
 * Single source of truth mapping every tool key to a real vector icon.
 *
 * Why this exists: the tools were previously rendered with emoji (📊, 🛡️, …).
 * Emoji render inconsistently across platforms — some show as flat glyphs,
 * some as full-color art, and a few (♿, 🅿️) fall back to tofu boxes on
 * Android/Chrome. A single lucide map gives one crisp, theme-colored,
 * accessible icon set everywhere, and keeps the header and home page in sync.
 */
const ICONS: Record<string, LucideIcon> = {
  spending: Wallet,
  insurancecompare: ShieldCheck,
  debt: CreditCard,
  lostmoney: Coins,
  compensation: LifeBuoy,
  classaction: Scale,
  childsavings: PiggyBank,
  arnona: House,
  disability: Accessibility,
  defects: Hammer,
  carvalue: Car,
  mortins: ShieldHalf,
  dupinsurance: ShieldAlert,
  pension: LineChart,
  mortgage: Landmark,
  deposit: KeyRound,
  deals: TicketPercent,
  entitlements: Target,
  payslip: ReceiptText,
  severance: FileText,
  maternity: Baby,
  taxrefund: Banknote,
  unemployment: Compass,
  olim: PlaneLanding,
  parking: SquareParking,
  transportFine: Bus,
  baggage: Luggage,
  bankfees: Building2,
  priceprotection: Tag,
  warranty: Wrench,
  miluim: Medal,
  rights: BookOpen,
  electricity: Zap,
  flights: Plane,
  mobile: Smartphone,
  subs: Repeat,
  vat: Calculator,
  score: Gauge,
  whatAmIOwed: Target,
  scan: ScanLine,
};

/** Plain inline icon (currentColor), used in dense lists like the nav menu. */
export function ToolIcon({
  name,
  size = 18,
  className,
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  const Icon = ICONS[name] ?? Sparkles;
  return <Icon size={size} strokeWidth={1.75} className={className} aria-hidden />;
}

/**
 * Premium tinted tile used on card grids (home verticals). The rounded emerald
 * tile reads as a designed product surface rather than a loose glyph.
 */
export function ToolIconTile({ name, size = 22 }: { name: string; size?: number }) {
  const Icon = ICONS[name] ?? Sparkles;
  return (
    <span
      className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-[rgba(63,203,155,0.12)] border border-[rgba(63,203,155,0.22)] text-emerald"
      aria-hidden
    >
      <Icon size={size} strokeWidth={1.75} />
    </span>
  );
}
