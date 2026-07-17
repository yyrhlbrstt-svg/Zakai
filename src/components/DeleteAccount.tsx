"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { Card, Button, Input, FieldError } from "@/components/ui";

/**
 * Right-to-be-forgotten UI. Two explicit steps (open → password + confirm)
 * before the irreversible call, and the password requirement means a stolen
 * session can't erase an account.
 */
export function DeleteAccount() {
  const t = useTranslations("settings.deleteAccount");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error === "invalidCredentials" ? t("wrongPassword") : t("failed"));
        return;
      }
      router.replace("/");
      router.refresh();
    } catch {
      setError(t("failed"));
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="p-6 border-[rgba(240,138,107,0.3)]">
      <div className="text-[12px] font-extrabold text-[#F08A6B] mb-2">{t("title")}</div>
      <p className="text-ink-soft text-[13px] leading-relaxed mt-0 mb-3">{t("explain")}</p>
      {!open ? (
        <Button
          variant="ghost"
          className="!text-[13.5px] !px-4 !py-2.5 !border-[rgba(240,138,107,0.4)] !text-[#F08A6B]"
          onClick={() => setOpen(true)}
        >
          {t("openBtn")}
        </Button>
      ) : (
        <form onSubmit={confirm} className="flex flex-col gap-3">
          <label className="block">
            <span className="text-[13px] text-ink-soft">{t("passwordLabel")}</span>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              className="mt-1"
            />
          </label>
          <FieldError>{error}</FieldError>
          <div className="flex gap-2.5 flex-wrap">
            <Button
              type="submit"
              variant="ghost"
              disabled={pending || password.length === 0}
              className="!text-[13.5px] !px-4 !py-2.5 !border-[rgba(240,138,107,0.5)] !text-[#F08A6B]"
            >
              {pending ? t("deleting") : t("confirmBtn")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="!text-[13.5px] !px-4 !py-2.5"
              onClick={() => {
                setOpen(false);
                setPassword("");
                setError(null);
              }}
            >
              {t("cancel")}
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}
