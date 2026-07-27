/**
 * The profile, asked once and remembered.
 *
 * THE COMPLAINT THIS ANSWERS
 *
 * "Who has the energy to write things down or photograph things, and it wants
 * access to your bank — that isn't convenient."
 *
 * All three are true of the app today, and the third is the smallest problem.
 * The largest is that thirty-five tools each start from zero: the rights check
 * asks your age and whether you rent, the entitlement quiz asks again, the tax
 * tool asks again, and none of them remember you between visits. The effort is
 * not any single question — it is answering the same eight questions for the
 * ninth time and knowing you will answer them again next month.
 *
 * So: eight taps, no free text, no camera, no bank connection, stored on the
 * device, and every tool reads from it.
 *
 * WHY THE DEVICE AND NOT THE SERVER
 *
 * Because it has to work before signup. A profile that requires an account
 * puts a registration wall in front of the first useful thing the product does,
 * and the person who was going to bounce bounces there. It syncs to the account
 * when there is one; until then the value is delivered anyway.
 *
 * It also means the most sensitive facts a person gives us — disability, low
 * income, immigration status — never leave their phone unless they choose to
 * create an account. For a service whose users are disproportionately people
 * the system has already failed, that is not a nice-to-have.
 */

import type { RightsProfile } from "@/lib/rights";

const STORAGE_KEY = "zakai.profile.v1";

/**
 * Versioned on purpose. When the questions change, an old blob must be
 * discarded rather than half-read: a profile silently missing a field produces
 * a wrong entitlement list, and a wrong entitlement list is worse than no
 * entitlement list because the person believes it.
 */
export const PROFILE_VERSION = 1;

export interface StoredProfile {
  version: number;
  profile: RightsProfile;
  /** Rights the user has acted on, so the score survives a reload. */
  actedOn: string[];
  updatedAt: string;
}

export const DEFAULT_PROFILE: RightsProfile = {
  ageGroup: "25_44",
  employment: "employee",
  children: 0,
  childrenUnder6: 0,
  renting: false,
  lowIncome: false,
  newImmigrant: false,
  dischargedSoldier: false,
  reservist: false,
  disability: false,
};

/**
 * The questions that make up a complete profile. Completeness is measured as
 * "did you engage with this at all", not "did you answer yes" — a person with
 * no children has a complete profile, and scoring them as incomplete for it
 * would be both wrong and insulting.
 */
export const PROFILE_FIELDS: (keyof RightsProfile)[] = [
  "ageGroup",
  "employment",
  "children",
  "renting",
  "lowIncome",
  "newImmigrant",
  "dischargedSoldier",
  "disability",
];

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

/** Read the stored profile, or null when there is none or it is unusable. */
export function loadProfile(): StoredProfile | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredProfile>;
    if (parsed.version !== PROFILE_VERSION || !parsed.profile) return null;
    return {
      version: PROFILE_VERSION,
      // Merge over the defaults so a field added since this blob was written
      // has a value rather than being undefined inside an eligibility rule.
      profile: { ...DEFAULT_PROFILE, ...parsed.profile },
      actedOn: Array.isArray(parsed.actedOn) ? parsed.actedOn.filter((x) => typeof x === "string") : [],
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString(),
    };
  } catch {
    // Corrupt or unreadable (private mode, quota, a hand-edited value). Start
    // clean rather than throwing on a screen the user is trying to read.
    return null;
  }
}

export function saveProfile(profile: RightsProfile, actedOn: string[] = []): void {
  if (!isBrowser()) return;
  try {
    const payload: StoredProfile = {
      version: PROFILE_VERSION,
      profile,
      actedOn: [...new Set(actedOn)],
      updatedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Storage full or blocked. The profile still works for this session; losing
    // persistence is not worth interrupting anyone over.
  }
}

/** Mark a right as acted on, idempotently. */
export function markActedOn(rightId: string): string[] {
  const current = loadProfile();
  const next = [...new Set([...(current?.actedOn ?? []), rightId])];
  if (current) saveProfile(current.profile, next);
  return next;
}

export function clearProfile(): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing useful to do; the caller is already on a "cleared" screen.
  }
}

/**
 * How much of the profile has been engaged with, 0..1.
 *
 * A profile that has never been touched scores 0 even though every field has a
 * default, because defaults are our guess and not the person's answer. Treating
 * an untouched default as an answer would show a confident entitlement list
 * built entirely on assumptions.
 */
export function completeness(stored: StoredProfile | null): number {
  if (!stored) return 0;
  const differsFromDefault = PROFILE_FIELDS.some(
    (f) => stored.profile[f] !== DEFAULT_PROFILE[f],
  );
  // Touched at all counts as complete: every field has a valid value once the
  // person has been through the questions, and there is no partial state to
  // measure without asking them to prove they read each one.
  return differsFromDefault ? 1 : 0.5;
}
