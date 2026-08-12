"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { usePathname } from "@/i18n/routing";

/**
 * Registers the PWA service worker and offers one-tap Web Push opt-in.
 * Shown only when:
 *  - browser supports Push + ServiceWorker
 *  - user is logged in (parent only mounts when session exists, or we probe)
 *  - VAPID public key is configured
 *  - user has not already granted / denied permanently in a dismissible way
 *
 * The agent uses push when it auto-follows-up or when inbound email proposes a saving.
 */

const DISMISS_KEY = "zk_push_dismissed";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

const copy = {
  he: {
    title: "הסוכן יעדכן אותך בטלפון",
    sub: "כשיש תזכורת לספק או אישור חיסכון — תקבל התראה. בלי SMS, בלי מוקד.",
    cta: "הפעל התראות",
    done: "התראות פעילות",
    dismiss: "לא עכשיו",
  },
  en: {
    title: "Let the agent ping your phone",
    sub: "When it follows up with a provider or a saving is confirmed — you get a push. No SMS, no call center.",
    cta: "Enable notifications",
    done: "Notifications on",
    dismiss: "Not now",
  },
};

export function EnablePush({ loggedIn }: { loggedIn: boolean }) {
  const locale = useLocale();
  const pathname = usePathname();
  const moneyOs = pathname === "/money" || pathname === "/dashboard";
  const t = locale === "he" || locale === "ar" ? copy.he : copy.en;
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [on, setOn] = useState(false);

  useEffect(() => {
    if (!loggedIn) return;
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    try {
      if (localStorage.getItem(DISMISS_KEY) === "1") return;
    } catch {
      /* ignore */
    }
    if (Notification.permission === "denied") return;

    // Always register the SW so push can land even if the banner was dismissed later.
    navigator.serviceWorker.register("/sw.js").catch(() => null);

    if (Notification.permission === "granted") {
      // Re-ensure subscription is stored server-side (device may have rotated keys).
      ensureSubscription().then((ok) => {
        if (ok) setOn(true);
        else setShow(true);
      });
      return;
    }

    // Permission default — show banner after a short delay so it doesn't fight InstallPrompt.
    const delay = moneyOs ? 2200 : 4000;
    const timer = setTimeout(() => setShow(true), delay);
    return () => clearTimeout(timer);
  }, [loggedIn, moneyOs]);

  async function ensureSubscription(): Promise<boolean> {
    try {
      const keyRes = await fetch("/api/push/subscribe");
      const keyData = (await keyRes.json()) as { configured?: boolean; publicKey?: string };
      if (!keyData.configured || !keyData.publicKey) return false;

      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(keyData.publicKey) as BufferSource,
        });
      }
      const json = sub.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return false;

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
        }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async function enable() {
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        dismiss();
        return;
      }
      const ok = await ensureSubscription();
      if (ok) {
        setOn(true);
        setShow(false);
      }
    } finally {
      setBusy(false);
    }
  }

  function dismiss() {
    setShow(false);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  }

  if (on && !show) return null;
  if (!show) return null;

  return (
    <div className="fixed inset-x-3 bottom-[4.5rem] z-[9997] mx-auto max-w-[520px] rounded-2xl border border-[rgba(62,198,255,0.35)] bg-[#0c1420] shadow-[0_24px_60px_rgba(0,0,0,0.55)] p-4 flex items-center gap-3">
      <div className="text-2xl shrink-0" aria-hidden>
        🔔
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-extrabold text-[14px]">{t.title}</div>
        <div className="text-ink-soft text-[12px] mt-0.5 leading-snug">{t.sub}</div>
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={enable}
        className="shrink-0 grad-bg btn-sheen text-[#06121A] font-extrabold text-body rounded-xl px-4 py-2.5 border-0 cursor-pointer disabled:opacity-60"
      >
        {busy ? "…" : t.cta}
      </button>
      <button
        type="button"
        onClick={dismiss}
        aria-label={t.dismiss}
        className="shrink-0 text-ink-soft hover:text-ink text-lg leading-none px-1 bg-transparent border-0 cursor-pointer"
      >
        ✕
      </button>
    </div>
  );
}
