"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter, Link } from "@/i18n/routing";
import { Card, Button, Input, FieldError } from "@/components/ui";

/** Error keys the API may return that live in the `auth` message namespace. */
const AUTH_ERROR_KEYS = new Set([
  "invalidCredentials",
  "emailTaken",
  "weakPassword",
  "invalidEmail",
  "invalidPhone",
  "nameRequired",
  "mustLogin",
  "tooManyRequests",
]);

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const t = useTranslations("auth");
  const tc = useTranslations("common");
  const tl = useTranslations("legal");
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [termsOk, setTermsOk] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", phone: "" });
  const terms = tl.raw("terms") as string[];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "signup" && !termsOk) return;
    setError(null);
    setPending(true);
    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/signup";
      const payload =
        mode === "login"
          ? { email: form.email, password: form.password }
          : form;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "genericError");
        return;
      }
      router.replace("/check");
      router.refresh();
    } catch {
      setError("genericError");
    } finally {
      setPending(false);
    }
  }

  // Map an API error key to a human message. Only known auth keys are looked
  // up in the auth namespace; everything else (genericError, a 500 with no JSON,
  // an unexpected key) resolves to a sensible Hebrew fallback. A raw key like
  // "auth.genericError" must NEVER reach the user.
  function tErr(key: string | null) {
    if (!key) return null;
    if (AUTH_ERROR_KEYS.has(key)) return t(key);
    return tc("genericError");
  }

  return (
    <main className="max-w-[440px] mx-auto px-5 pb-20 pt-6">
      <h1 className="font-display text-[27px] text-center mb-6">
        {mode === "login" ? t("loginTitle") : t("signupTitle")}
      </h1>
      <Card className="p-6">
        <form onSubmit={submit} className="flex flex-col gap-3.5">
          {mode === "signup" && (
            <label className="block">
              <span className="text-[13.5px] text-ink-soft">{t("name")}</span>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                autoComplete="name"
                required
              />
            </label>
          )}
          <label className="block">
            <span className="text-[13.5px] text-ink-soft">{t("email")}</span>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              autoComplete="email"
              required
            />
          </label>
          {mode === "signup" && (
            <label className="block">
              <span className="text-[13.5px] text-ink-soft">{t("phone")}</span>
              <Input
                type="tel"
                inputMode="tel"
                placeholder="0501234567"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                autoComplete="tel"
                required
              />
              <span className="text-[11.5px] text-ink-soft mt-1 block leading-snug">
                {t("phoneHint")}
              </span>
            </label>
          )}
          <label className="block">
            <span className="text-[13.5px] text-ink-soft">{t("password")}</span>
            <div className="relative">
              <Input
                type={showPw ? "text" : "password"}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                className="pe-11"
                required
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                aria-pressed={showPw}
                aria-label={showPw ? t("hidePassword") : t("showPassword")}
                title={showPw ? t("hidePassword") : t("showPassword")}
                className="absolute end-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-ink-soft hover:text-ink cursor-pointer bg-transparent border-0"
              >
                {showPw ? <EyeOff /> : <Eye />}
              </button>
            </div>
          </label>

          {mode === "signup" && (
            <div className="mt-1">
              <details className="text-[12.5px] text-ink-soft">
                <summary className="cursor-pointer font-bold text-emerald">
                  {tl("termsTitle")}
                </summary>
                <ul className="mt-2 ps-4 list-disc space-y-1.5 leading-relaxed">
                  {terms.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
                <p className="mt-2 text-amber font-semibold">{tl("termsNote")}</p>
              </details>
              <label className="flex gap-2.5 items-start mt-2.5 text-[13px] leading-snug cursor-pointer">
                <input
                  type="checkbox"
                  checked={termsOk}
                  onChange={(e) => setTermsOk(e.target.checked)}
                  className="mt-0.5 w-[18px] h-[18px] shrink-0"
                  required
                />
                <span>{tl("agree")}</span>
              </label>
            </div>
          )}

          <FieldError>{tErr(error)}</FieldError>

          <Button
            type="submit"
            disabled={pending || (mode === "signup" && !termsOk)}
            className="w-full mt-1"
          >
            {mode === "login" ? t("loginBtn") : t("signupBtn")}
          </Button>
        </form>
      </Card>

      <p className="text-center mt-5 text-sm">
        <Link
          href={mode === "login" ? "/signup" : "/login"}
          className="text-emerald font-bold no-underline"
        >
          {mode === "login" ? t("toSignup") : t("toLogin")}
        </Link>
      </p>
    </main>
  );
}

function Eye() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function EyeOff() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 3l18 18M10.6 10.6a3 3 0 0 0 4.2 4.2M9.4 5.2A9.5 9.5 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.1 3.9M6.1 6.1A17 17 0 0 0 2 12s3.5 7 10 7a9.5 9.5 0 0 0 3-.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
