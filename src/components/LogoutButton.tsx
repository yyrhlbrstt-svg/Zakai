"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { Button } from "@/components/ui";

export function LogoutButton() {
  const t = useTranslations("settings");
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function logout() {
    setPending(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/");
    router.refresh();
  }

  return (
    <Button variant="ghost" onClick={logout} disabled={pending}>
      {pending ? t("loggingOut") : t("logout")}
    </Button>
  );
}
