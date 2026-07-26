"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter, Link } from "@/i18n/routing";
import { Card, Input, Button } from "@/components/ui";

/**
 * The two halves of account recovery.
 *
 * Both are deliberately plain: someone reaching these screens is already
 * locked out and frustrated, and this is the wrong moment to be clever.
 */

const errorKeys = ["tooManyRequests", "invalidEmail", "weakPassword", "reset_invalid", "reset_expired", "reset_used"] as const;

function messageFor(t: (k: string) => string, code: string | null): string | null {
  if (!code) return null;
  return (errorKeys as readonly string[]).includes(code) ? t(code) : t("genericError");
}

/** Step one: ask for the link. */
export function ForgotPasswordForm() {
  const t = useTranslations("reset");
  const locale = useLocale();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/password/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, locale }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data.error ?? "genericError");
      else setSent(true);
    } catch {
      setError("genericError");
    } finally {
      setBusy(false);
    }
  }

  // The confirmation says an email was sent *if the address is registered*.
  // Saying "we sent you an email" outright would confirm the account exists,
  // which is exactly what the identical server response is designed to hide.
  if (sent) {
    return (
      <Card className="p-7">
        <h1 className="font-display text-2xl mt-0 mb-3">{t("sentTitle")}</h1>
        <p className="text-ink-soft text-[14px] leading-relaxed m-0">{t("sentBody")}</p>
        <p className="mt-5 mb-0 text-sm">
          <Link href="/login" className="text-emerald font-bold no-underline">
            {t("backToLogin")}
          </Link>
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-7">
      <h1 className="font-display text-2xl mt-0 mb-2">{t("requestTitle")}</h1>
      <p className="text-ink-soft text-[14px] leading-relaxed mt-0 mb-5">{t("requestBody")}</p>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <label className="block">
          <span className="text-[13.5px] text-ink-soft">{t("email")}</span>
          <Input
            type="email"
            inputMode="email"
            dir="ltr"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        {error && (
          <p role="alert" className="text-[13px] text-[#ff8f8f] m-0">
            {messageFor(t, error)}
          </p>
        )}
        <Button type="submit" disabled={busy}>
          {busy ? t("sending") : t("requestBtn")}
        </Button>
      </form>
    </Card>
  );
}

/** Step two: set the new password, from the link in the email. */
export function ResetPasswordForm({ token }: { token: string }) {
  const t = useTranslations("reset");
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Arriving with no token at all is a mis-copied link, not a server problem.
  if (!token) {
    return (
      <Card className="p-7">
        <h1 className="font-display text-2xl mt-0 mb-3">{t("invalidTitle")}</h1>
        <p className="text-ink-soft text-[14px] leading-relaxed m-0">{t("reset_invalid")}</p>
        <p className="mt-5 mb-0 text-sm">
          <Link href="/forgot" className="text-emerald font-bold no-underline">
            {t("requestAgain")}
          </Link>
        </p>
      </Card>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/password/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data.error ?? "genericError");
      else router.push("/login");
    } catch {
      setError("genericError");
    } finally {
      setBusy(false);
    }
  }

  // An expired or already-used link was genuinely ours — so the honest next
  // step is "ask for another", not "that link is wrong".
  const stale = error === "reset_expired" || error === "reset_used";

  return (
    <Card className="p-7">
      <h1 className="font-display text-2xl mt-0 mb-2">{t("setTitle")}</h1>
      <p className="text-ink-soft text-[14px] leading-relaxed mt-0 mb-5">{t("setBody")}</p>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <label className="block">
          <span className="text-[13.5px] text-ink-soft">{t("newPassword")}</span>
          <div className="relative">
            <Input
              type={show ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              aria-label={t(show ? "hidePassword" : "showPassword")}
              aria-pressed={show}
              className="absolute inset-inline-end-3 top-1/2 -translate-y-1/2 bg-transparent border-0 cursor-pointer text-ink-soft p-1"
              style={{ insetInlineEnd: "0.75rem" }}
            >
              {show ? "🙈" : "👁"}
            </button>
          </div>
          <span className="text-[11.5px] text-ink-soft mt-1 block">{t("passwordHint")}</span>
        </label>
        {error && (
          <p role="alert" className="text-[13px] text-[#ff8f8f] m-0">
            {messageFor(t, error)}
            {stale && (
              <>
                {" "}
                <Link href="/forgot" className="text-emerald font-bold no-underline">
                  {t("requestAgain")}
                </Link>
              </>
            )}
          </p>
        )}
        <Button type="submit" disabled={busy}>
          {busy ? t("saving") : t("setBtn")}
        </Button>
      </form>
    </Card>
  );
}
