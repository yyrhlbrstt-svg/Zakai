/**
 * The Rights Engine — the literal meaning of the brand: "זכאי" = entitled.
 *
 * A deterministic catalog of Israeli entitlements and benefits, filtered by a
 * short household profile. This is the breadth play done honestly: one
 * engine, 40+ real rights across tax, national insurance, municipal, banking,
 * consumer, army, family, seniors and housing — each with an eligibility
 * rule, an (optional, conservative) value estimate, and a how-to-claim hint.
 *
 * Amounts are only attached where they are stable and well-known; everything
 * else is marked "varies" rather than invented. Nothing here is legal advice
 * and the UI says so. Money in agorot.
 *
 * World-ready: the catalog is now per-country (RIGHTS_CATALOGS). Israel is the
 * complete one; the US and UK carry real, well-known federal/national programs
 * so "each country has its own rights" — exactly the Israel model, per market.
 * Adding a country is adding a catalog here, never editing the engine. Foreign
 * catalogs attach NO money amounts (shown as "varies") — honest, and it avoids
 * ever printing ₪ against a non-Israeli benefit.
 */
import type { CountryCode } from "@/lib/verticals/types";

export interface RightsProfile {
  ageGroup: "18_24" | "25_44" | "45_66" | "67_plus";
  employment: "employee" | "self_employed" | "unemployed" | "student" | "soldier" | "retired";
  children: number;
  childrenUnder6: number;
  renting: boolean;
  lowIncome: boolean;
  newImmigrant: boolean;
  dischargedSoldier: boolean;
  reservist: boolean;
  disability: boolean;
}

export type RightCategory =
  | "tax"
  | "bituach"
  | "municipal"
  | "banking"
  | "consumer"
  | "health"
  | "work"
  | "transport"
  | "education"
  | "army"
  | "family"
  | "senior"
  | "housing"
  | "benefits"; // welfare / social-security programs (used by non-IL catalogs)

export interface Entitlement {
  id: string;
  category: RightCategory;
  eligible: (p: RightsProfile) => boolean;
  /** Conservative yearly value in agorot, when honestly quantifiable. */
  yearlyAgorot?: number;
  /** One-time value in agorot, when honestly quantifiable. */
  oneTimeAgorot?: number;
}

const senior = (p: RightsProfile) => p.ageGroup === "67_plus" || p.employment === "retired";
const working = (p: RightsProfile) => p.employment === "employee" || p.employment === "self_employed";
const parent = (p: RightsProfile) => p.children > 0;

