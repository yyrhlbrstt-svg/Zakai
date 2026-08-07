"use client";

import { useState } from "react";
import { Card, Button } from "@/components/ui";

/**
 * Issue a mandate, verify it, break it, watch it fail — on the page.
 *
 * An integrator does not believe a protocol because a page says the signature
 * is checked. They believe it when they watch a valid token pass, change one
 * character, and watch the same verifier reject it. Everything here is a real
 * network call to the real endpoints: nothing is simulated, and the tamper step
 * fails because Ed25519 makes it fail, not because this component decided to
 * show a red box.
 *
 * The fourth step is the one that matters most and is easiest to leave out:
 * presenting the sandbox token to the PRODUCTION verifier, which refuses it as
 * UNKNOWN_ISSUER. An integrator should see the containment as clearly as they
 * see the capability, in the same sitting.
 */

type StepState = "idle" | "running" | "ok" | "fail";

interface Step {
  key: string;
  label: string;
  detail: string;
  state: StepState;
  output?: string;
}

const SCOPES = ["read:bills", "dispute:charge"];

export function MandateConsole({ he }: { he: boolean }) {
  const t = (heText: string, en: string) => (he ? heText : en);

  const [steps, setSteps] = useState<Step[]>([]);
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  function push(step: Step) {
    setSteps((prev) => [...prev.filter((s) => s.key !== step.key), step]);
  }

  async function run() {
    setBusy(true);
    setSteps([]);
    setToken(null);

    try {
      // 1 — issue
      push({
        key: "issue",
        label: t("מנפיק Mandate", "Issuing a mandate"),
        detail: t("POST /api/mandate/sandbox/issue", "POST /api/mandate/sandbox/issue"),
        state: "running",
      });
      const issueRes = await fetch("/api/mandate/sandbox/issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scopes: SCOPES }),
      });
      const issued = (await issueRes.json()) as {
        token?: string;
        issuer?: string;
        expiresAt?: string;
        error?: string;
      };
      if (!issueRes.ok || !issued.token) {
        push({
          key: "issue",
          label: t("מנפיק Mandate", "Issuing a mandate"),
          detail: t("ההנפקה נכשלה", "Issue failed"),
          state: "fail",
          output: issued.error ?? String(issueRes.status),
        });
        return;
      }
      setToken(issued.token);
      push({
        key: "issue",
        label: t("Mandate הונפק", "Mandate issued"),
        detail: `iss: ${issued.issuer}`,
        state: "ok",
        output: `${issued.token.slice(0, 56)}…`,
      });

      // 2 — verify against the sandbox JWKS, in this browser
      push({
        key: "verify",
        label: t("מאמת חתימה", "Verifying signature"),
        detail: t("WebCrypto מול ה־JWKS של הסביבה", "WebCrypto against the sandbox JWKS"),
        state: "running",
      });
      const okValid = await verifyLocally(issued.token);
      push({
        key: "verify",
        label: okValid
          ? t("החתימה תקפה", "Signature valid")
          : t("החתימה נכשלה", "Signature failed"),
        detail: t(
          "אומת בדפדפן שלך — לא בשרת שלנו",
          "Checked in your browser, not on our server",
        ),
        state: okValid ? "ok" : "fail",
      });

      // 3 — tamper
      push({
        key: "tamper",
        label: t("משנה תו אחד", "Changing one character"),
        detail: t("באמצע ה־payload", "in the middle of the payload"),
        state: "running",
      });
      const okTampered = await verifyLocally(tamper(issued.token));
      push({
        key: "tamper",
        label: okTampered
          ? t("הטוקן המשובש התקבל", "Tampered token accepted")
          : t("הטוקן המשובש נדחה", "Tampered token rejected"),
        detail: t(
          "זו החתימה שדוחה אותו, לא הדף הזה",
          "Ed25519 rejects it, not this page",
        ),
        // Rejection is the passing outcome here.
        state: okTampered ? "fail" : "ok",
      });

      // 4 — the containment
      push({
        key: "contain",
        label: t("מציג אותו למאמת הפרודקשן", "Presenting it to the production verifier"),
        detail: "POST /api/mandate/verify",
        state: "running",
      });
      const prodRes = await fetch("/api/mandate/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mandate: issued.token, audience: "sandbox-institution" }),
      });
      const prod = (await prodRes.json()) as { valid?: boolean; reason?: string };
      push({
        key: "contain",
        label:
          prod.valid === false
            ? t("הפרודקשן מסרב — כמתוכנן", "Production refuses it — by design")
            : t("הפרודקשן קיבל אותו — תקלה", "Production accepted it — a defect"),
        detail: t(
          "טוקן ניסיון לא מעניק שום סמכות",
          "A sandbox token grants no authority",
        ),
        state: prod.valid === false ? "ok" : "fail",
        output: prod.reason,
      });
    } catch (err) {
      push({
        key: "error",
        label: t("משהו נכשל", "Something failed"),
        detail: String(err instanceof Error ? err.message : err).slice(0, 120),
        state: "fail",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-6 mb-4">
      <h2 className="font-display text-h4 mb-2">
        {t("נסו את זה עכשיו", "Try it right now")}
      </h2>
      <p className="text-body text-ink-soft leading-relaxed mb-4">
        {t(
          "ארבע קריאות אמיתיות לנקודות הקצה האמיתיות. שום דבר כאן לא מדומה — כולל השלב שבו זה נכשל.",
          "Four real calls to the real endpoints. Nothing here is simulated — including the step where it fails.",
        )}
      </p>

      <Button onClick={run} disabled={busy}>
        {busy ? t("רץ…", "Running…") : t("הרץ את הרצף", "Run the sequence")}
      </Button>

      {steps.length > 0 && (
        <ol className="list-none p-0 mt-5 flex flex-col gap-2.5">
          {steps.map((s) => (
            <li
              key={s.key}
              className="flex items-start gap-3 rounded-xl border px-4 py-3"
              style={{
                borderColor:
                  s.state === "ok"
                    ? "rgba(63,203,155,0.45)"
                    : s.state === "fail"
                      ? "rgba(255,143,143,0.45)"
                      : "rgba(255,255,255,0.1)",
                background:
                  s.state === "ok"
                    ? "rgba(63,203,155,0.07)"
                    : s.state === "fail"
                      ? "rgba(255,143,143,0.07)"
                      : "rgba(255,255,255,0.03)",
              }}
            >
              <span aria-hidden className="text-body-lg leading-none mt-0.5">
                {s.state === "ok" ? "✓" : s.state === "fail" ? "✕" : "…"}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block font-bold text-body">{s.label}</span>
                <span className="block text-caption text-ink-soft mt-0.5">{s.detail}</span>
                {s.output && (
                  <code
                    dir="ltr"
                    className="block text-micro text-ink-soft mt-1.5 font-mono break-all"
                  >
                    {s.output}
                  </code>
                )}
              </span>
            </li>
          ))}
        </ol>
      )}

      {token && (
        <details className="mt-4">
          <summary className="cursor-pointer text-caption font-bold text-emerald select-none">
            {t("הצג את הטוקן המלא", "Show the full token")}
          </summary>
          <code
            dir="ltr"
            className="block text-micro font-mono break-all mt-2 text-ink-soft leading-relaxed"
          >
            {token}
          </code>
        </details>
      )}
    </Card>
  );
}

/** Flip one character inside the payload segment, leaving the shape intact. */
function tamper(token: string): string {
  const [h, p, s] = token.split(".");
  const at = Math.min(10, p.length - 1);
  const flipped = p[at] === "A" ? "B" : "A";
  return `${h}.${p.slice(0, at)}${flipped}${p.slice(at + 1)}.${s}`;
}

/**
 * Verify in the browser with WebCrypto against the published sandbox JWKS.
 *
 * Done client-side on purpose: a server round-trip would leave the reader
 * trusting our answer about our own signature. This way the check runs on
 * their machine, with a key they can fetch themselves.
 */
async function verifyLocally(token: string): Promise<boolean> {
  const jwks = (await (await fetch("/api/mandate/sandbox/jwks.json")).json()) as {
    keys: JsonWebKey[];
  };
  const key = await crypto.subtle.importKey(
    "jwk",
    { ...jwks.keys[0], ext: true },
    { name: "Ed25519" },
    false,
    ["verify"],
  );
  const [h, p, s] = token.split(".");
  return crypto.subtle.verify(
    { name: "Ed25519" },
    key,
    b64uToBytes(s),
    new TextEncoder().encode(`${h}.${p}`),
  );
}

function b64uToBytes(b64u: string): Uint8Array<ArrayBuffer> {
  const b64 = b64u.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64.padEnd(Math.ceil(b64.length / 4) * 4, "="));
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
