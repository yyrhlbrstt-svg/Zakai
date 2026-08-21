import { NextResponse } from "next/server";
import { openBankingProvider } from "@/lib/openBanking";
import { estimateFromFeed } from "@/lib/openBanking/estimate";
import { getSessionUserId } from "@/lib/auth/session";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { reportError } from "@/lib/report-error";

/**
 * Link an account and get the estimate, in one call.
 *
 * WHY THE ESTIMATE COMES BEFORE THE MANDATE
 *
 * The old order asked somebody to sign a power of attorney and *then* showed
 * them what it was worth. That is backwards: the signature is the expensive
 * act and the number is the reason to perform it. So this route deliberately
 * requires no Mandate — reading a feed the person just connected is not acting
 * on their behalf against anybody.
 *
 * WHY IT STILL REQUIRES A SESSION
 *
 * Account data belongs to an account. There is nowhere to put a linked feed
 * for an anonymous visitor, and nothing to revoke later.
 *
 * WHAT IT REFUSES TO DO
 *
 * It never returns a figure without saying whether the figure is real.
 * `isLive` rides on the response for exactly that reason: with the mock
 * provider in play these are fixtures, and a client that renders the number
 * without the label would be inventing an amount — the first thing this
 * product is not allowed to do.
 */

/**
 * Six months back.
 *
 * Three was the first guess and it is too short for the finding that matters
 * most: a price step-up needs a settled "before" AND a settled "after", which
 * is four or five monthly charges, not three. Six months is also what makes
 * the confidence score mean anything — the detector saturates at five
 * sightings, and a ninety-day window can never supply them.
 */
const WINDOW_DAYS = 183;

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function POST(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const limited = await rateLimit("ob-estimate", userId || clientIp(request), 30, 3600);
  if (!limited.ok) return NextResponse.json({ ok: false, error: "tooManyRequests" }, { status: 429 });

  try {
    const provider = openBankingProvider();
    const accounts = await provider.getAccounts(userId);

    const to = new Date();
    const from = new Date(to.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const range = { from: isoDay(from), to: isoDay(to) };

    const all = (
      await Promise.all(accounts.map((a) => provider.getTransactions(a.resourceId, range)))
    ).flat();

    const estimate = estimateFromFeed(all, provider.isLive);

    return NextResponse.json({
      ok: true,
      providerId: provider.id,
      isLive: provider.isLive,
      accounts: accounts.map((a) => ({
        resourceId: a.resourceId,
        label: a.name ?? a.product ?? a.resourceId,
        // Never the full IBAN or PAN to the client: the last four is all a
        // person needs to recognise the account, and all we should hold in a
        // browser tab.
        tail: (a.maskedPan ?? a.iban ?? "").slice(-4),
        type: a.cashAccountType,
      })),
      estimate: {
        monthlyAgorot: estimate.monthlyAgorot,
        transactionsRead: estimate.transactionsRead,
        claimable: estimate.claimable.map((c) => ({
          merchant: c.merchant,
          monthlyAgorot: c.monthlyAgorot,
          category: c.category,
          occurrences: c.occurrences,
        })),
        heldBackCount: estimate.heldBack.length,
        priceIncreases: estimate.priceIncreases.map((p) => ({
          merchant: p.merchant,
          fromAgorot: p.fromAgorot,
          toAgorot: p.toAgorot,
          deltaAgorot: p.deltaAgorot,
          claimable: p.claimable,
        })),
      },
    });
  } catch (err) {
    await reportError(err, { route: "open-banking/estimate" });
    return NextResponse.json({ ok: false, error: "genericError" }, { status: 500 });
  }
}