export const ENTITLEMENTS: Entitlement[] = [
  // ---- Tax (מס הכנסה) ----
  { id: "tax_refund", category: "tax", eligible: working },
  { id: "work_grant", category: "tax", eligible: (p) => working(p) && p.lowIncome },
  { id: "credit_children", category: "tax", eligible: (p) => working(p) && parent(p) },
  { id: "credit_degree", category: "tax", eligible: (p) => working(p) && p.ageGroup !== "67_plus" },
  { id: "credit_oleh", category: "tax", eligible: (p) => p.newImmigrant && working(p) },
  { id: "credit_discharged", category: "tax", eligible: (p) => p.dischargedSoldier && working(p) },
  { id: "credit_donations", category: "tax", eligible: working },
  { id: "credit_pension_deposit", category: "tax", eligible: working },
  { id: "tax_disability_exemption", category: "tax", eligible: (p) => p.disability },

  // ---- National insurance (ביטוח לאומי) ----
  { id: "child_allowance", category: "bituach", eligible: parent },
  { id: "maternity_grant", category: "bituach", eligible: (p) => p.childrenUnder6 > 0 },
  { id: "unemployment_benefit", category: "bituach", eligible: (p) => p.employment === "unemployed" },
  { id: "income_support", category: "bituach", eligible: (p) => p.lowIncome && !working(p) },
  { id: "old_age_pension", category: "bituach", eligible: senior },
  { id: "miluim_pay", category: "bituach", eligible: (p) => p.reservist },
  { id: "disability_allowance", category: "bituach", eligible: (p) => p.disability },

  // ---- Municipal (ארנונה ומים) ----
  { id: "arnona_income", category: "municipal", eligible: (p) => p.lowIncome },
  { id: "arnona_oleh", category: "municipal", eligible: (p) => p.newImmigrant },
  { id: "arnona_senior", category: "municipal", eligible: senior },
  { id: "arnona_disability", category: "municipal", eligible: (p) => p.disability },
  { id: "arnona_soldier", category: "municipal", eligible: (p) => p.employment === "soldier" },
  { id: "water_disability", category: "municipal", eligible: (p) => p.disability },

  // ---- Banking (בנקים ואשראי) ----
  { id: "bank_basic_track", category: "banking", eligible: () => true, yearlyAgorot: 15_000 },
  { id: "bank_senior_track", category: "banking", eligible: (p) => senior(p) || p.disability },
  { id: "bank_soldier_student", category: "banking", eligible: (p) => p.employment === "soldier" || p.employment === "student" },
  { id: "credit_report_free", category: "banking", eligible: () => true },
  { id: "dormant_money", category: "banking", eligible: () => true },

  // ---- Consumer (הבית של זכאי) ----
  { id: "mobile_check", category: "consumer", eligible: () => true },
  { id: "electricity_switch", category: "consumer", eligible: () => true },
  { id: "electricity_social", category: "consumer", eligible: (p) => p.lowIncome || p.disability || senior(p) },
  { id: "flight_comp", category: "consumer", eligible: () => true },
  { id: "subscription_audit", category: "consumer", eligible: () => true },
  { id: "insurance_duplicates", category: "consumer", eligible: () => true },
  { id: "pension_fees", category: "consumer", eligible: working },

  // ---- Health (בריאות) ----
  { id: "health_dental_kids", category: "health", eligible: parent },
  { id: "health_glasses_kids", category: "health", eligible: parent },
  { id: "health_er_exemption", category: "health", eligible: () => true },

  // ---- Work (זכויות בעבודה) ----
  { id: "work_havraa", category: "work", eligible: (p) => p.employment === "employee" },
  { id: "work_pension_mandatory", category: "work", eligible: (p) => p.employment === "employee" },
  { id: "work_travel", category: "work", eligible: (p) => p.employment === "employee" },
  { id: "work_overtime", category: "work", eligible: (p) => p.employment === "employee" },
  { id: "work_sick", category: "work", eligible: (p) => p.employment === "employee" },

  // ---- Transport (תחבורה) ----
  {
    id: "transport_youth",
    category: "transport",
    eligible: (p) =>
      p.ageGroup === "18_24" || p.employment === "student" || p.employment === "soldier",
  },

  // ---- Education (השכלה) ----
  { id: "student_scholarships", category: "education", eligible: (p) => p.employment === "student" },

  // ---- More consumer rights ----
  { id: "consumer_cancel14", category: "consumer", eligible: () => true },
  { id: "consumer_telecom_exit", category: "consumer", eligible: () => true },

  // ---- More national insurance ----
  { id: "mobility_allowance", category: "bituach", eligible: (p) => p.disability },

  // ---- Army (חיילים ומילואים) ----
  { id: "discharged_deposit", category: "army", eligible: (p) => p.dischargedSoldier },
  { id: "reservist_benefits", category: "army", eligible: (p) => p.reservist },

  // ---- Family ----
  { id: "daycare_subsidy", category: "family", eligible: (p) => p.childrenUnder6 > 0 && working(p) },
  { id: "child_savings", category: "family", eligible: parent },

  // ---- Seniors ----
  { id: "senior_card", category: "senior", eligible: senior },
  { id: "heating_grant", category: "senior", eligible: (p) => senior(p) && p.lowIncome },

  // ---- Housing ----
  { id: "rent_assistance", category: "housing", eligible: (p) => p.renting && p.lowIncome },
  { id: "mortgage_refinance", category: "housing", eligible: (p) => !p.renting },
];

/**
 * United States — real, well-known federal programs. No amounts attached: US
 * benefit values are means-tested and state-variable, so they honestly show as
 * "varies" (and never print ₪). IL-specific profile flags simply go unused here.
 */
export const US_ENTITLEMENTS: Entitlement[] = [
  { id: "us_eitc", category: "tax", eligible: (p) => working(p) && p.lowIncome },
  { id: "us_ctc", category: "tax", eligible: (p) => working(p) && parent(p) },
  { id: "us_savers_credit", category: "tax", eligible: (p) => working(p) && p.lowIncome },
  { id: "us_snap", category: "benefits", eligible: (p) => p.lowIncome },
  { id: "us_medicaid", category: "health", eligible: (p) => p.lowIncome },
  { id: "us_aca_subsidy", category: "health", eligible: () => true },
  { id: "us_unemployment", category: "benefits", eligible: (p) => p.employment === "unemployed" },
  { id: "us_ssdi", category: "benefits", eligible: (p) => p.disability },
  { id: "us_social_security", category: "senior", eligible: senior },
  { id: "us_liheap", category: "benefits", eligible: (p) => p.lowIncome },
  { id: "us_section8", category: "housing", eligible: (p) => p.renting && p.lowIncome },
  { id: "us_pell_grant", category: "education", eligible: (p) => p.employment === "student" },
  { id: "us_lifeline", category: "consumer", eligible: (p) => p.lowIncome },
  { id: "us_401k_match", category: "work", eligible: (p) => p.employment === "employee" },
  { id: "us_free_credit_report", category: "banking", eligible: () => true },
];

