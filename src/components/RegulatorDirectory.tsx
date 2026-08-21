import { getTranslations } from "next-intl/server";
import { heEn } from "@/lib/heEn";
import { REGULATORS } from "@/lib/rightsGraph/directory";
import { Card } from "@/components/ui";
import { Link } from "@/i18n/routing";

/**
 * The legal address book, as a page anyone can read.
 *
 * The directory has existed as data for a while — legal names, verified
 * intake channels, the sector each body supervises, and the date a human
 * last checked each one against its official source. Nothing in the product
 * ever showed it to a person, and no single place in Israel publishes it
 * either: people asking "who supervises my bank, and where exactly does a
 * written demand go" are left guessing at a search engine.
 *
 * Two rules make this worth trusting rather than just worth reading:
 *  - A body whose intake channel is not verified shows NO address. The entry
 *    still appears, because knowing which regulator covers you is useful on
 *    its own, but an address nobody checked is how a real complaint ends up
 *    in a mailbox nobody reads.
 *  - Every entry carries the date it was last verified, in the open. A
 *    directory without dates is a directory that quietly goes stale.
 */
export async function RegulatorDirectory({ he, locale }: { he: boolean; locale: string }) {
  const t = await getTranslations({ locale, namespace: "companies" });
  return (
    <section className="mt-10">
      <h2 className="font-display text-h3 mb-1">
        {t("dirTitle")}
      </h2>
      <p className="text-ink-soft text-body leading-relaxed mt-0 mb-4 max-w-[560px]">
        {t("dirIntro")}
      </p>

      <ul className="list-none p-0 m-0 grid gap-3">
        {REGULATORS.map((r) => (
          <li key={r.ref}>
            <Card className="p-5">
              <div className="font-extrabold text-body-lg leading-snug">
                {heEn(he, r.legalName.he, r.legalName.en)}
              </div>
              <p className="text-ink-soft text-caption mt-1.5 mb-3 leading-relaxed">
                {heEn(he, r.supervises.he, r.supervises.en)}
              </p>

              {r.demand ? (
                r.demand.channel === "email" ? (
                  <a
                    href={`mailto:${r.demand.address}`}
                    dir="ltr"
                    className="text-emerald text-body font-bold no-underline"
                  >
                    {r.demand.address}
                  </a>
                ) : (
                  <a
                    href={r.demand.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald text-body font-bold no-underline"
                  >
                    {t("dirForm")} →
                  </a>
                )
              ) : (
                <span className="text-ink-soft text-caption">
                  {t("dirUnverified")}
                </span>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-micro text-ink-soft">
                <a
                  href={r.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-ink-soft underline"
                >
                  {t("dirSource")}
                </a>
                <span>
                  {t("dirVerified")}{" "}
                  <span dir="ltr">{r.lastVerifiedAt}</span>
                </span>
              </div>
            </Card>
          </li>
        ))}
      </ul>

      {/* The rule for every tool here: it ends somewhere real, not at a list. */}
      <div className="mt-5 rounded-2xl border border-[rgba(63,203,155,0.35)] bg-[rgba(63,203,155,0.07)] p-5">
        <div className="font-extrabold text-body-lg">
          {t("dirNextTitle")}
        </div>
        <p className="text-ink-soft text-body mt-1.5 mb-3 leading-relaxed">
          {t("dirNextBody")}
        </p>
        <Link
          href="/complaint-escalation"
          className="inline-block text-emerald font-bold no-underline"
        >
          {t("dirNextCta")} →
        </Link>
      </div>
    </section>
  );
}
