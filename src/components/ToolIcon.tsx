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
  Clock,
  ShieldX,
  Megaphone,
  CalendarClock,
  Briefcase,
  School,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  money: Wallet,
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
  contractCheck: FileText,
  overtimeBackPay: Clock,
  latePayment: Banknote,
  scamCheck: ShieldX,
  complaintEscalation: Megaphone,
  deadlines: CalendarClock,
  advanceTax: Briefcase,
  schoolPayments: School,
};

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
