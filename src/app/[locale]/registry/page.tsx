import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Card } from "@/components/ui";
import { alternateLanguages } from "@/lib/seo";
import { registryDocument } from "@/lib/mandate/trustRegistry";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "registry" });
  return {
    title: t("metaTitle"),
    description: t("metaDesc"),
    alternates: { languages: alternateLanguages("/registry") },
  };
}

const ORIGIN = process.env.NEXT_PUBLIC_APP_URL || "https://zakai-3uxj.vercel.app";

export default async function RegistryPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const doc = registryDocument();

  return (
    <main className="max-w-[760px] mx-auto px-5 pb-24 pt-4" dir="ltr">
      <p className="text-[12px] uppercase tracking-wide text-emerald font-bold mb-2">
        Registered Mandate issuers
      </p>
      <h1 className="font-display text-[32px] mb-3">Who may sign a Zakai Mandate</h1>
      <p className="text-ink-soft text-[15.5px] leading-relaxed mb-8 max-w-[620px]">
        Every party listed here signs mandates with its own Ed25519 keys and
        appears on the same terms as every other issuer — the same admitted
        scopes, the same categorical prohibitions, no operator privilege.
        Machine-readable version:{" "}
        <code className="text-[13px]">{ORIGIN}/.well-known/zakai-trust-registry.json</code>.
      </p>

      <Card className="p-6 mb-6">
        <h2 className="font-display text-xl mb-4">
          {doc.issuers.length} registered issuer{doc.issuers.length === 1 ? "" : "s"}
        </h2>
        <div className="flex flex-col gap-4">
          {doc.issuers.map((i) => (
            <div key={i.iss} className="border border-[rgba(255,255,255,0.09)] rounded-xl p-4">
              <div className="flex items-center justify-between gap-3 mb-2">
                <span className="font-bold text-[15px]">{i.name}</span>
                <span
                  className={`text-[11px] font-extrabold uppercase tracking-wide px-2.5 py-1 rounded-full ${
                    i.status === "active"
                      ? "bg-[rgba(63,203,155,0.12)] text-emerald"
                      : "bg-[rgba(255,90,90,0.12)] text-danger"
                  }`}
                >
                  {i.status}
                </span>
              </div>
              <p className="text-[12.5px] text-ink-soft font-mono break-all mb-2">{i.iss}</p>
              <p className="text-[12.5px] text-ink-soft">
                Admitted {i.admitted_at} · {i.allowed_scopes.length} scope
                {i.allowed_scopes.length === 1 ? "" : "s"} granted
                {i.note ? ` · ${i.note}` : ""}
              </p>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-6 mb-6">
        <h2 className="font-display text-xl mb-3">Every issuer, without exception</h2>
        <p className="text-[14.5px] leading-relaxed mb-3">
          No mandate from any issuer listed here — or admitted later — may ever
          carry one of these scopes. This is the promise an institution
          verifies once and relies on for every issuer, forever, not a claim
          it has to re-check per party:
        </p>
        <ul className="list-disc pl-5 flex flex-col gap-1 text-[13.5px] font-mono">
          {doc.forbiddenScopes.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </Card>

      <Card className="p-6">
        <h2 className="font-display text-xl mb-3">Become issuer #2</h2>
        <p className="text-[14.5px] leading-relaxed mb-3">
          A registry with one issuer is a JSON file with an entry in it. Every
          party after the first is what makes it a network — for institutions
          that trust the registry instead of one company, and for the next
          issuer after that, whose admission gets easier because this one
          proved the format works. If you run your own Ed25519 signing keys,
          the path in is the same conformance check anyone can run, not a
          sales conversation:
        </p>
        <a
          href={`/${locale}/institutions#registered-issuer`}
          className="text-emerald font-bold no-underline"
        >
          Run the independent conformance probe →
        </a>
      </Card>
    </main>
  );
}