/**
 * United Kingdom — real, well-known national/DWP/HMRC programs. Amounts "varies"
 * for the same means-tested reason.
 */
export const UK_ENTITLEMENTS: Entitlement[] = [
  { id: "uk_universal_credit", category: "benefits", eligible: (p) => p.lowIncome },
  { id: "uk_child_benefit", category: "family", eligible: parent },
  { id: "uk_marriage_allowance", category: "tax", eligible: working },
  { id: "uk_council_tax_reduction", category: "benefits", eligible: (p) => p.lowIncome },
  { id: "uk_jsa", category: "benefits", eligible: (p) => p.employment === "unemployed" },
  { id: "uk_state_pension", category: "senior", eligible: senior },
  { id: "uk_pip", category: "benefits", eligible: (p) => p.disability },
  { id: "uk_winter_fuel", category: "senior", eligible: senior },
  { id: "uk_warm_home_discount", category: "benefits", eligible: (p) => p.lowIncome },
  { id: "uk_housing_benefit", category: "housing", eligible: (p) => p.renting && p.lowIncome },
  { id: "uk_free_childcare", category: "family", eligible: (p) => p.childrenUnder6 > 0 && working(p) },
  { id: "uk_student_finance", category: "education", eligible: (p) => p.employment === "student" },
  { id: "uk_pension_auto_enrolment", category: "work", eligible: (p) => p.employment === "employee" },
  { id: "uk_free_prescriptions", category: "health", eligible: () => true },
  { id: "uk_help_to_save", category: "banking", eligible: (p) => p.lowIncome && working(p) },
];

/**
 * Germany — real, well-known federal programs (Bund / Bundesagentur für Arbeit
 * / Familienkasse). Amounts "varies" for the same means-tested reason; formatted
 * in € via the DE market when a value ever is attached.
 */
export const DE_ENTITLEMENTS: Entitlement[] = [
  { id: "de_buergergeld", category: "benefits", eligible: (p) => p.lowIncome || p.employment === "unemployed" },
  { id: "de_arbeitslosengeld", category: "benefits", eligible: (p) => p.employment === "unemployed" },
  { id: "de_kindergeld", category: "family", eligible: parent },
  { id: "de_kinderzuschlag", category: "family", eligible: (p) => parent(p) && p.lowIncome },
  { id: "de_elterngeld", category: "family", eligible: (p) => p.childrenUnder6 > 0 },
  { id: "de_wohngeld", category: "housing", eligible: (p) => p.renting && p.lowIncome },
  { id: "de_bafog", category: "education", eligible: (p) => p.employment === "student" },
  { id: "de_gesetzliche_rente", category: "senior", eligible: senior },
  { id: "de_pflegegrad", category: "benefits", eligible: (p) => p.disability },
  { id: "de_schwerbehinderung", category: "benefits", eligible: (p) => p.disability },
  { id: "de_bildung_teilhabe", category: "family", eligible: (p) => parent(p) && p.lowIncome },
  { id: "de_rundfunk_befreiung", category: "consumer", eligible: (p) => p.lowIncome || p.disability },
  { id: "de_riester_zulage", category: "tax", eligible: (p) => working(p) },
  { id: "de_krankenversicherung", category: "health", eligible: () => true },
  { id: "de_schufa_auskunft", category: "banking", eligible: () => true },
];

/** Canada — federal programs (CRA / Service Canada). Amounts "varies". */
export const CA_ENTITLEMENTS: Entitlement[] = [
  { id: "ca_gst_credit", category: "tax", eligible: (p) => p.lowIncome },
  { id: "ca_canada_child_benefit", category: "family", eligible: parent },
  { id: "ca_canada_workers_benefit", category: "tax", eligible: (p) => working(p) && p.lowIncome },
  { id: "ca_ei", category: "benefits", eligible: (p) => p.employment === "unemployed" },
  { id: "ca_oas", category: "senior", eligible: senior },
  { id: "ca_gis", category: "benefits", eligible: (p) => senior(p) && p.lowIncome },
  { id: "ca_cpp", category: "senior", eligible: senior },
  { id: "ca_disability_tax_credit", category: "benefits", eligible: (p) => p.disability },
  { id: "ca_housing_benefit", category: "housing", eligible: (p) => p.renting && p.lowIncome },
  { id: "ca_student_grants", category: "education", eligible: (p) => p.employment === "student" },
  { id: "ca_childcare", category: "family", eligible: (p) => p.childrenUnder6 > 0 },
];

