"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { Card, Button, Input } from "@/components/ui";
import { daysUntil } from "@/lib/deadlines";

interface DeadlineRow {
  id: string;
  label: string;
  dueDate: string;
  remindDaysBefore: number;
}

/**
 * A personal date the user wants a heads-up before — passport, car test, an
 * annual filing. No Case, no Mandate, no fee: this is a calendar with a
 * nudge, and the reminder itself is sent by the existing daily cron
 * (extended, not duplicated — see /api/cron/nudges).
 */
export function DeadlineTracker() {
  const t = useTranslations("deadlines");
  const router = useRouter();
  const [rows, setRows] = useState<DeadlineRow[] | null>(null);
  const [label, setLabel] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [remindDays, setRemindDays] = useState("14");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/deadlines");
    if (res.status === 401) {
      router.replace("/login?return=/deadlines");
      return;
    }
    if (!res.ok) return;
    const data = await res.json();
    setRows(data.deadlines);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function add() {
    if (!label.trim() || !dueDate) return;
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/deadlines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: label.trim(),
          dueDate,
          remindDaysBefore: Number(remindDays) || 14,
        }),
      });
      if (res.status === 401) {
        router.replace("/login?return=/deadlines");
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error === "deadlineLimit" ? t("limitError") : t("genericError"));
        return;
      }
      setLabel("");
      setDueDate("");
      setRemindDays("14");
      await load();
    } catch {
      setError(t("genericError"));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setRows((r) => r?.filter((x) => x.id !== id) ?? null);
    await fetch(`/api/deadlines/${id}`, { method: "DELETE" }).catch(() => null);
  }

  return (
    <div>
      <Card className="p-6 flex flex-col gap-3">
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(160px,1fr))]">
          <label className="block">
            <span className="text-[13px] text-ink-soft block mb-1.5">{t("labelQ")}</span>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={t("labelPlaceholder")} />
          </label>
          <label className="block">
            <span className="text-[13px] text-ink-soft block mb-1.5">{t("dateQ")}</span>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </label>
          <label className="block">
            <span className="text-[13px] text-ink-soft block mb-1.5">{t("remindQ")}</span>
            <Input type="number" min={1} max={180} value={remindDays} onChange={(e) => setRemindDays(e.target.value)} />
          </label>
        </div>
        <Button onClick={add} disabled={!label.trim() || !dueDate || busy}>
          {busy ? t("adding") : t("addCta")}
        </Button>
        {error && <p className="text-[13px] text-amber m-0">{error}</p>}
      </Card>

      {rows && rows.length > 0 && (
        <div className="mt-5 flex flex-col gap-2.5">
          {rows.map((d) => {
            const days = daysUntil(new Date(d.dueDate));
            return (
              <Card key={d.id} className="p-4 flex items-center gap-4 flex-wrap">
                <div className="flex-1 min-w-[140px]">
                  <div className="font-bold text-[14px]">{d.label}</div>
                  <div className="text-ink-soft text-[12.5px] mt-0.5">
                    {new Date(d.dueDate).toLocaleDateString("he-IL")}
                  </div>
                </div>
                <div
                  className={`text-[12.5px] font-extrabold rounded-full px-3 py-1 ${
                    days < 0
                      ? "text-[#F08A6B] bg-[rgba(240,138,107,0.1)]"
                      : days <= d.remindDaysBefore
                        ? "text-[#F0B45C] bg-[rgba(240,180,92,0.1)]"
                        : "text-ink-soft bg-[rgba(255,255,255,0.05)]"
                  }`}
                >
                  {days < 0 ? t("daysOverdue", { count: Math.abs(days) }) : t("daysLeft", { count: days })}
                </div>
                <button
                  type="button"
                  onClick={() => remove(d.id)}
                  className="text-[12.5px] text-ink-soft hover:text-[#F08A6B] bg-transparent border-0 cursor-pointer"
                >
                  {t("remove")}
                </button>
              </Card>
            );
          })}
        </div>
      )}

      {rows && rows.length === 0 && <p className="mt-5 text-ink-soft text-[13.5px]">{t("empty")}</p>}
    </div>
  );
}
