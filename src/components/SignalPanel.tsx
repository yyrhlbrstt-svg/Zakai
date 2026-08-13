import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { Card, Button } from "@/components/ui";
import type { SignalMatch } from "@/lib/services/signalMatches";
import type { Locale } from "@/i18n/config";

/**
 * "This happened, and here is your part of it."
 *
 * THE ONE RULE OF THIS SCREEN
 *
 * Every claim on it is followed by the evidence for it. The headline says what
 * happened, the reason says why it reaches this person, and the citation is a
 * link they can open and read for themselves — not a logo, not "according to
 * the regulator", an actual URL to the actual page.
 *
 * That is not decoration and it is not caution. It is the entire difference
 * between this and every "you may be owed £££" advert anybody has ever
 * ignored. The reason those fail is that the reader has no way to check them,
 * so the rational response is to assume it is marketing. Here they can check
 * in one tap, which is what makes the same sentence worth acting on.
 *
 * WHEN IT RENDERS NOTHING
 *
 * When nothing matches. No "we're watching for you", no empty-state
 * reassurance, no placeholder — those all claim a service is running on
 * somebody's behalf, and the honest version of that claim is silence until
 * there is something to say.
 */
export async function SignalPanel({
  matches,
  locale,
}: {
  matches: readonly SignalMatch[];
  locale: Locale;
}) {
  if (matches.length === 0) return null;
  const t = await getTranslations({ locale, namespace: "signal" });

  /**
   * The reader's own language when the event carries it, English otherwise.
   *
   * Falling back to English rather than Hebrew for an untranslated event: an
   * Arabic reader in Israel is usually better served by Hebrew, but an event
   * headline is a legal-ish statement about money and a half-understood one
   * is worse than a clearly foreign one. The locale chain in i18n/request.ts
   * makes the opposite call for UI chrome, deliberately, and that is the right
   * call there.
   */
  const rows = matches.map((m) => ({
    ...m,
    headline: m.event.headline[locale] ?? m.event.headline.en,
  }));

  return (
    <section className="mb-6" aria-label={t("title")}>
      <div className="font-extrabold text-[14px] mb-3">{t("title")}</div>

      <div className="flex flex-col gap-3">
        {rows.map(({ event, because, claimOpen, headline }) => (
          <Card key={event.id} className="p-5 border border-[rgba(63,203,155,0.35)]">
            <p className="font-extrabold text-[15.5px] leading-snug m-0">{headline}</p>

            {/* Why them, and not somebody else. Never summarised into "you may
                be eligible" — the specific reason is the persuasive part. */}
            <ul className="list-none p-0 mt-3 mb-0 flex flex-col gap-1.5">
              {because.map((reason) => (
                <li key={reason} className="text-body text-ink-soft leading-relaxed">
                  {reason}
                </li>
              ))}
            </ul>

            {claimOpen ? (
              <Link href={event.claim.path} className="no-underline block mt-4">
                <Button className="w-full">{t("claimCta")}</Button>
              </Link>
            ) : (
              /* Out of time is a fact somebody is still owed. Hiding the event
                 would be kinder to look at and would leave them believing
                 nothing had happened to them at all. */
              <p className="text-body text-amber mt-4 mb-0 leading-relaxed">
                {t("closed", { date: event.claim.deadline ?? "" })}
              </p>
            )}

            <p className="text-caption text-ink-soft mt-3 mb-0 leading-relaxed">
              {event.confidence === "confirmed" ? t("sourceOfficial") : t("sourceReported")}{" "}
              <a
                href={event.source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald underline"
              >
                {t("sourceLine", {
                  publisher: event.source.publisher,
                  date: event.source.publishedAt,
                })}
              </a>
            </p>
          </Card>
        ))}
      </div>
    </section>
  );
}