/** Australia — Services Australia / Centrelink programs. Amounts "varies". */
export const AU_ENTITLEMENTS: Entitlement[] = [
  { id: "au_family_tax_benefit", category: "family", eligible: parent },
  { id: "au_jobseeker", category: "benefits", eligible: (p) => p.employment === "unemployed" },
  { id: "au_age_pension", category: "senior", eligible: senior },
  { id: "au_disability_support_pension", category: "benefits", eligible: (p) => p.disability },
  { id: "au_rent_assistance", category: "housing", eligible: (p) => p.renting && p.lowIncome },
  { id: "au_childcare_subsidy", category: "family", eligible: (p) => p.childrenUnder6 > 0 && working(p) },
  { id: "au_youth_allowance", category: "education", eligible: (p) => p.employment === "student" },
  { id: "au_low_income_card", category: "benefits", eligible: (p) => p.lowIncome },
  { id: "au_parenting_payment", category: "family", eligible: (p) => parent(p) && p.lowIncome },
  { id: "au_superannuation", category: "work", eligible: (p) => p.employment === "employee" },
];

/** France — service-public / CAF / Pôle emploi programs. Amounts "varies". */
export const FR_ENTITLEMENTS: Entitlement[] = [
  { id: "fr_rsa", category: "benefits", eligible: (p) => p.lowIncome },
  { id: "fr_prime_activite", category: "tax", eligible: (p) => working(p) && p.lowIncome },
  { id: "fr_allocations_familiales", category: "family", eligible: parent },
  { id: "fr_apl", category: "housing", eligible: (p) => p.renting && p.lowIncome },
  { id: "fr_chomage", category: "benefits", eligible: (p) => p.employment === "unemployed" },
  { id: "fr_retraite", category: "senior", eligible: senior },
  { id: "fr_aah", category: "benefits", eligible: (p) => p.disability },
  { id: "fr_paje", category: "family", eligible: (p) => p.childrenUnder6 > 0 },
  { id: "fr_bourse", category: "education", eligible: (p) => p.employment === "student" },
  { id: "fr_cheque_energie", category: "consumer", eligible: (p) => p.lowIncome },
];

/** Ireland — DSP / Citizens Information programs. Amounts "varies". */
export const IE_ENTITLEMENTS: Entitlement[] = [
  { id: "ie_child_benefit", category: "family", eligible: parent },
  { id: "ie_jobseekers", category: "benefits", eligible: (p) => p.employment === "unemployed" },
  { id: "ie_state_pension", category: "senior", eligible: senior },
  { id: "ie_disability_allowance", category: "benefits", eligible: (p) => p.disability },
  { id: "ie_hap", category: "housing", eligible: (p) => p.renting && p.lowIncome },
  { id: "ie_working_family_payment", category: "family", eligible: (p) => working(p) && parent(p) && p.lowIncome },
  { id: "ie_fuel_allowance", category: "benefits", eligible: (p) => p.lowIncome },
  { id: "ie_susi_grant", category: "education", eligible: (p) => p.employment === "student" },
  { id: "ie_medical_card", category: "health", eligible: (p) => p.lowIncome },
  { id: "ie_back_to_school", category: "family", eligible: (p) => parent(p) && p.lowIncome },
];

/** Netherlands — Belastingdienst / UWV / SVB programs. Amounts "varies". */
export const NL_ENTITLEMENTS: Entitlement[] = [
  { id: "nl_zorgtoeslag", category: "health", eligible: (p) => p.lowIncome },
  { id: "nl_huurtoeslag", category: "housing", eligible: (p) => p.renting && p.lowIncome },
  { id: "nl_kinderbijslag", category: "family", eligible: parent },
  { id: "nl_kindgebonden_budget", category: "family", eligible: (p) => parent(p) && p.lowIncome },
  { id: "nl_ww", category: "benefits", eligible: (p) => p.employment === "unemployed" },
  { id: "nl_aow", category: "senior", eligible: senior },
  { id: "nl_bijstand", category: "benefits", eligible: (p) => p.lowIncome },
  { id: "nl_wia", category: "benefits", eligible: (p) => p.disability },
  { id: "nl_studiefinanciering", category: "education", eligible: (p) => p.employment === "student" },
  { id: "nl_kinderopvangtoeslag", category: "family", eligible: (p) => p.childrenUnder6 > 0 && working(p) },
];

