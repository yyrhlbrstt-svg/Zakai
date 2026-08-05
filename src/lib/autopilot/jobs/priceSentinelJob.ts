import "server-only";

import { prisma } from "@/lib/prisma";
import type { AutopilotJobResult } from "../findings";

export interface PriceFeed {
  provider: string;
  url: string;
  market?: string;
}

function priceFeeds(): PriceFeed[] {
  const raw = process.env.AUTOPILOT_PRICE_FEEDS_JSON?.trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as PriceFeed[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function runPriceSentinel(): Promise<AutopilotJobResult> {
  const feeds = priceFeeds();
  const findings: AutopilotJobResult["findings"] = [];

  if (feeds.length === 0) {
    return {
      ok: true,
      summary: "Price Sentinel: no AUTOPILOT_PRICE_FEEDS_JSON configured.",
      findings: [
        {
          kind: "price_sentinel_unconfigured",
          severity: "note",
          message: "Set AUTOPILOT_PRICE_FEEDS_JSON to enable public price page watches.",
        },
      ],
    };
  }

  const { fetchSourceBody, hashContent } = await import("@/lib/autopilot/lawWatcher");
  let changes = 0;

  for (const feed of feeds) {
    const body = await fetchSourceBody(feed.url);
    if (!body) {
      findings.push({
        kind: "price_fetch_failed",
        severity: "warning",
        message: `Failed to fetch ${feed.url}`,
        meta: { provider: feed.provider },
      });
      continue;
    }
    const hash = hashContent(body);
    const key = `price:${feed.provider}`;
    const prev = await prisma.autopilotSourceSnapshot.findUnique({ where: { sourceUrl: key } });

    if (!prev) {
      await prisma.autopilotSourceSnapshot.create({
        data: {
          sourceUrl: key,
          market: feed.market ?? "IL",
          rightId: feed.provider,
          contentHash: hash,
          lastSnippet: body.slice(0, 10_000),
        },
      });
      continue;
    }

    if (prev.contentHash !== hash) {
      changes++;
      await prisma.autopilotSourceSnapshot.update({
        where: { sourceUrl: key },
        data: {
          contentHash: hash,
          lastSnippet: body.slice(0, 10_000),
          lastChangedAt: new Date(),
        },
      });
      findings.push({
        kind: "price_page_changed",
        severity: "warning",
        message: `Public price page changed for ${feed.provider}`,
        meta: { provider: feed.provider, url: feed.url },
      });
    }
  }

  return {
    ok: true,
    summary: `Price Sentinel: ${feeds.length} feed(s), ${changes} change(s).`,
    findings,
  };
}
