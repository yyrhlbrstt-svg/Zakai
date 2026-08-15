"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { Card, Button } from "@/components/ui";
import { IconAlertTriangle } from "@/components/Icon";
import { reportError } from "@/lib/report-error";

/**
 * Next's error boundary for this whole locale segment. Without it, any
 * unhandled exception in a server or client component fell through to the
 * framework's own default error screen — unbranded, and (worse, for an app
 * meant to feel installed and native) the kind of raw stack-trace-adjacent
 * page that reads as "this app is broken" rather than "something went wrong,
 * try again." Must be a Client Component — that's a Next.js requirement for
 * error boundaries, not a choice made here.
 */
export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("errorPage");

  useEffect(() => {
    void reportError(error, { boundary: "locale", digest: error.digest });
  }, [error]);

  return (
    <main className="max-w-[520px] mx-auto px-5 pt-24 pb-20 text-center">
      <IconAlertTriangle width={44} height={44} className="mb-4 mx-auto text-[#f0b45c]" />
      <Card className="p-8">
        <h1 className="font-display text-2xl mb-2">{t("title")}</h1>
        <p className="text-ink-soft text-[14.5px] leading-relaxed mb-6">{t("subtitle")}</p>
        <div className="flex flex-wrap gap-3 justify-center">
          <Button onClick={() => reset()}>{t("retry")}</Button>
          <Link href="/">
            <Button variant="ghost">{t("home")}</Button>
          </Link>
        </div>
      </Card>
    </main>
  );
}
