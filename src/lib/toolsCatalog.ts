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
  // Featured = Tools dropdown only (Money is the chrome CTA — never duplicate it).
  // Cap: mature Mandate loops after /money. Full inventory on /tools.
  { href: "/money", key: "money", category: "agent", agentic: true },
  { href: "/assistant", key: "assistant", category: "agent" },
  { href: "/cancel", key: "cancel", category: "agent", featured: true, agentic: true },
  { href: "/cancel/universal", key: "universalCancel", category: "agent" },
  { href: "/check", key: "newCheck", category: "agent", agentic: true },
  { href: "/bank-fees", key: "bankfees", category: "agent", featured: true, agentic: true },
  { href: "/bank-loan-fee", key: "bankloanfee", category: "rights" },
  { href: "/electricity", key: "electricity", category: "agent", featured: true, agentic: true },
  { href: "/flights", key: "flights", category: "agent", agentic: true },
  { href: "/refund-chase", key: "refundchase", category: "agent", agentic: true },
  { href: "/what-am-i-owed", key: "whatAmIOwed", category: "rights" },
  { href: "/entitlements", key: "entitlements", category: "rights" },
  { href: "/rights", key: "rights", category: "rights" },
  { href: "/leaks", key: "leaks", category: "agent" },
  { href: "/proofs", key: "proofs", category: "agent" },
  { href: "/must-have", key: "mustHave", category: "agent" },
  { href: "/companies", key: "companiesFairness", category: "rights" },
  { href: "/regulatory", key: "regulatoryKit", category: "developers" },
  { href: "/incident", key: "incident", category: "selfHelp" },
  { href: "/dormant", key: "dormant", category: "rights" },
  { href: "/vehicle-check", key: "vehicleCheck", category: "selfHelp" },
  { href: "/credit-card", key: "creditcard", category: "selfHelp" },
  { href: "/score", key: "score", category: "selfHelp" },
  { href: "/scan", key: "scan", category: "agent", agentic: true },
  { href: "/receipts", key: "receipts", category: "agent", agentic: true },
  { href: "/small-business", key: "smallBusiness", category: "agent" },
  { href: "/spending", key: "spending", category: "selfHelp" },
  { href: "/vat", key: "vat", category: "selfHelp" },
  { href: "/insurance-compare", key: "insurancecompare", category: "selfHelp" },
  { href: "/debt-consolidation", key: "debt", category: "selfHelp" },
  { href: "/lost-money", key: "lostmoney", category: "rights" },
  { href: "/compensation-claims", key: "compensation", category: "rights" },
  { href: "/class-action", key: "classaction", category: "rights" },
  { href: "/child-savings", key: "childsavings", category: "rights" },
  { href: "/arnona", key: "arnona", category: "agent", agentic: true },
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
  { href: "/join-network", key: "joinNetwork", category: "developers" },
  { href: "/fairness-certified", key: "fairnessCertified", category: "developers" },
  { href: "/integrations", key: "integrations", category: "developers" },
  { href: "/domains", key: "domainsHub", category: "developers" },
  { href: "/standard", key: "standardInterop", category: "developers" },
  { href: "/protocol", key: "protocolPage", category: "developers" },
  { href: "/global", key: "globalMarkets", category: "global" },
  { href: "/institutions/leader", key: "institutionLeader", category: "developers" },
  { href: "/network-proof", key: "networkProof", category: "developers" },
  { href: "/student-loan-overpayment", key: "studentLoan", category: "global" },
  { href: "/wage-statement-audit", key: "wageAudit", category: "global" },
  { href: "/debt-collector-dispute", key: "debtCollector", category: "global" },
  { href: "/train-delay", key: "trainDelay", category: "agent", agentic: true },
  { href: "/consumer-cancel", key: "consumerCancel", category: "agent" },
  { href: "/toll-dispute", key: "tollDispute", category: "agent", agentic: true },
  { href: "/vehicle-license-refund", key: "vehicleLicenseRefund", category: "agent", agentic: true },
  { href: "/collection-complaint", key: "collectionComplaint", category: "selfHelp" },
  { href: "/car-insurance-refund", key: "carInsuranceRefund", category: "agent", agentic: true },
  { href: "/vaad-bait", key: "vaadBait", category: "rights" },
  { href: "/water-bill", key: "waterBill", category: "agent", agentic: true },
  { href: "/landlord-repairs", key: "landlordRepairs", category: "agent", agentic: true },
  { href: "/duplicate-charge", key: "duplicateCharge", category: "agent", agentic: true },
  // Quiz/letter page — Mandate loop is /check (do not label as agentic).
  { href: "/telecom-exit", key: "telecomExit", category: "selfHelp", agentic: false },
  { href: "/payslip", key: "payslip", category: "selfHelp" },
  { href: "/severance", key: "severance", category: "selfHelp" },
  { href: "/maternity", key: "maternity", category: "rights" },
  { href: "/taxrefund", key: "taxrefund", category: "rights" },
  { href: "/unemployment", key: "unemployment", category: "rights" },
  { href: "/olim", key: "olim", category: "rights" },
  { href: "/parking", key: "parking", category: "agent", agentic: true },
  { href: "/transport-fine", key: "transportFine", category: "agent", agentic: true },
  { href: "/baggage", key: "baggage", category: "agent", agentic: true },
  { href: "/price-protection", key: "priceprotection", category: "agent", agentic: true },
  { href: "/warranty", key: "warranty", category: "agent", agentic: true },
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
