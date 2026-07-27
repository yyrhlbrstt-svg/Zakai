import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_PROFILE,
  PROFILE_VERSION,
  clearProfile,
  completeness,
  loadProfile,
  markActedOn,
  saveProfile,
} from "./store";

/** A minimal localStorage, so these tests do not need a DOM environment. */
function installStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  const storage = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
    key: (i: number) => [...data.keys()][i] ?? null,
    get length() {
      return data.size;
    },
  };
  vi.stubGlobal("window", { localStorage: storage });
  return storage;
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe("asked once, remembered", () => {
  it("round-trips a profile", () => {
    installStorage();
    saveProfile({ ...DEFAULT_PROFILE, renting: true, children: 2 });
    const loaded = loadProfile();
    expect(loaded?.profile.renting).toBe(true);
    expect(loaded?.profile.children).toBe(2);
    expect(loaded?.version).toBe(PROFILE_VERSION);
  });

  it("returns null when nothing has been stored", () => {
    installStorage();
    expect(loadProfile()).toBeNull();
  });

  it("survives being called on the server, where there is no window", () => {
    vi.stubGlobal("window", undefined);
    expect(loadProfile()).toBeNull();
    expect(() => saveProfile(DEFAULT_PROFILE)).not.toThrow();
    expect(() => clearProfile()).not.toThrow();
  });
});

describe("it refuses to half-read a stale profile", () => {
  it("discards a blob from an older version", () => {
    installStorage({
      "zakai.profile.v1": JSON.stringify({ version: 0, profile: { renting: true } }),
    });
    expect(loadProfile()).toBeNull();
  });

  it("discards corrupt JSON rather than throwing on screen", () => {
    installStorage({ "zakai.profile.v1": "{not json at all" });
    expect(loadProfile()).toBeNull();
  });

  it("discards a blob with no profile in it", () => {
    installStorage({
      "zakai.profile.v1": JSON.stringify({ version: PROFILE_VERSION }),
    });
    expect(loadProfile()).toBeNull();
  });

  it("fills a field added since the blob was written, instead of leaving it undefined", () => {
    installStorage({
      "zakai.profile.v1": JSON.stringify({
        version: PROFILE_VERSION,
        profile: { renting: true },
        updatedAt: new Date().toISOString(),
      }),
    });
    const loaded = loadProfile()!;
    expect(loaded.profile.renting).toBe(true);
    // Every other field must have a real value — an eligibility rule that reads
    // `undefined` produces a wrong entitlement list.
    for (const [key, fallback] of Object.entries(DEFAULT_PROFILE)) {
      if (key === "renting") continue;
      expect(loaded.profile[key as keyof typeof DEFAULT_PROFILE]).toBe(fallback);
    }
  });

  it("drops non-string entries from actedOn", () => {
    installStorage({
      "zakai.profile.v1": JSON.stringify({
        version: PROFILE_VERSION,
        profile: DEFAULT_PROFILE,
        actedOn: ["real", 42, null, "also-real"],
      }),
    });
    expect(loadProfile()!.actedOn).toEqual(["real", "also-real"]);
  });
});

describe("acted-on tracking", () => {
  it("records a right and does not duplicate it", () => {
    installStorage();
    saveProfile(DEFAULT_PROFILE);
    markActedOn("tax_refund");
    markActedOn("tax_refund");
    markActedOn("arnona_senior");
    expect(loadProfile()!.actedOn.sort()).toEqual(["arnona_senior", "tax_refund"]);
  });

  it("does nothing harmful when there is no profile yet", () => {
    installStorage();
    expect(markActedOn("tax_refund")).toEqual(["tax_refund"]);
    expect(loadProfile()).toBeNull();
  });

  it("deduplicates on save", () => {
    installStorage();
    saveProfile(DEFAULT_PROFILE, ["a", "a", "b"]);
    expect(loadProfile()!.actedOn).toEqual(["a", "b"]);
  });
});

describe("completeness", () => {
  it("is zero with no profile at all", () => {
    expect(completeness(null)).toBe(0);
  });

  it("does not treat untouched defaults as answers", () => {
    installStorage();
    saveProfile(DEFAULT_PROFILE);
    expect(completeness(loadProfile())).toBe(0.5);
  });

  it("counts a profile the person actually changed as complete", () => {
    installStorage();
    saveProfile({ ...DEFAULT_PROFILE, disability: true });
    expect(completeness(loadProfile())).toBe(1);
  });
});

describe("storage failures never surface to the user", () => {
  it("swallows a write that throws (quota, private mode)", () => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => null,
        setItem: () => {
          throw new Error("QuotaExceededError");
        },
        removeItem: () => {
          throw new Error("blocked");
        },
      },
    });
    expect(() => saveProfile(DEFAULT_PROFILE)).not.toThrow();
    expect(() => clearProfile()).not.toThrow();
  });

  it("swallows a read that throws", () => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => {
          throw new Error("blocked");
        },
      },
    });
    expect(loadProfile()).toBeNull();
  });
});

describe("clearing", () => {
  it("removes the profile", () => {
    installStorage();
    saveProfile({ ...DEFAULT_PROFILE, renting: true });
    clearProfile();
    expect(loadProfile()).toBeNull();
  });
});
