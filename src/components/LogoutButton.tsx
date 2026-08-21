"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { Button } from "@/components/ui";

export function LogoutButton() {
  const t = useTranslations("settings");
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function logout() {
    setPending(true);
    setFailed(false);
    try {
      /*
        Navigating away used to happen whether or not the request worked. A
        person who taps "log out", sees the homepage and walks away has been
        told they are signed out — and on a shared or family phone, with a
        session cookie still valid, that is not a cosmetic difference. Now
        the screen only changes when the server actually ended the session,
        and says so plainly when it did not.
      */
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (!res.ok) {
        setFailed(true);
        return;
      }
      router.replace("/");
      router.refresh();
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Button variant="ghost" onClick={logout} disabled={pending}>
        {pending ? t("loggingOut") : t("logout")}
      </Button>
      {failed && (
        <p role="alert" className="text-caption text-danger font-bold mt-2 mb-0 leading-relaxed">
          {t("logoutFailed")}
        </p>
      )}
    </>
  );
}
