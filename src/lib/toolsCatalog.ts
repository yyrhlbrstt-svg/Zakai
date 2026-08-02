/**
 * Single catalog for header, /tools hub, and SEO. CEO rule: nav shows featured
 * only; full inventory lives on /tools.
 */

export type ToolCategory = "agent" | "rights" | "global" | "selfHelp" | "developers";

export interface ToolEntry {
  href: string;
  key: string;
  category: ToolCategory;
  /** Shown in header dropdown (max ~12). */
  featured?: boolean;
  agentic?: boolean;
}

export const TOOL_CATALOG: readonly ToolEntry[] = [
  { href: "/money", key: "money", category: "agent", featured: true, agentic: true },
  { href: "/cancel", key: "cancel", category: "agent", featured: true, agentic: true },
  { href: "/check", key: "newCheck", category: "agent", featured: true, agentic: true },
  { href: "/bank-fees", key: "bankfees", category: "agent", featured: true, agentic: true },
  { href: "/electricity", key: "electricity", category: "agent", featured: true, agentic: true },
  { href: "/flights", key: "flights", category: "agent", featured: true, agentic: true },
  { href: "/refund-chase", key: "refundchase", category: "agent", featured: true, agentic: true },
  { href: "/what-am-i-owed", key: "whatAmIOwed", category: "rights", featured: true },
  { href: "/entitlements", key: "entitlements", category: "rights", featured: true },
  { href: "/rights", key: "rights", category: "rights", featured: true },
  { href: "/leaks", key: "leaks", category: "agent", featured: true },
  { href: "/proofs", key: "proofs", category: "agent", featured: true },
  { href: "/incident", key: "incident", category: "selfHelp" },
  { href: "/dormant", key: "dormant", category: "rights" },
  { href: "/vehicle-check", key: "vehicleCheck", category: "selfHelp" },
  { href: "/credit-card", key: "creditcard", category: "selfHelp" },
  { href: "/score", key: "score", category: "selfHelp" },
  { href: "/scan", key: "scan", category: "agent", agentic: true },
  { href: "/spending", key: "spending", category: "selfHelp" },
  { href: "/vat", key: "vat", category: "selfHelp" },
  { href: "/insurance-compare", key: "insurancecompare", category: "selfHelp" },
  { href: "/debt-consolidation", key: "debt", category: "selfHelp" },
  { href: "/lost-money", key: "lostmoney", category: "rights" },
  { href: "/compensation-claims", key: "compensation", category: "rights" },
  { href: "/class-action", key: "classaction", category: "rights" },
  { href: "/child-savings", key: "childsavings", category: "rights" },
  { href: "/arnona", key: "arnona", category: "rights" },
  { href: "/disability-benefits", key: "disability", category: "rights" },
  { href: "/construction-defects", key: "defects", category: "rights" },
  { href: "/alimony-guarantee", key: "alimonyGuarantee", category: "rights" },
  { href: "/business-compensation", key: "businessCompensation", category: "rights" },
  { href: "/holocaust-survivors", key: "holocaustSurvivors", category: "rights" },
  { href: "/car-value", key: "carvalue", category: "selfHelp" },
  { href: "/mortgage-insurance", key: "mortins", category: "selfHelp" },
  { href: "/duplicate-insurance", key: "dupinsurance", category: "agent", agentic: true },
  { href: "/pension-fees", key: "pension", category: "selfHelp" },
  { href: "/mortgage", key: "mortgage", category: "selfHelp" },
  { href: "/deposit", key: "deposit", category: "agent", agentic: true },
  { href: "/deals", key: "deals", category: "selfHelp" },
  { href: "/integrations", key: "integrations", category: "developers", featured: true },
  { href: "/network-proof", key: "networkProof", category: "developers", featured: true },
  { href: "/student-loan-overpayment", key: "studentLoan", category: "global" },
  { href: "/wage-statement-audit", key: "wageAudit", category: "global" },
  { href: "/debt-collector-dispute", key: "debtCollector", category: "global" },
  { href: "/train-delay", key: "trainDelay", category: "rights" },
  { href: "/consumer-cancel", key: "consumerCancel", category: "agent" },
  { href: "/toll-dispute", key: "tollDispute", category: "selfHelp" },
  { href: "/vehicle-license-refund", key: "vehicleLicenseRefund", category: "selfHelp" },
  { href: "/collection-complaint", key: "collectionComplaint", category: "selfHelp" },
  { href: "/car-insurance-refund", key: "carInsuranceRefund", category: "selfHelp" },
  { href: "/vaad-bait", key: "vaadBait", category: "rights" },
  { href: "/water-bill", key: "waterBill", category: "rights" },
  { href: "/landlord-repairs", key: "landlordRepairs", category: "rights" },
  { href: "/duplicate-charge", key: "duplicateCharge", category: "agent", agentic: true },
  { href: "/telecom-exit", key: "telecomExit", category: "agent", agentic: true },
  { href: "/payslip", key: "payslip", category: "selfHelp" },
  { href: "/severance", key: "severance", category: "selfHelp" },
  { href: "/maternity", key: "maternity", category: "rights" },
  { href: "/taxrefund", key: "taxrefund", category: "rights" },
  { href: "/unemployment", key: "unemployment", category: "rights" },
  { href: "/olim", key: "olim", category: "rights" },
  { href: "/parking", key: "parking", category: "agent", agentic: true },
  { href: "/transport-fine", key: "transportFine", category: "agent", agentic: true },
  { href: "/baggage", key: "baggage", category: "selfHelp" },
  { href: "/price-protection", key: "priceprotection", category: "selfHelp" },
  { href: "/warranty", key: "warranty", category: "selfHelp" },
  { href: "/miluim", key: "miluim", category: "rights" },
  { href: "/contract-check", key: "contractCheck", category: "selfHelp" },
  { href: "/overtime-backpay", key: "overtimeBackPay", category: "selfHelp" },
  { href: "/late-payment", key: "latePayment", category: "agent", agentic: true },
  { href: "/scam-check", key: "scamCheck", category: "selfHelp" },
  { href: "/complaint-escalation", key: "complaintEscalation", category: "selfHelp" },
  { href: "/deadlines", key: "deadlines", category: "selfHelp" },
  { href: "/advance-tax", key: "advanceTax", category: "selfHelp" },
  { href: "/school-payments", key: "schoolPayments", category: "selfHelp" },
] as const;

export const FEATURED_TOOLS = TOOL_CATALOG.filter((t) => t.featured);

export const CATEGORY_ORDER: ToolCategory[] = ["agent", "rights", "global", "selfHelp", "developers"];

export function toolsInCategory(cat: ToolCategory): ToolEntry[] {
  return TOOL_CATALOG.filter((t) => t.category === cat);
}
