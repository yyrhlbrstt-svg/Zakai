import "server-only";
import { prisma } from "@/lib/prisma";
import { pushToUser, pushConfigured } from "@/lib/push";
import { evaluateRights, type RightsProfile } from "@/lib/rights";
import { summariseWatch, todaysAlert, type WatchItem } from "./watch";

/**
 * The watch, running while nobody is looking.
 *
 * This is the whole point of the feature and the reason it cannot be a chat: a
 * person does not have to think to ask, on the right day, about a thing they do
 * not know exists. The cron thinks for them.
 *
 * Everything here is built around not abusing that. A daily job with permission
 * to send notifications is one bad decision away from being the reason somebody
 * turns them off — and the right to interrupt, once spent, does not come back.
 */

/** Never alert the same person twice in this window, whatever is on the clock. */
const QUIET_DAYS = 14;
/** How many accounts one run will touch. Keeps a cron inside its time budget. */
const BATCH = 500;

function alertKeyFor(item: WatchItem): string {
  return item.taxYear ? `${item.rightId}:${item.taxYear}` : item.rightId;
}

export interface VigilRunResult {
  considered: number;
  sent: number;
  /** Skipped because the person was alerted recently, not because nothing was due. */
  quieted: number;
  /** Skipped because we had already alerted about that exact deadline. */
  duplicates: number;
}

/**
 * One pass over everyone with a mirrored profile.
 *
 * Reads the profile from the account rather than the device, because a watchdog
 * that only runs while the app is open is not a watchdog. Users who never
 * created an account are simply not here — which is the correct consequence of
 * having kept their answers on their own phone.
 */
export async function runVigil(now: Date = new Date()): Promise<VigilRunResult> {
  const result: VigilRunResult = { considered: 0, sent: 0, quieted: 0, duplicates: 0 };
  if (!pushConfigured()) return result;

  const profiles = await prisma.userProfile.findMany({
    take: BATCH,
    orderBy: { updatedAt: "desc" },
    select: { userId: true, data: true },
  });

  const quietSince = new Date(now.getTime() - QUIET_DAYS * 86_400_000);

  for (const row of profiles) {
    result.considered++;
    try {
      const profile = row.data as unknown as RightsProfile;

      // A person who has been told something recently gets left alone, even if
      // something else came due. Two notifications in a fortnight from a money
      // app is how it starts reading as marketing.
      const recent = await prisma.vigilAlert.findFirst({
        where: { userId: row.userId, sentAt: { gte: quietSince } },
        select: { id: true },
      });
      if (recent) {
        result.quieted++;
        continue;
      }

      const rights = evaluateRights(profile);
      const actedOn = (
        await prisma.case.findMany({
          where: { userId: row.userId },
          select: { vertical: true },
        })
      ).map((c) => c.vertical);

      const summary = summariseWatch({
        profile,
        eligible: rights.matches.map((e) => ({
          id: e.id,
          yearlyMinor: e.yearlyAgorot,
          oneTimeMinor: e.oneTimeAgorot,
        })),
        actedOn,
        now,
      });

      const item = todaysAlert(summary);
      if (!item) continue;

      // Claim the alert first. If the push then fails we have still spent the
      // slot, which is the right way round: a notification sent twice is worse
      // than one missed, and the ledger is what makes "once, ever" true.
      const key = alertKeyFor(item);
      try {
        await prisma.vigilAlert.create({ data: { userId: row.userId, alertKey: key } });
      } catch {
        result.duplicates++;
        continue;
      }

      await pushToUser(row.userId, {
        title: alertTitle(item),
        body: alertBody(item),
        url: "/he/score",
        tag: `vigil:${key}`,
      });
      result.sent++;
    } catch (err) {
      // One malformed profile must not stop the run for everyone else.
      console.warn("[vigil] skipped a profile:", err);
    }
  }

  return result;
}

/**
 * Hebrew, and deliberately plain.
 *
 * No exclamation, no urgency language beyond the actual number of days. The
 * fact is alarming enough on its own, and dressing it up is what turns a
 * genuine warning into something people learn to swipe away.
 */
function alertTitle(item: WatchItem): string {
  const days = item.daysLeft ?? 0;
  return `נותרו ${days} ימים`;
}

function alertBody(item: WatchItem): string {
  const shekels = Math.round(item.valueAtRiskMinor / 100).toLocaleString("he-IL");
  const year = item.taxYear ? ` (שנת ${item.taxYear})` : "";
  return `סכום של כ-₪${shekels}${year} מפסיק להיות ניתן לתביעה. אפשר להתחיל מהאפליקציה.`;
}

/** Mirror a device profile onto the account. */
export async function saveProfileToAccount(userId: string, profile: RightsProfile) {
  await prisma.userProfile.upsert({
    where: { userId },
    create: { userId, data: profile as unknown as object },
    update: { data: profile as unknown as object },
  });
}
