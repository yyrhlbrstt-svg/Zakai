"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Card, Button } from "@/components/ui";
import type { GrantedAuthority } from "@/lib/services/authorityControl";

/**
 * One tap to withdraw, and the state visible before and after.
 *
 * Revoked grants stay on screen rather than vanishing. A list that removes what
 * you just cancelled cannot answer "did that actually work", which is the
 * question people open this page to ask.
 */
export function AuthorityList({ authorities }: { authorities: GrantedAuthority[] }) {
  const t = useTranslations("authority");
  const [state, setState] = useState<Record<string, "idle" | "busy" | "revoked" | "error">>({});
  // Two-step, not a native confirm() dialog: the button itself becomes the
  // confirmation, so there is nothing to dismiss by habit the way a browser
  // confirm() is — this is the one action on the page a reflexive click
  // should not be able to trigger.
  const [revokeAllState, setRevokeAllState] = useState<"idle" | "armed" | "busy" | "done" | "error">(
    "idle",
  );

  async function revoke(code: string) {
    setState((s) => ({ ...s, [code]: "busy" }));
    try {
      const res = await fetch("/api/authority/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      setState((s) => ({ ...s, [code]: res.ok ? "revoked" : "error" }));
    } catch {
      setState((s) => ({ ...s, [code]: "error" }));
    }
  }

  async function revokeAll() {
    if (revokeAllState !== "armed") {
      setRevokeAllState("armed");
      return;
    }
    setRevokeAllState("busy");
    try {
      const res = await fetch("/api/authority/revoke-all", { method: "POST" });
      if (!res.ok) {
        setRevokeAllState("error");
        return;
      }
      const data = (await res.json()) as { revoked: string[] };
      setState((s) => {
        const next = { ...s };
        for (const code of data.revoked) next[code] = "revoked";
        return next;
      });
      setRevokeAllState("done");
    } catch {
      setRevokeAllState("error");
    }
  }

  const activeCount = authorities.filter(
    (a) => a.status !== "REVOKED" && state[a.code] !== "revoked",
  ).length;

  if (authorities.length === 0) {
    return (
      <Card className="p-7 text-center">
        <p className="text-ink-soft text-[14px] m-0 leading-relaxed">{t("empty")}</p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {activeCount > 1 && revokeAllState !== "done" && (
        <div className="flex items-center justify-end gap-2.5 flex-wrap">
          {revokeAllState === "error" && (
            <span role="alert" className="text-[12px] text-[#ff8f8f]">
              {t("revokeFailed")}
            </span>
          )}
          <Button
            variant="ghost"
            disabled={revokeAllState === "busy"}
            onClick={revokeAll}
            className="!text-[12.5px] !px-4 !py-2 !border-[rgba(255,143,143,0.35)] !text-[#ff8f8f]"
          >
            {revokeAllState === "busy"
              ? t("revoking")
              : revokeAllState === "armed"
                ? t("revokeAllConfirm")
                : t("revokeAll")}
          </Button>
        </div>
      )}
      {authorities.map((a) => {
        const local = state[a.code];
        const revoked = a.status === "REVOKED" || local === "revoked";
        return (
          <Card key={a.code} className="p-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex-1 basis-[240px]">
                <div className="font-extrabold text-[15px]">{a.provider}</div>
                <div className="text-ink-soft text-[13px] mt-1.5 leading-relaxed">{a.scope}</div>
                <div className="text-ink-soft text-[11.5px] mt-2" dir="ltr">
                  {a.code} · {new Date(a.issuedAt).toLocaleDateString()}
                </div>
              </div>

              {revoked ? (
                <span className="text-[12.5px] font-extrabold text-ink-soft rounded-full border border-[rgba(255,255,255,0.12)] px-3 py-1.5">
                  {t("revoked")}
                </span>
              ) : (
                <Button
                  variant="ghost"
                  disabled={local === "busy"}
                  onClick={() => revoke(a.code)}
                  className="!text-[13px] !px-4 !py-2"
                >
                  {local === "busy" ? t("revoking") : t("revoke")}
                </Button>
              )}
            </div>

            {local === "error" && (
              <p role="alert" className="text-[12.5px] text-[#ff8f8f] mt-3 mb-0">
                {t("revokeFailed")}
              </p>
            )}
            {local === "revoked" && (
              <p className="text-[12.5px] text-emerald mt-3 mb-0 leading-relaxed">
                {t("revokedNote")}
              </p>
            )}
          </Card>
        );
      })}
    </div>
  );
}
