"use client";

import { useState } from "react";
import { Button } from "@/components/ui";

/**
 * The clickable form of `npm run grant:owner-access`, for a founder who
 * reached this page (already proved ADMIN_EMAIL + verified email) but has
 * no terminal access to production. Posts to /api/founder/grant-owner-access,
 * which re-checks the same two gates server-side before touching anything.
 */
export function GrantOwnerAccessButton({ currentPlan }: { currentPlan: string }) {
  const [plan, setPlan] = useState(currentPlan);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (plan === "BUSINESS") {
    return (
      <p className="text-[12.5px] text-emerald font-bold m-0">
        החשבון שלך כבר על BUSINESS (0% עמלה, בלי הגבלת תיקים).
      </p>
    );
  }

  async function grant() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/founder/grant-owner-access", { method: "POST" });
      const data = (await res.json()) as { ok?: boolean; plan?: string; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "genericError");
        return;
      }
      setPlan(data.plan ?? "BUSINESS");
    } catch {
      setError("genericError");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <Button variant="ghost" onClick={grant} disabled={busy}>
        {busy ? "משדרג..." : `שדרג את החשבון שלי מ-${currentPlan} ל-BUSINESS`}
      </Button>
      {error && <span className="text-[12px] text-amber">שגיאה: {error}</span>}
    </div>
  );
}
