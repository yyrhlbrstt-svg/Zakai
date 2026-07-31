"use client";

import { useState } from "react";
import { Button, Input, Textarea, FieldError } from "@/components/ui";
import { SCOPES } from "@/lib/mandate/scopes";

/**
 * Self-serve application to become a delegated issuer — see
 * src/app/api/mandate/delegation/apply/route.ts for why this exists at all.
 * Scope validation happens twice on purpose: disabling a forbidden checkbox
 * here saves a round trip, and the API revalidates because a client check is
 * a convenience, never the boundary.
 */
export function DelegationApplyForm() {
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [errorDetail, setErrorDetail] = useState<string>("");
  const [scopes, setScopes] = useState<string[]>([]);

  function toggleScope(scope: string) {
    setScopes((prev) => (prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]));
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState("sending");
    setErrorDetail("");
    const fd = new FormData(e.currentTarget);
    const payload = {
      slug: String(fd.get("slug") || "").trim(),
      name: String(fd.get("name") || "").trim(),
      contactEmail: String(fd.get("contactEmail") || "").trim(),
      useCase: String(fd.get("useCase") || "").trim(),
      requestedScopes: scopes,
    };
    try {
      const res = await fetch("/api/mandate/delegation/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setState("done");
        return;
      }
      const data = await res.json().catch(() => null);
      setErrorDetail(data?.scopes ? `${data.error}: ${data.scopes.join(", ")}` : data?.error || "");
      setState("error");
    } catch {
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <div className="rounded-2xl border border-[rgba(63,203,155,0.4)] bg-[rgba(63,203,155,0.07)] p-8 text-center">
        <div className="text-[40px] mb-2" aria-hidden>✓</div>
        <div className="font-display text-2xl">Application received</div>
        <div className="text-ink-soft text-[14px] mt-2">
          A human reviews every application before any key is issued. We&apos;ll reply to the
          address you gave us.
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3.5">
      <label className="text-[13px] text-ink-soft">
        Slug (a stable identifier — e.g. <code className="text-[12px]">yourbot.example</code>)
      </label>
      <Input name="slug" required minLength={2} maxLength={64} placeholder="yourbot.example" />

      <label className="text-[13px] text-ink-soft">Agent / company name</label>
      <Input name="name" required minLength={2} maxLength={120} />

      <label className="text-[13px] text-ink-soft">Contact email</label>
      <Input name="contactEmail" type="email" required maxLength={160} />

      <label className="text-[13px] text-ink-soft">
        What will your agent do with these mandates? (min 20 characters)
      </label>
      <Textarea name="useCase" required minLength={20} maxLength={2000} rows={4} />

      <fieldset className="m-0 p-0 border-0">
        <legend className="text-[13px] text-ink-soft mb-2">Scopes you need</legend>
        <div className="flex flex-col gap-1.5 max-h-[220px] overflow-y-auto rounded-xl border border-[rgba(255,255,255,0.08)] p-3">
          {SCOPES.map((s) => (
            <label key={s.scope} className="flex items-start gap-2 text-[13px] cursor-pointer">
              <input
                type="checkbox"
                checked={scopes.includes(s.scope)}
                onChange={() => toggleScope(s.scope)}
                className="mt-0.5"
              />
              <span>
                <code className="text-[12px]">{s.scope}</code>
                <span className="text-ink-soft"> — {s.summary}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {state === "error" && (
        <FieldError>
          {errorDetail || "Something went wrong. Please try again."}
        </FieldError>
      )}

      <Button type="submit" disabled={state === "sending" || scopes.length === 0}>
        {state === "sending" ? "Sending…" : "Submit application"}
      </Button>
    </form>
  );
}
