/**
 * Rights-as-a-service — a thin client for Zakai's public ZML rights catalog.
 *
 * Any app can call `GET /api/rights/catalog?market=IL` directly; this module
 * exists so a third-party developer doesn't have to hand-roll pagination,
 * error handling, and typing every time. It never asks for a Mandate or a
 * widget key — the catalog is public, read-only data (statute citations,
 * eligibility predicates, action metadata), not user data — see
 * `docs/WIDGET_EMBED.md` for the browser-embed path if you want a rendered
 * UI strip instead of raw data.
 *
 * This is deliberately the smallest useful surface: list what a market's
 * rights are, and fetch one in full (citation + how to act on it). Deciding
 * whether a specific person qualifies is the app's own eligibility logic —
 * this SDK ports catalog *data*, not the recommendation engine.
 */

export class RightsApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "RightsApiError";
  }
}

export interface RightsCatalogEntry {
  id: string;
  category: string;
  market: string;
  auto_eligible: boolean;
  label?: string;
  financial?: {
    yearly_minor?: number;
    one_time_minor?: number;
    currency?: string;
  };
  _links: {
    self: string;
    full: string;
    evaluate: string;
  };
}

export interface RightsCatalogPage {
  zml_version: string;
  api_version: string;
  market: string;
  total: number;
  rights: RightsCatalogEntry[];
  _links?: { next: string };
}

export interface ListRightsOptions {
  /** Base URL of the Zakai deployment, e.g. https://zakai-3uxj.vercel.app */
  origin: string;
  market: string;
  category?: string;
  /** BCP-47 locale for `label`; omit for raw (untranslated) entries. */
  locale?: string;
}

/** One page of the catalog — mirrors GET /api/rights/catalog exactly. */
export async function fetchRightsCatalogPage(
  opts: ListRightsOptions & { cursor?: string },
): Promise<RightsCatalogPage> {
  const url = new URL("/api/rights/catalog", opts.origin);
  url.searchParams.set("market", opts.market);
  if (opts.category) url.searchParams.set("category", opts.category);
  if (opts.locale) url.searchParams.set("locale", opts.locale);
  if (opts.cursor) url.searchParams.set("cursor", opts.cursor);

  let res: Response;
  try {
    res = await fetch(url, { headers: { accept: "application/json" } });
  } catch (err) {
    throw new RightsApiError(
      `rights catalog unreachable: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  if (!res.ok) {
    throw new RightsApiError(`rights catalog returned ${res.status}`, res.status);
  }
  return (await res.json()) as RightsCatalogPage;
}

/**
 * Every right for a market, auto-paginating. Capped at 20 pages (2,000
 * rights at the API's max page size) so a malformed cursor loop can't hang a
 * caller forever — no real market is anywhere near that size today.
 */
export async function listRights(opts: ListRightsOptions): Promise<RightsCatalogEntry[]> {
  const all: RightsCatalogEntry[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < 20; page++) {
    const doc = await fetchRightsCatalogPage({ ...opts, cursor });
    all.push(...doc.rights);
    const next = doc._links?.next;
    if (!next) break;
    cursor = new URL(next, opts.origin).searchParams.get("cursor") ?? undefined;
    if (!cursor) break;
  }
  return all;
}

export interface RightFullDocument {
  id: string;
  category: string;
  market: string;
  display_name: Record<string, string>;
  source: { reference: string };
  [key: string]: unknown;
}

/** The full ZML document for one right — citation, predicate, action. */
export async function fetchRight(origin: string, id: string): Promise<RightFullDocument> {
  const url = new URL(`/api/rights/catalog/${encodeURIComponent(id)}`, origin);
  url.searchParams.set("full", "1");
  let res: Response;
  try {
    res = await fetch(url, { headers: { accept: "application/json" } });
  } catch (err) {
    throw new RightsApiError(
      `rights catalog unreachable: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  if (!res.ok) {
    throw new RightsApiError(`right "${id}" returned ${res.status}`, res.status);
  }
  return (await res.json()) as RightFullDocument;
}

export interface EvaluationGuide {
  id: string;
  [key: string]: unknown;
}

/** Machine-readable guide for deciding whether a specific right applies. */
export async function fetchEvaluationGuide(origin: string, id: string): Promise<EvaluationGuide> {
  const url = new URL(`/api/rights/evaluate/${encodeURIComponent(id)}`, origin);
  let res: Response;
  try {
    res = await fetch(url, { headers: { accept: "application/json" } });
  } catch (err) {
    throw new RightsApiError(
      `evaluation guide unreachable: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  if (!res.ok) {
    throw new RightsApiError(`evaluation guide for "${id}" returned ${res.status}`, res.status);
  }
  return (await res.json()) as EvaluationGuide;
}
