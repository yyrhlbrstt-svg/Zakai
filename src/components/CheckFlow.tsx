"use client";

import { useState, useRef } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { bcp47, type Locale } from "@/i18n/config";
import { Card, Button, Input, Select, Textarea, FieldError, Spinner } from "@/components/ui";
import { FallNumber } from "@/components/FallNumber";
import { PROVIDER_KEYS } from "@/lib/providers";

type Stage =
  | "input"
  | "analyzing"
  | "recommend"
  | "verify"
  | "sending"
  | "sent"
  | "result";

interface Rec {
  caseId: string;
  providerLabelKey: string;
  amountShekels: number;
  targetShekels: number;
  marketLowShekels: number;
  marketHighShekels: number;
  strategy: string;
  draftMessage: string;
  source: "ai" | "template";
}

interface AuthDoc {
  code: string;
  scope: string;
  verifyUrl: string;
  documentUrl: string;
}

const STEP_OF: Record<Stage, number> = {
  input: 0,
  analyzing: 1,
  recommend: 2,
  verify: 3,
  sending: 4,
  sent: 4,
  result: 5,
};

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1]);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export function CheckFlow() {
  const t = useTranslations("flow");
  const tp = useTranslations("providers");
  const tv = useTranslations("verify");
  const locale = useLocale() as Locale;
  const nf = new Intl.NumberFormat(bcp47[locale]);
  const router = useRouter();

  const [stage, setStage] = useState<Stage>("input");
  const [manualOpen, setManualOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErr, setFieldErr] = useState(false);

  const [provider, setProvider] = useState("");
  const [amount, setAmount] = useState("");
  const [plan, setPlan] = useState("");

  const [rec, setRec] = useState<Rec | null>(null);
  const [draft, setDraft] = useState("");
  const [consent, setConsent] = useState(false);

  // verification state
  const [phoneMasked, setPhoneMasked] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [devHint, setDevHint] = useState(false);
  const [code, setCode] = useState("");
  const [ownershipOk, setOwnershipOk] = useState(false);
  const [ownErr, setOwnErr] = useState<string | null>(null);
  const [auth, setAuth] = useState<AuthDoc | null>(null);
  const [busy, setBusy] = useState(false);

  // outcome
  const [newAmount, setNewAmount] = useState("");
  const [outcome, setOutcome] = useState<{ saving: number; fee: number; chargeable: boolean } | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);

  function tErr(key: string | null): string | null {
    if (!key) return null;
    try {
      return t(key);
    } catch {
      return t("readError");
    }
  }

  async function analyze(payload: Record<string, unknown>) {
    setError(null);
    setStage("analyzing");
    try {
      const res = await fetch("/api/cases/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, locale }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        router.replace("/login");
        return;
      }
      if (!res.ok) {
        setError(data.error || "genericError");
        setStage("input");
        if (data.error === "aiUnavailable") setManualOpen(true);
        return;
      }
      setRec(data);
      setDraft(data.draftMessage);
      setStage("recommend");
    } catch {
      setError("genericError");
      setStage("input");
    }
  }

  async function onFile(file?: File | null) {
    if (!file) return;
    const base64 = await fileToBase64(file);
    await analyze({ mode: "image", imageBase64: base64, mediaType: file.type || "image/jpeg" });
  }

  function analyzeManual() {
    const amt = Number(amount);
    if (!provider || !amt || amt <= 0) {
      setFieldErr(true);
      return;
    }
    setFieldErr(false);
    analyze({ mode: "manual", provider, amountShekels: amt, plan });
  }

  async function approve() {
    if (!rec) return;
    setBusy(true);
    await fetch(`/api/cases/${rec.caseId}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ editedMessage: draft }),
    });
    setBusy(false);
    setStage("verify");
  }

  async function sendCode() {
    if (!rec) return;
    setOwnErr(null);
    const res = await fetch(`/api/cases/${rec.caseId}/ownership/send`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setOwnErr(data.error === "cooldown" ? "codeSent" : "genericError");
      return;
    }
    setCodeSent(true);
    setDevHint(Boolean(data.devHint));
    setPhoneMasked(data.phoneMasked || "");
  }

  async function verifyCode() {
    if (!rec) return;
    setOwnErr(null);
    const res = await fetch(`/api/cases/${rec.caseId}/ownership/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const map: Record<string, string> = {
        invalid: "codeInvalid",
        expired: "codeExpired",
        too_many_attempts: "tooManyAttempts",
        no_code: "codeExpired",
      };
      setOwnErr(map[data.error] || "codeInvalid");
      return;
    }
    setOwnershipOk(true);
  }

  async function generateAuth() {
    if (!rec) return;
    setBusy(true);
    const res = await fetch(`/api/cases/${rec.caseId}/authorization`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) setAuth(data);
  }

  async function send() {
    if (!rec) return;
    setStage("sending");
    const res = await fetch(`/api/cases/${rec.caseId}/send`, { method: "POST" });
    if (!res.ok) {
      setStage("verify");
      setOwnErr("genericError");
      return;
    }
    setStage("sent");
  }

  async function recordSaving(amt: number) {
    if (!rec) return;
    setBusy(true);
    const res = await fetch(`/api/cases/${rec.caseId}/record-saving`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newAmountShekels: amt }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) {
      setOutcome({
        saving: data.savingMonthlyShekels,
        fee: data.feeShekels,
        chargeable: data.chargeable,
      });
      setStage("result");
    }
  }

  const steps = t.raw("steps") as string[];
  const stepIndex = STEP_OF[stage];

  return (
    <main className="max-w-[640px] mx-auto px-5 pb-20 pt-1">
      {/* step indicator */}
      <ol className="flex items-center gap-1.5 my-2 mb-6 list-none p-0">
        {steps.map((s, i) => (
          <li
            key={s}
            className="flex items-center gap-1.5"
            style={{ flex: i < steps.length - 1 ? 1 : "none" }}
          >
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-[26px] h-[26px] rounded-full flex items-center justify-center text-[12.5px] font-extrabold ${
                  i <= stepIndex ? "grad-bg text-[#06121A]" : "bg-[rgba(255,255,255,0.07)] text-ink-soft"
                }`}
              >
                {i + 1}
              </div>
              <div className={`text-[10.5px] font-semibold ${i <= stepIndex ? "text-ink" : "text-ink-soft"}`}>
                {s}
              </div>
            </div>
            {i < steps.length - 1 && (
              <div
                className="flex-1 h-0.5 rounded mb-4"
                style={{ background: i < stepIndex ? "#2CE5A7" : "rgba(255,255,255,0.08)" }}
              />
            )}
          </li>
        ))}
      </ol>

      {stage === "input" && (
        <div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={(e) => onFile(e.target.files?.[0])}
            className="hidden"
          />
          <div
            role="button"
            tabIndex={0}
            onClick={() => fileRef.current?.click()}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && fileRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              onFile(e.dataTransfer.files?.[0]);
            }}
            className={`${
              "bg-[rgba(255,255,255,0.045)] rounded-2xl backdrop-blur-xl cursor-pointer transition-all"
            } text-center px-6 py-11`}
            style={{
              border: `2px dashed ${dragOver ? "#2CE5A7" : "rgba(255,255,255,0.09)"}`,
              background: dragOver ? "rgba(44,229,167,0.07)" : "rgba(255,255,255,0.045)",
            }}
          >
            <div className="text-[38px] mb-3">📄</div>
            <div className="font-display text-xl">{t("dropTitle")}</div>
            <div className="text-ink-soft text-sm mt-2">{t("dropSub")}</div>
          </div>

          <FieldError>{tErr(error)}</FieldError>

          <div className="flex justify-center mt-4">
            <button
              onClick={() => setManualOpen((v) => !v)}
              className="bg-transparent border-0 text-emerald text-sm font-bold cursor-pointer"
            >
              {t("orManual")}
            </button>
          </div>

          {manualOpen && (
            <Card className="p-5 mt-3.5">
              <Select
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                className="mb-3"
                aria-label={t("providerLabel")}
              >
                <option value="">{t("providerLabel")}</option>
                {PROVIDER_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {tp(k)}
                  </option>
                ))}
              </Select>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={t("amountLabel")}
                className="mb-3"
                aria-label={t("amountLabel")}
              />
              <Input
                value={plan}
                onChange={(e) => setPlan(e.target.value)}
                placeholder={t("planPlaceholder")}
                aria-label={t("planPlaceholder")}
              />
              {fieldErr && <FieldError>{t("needAmount")}</FieldError>}
              <Button onClick={analyzeManual} className="w-full mt-3.5">
                {t("analyzeBtn")}
              </Button>
            </Card>
          )}
        </div>
      )}

      {stage === "analyzing" && <Spinner label={t("analyzing")} sub={t("analyzingSub")} />}
      {stage === "sending" && <Spinner label={t("sending")} sub={t("sendingSub")} />}

      {stage === "recommend" && rec && (
        <div>
          <Card className="p-6">
            <div className="text-sm text-ink-soft">
              {t("recFor")} <b className="text-ink">{tp(rec.providerLabelKey)}</b>
            </div>
            <div className="flex gap-8 mt-4">
              <div>
                <div className="text-[12.5px] text-ink-soft">{t("currentAmount")}</div>
                <div className="font-display text-3xl">₪{nf.format(rec.amountShekels)}</div>
              </div>
              <div>
                <div className="text-[12.5px] text-emerald font-bold">{t("targetAmount")}</div>
                <div className="font-display grad-text text-3xl">₪{nf.format(rec.targetShekels)}</div>
              </div>
            </div>
            <div className="mt-3.5 text-[11.5px] font-bold text-ink-soft">
              {t("strategyTitle")}
            </div>
            <div className="mt-1.5 text-[14.5px] leading-relaxed">{rec.strategy}</div>
          </Card>

          <Card className="p-5 mt-3.5">
            <div className="text-[12px] font-extrabold text-ink-soft">
              {t("draftTitle")}
            </div>
            <div className="text-[12px] text-ink-soft mt-1.5 mb-2.5">{t("draftNote")}</div>
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={10}
              className="whitespace-pre-wrap"
            />
          </Card>

          <label className="flex gap-2.5 items-start mt-4 text-sm leading-normal cursor-pointer">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-1 w-[18px] h-[18px] shrink-0"
            />
            <span>
              {t("consentLabel")} <b>{tp(rec.providerLabelKey)}</b> {t("consentLabel2")}
            </span>
          </label>

          <div className="flex gap-2.5 mt-4">
            <Button onClick={approve} disabled={!consent || busy} className="flex-1">
              {t("approveBtn")}
            </Button>
            <Button variant="ghost" onClick={() => location.reload()}>
              {t("startOver")}
            </Button>
          </div>
        </div>
      )}

      {stage === "verify" && rec && (
        <div>
          <Card className="p-6">
            <h2 className="font-display text-2xl m-0">{tv("title")}</h2>
            <p className="text-ink-soft text-[14.5px] mt-2 leading-relaxed">{tv("sub")}</p>
          </Card>

          {/* 1. ownership */}
          <Card className="p-5 mt-3.5">
            <div className="flex items-center gap-2">
              <StepDot done={ownershipOk} />
              <div className="font-extrabold">{tv("ownershipTitle")}</div>
            </div>
            {!ownershipOk ? (
              <div className="mt-3">
                {!codeSent ? (
                  <Button onClick={sendCode}>{tv("sendCode")}</Button>
                ) : (
                  <>
                    <p className="text-[13.5px] text-ink-soft mb-2.5">
                      {tv("ownershipSub", { phone: phoneMasked })}
                    </p>
                    {devHint && (
                      <p className="text-[12px] text-amber mb-2.5">{tv("ownershipDevNote")}</p>
                    )}
                    <div className="flex gap-2.5">
                      <Input
                        value={code}
                        onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                        inputMode="numeric"
                        maxLength={6}
                        placeholder={tv("codeLabel")}
                        aria-label={tv("codeLabel")}
                      />
                      <Button onClick={verifyCode}>{tv("verifyCode")}</Button>
                    </div>
                    <button
                      onClick={sendCode}
                      className="bg-transparent border-0 text-emerald text-[13px] font-bold cursor-pointer mt-2"
                    >
                      {tv("resendCode")}
                    </button>
                  </>
                )}
                {ownErr && <FieldError>{tvSafe(tv, ownErr)}</FieldError>}
              </div>
            ) : (
              <div className="text-emerald text-sm font-bold mt-2">✓ {tv("ownershipVerified")}</div>
            )}
          </Card>

          {/* 2. authorization document */}
          <Card className="p-5 mt-3.5">
            <div className="flex items-center gap-2">
              <StepDot done={Boolean(auth)} />
              <div className="font-extrabold">{tv("authTitle")}</div>
            </div>
            <p className="text-[13.5px] text-ink-soft mt-2 leading-relaxed">{tv("authSub")}</p>
            {!auth ? (
              <Button onClick={generateAuth} disabled={busy} className="mt-3">
                {tv("authGenerate")}
              </Button>
            ) : (
              <div className="mt-3 text-sm">
                <div className="text-emerald font-bold mb-2">✓ {tv("authGenerated")}</div>
                <div className="text-ink-soft">{tv("authCode")}</div>
                <div className="font-display text-xl tracking-wide">{auth.code}</div>
                <div className="flex gap-4 mt-2.5 flex-wrap">
                  <a href={auth.documentUrl} target="_blank" rel="noreferrer" className="text-emerald font-bold no-underline">
                    {tv("authView")} ↗
                  </a>
                  <a href={auth.verifyUrl} target="_blank" rel="noreferrer" className="text-emerald font-bold no-underline">
                    {tv("authVerifyLink")} ↗
                  </a>
                </div>
              </div>
            )}
          </Card>

          <div className="flex gap-2.5 mt-4">
            <Button onClick={send} disabled={!ownershipOk || !auth} className="flex-1">
              {tv("proceed")}
            </Button>
          </div>
          {(!ownershipOk || !auth) && (
            <p className="text-[12.5px] text-ink-soft mt-2 text-center">{tv("bothRequired")}</p>
          )}
        </div>
      )}

      {stage === "sent" && rec && (
        <div>
          <div className="text-center pt-6">
            <div className="w-[92px] h-[92px] mx-auto mb-5 rounded-full grad-bg text-[#06121A] flex items-center justify-center text-[40px] font-black">
              ✓
            </div>
            <h2 className="font-display text-[27px] m-0 mb-2">{t("sentTitle")}</h2>
            <p className="text-ink-soft text-[15px] max-w-[420px] mx-auto leading-relaxed">
              {t("sentSub")}
            </p>
          </div>

          <Card className="p-5 mt-6">
            <div className="font-extrabold">{t("trackTitle")}</div>
            <p className="text-[13.5px] text-ink-soft mt-1.5 mb-3 leading-relaxed">{t("trackSub")}</p>
            <Input
              type="number"
              value={newAmount}
              onChange={(e) => setNewAmount(e.target.value)}
              placeholder={t("newAmountLabel")}
              aria-label={t("newAmountLabel")}
            />
            <div className="flex gap-2.5 mt-3.5 flex-wrap">
              <Button
                onClick={() => recordSaving(Number(newAmount))}
                disabled={busy || newAmount === "" || Number(newAmount) < 0}
                className="flex-1"
              >
                {t("recordSavingBtn")}
              </Button>
              <Button
                variant="ghost"
                onClick={() => recordSaving(rec.amountShekels)}
                disabled={busy}
              >
                {t("noChangeBtn")}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {stage === "result" && rec && outcome && (
        <div>
          <Card className="text-center px-7 py-14 relative overflow-hidden">
            <div
              className="absolute top-1/2 left-1/2 w-[340px] h-[340px] -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{ background: "#2CE5A7", filter: "blur(95px)", opacity: 0.3 }}
              aria-hidden
            />
            <div className="relative">
              <div className="text-[13px] text-ink-soft font-extrabold">
                {t("resultTitle")}
              </div>
              {outcome.chargeable ? (
                <>
                  {/* The old amount, settling down to the new one — weight lifted. */}
                  <div className="text-ink-soft text-[15px] mt-4 line-through decoration-[rgba(147,166,165,0.5)]">
                    ₪{nf.format(rec.amountShekels)}
                  </div>
                  <div className="font-display grad-text text-[76px] leading-[1.05] mt-1">
                    <FallNumber
                      from={rec.amountShekels}
                      to={rec.amountShekels - outcome.saving}
                      locale={bcp47[locale]}
                    />
                  </div>
                  <div className="text-ink-soft text-sm mt-2">{t("perMonth")}</div>
                  <div className="flex justify-center gap-12 mt-10 flex-wrap">
                    <div>
                      <div className="font-display text-emerald text-[26px]">
                        ₪{nf.format(outcome.saving)}
                      </div>
                      <div className="text-[12.5px] text-ink-soft mt-0.5">{t("monthlySaving")}</div>
                    </div>
                    <div>
                      <div className="font-display text-emerald text-[26px]">
                        ₪{nf.format(outcome.saving * 12)}
                      </div>
                      <div className="text-[12.5px] text-ink-soft mt-0.5">{t("annualSaving")}</div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="mt-4 text-[15px] leading-relaxed">{t("noSaving")}</div>
              )}
            </div>
          </Card>

          {outcome.chargeable && (
            <Card className="p-5 mt-3.5 border border-[rgba(44,229,167,0.35)]">
              <div className="flex justify-between items-center">
                <div className="text-sm font-bold">{t("feeNote")}</div>
                <div className="font-display grad-text text-2xl">₪{nf.format(outcome.fee)}</div>
              </div>
              <div className="text-[13px] text-ink-soft mt-1.5">{t("feeExplain")}</div>
            </Card>
          )}

          <div className="flex gap-2.5 mt-4">
            <Button variant="ghost" onClick={() => location.reload()} className="flex-1">
              {t("newCase")}
            </Button>
            <Button onClick={() => router.push("/dashboard")} className="flex-1">
              {t("toDash")}
            </Button>
          </div>
        </div>
      )}
    </main>
  );
}

function StepDot({ done }: { done: boolean }) {
  return (
    <span
      className={`w-5 h-5 rounded-full inline-flex items-center justify-center text-[12px] font-black ${
        done ? "grad-bg text-[#06121A]" : "bg-[rgba(255,255,255,0.1)] text-ink-soft"
      }`}
    >
      {done ? "✓" : ""}
    </span>
  );
}

function tvSafe(tv: ReturnType<typeof useTranslations>, key: string): string {
  try {
    return tv(key);
  } catch {
    return tv("codeInvalid");
  }
}
