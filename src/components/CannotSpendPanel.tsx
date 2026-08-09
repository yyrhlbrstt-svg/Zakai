import { getTranslations } from "next-intl/server";
import { Card } from "@/components/ui";
import { SCOPES, FORBIDDEN_SCOPES } from "@/lib/mandate/scopes";

/**
 * The one thing worth saying out loud, said with the actual list underneath it.
 *
 * The common shape of an AI money product is "connect your account and let it
 * manage your money", and people are right to find that frightening: an agent
 * that can spend can be made to drain an account. Zakai is built the other way
 * round and always has been — there is no `payment:initiate`, money only ever
 * moves *toward* the person, and a compromised Mandate produces unwanted
 * correspondence rather than theft.
 *
 * That was true and written down in `scopes.ts`, and a reader had no way to
 * know it. A safety claim in marketing copy is worth nothing, because the
 * companies a reader is right to distrust make the same claim.
 *
 * So this renders the real vocabulary: every capability a Mandate can carry,
 * read straight from the table the verifier uses, next to the list that is
 * refused outright. If somebody adds a spending scope, this page says so on
 * its own — and `noOutwardMoney.test.ts` fails the build before it ships.
 */
export async function CannotSpendPanel({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "cannotSpend" });

  return (
    <Card className="p-6 flex flex-col gap-4">
      <div>
        <h2 className="font-display text-xl m-0">{t("heading")}</h2>
        <p className="text-ink-soft text-body mt-2 mb-0 leading-relaxed">{t("sub")}</p>
      </div>

      <div>
        <h3 className="text-body font-extrabold m-0 mb-2">{t("allowedHeading")}</h3>
        <ul className="list-none p-0 m-0 flex flex-col gap-1.5">
          {SCOPES.map((s) => (
            <li key={s.scope} className="text-micro text-ink-soft leading-relaxed">
              <code className="text-micro" dir="ltr">
                {s.scope}
              </code>{" "}
              — {s.summary}
              {s.perActConfirmation ? ` · ${t("perAct")}` : ""}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="text-body font-extrabold m-0 mb-2">{t("refusedHeading")}</h3>
        <p className="text-micro text-ink-soft mb-2 leading-relaxed">{t("refusedNote")}</p>
        <ul className="list-none p-0 m-0 flex flex-wrap gap-x-3 gap-y-1">
          {FORBIDDEN_SCOPES.map((s) => (
            <li key={s} className="text-micro text-[#f08a6b]" dir="ltr">
              <code className="text-micro">{s}</code>
            </li>
          ))}
        </ul>
      </div>

      <p className="text-micro text-ink-soft leading-relaxed m-0">
        {t("verify")}{" "}
        <a className="text-emerald underline" href="/api/mandate/scopes" dir="ltr">
          /api/mandate/scopes
        </a>
      </p>
    </Card>
  );
}
