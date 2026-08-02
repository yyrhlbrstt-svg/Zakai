import "server-only";
import { prisma } from "@/lib/prisma";
import { localePath, localeForCountry } from "@/lib/localePath";
import type { Locale } from "@/i18n/config";

const LOCALE_PREFIX = /^\/(he|en|ar|ru|de|fr)(\/|$)/;

async function resolvePushUrl(userId: string, url: string): Promise<string> {
  if (!url.startsWith("/") || LOCALE_PREFIX.test(url.split("?")[0] ?? url)) {
    return url;
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { country: true },
  });
  return localePath(localeForCountry(user?.country), url);
}

/**
 * Web Push (PWA). When VAPID keys are set, the agent can notify the installed
 * app the moment it acts — follow-up sent, inbound savings proposed, fee ready.
 *
 * Without VAPID keys the helper is a no-op (dev-safe). Delivery uses the
 * standard Web Push protocol; we avoid a heavy SDK and call the endpoint
 * with the browser's subscription keys when web-push is available at runtime.
 *
 * Generate keys once:
 *   npx web-push generate-vapid-keys
 * Store VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY in env (public also exposed as
 * NEXT_PUBLIC_VAPID_PUBLIC_KEY for the client subscribe flow).
 */

export function pushConfigured(): boolean {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

export function publicVapidKey(): string | null {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY || null;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

/**
 * Best-effort: send the same notification to every device the user has
 * subscribed. Expired endpoints are deleted. Never throws to callers.
 */
export async function pushToUser(userId: string, payload: PushPayload): Promise<number> {
  if (!pushConfigured()) return 0;

  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  if (subs.length === 0) return 0;

  // Dynamic import so the build does not fail when web-push is not installed yet.
  let webpush: {
    setVapidDetails: (subject: string, publicKey: string, privateKey: string) => void;
    sendNotification: (
      subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
      payload: string,
      options?: { TTL?: number },
    ) => Promise<unknown>;
  };
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    webpush = require("web-push");
  } catch {
    return 0;
  }

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:support@zakai.example",
    process.env.VAPID_PUBLIC_KEY as string,
    process.env.VAPID_PRIVATE_KEY as string,
  );

  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: await resolvePushUrl(userId, payload.url || "/dashboard"),
    tag: payload.tag || "zakai",
  });

  let sent = 0;
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        body,
        { TTL: 60 * 60 * 12 },
      );
      sent++;
    } catch (err: unknown) {
      const status = (err as { statusCode?: number })?.statusCode;
      // 404 / 410 = subscription gone — clean up.
      if (status === 404 || status === 410) {
        await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => null);
      }
    }
  }
  return sent;
}
