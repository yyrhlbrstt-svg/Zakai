/**
 * Maps a rights-engine entitlement id to the in-app path where the user can
 * actually act (full-service agent, letter, or lead). Keeps EntitlementQuiz
 * and any future surfaces aligned — one table, not scattered one-offs.
 *
 * Only routes that exist as pages today. Unknown ids fall through to /rights.
 */

/** Entitlements that close in a monetizable full-service loop (success fee). */
export const FULL_SERVICE_ENTITLEMENT_IDS = new Set([
  "mobile_check",
  "electricity_switch",
  "electricity_social",
  "flight_comp",
  "train_delay_compensation",
  "subscription_audit",
  "consumer_cancel14",
  "consumer_telecom_exit",
  "duplicate_charge_dispute",
  "bank_basic_track",
  "bank_senior_track",
  "bank_soldier_student",
]);

const ROUTES: Record<string, string> = {
  // Tax
  tax_refund: "/taxrefund",
  tax_coordination: "/taxrefund",
  work_grant: "/taxrefund",
  credit_children: "/taxrefund",
  credit_degree: "/taxrefund",
  credit_oleh: "/taxrefund",
  credit_discharged: "/taxrefund",
  credit_donations: "/taxrefund",
  credit_pension_deposit: "/taxrefund",
  tax_disability_exemption: "/taxrefund",
  credit_life_insurance: "/taxrefund",
  credit_special_needs_child: "/taxrefund",
  provident_withdrawal_refund: "/taxrefund",
  betterment_tax_refund: "/taxrefund",
  eligible_settlement_credit: "/taxrefund",

  // Bituach / benefits
  child_allowance: "/rights",
  maternity_grant: "/maternity",
  unemployment_benefit: "/unemployment",
  income_support: "/rights",
  old_age_pension: "/rights",
  miluim_pay: "/miluim",
  reservist_benefits: "/miluim",
  disability_allowance: "/disability-benefits",
  mobility_allowance: "/disability-benefits",
  long_term_care_benefit: "/rights",

  // Municipal
  arnona_income: "/arnona",
  arnona_oleh: "/arnona",
  arnona_senior: "/arnona",
  arnona_disability: "/arnona",
  arnona_soldier: "/arnona",
  arnona_large_family: "/arnona",
  arnona_area_correction: "/arnona",
  water_leak_credit: "/rights",
  water_disability: "/rights",

  // Banking / consumer money
  bank_basic_track: "/bank-fees",
  bank_senior_track: "/bank-fees",
  bank_soldier_student: "/bank-fees",
  credit_report_free: "/rights",
  dormant_money: "/dormant",
  hishtalmut_withdrawal: "/rights",
  mobile_check: "/money",
  electricity_switch: "/electricity",
  electricity_social: "/electricity",
  flight_comp: "/flights",
  train_delay_compensation: "/flights",
  subscription_audit: "/money",
  insurance_duplicates: "/duplicate-insurance",
  pension_fees: "/pension-fees",
  duplicate_charge_dispute: "/refund-chase",
  consumer_cancel14: "/cancel",
  consumer_telecom_exit: "/cancel",

  // Work
  work_havraa: "/rights",
  work_pension_mandatory: "/pension-fees",
  work_travel: "/rights",
  work_overtime: "/overtime-backpay",
  work_sick: "/rights",

  // Transport / family / housing
  route6_dispute: "/transport-fine",
  vehicle_license_fee_refund: "/rights",
  student_scholarships: "/rights",
  daycare_subsidy: "/rights",
  child_savings: "/child-savings",
  senior_card: "/rights",
  heating_grant: "/rights",
  rent_assistance: "/rights",
  mortgage_refinance: "/mortgage",
  discharged_deposit: "/rights",

  // Health
  health_dental_kids: "/rights",
  health_glasses_kids: "/rights",
  health_er_exemption: "/rights",
};

/**
 * Best in-app action for this entitlement. International pack ids (us_, uk_, gb_, …)
 * route to /rights until a dedicated vertical ships.
 */
export function actionRouteForEntitlement(id: string): string {
  const direct = ROUTES[id];
  if (direct) return direct;
  if (/^(us|uk|gb|de|fr|ca|au|it|ie|se|pl)_/.test(id)) return "/rights";
  return "/rights";
}

export function isFullServiceEntitlement(id: string): boolean {
  return FULL_SERVICE_ENTITLEMENT_IDS.has(id);
}
