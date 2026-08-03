"use client";

import { useState, useEffect, useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter, Link } from "@/i18n/routing";
import { hasOutreachEmail, redirectIfOpenLoop } from "@/lib/openLoopClient";
import { useSearchParams } from "next/navigation";
import { Card, Button, Input, Select, Textarea } from "@/components/ui";
import { buildCancelLetter, type CancelIntent } from "@/lib/cancelLetter";
import {
  pickOutreachEmail,
  resolveSubscriptionCompany,
  subscriptionOutreachReady,
} from "@/lib/normalizeSubscriptionProvider";
import { withFooter } from "@/lib/letterFooter";
import { openMailto } from "@/lib/mailto";

const INTENTS: CancelIntent[] = ["cancel", "retention", "downgrade", "pause"];

function parseIntent(v: string | null): CancelIntent {
  if (v && INTENTS.includes(v as CancelIntent)) return v as CancelIntent;
  return "cancel";
}

export function CancelTool() {
  const locale = useLocale();
  const footerLocale = locale === "he" || locale === "ar" ? "he" : "en";
  const t = useTranslations("inline_components_CancelTool");
  const router = useRouter();
  const search = useSearchParams();

  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [product, setProduct] = useState("");
  const [account, setAccount] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [monthly, setMonthly] = useState("");
  const [intent, setIntent] = useState<CancelIntent>("cancel");
  const [reason, setReason] = useState("");
  const [out, setOut] = useState<{ subject: string; body: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [mailOpened, setMailOpened] = useState(false);
  const [busy, setBusy] = useState(false);
  const [caseId, setCaseId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [prefilled, setPrefilled] = useState(false);

  const outreachTo = useMemo(() => {
    const resolved = resolveSubscriptionCompany(company, product);
    return pickOutreachEmail({
      contactEmail: contactEmail.trim() || undefined,
      defaultContactEmail: resolved.defaultContactEmail,
    });
  }, [company, product, contactEmail]);

  const agentReady = useMemo(
    () => company.trim().length > 0 && product.trim().length > 0 && Boolean(outreachTo),
    [company, product, outreachTo],
  );

  useEffect(() => {
    const c = search.get("company") || search.get("merchant");
    const p = search.get("product") || search.get("plan");
    const m = search.get("monthly") || search.get("amount");
    const i = search.get("intent");
    const n = search.get("name");
    const ce = search.get("contactEmail") || search.get("email");
    if (c) setCompany(c.slice(0, 120));
    if (p) setProduct(p.slice(0, 120));
    else if (c) setProduct(c.slice(0, 120));
    if (m && !Number.isNaN(Number(m))) setMonthly(String(Math.round(Number(m))));
    if (i) setIntent(parseIntent(i));
    if (n) setName(n.slice(0, 80));
    if (ce && /@/.test(ce)) setContactEmail(ce.slice(0, 120));
    if (c || p || m || ce) setPrefilled(true);
  }, [search]);

  function generate() {
    setError(null);
    setCaseId(null);
    const letter = buildCancelLetter({
      customerName: name,
      company,
      product,
      accountOrEmail: account,
      monthlyShekels: monthly ? Number(monthly) : undefined,
      intent,
      reason,
    });
    setOut({
      subject: letter.subject,
      body: withFooter(letter.body, footerLocale),
    });
  }

  async function sendWithAgent() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/cases/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: name,
          company,
          product,
          accountOrEmail: account || undefined,
          contactEmail: contactEmail.trim() || undefined,
          monthlyShekels: monthly ? Number(monthly) : undefined,
          intent,
          reason: reason || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        router.replace(`/login?return=/cancel`);
        return;
      }
      if (!res.ok) {
        if (redirectIfOpenLoop(data, router.push)) return;
        // Legacy hard-gate — soft-open usually opens and collects inbox on dashboard.
        if (data.error === "needsOutreachEmail") {
          setError(t("errorNeedsEmail"));
          return;
        }
        setError(
          res.status === 403 && data.error === "caseLimit" ? t("errorCaseLimit") : t("errorGeneric"),
        );
        return;
      }
      const letter = buildCancelLetter({
        customerName: name,
        company,
        product,
        accountOrEmail: account,
        monthlyShekels: monthly ? Number(monthly) : undefined,
        intent,
        reason,
      });
      setOut({
        subject: letter.subject,
        body: withFooter(letter.body, footerLocale),
      });
      setCaseId(data.caseId);
      router.push(data.dispatched ? `/money?case=${data.caseId}&sent=1` : `/money?case=${data.caseId}`);
    } catch {
      setError(t("errorGeneric"));
    } finally {
      setBusy(false);
    }
  }

  const showContactHint =
    company.trim().length > 0 &&
    !subscriptionOutreachReady(company, product, contactEmail.trim() || undefined);

  function sendViaMailto() {
    if (!out || !outreachTo) {
      setError(t("errorNeedsEmail"));
      return;
    }
    if (openMailto(outreachTo, out.subject, out.body)) {
      setMailOpened(true);
      setTimeout(() => setMailOpened(false), 2500);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {prefilled && (
        <div className="rounded-xl border border-[rgba(63,203,155,0.35)] bg-[rgba(63,203,155,0.08)] px-4 py-3 text-[13px] font-bold">
          {t("t_cf09ad5a")}
        </div>
      )}

      <Card className="p-5 flex flex-col gap-3">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("t_ebd6b437")} />
        <Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder={t("t_524bf65a")} />
        <Input value={product} onChange={(e) => setProduct(e.target.value)} placeholder={t("t_39e161aa")} />
        <Input value={account} onChange={(e) => setAccount(e.target.value)} placeholder={t("t_ad08a6d5")} />
        <Input
          type="email"
          value={contactEmail}
          onChange={(e) => setContactEmail(e.target.value)}
          placeholder={t("contactEmailPlaceholder")}
        />
        {showContactHint && (
          <p className="text-[12px] text-amber mb-0 -mt-1 leading-relaxed">{t("contactEmailHint")}</p>
        )}
        <Input type="number" value={monthly} onChange={(e) => setMonthly(e.target.value)} placeholder={t("t_e7275f0c")} />
        <Select value={intent} onChange={(e) => setIntent(e.target.value as CancelIntent)}>
          <option value="cancel">{t("t_265eb5c4")}</option>
          <option value="retention">{t("t_3bb646d8")}</option>
          <option value="downgrade">{t("t_59c6dced")}</option>
          <option value="pause">{t("t_9824add7")}</option>
        </Select>
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder={t("t_d5befca9")} />

        <p className="text-[12px] text-ink-soft leading-relaxed mb-0">{t("agentHonestNote")}</p>

        <div className="flex flex-col gap-2 mt-1">
          <Button
            onClick={sendWithAgent}
            disabled={!agentReady || busy}
            className="w-full"
          >
            {busy ? t("agentOpening") : t("agentOpenCase")}
          </Button>
          <details className="text-[13px] text-ink-soft">
            <summary className="cursor-pointer font-bold select-none">
              {locale === "he" || locale === "ar"
                ? "חלופה — מכתב להעתקה בלבד"
                : "Alternative — copy-only letter"}
            </summary>
            <Button
              variant="ghost"
              onClick={generate}
              disabled={!company.trim() || !product.trim() || busy}
              className="w-full text-[13px] mt-2"
            >
              {t("t_b4c9b341")}
            </Button>
          </details>
        </div>
        {error && <p className="text-[13px] text-amber mt-1 mb-0">{error}</p>}
      </Card>

      {caseId && (
        <Card className="p-5 border border-[rgba(63,203,155,0.4)] bg-[rgba(63,203,155,0.08)]">
          <div className="text-emerald font-extrabold text-[15px]">{t("t_360e126e")}</div>
          <p className="text-[13.5px] text-ink-soft mt-2 leading-relaxed mb-3">{t("t_11cf65f5")}</p>
          <Link href={`/dashboard?case=${caseId}`}>
            <Button className="w-full">{t("t_9fc8b2a9")}</Button>
          </Link>
        </Card>
      )}

      {out && (
        <Card className="p-5">
          <div className="text-[12px] text-ink-soft font-bold">{t("t_550c1f87")}</div>
          <div className="font-extrabold mt-1">{out.subject}</div>
          <pre className="mt-4 whitespace-pre-wrap text-[13px] leading-relaxed bg-[#060b12] rounded-xl p-4 border border-[rgba(255,255,255,0.08)]">
            {out.body}
          </pre>
          <div className="mt-3 flex flex-col gap-2">
            <Button className="w-full" disabled={!outreachTo} onClick={sendViaMailto}>
              {mailOpened
                ? t("mailOpened")
                : outreachTo
                  ? t("sendMailto", { email: outreachTo })
                  : t("sendMailtoNeedsEmail")}
            </Button>
            <Button
              className="w-full"
              variant="ghost"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(`${out.subject}\n\n${out.body}`);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                } catch {
                  /* ignore */
                }
              }}
            >
              {copied ? t("copied") : t("copyAll")}
            </Button>
          </div>
          <p className="text-[12px] text-ink-soft mt-3 mb-0">{t("t_d628bea2")}</p>
        </Card>
      )}
    </div>
  );
}
