import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/routing";
import { getCurrentUser } from "@/lib/auth/user";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui";
import { IconEye, IconPencil } from "@/components/Icon";
import { AuthorizeDecision } from "@/components/AuthorizeDecision";
import { explainAuthority } from "@/lib/mandate/explainScopes";
import { privatePageMetadata } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "authorize" });
  /**
   * The scope catalogue's own summaries are English — it is a protocol
   * document, read by integrators. This screen is read by a person deciding
   * whether to hand a stranger authority over their money, in the language
   * they think in. Falling back to the catalogue keeps a new scope legible
   * rather than blank, but a scope with no translation on this screen is a
   * scope somebody is being asked to consent to without reading it.
   */
  const scopeText = await getTranslations({ locale, namespace: "scopeText" });
  const describe = (scope: string, fallback: string | null) => {
    try {
      const translated = scopeText(scope as never);
      if (translated && !translated.startsWith("scopeText.")) return translated;
    } catch {
      /* not translated yet */
    }
    return fallback ?? scope;
  };
  return privatePageMetadata(t("title"));
}

/**
 * The moment a person lends authority to somebody else's agent.
 *
 * Everything here is server-rendered from the stored request, never from the
 * query string. An agent that could put the scope list or its own name in the
 * URL could show a person one thing and receive another, and the consent would
 * be worthless — which is the whole asset.
 */
export default async function AuthorizePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ req?: string }>;
}) {
  const { locale } = await params;
  const { req } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "authorize" });
  /**
   * The scope catalogue's own summaries are English — it is a protocol
   * document, read by integrators. This screen is read by a person deciding
   * whether to hand a stranger authority over their money, in the language
   * they think in. Falling back to the catalogue keeps a new scope legible
   * rather than blank, but a scope with no translation on this screen is a
   * scope somebody is being asked to consent to without reading it.
   */
  const scopeText = await getTranslations({ locale, namespace: "scopeText" });
  const describe = (scope: string, fallback: string | null) => {
    try {
      const translated = scopeText(scope as never);
      if (translated && !translated.startsWith("scopeText.")) return translated;
    } catch {
      /* not translated yet */
    }
    return fallback ?? scope;
  };

  const user = await getCurrentUser();
  if (!user) redirect({ href: `/login?return=/authorize?req=${req ?? ""}`, locale });

  const request = req
    ? await prisma.agentAuthorizationRequest.findUnique({
        where: { id: req },
        include: { client: true },
      })
    : null;

  if (!request || request.status !== "pending" || request.expiresAt <= new Date()) {
    return (
      <main className="max-w-[560px] mx-auto px-5 pb-20 pt-6">
        <Card className="p-6">
          <h1 className="font-display text-h3 m-0 mb-2">{t("goneTitle")}</h1>
          <p className="text-body text-ink-soft m-0 leading-relaxed">{t("goneSub")}</p>
        </Card>
      </main>
    );
  }

  const authority = explainAuthority(request.scopes);

  return (
    <main className="max-w-[560px] mx-auto px-5 pb-20 pt-6">
      <h1 className="font-display text-h2 mb-2">{t("title")}</h1>
      <p className="text-body-lg text-ink-soft leading-relaxed mb-5">
        {t("intro", { agent: request.client.name })}
      </p>

      <Card className="p-6">
        <div className="text-caption text-ink-soft">{t("whoLabel")}</div>
        <div className="font-extrabold text-lead mt-1">{request.client.name}</div>
        {request.client.description && (
          <p className="text-body text-ink-soft mt-1 mb-0 leading-relaxed">
            {request.client.description}
          </p>
        )}

        <div className="text-caption text-ink-soft mt-5">{t("whyLabel")}</div>
        <p className="text-body mt-1 mb-0 leading-relaxed">{request.purpose}</p>

        <div className="text-caption text-ink-soft mt-5">{t("whatLabel")}</div>
        <ul className="m-0 mt-2 p-0 list-none flex flex-col gap-2.5">
          {authority.scopes.map((s) => (
            <li key={s.scope} className="flex gap-3 items-baseline">
              <span className={s.tier === "read" ? "text-emerald" : "text-amber"}>
                {s.tier === "read" ? (
                  <IconEye width={16} height={16} />
                ) : (
                  <IconPencil width={16} height={16} />
                )}
              </span>
              <span className="text-body leading-relaxed">{describe(s.scope, s.summary)}</span>
            </li>
          ))}
        </ul>

        {/* The sentence that decides whether somebody says no. Computed, not
            left for a reader to work out from a list of scope names. */}
        {authority.silentActions.length > 0 && (
          <p className="text-body text-amber mt-4 mb-0 leading-relaxed">
            {t("silentWarning", { count: authority.silentActions.length })}
          </p>
        )}
        {authority.readOnly && (
          <p className="text-body text-emerald mt-4 mb-0 leading-relaxed">{t("readOnly")}</p>
        )}

        <p className="text-caption text-ink-soft mt-5 mb-0 leading-relaxed">
          {t("revokeNote")}
        </p>
      </Card>

      <AuthorizeDecision requestId={request.id} />
    </main>
  );
}