/** Spain — Seguridad Social / SEPE programs. Amounts "varies". */
export const ES_ENTITLEMENTS: Entitlement[] = [
  { id: "es_ingreso_minimo_vital", category: "benefits", eligible: (p) => p.lowIncome },
  { id: "es_prestacion_desempleo", category: "benefits", eligible: (p) => p.employment === "unemployed" },
  { id: "es_pension_jubilacion", category: "senior", eligible: senior },
  { id: "es_ayuda_familia", category: "family", eligible: parent },
  { id: "es_ingreso_discapacidad", category: "benefits", eligible: (p) => p.disability },
  { id: "es_bono_social_electrico", category: "consumer", eligible: (p) => p.lowIncome },
  { id: "es_becas", category: "education", eligible: (p) => p.employment === "student" },
  { id: "es_ayuda_alquiler", category: "housing", eligible: (p) => p.renting && p.lowIncome },
  { id: "es_prestacion_hijo", category: "family", eligible: (p) => parent(p) && p.lowIncome },
];

/**
 * The rights catalog per market. Israel is the complete, money-quantified one;
 * others are the honest informational set for that country. Adding a country =
 * adding an entry here.
 */
export const RIGHTS_CATALOGS: Record<CountryCode, Entitlement[]> = {
  IL: ENTITLEMENTS,
  US: US_ENTITLEMENTS,
  UK: UK_ENTITLEMENTS,
  DE: DE_ENTITLEMENTS,
  CA: CA_ENTITLEMENTS,
  AU: AU_ENTITLEMENTS,
  FR: FR_ENTITLEMENTS,
  IE: IE_ENTITLEMENTS,
  NL: NL_ENTITLEMENTS,
  ES: ES_ENTITLEMENTS,
};

/** Countries with a rights catalog, for a UI selector. */
export const RIGHTS_COUNTRIES = Object.keys(RIGHTS_CATALOGS) as CountryCode[];

/**
 * A deep link into the country's OFFICIAL rights/benefits source for a given
 * entitlement title — never a third-party or invented source. IL → Kol-Zchut,
 * UK → GOV.UK, US → USA.gov.
 */
export function rightsSourceUrl(country: CountryCode, title: string): string {
  const q = encodeURIComponent(title);
  switch (country) {
    case "UK":
      return `https://www.gov.uk/search/all?keywords=${q}`;
    case "US":
      return `https://www.usa.gov/search?query=${q}`;
    case "DE":
      return `https://www.bund.de/SiteGlobals/Functions/Suche/Suche_Formular.html?input_=${q}`;
    case "CA":
      return `https://www.canada.ca/en/sr/srb.html?q=${q}`;
    case "AU":
      return `https://www.servicesaustralia.gov.au/search?query=${q}`;
    case "FR":
      return `https://www.service-public.fr/particuliers/recherche?keyword=${q}`;
    case "IE":
      return `https://www.citizensinformation.ie/en/search/?query=${q}`;
    case "NL":
      return `https://www.government.nl/search?query=${q}`;
    case "ES":
      return `https://administracion.gob.es/pagBuscador/buscar.html?query=${q}`;
    case "IL":
    default:
      return `https://www.kolzchut.org.il/he/Special:Search?search=${q}`;
  }
}

export interface RightsResult {
  matches: Entitlement[];
  /** Sum of the conservatively-quantifiable yearly values only. */
  quantifiedYearlyAgorot: number;
  byCategory: Map<RightCategory, Entitlement[]>;
}

export function evaluateRights(p: RightsProfile, country: CountryCode = "IL"): RightsResult {
  const catalog = RIGHTS_CATALOGS[country] ?? ENTITLEMENTS;
  const matches = catalog.filter((e) => e.eligible(p));
  const byCategory = new Map<RightCategory, Entitlement[]>();
  for (const e of matches) {
    const arr = byCategory.get(e.category);
    if (arr) arr.push(e);
    else byCategory.set(e.category, [e]);
  }
  return {
    matches,
    quantifiedYearlyAgorot: matches.reduce((s, e) => s + (e.yearlyAgorot ?? 0), 0),
    byCategory,
  };
}
