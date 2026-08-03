"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { Card, Input, Button } from "@/components/ui";
import {
  VERIFIER_READINESS_AUDIENCE,
  VERIFIER_READINESS_ENDPOINTS,
} from "@/lib/referenceVerifier";

type StepState = "idle" | "running" | "ok" | "fail";

type ReadyPayload = {
  ready_for_pioneer?: boolean;
  vectors?: { passed?: boolean; total?: number; failed?: string[] };
  status_list?: { ok?: boolean; detail?: string };
};

export function ReferenceVerifierWizard() {
  const t = useTranslations("institutionLeader");
  const [steps, setSteps] = useState<Record<string, StepState>>(
    Object.fromEntries(VERIFIER_READINESS_ENDPOINTS.map((e) => [e.id, "idle"])),
  );
  const [verifyStep, setVerifyStep] = useState<StepState>("idle");
  const [inboundStep, setInboundStep] = useState<StepState>("idle");
  const [readyStep, setReadyStep] = useState<StepState>("idle");
  const [readyDetail, setReadyDetail] = useState<string | null>(null);
  const [pioneerReady, setPioneerReady] = useState(false);
  const [allOk, setAllOk] = useState(false);
  const [institutionId, setInstitutionId] = useState("");
  const [nameHe, setNameHe] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [email, setEmail] = useState("");
  const [registerMsg, setRegisterMsg] = useState<string | null>(null);
  const [publicUrl, setPublicUrl] = useState<string | null>(null);
  const [listedId, setListedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const runChecks = useCallback(async () => {
    setAllOk(false);
    setPioneerReady(false);
    setReadyDetail(null);
    setRegisterMsg(null);
    setPublicUrl(null);
    setListedId(null);
    const next: Record<string, StepState> = {};
    for (const ep of VERIFIER_READINESS_ENDPOINTS) {
      next[ep.id] = "running";
      setSteps({ ...next });
      try {
        const res = await fetch(ep.path, { cache: "no-store" });
        next[ep.id] = res.ok ? "ok" : "fail";
      } catch {
        next[ep.id] = "fail";
      }
      setSteps({ ...next });
    }

    setVerifyStep("running");
    let verifyOk = false;
    try {
      const sample = await fetch("/api/institution/verifier-readiness/sample");
      if (sample.ok) {
        const { audience, token } = (await sample.json()) as { audience: string; token: string };
        const v = await fetch("/api/mandate/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, audience }),
        });
        const body = await v.json();
        verifyOk = v.ok && body.valid === true;
      }
    } catch {
      verifyOk = false;
    }
    setVerifyStep(verifyOk ? "ok" : "fail");

    setInboundStep("running");
    let inboundOk = false;
    try {
      const inbound = await fetch("/api/institution/inbound-receive", { cache: "no-store" });
      inboundOk = inbound.ok;
    } catch {
      inboundOk = false;
    }
    setInboundStep(inboundOk ? "ok" : "fail");

    // Hard Pioneer gate — same server check that blocks false wall listings.
    setReadyStep("running");
    let readyOk = false;
    try {
      const readyRes = await fetch("/api/mandate/ready", { cache: "no-store" });
      const readyBody = (await readyRes.json().catch(() => ({}))) as ReadyPayload;
      readyOk = readyRes.ok && readyBody.ready_for_pioneer === true;
      if (readyOk) {
        setReadyDetail(t("readyForPioneer"));
      } else {
        const fails = readyBody.vectors?.failed?.slice(0, 2)?.join("; ");
        const status = readyBody.status_list?.detail;
        setReadyDetail(
          [t("notReadyForPioneer"), fails, status].filter(Boolean).join(" — ") ||
            t("notReadyForPioneer"),
        );
      }
    } catch {
      readyOk = false;
      setReadyDetail(t("notReadyForPioneer"));
    }
    setReadyStep(readyOk ? "ok" : "fail");
    setPioneerReady(readyOk);

    const endpointsOk = Object.values(next).every((s) => s === "ok");
    // Registration form only opens when machine gate passes — UX matches server gate.
    setAllOk(endpointsOk && verifyOk && inboundOk && readyOk);
  }, [t]);

  async function register() {
    setRegisterMsg(null);
    setPublicUrl(null);
    setBusy(true);
    try {
      const res = await fetch("/api/institution/reference-verifiers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          institutionId,
          displayNameHe: nameHe,
          displayNameEn: nameEn,
          contactEmail: email,
          clientCompletedChecks: true,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        tier?: string;
        institutionId?: string;
        publicUrl?: string;
        hint?: string;
        failed?: string[];
      };
      if (res.status === 409) setRegisterMsg(t("registerConflict"));
      else if (data.error === "vectors_not_conformant") {
        setRegisterMsg(
          [t("registerVectorsBlocked"), data.hint, ...(data.failed ?? []).slice(0, 2)]
            .filter(Boolean)
            .join(" "),
        );
      } else if (!res.ok) setRegisterMsg(t("registerError"));
      else {
        setRegisterMsg(
          data.tier === "pioneer"
            ? t("registerPioneer", { id: data.institutionId ?? institutionId })
            : t("registerOk", { id: data.institutionId ?? institutionId }),
        );
        setPublicUrl(data.publicUrl ?? "/institutions/leaders");
        setListedId(data.institutionId ?? institutionId.trim().toLowerCase());
      }
    } catch {
      setRegisterMsg(t("registerError"));
    } finally {
      setBusy(false);
    }
  }

  const stepLabel = (s: StepState) => {
    if (s === "running") return "…";
    if (s === "ok") return "✓";
    if (s === "fail") return "✗";
    return "—";
  };

  return (
    <Card className="p-6 mt-8">
      <h2 className="font-display text-xl m-0 mb-2">{t("wizardTitle")}</h2>
      <p className="text-[13.5px] text-ink-soft leading-relaxed mb-4">{t("wizardSub")}</p>
      <p className="text-[12px] text-ink-soft mb-4">
        {t("verifyAudienceHint", { aud: VERIFIER_READINESS_AUDIENCE })}
      </p>
      <p className="text-[12.5px] text-ink-soft mb-4 leading-relaxed border border-[rgba(63,203,155,0.25)] rounded-xl px-3 py-2 bg-[rgba(63,203,155,0.05)]">
        {t("pioneerGateHint")}
      </p>

      <Button onClick={runChecks} className="mb-4">
        {t("runChecks")}
      </Button>

      <ul className="list-none p-0 m-0 flex flex-col gap-2 text-[13px]">
        {VERIFIER_READINESS_ENDPOINTS.map((ep) => (
          <li key={ep.id} className="flex justify-between gap-3">
            <span>{t(`check_${ep.id}`)}</span>
            <span aria-hidden>{stepLabel(steps[ep.id] ?? "idle")}</span>
          </li>
        ))}
        <li className="flex justify-between gap-3 font-bold">
          <span>{t("check_verify")}</span>
          <span aria-hidden>{stepLabel(verifyStep)}</span>
        </li>
        <li className="flex justify-between gap-3 font-bold">
          <span>{t("check_inbound")}</span>
          <span aria-hidden>{stepLabel(inboundStep)}</span>
        </li>
        <li className="flex justify-between gap-3 font-bold text-emerald">
          <span>{t("check_ready")}</span>
          <span aria-hidden>{stepLabel(readyStep)}</span>
        </li>
      </ul>

      {readyDetail ? (
        <p
          className={`text-[13px] mt-3 mb-0 font-extrabold ${
            pioneerReady ? "text-emerald" : "text-ink-soft"
          }`}
        >
          {readyDetail}
        </p>
      ) : null}

      {!pioneerReady && readyStep === "fail" ? (
        <p className="text-[12.5px] text-ink-soft mt-2 mb-0 leading-relaxed">
          {t("readyCliHint")}{" "}
          <code className="text-[11px]">npx zakai-mandate-ready</code>
          {" · "}
          <a className="text-emerald underline" href="/api/mandate/ready" target="_blank" rel="noreferrer">
            /api/mandate/ready
          </a>
        </p>
      ) : null}

      {allOk && pioneerReady && (
        <div className="mt-6 pt-5 border-t border-[rgba(255,255,255,0.08)]">
          <p className="text-emerald font-extrabold text-[14px] mb-3">{t("checksPassed")}</p>
          <div className="grid gap-3">
            <label className="block text-[13px]">
              {t("fieldInstitutionId")}
              <Input
                className="mt-1"
                value={institutionId}
                onChange={(e) => setInstitutionId(e.target.value)}
                placeholder="bank-leumi"
                dir="ltr"
              />
            </label>
            <label className="block text-[13px]">
              {t("fieldNameHe")}
              <Input className="mt-1" value={nameHe} onChange={(e) => setNameHe(e.target.value)} />
            </label>
            <label className="block text-[13px]">
              {t("fieldNameEn")}
              <Input className="mt-1" value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
            </label>
            <label className="block text-[13px]">
              {t("fieldEmail")}
              <Input
                type="email"
                className="mt-1"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                dir="ltr"
              />
            </label>
          </div>
          <Button className="mt-4 w-full" onClick={register} disabled={busy || !institutionId.trim()}>
            {busy ? t("registerBusy") : t("registerCta")}
          </Button>
          {registerMsg && <p className="text-[13px] mt-3 text-ink-soft">{registerMsg}</p>}

          {(listedId || allOk) && (
            <div className="mt-5 flex flex-col gap-2">
              <p className="text-[13px] font-extrabold text-ink m-0">{t("nextStepsTitle")}</p>
              <a
                href="/api/institution/pilot-package"
                className="text-[13px] text-emerald font-bold no-underline"
                target="_blank"
                rel="noreferrer"
              >
                {t("nextPilotPackage")}
              </a>
              <a
                href="/reference/inbound-receiver/receive.mjs"
                className="text-[13px] text-emerald font-bold no-underline"
                target="_blank"
                rel="noreferrer"
              >
                {t("nextCloneReceiver")}
              </a>
              {publicUrl ? (
                <Link href="/institutions/leaders" className="text-[13px] text-emerald font-bold">
                  {t("nextLeadersWall")}
                </Link>
              ) : null}
              <Link href="/join-network" className="text-[13px] text-emerald font-bold">
                {t("nextJoinNetwork")}
              </Link>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
