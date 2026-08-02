"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { Card, Input, Button } from "@/components/ui";
import {
  VERIFIER_READINESS_AUDIENCE,
  VERIFIER_READINESS_ENDPOINTS,
} from "@/lib/referenceVerifier";

type StepState = "idle" | "running" | "ok" | "fail";

export function ReferenceVerifierWizard() {
  const t = useTranslations("institutionLeader");
  const [steps, setSteps] = useState<Record<string, StepState>>(
    Object.fromEntries(VERIFIER_READINESS_ENDPOINTS.map((e) => [e.id, "idle"])),
  );
  const [verifyStep, setVerifyStep] = useState<StepState>("idle");
  const [allOk, setAllOk] = useState(false);
  const [institutionId, setInstitutionId] = useState("");
  const [nameHe, setNameHe] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [email, setEmail] = useState("");
  const [registerMsg, setRegisterMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const runChecks = useCallback(async () => {
    setAllOk(false);
    setRegisterMsg(null);
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

    const endpointsOk = Object.values(next).every((s) => s === "ok");
    setAllOk(endpointsOk && verifyOk);
  }, []);

  async function register() {
    setRegisterMsg(null);
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
      const data = await res.json().catch(() => ({}));
      if (res.status === 409) setRegisterMsg(t("registerConflict"));
      else if (!res.ok) setRegisterMsg(t("registerError"));
      else
        setRegisterMsg(
          data.tier === "pioneer" ? t("registerPioneer", { id: data.institutionId }) : t("registerOk", { id: data.institutionId }),
        );
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
      </ul>

      {allOk && (
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
        </div>
      )}
    </Card>
  );
}
