"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Card, Button, Input, Select } from "@/components/ui";
import { formatAgorot } from "@/lib/money";
import {
  COUPON_CATEGORIES,
  couponStatus,
  daysUntilExpiry,
  filterByCategory,
  searchCoupons,
  sortCoupons,
  type CouponRow,
  type CouponStatus,
} from "@/lib/coupons";

/**
 * The vault screen.
 *
 * Search and filtering run over rows already in memory rather than round-tripping
 * to the server: a person looking for a code is standing at a checkout, and a
 * network hop per keystroke is the difference between a tool they reach for and
 * one they gave up on. The whole list is already scoped to their own account.
 */

export interface CouponClientRow extends Omit<CouponRow, "expiresAt" | "usedAt" | "createdAt"> {
  expiresAt: string | null;
  usedAt: string | null;
  createdAt: string;
}

const STATUS_STYLE: Record<CouponStatus, string> = {
  expiring: "text-[#e0b341]",
  expired: "text-[#ff8f8f]",
  used: "text-ink-soft",
  active: "text-emerald",
  undated: "text-ink-soft",
};

function hydrate(r: CouponClientRow): CouponRow {
  return {
    ...r,
    expiresAt: r.expiresAt ? new Date(r.expiresAt) : null,
    usedAt: r.usedAt ? new Date(r.usedAt) : null,
    createdAt: new Date(r.createdAt),
  };
}

export function CouponVault({
  initial,
  bcp47,
}: {
  initial: CouponClientRow[];
  bcp47: string;
}) {
  const t = useTranslations("coupons");
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [copied, setCopied] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const rows = useMemo(() => initial.map(hydrate), [initial]);
  const shown = useMemo(
    () => sortCoupons(searchCoupons(filterByCategory(rows, category), query)),
    [rows, category, query],
  );

  const expiringCount = useMemo(
    () => rows.filter((r) => couponStatus(r) === "expiring").length,
    [rows],
  );

  async function copy(row: CouponRow) {
    try {
      await navigator.clipboard.writeText(row.code);
      setCopied(row.id);
      window.setTimeout(() => setCopied((c) => (c === row.id ? null : c)), 2000);
    } catch {
      // Clipboard blocked (insecure context, denied permission). Selecting the
      // code by hand still works, so this is not worth an error banner.
    }
  }

  async function toggleUsed(row: CouponRow) {
    setBusy(row.id);
    try {
      await fetch(`/api/coupons/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ used: !row.usedAt }),
      });
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function remove(row: CouponRow) {
    setBusy(row.id);
    try {
      await fetch(`/api/coupons/${row.id}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    const percentRaw = String(fd.get("percentOff") ?? "").trim();
    const amountRaw = String(fd.get("amountShekels") ?? "").trim();

    // Said here as well as on the server, because the person deserves the
    // answer before the round-trip, not a generic failure after it.
    if (percentRaw && amountRaw) {
      setFormError(t("errors.value"));
      return;
    }

    setAdding(true);
    try {
      const res = await fetch("/api/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          merchant: String(fd.get("merchant") ?? ""),
          code: String(fd.get("code") ?? ""),
          category: String(fd.get("category") ?? "other"),
          percentOff: percentRaw ? Number(percentRaw) : null,
          amountShekels: amountRaw ? Number(amountRaw) : null,
          expiresAt: String(fd.get("expiresAt") ?? "") || undefined,
          note: String(fd.get("note") ?? "") || undefined,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setFormError(t(`errors.${data.error ?? "generic"}`));
        return;
      }
      form.reset();
      router.refresh();
    } catch {
      setFormError(t("errors.generic"));
    } finally {
      setAdding(false);
    }
  }

  const fmtDate = (d: Date) =>
    d.toLocaleDateString(bcp47, { day: "numeric", month: "short", year: "numeric" });

  return (
    <div className="flex flex-col gap-5">
      {expiringCount > 0 && (
        <Card className="p-4">
          <p className="text-caption text-[#e0b341] m-0 leading-relaxed">
            {t("expiringBanner", { count: expiringCount })}
          </p>
        </Card>
      )}

      <Card className="p-5">
        <h2 className="font-display text-title mt-0 mb-4">{t("addTitle")}</h2>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(160px,1fr))]">
            <label className="flex flex-col gap-1.5">
              <span className="text-caption text-ink-soft">{t("field.merchant")}</span>
              <Input name="merchant" required maxLength={80} autoComplete="off" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-caption text-ink-soft">{t("field.code")}</span>
              <Input name="code" required maxLength={64} autoComplete="off" dir="ltr" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-caption text-ink-soft">{t("field.category")}</span>
              <Select name="category" defaultValue="other">
                {COUPON_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {t(`category.${c}`)}
                  </option>
                ))}
              </Select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-caption text-ink-soft">{t("field.percentOff")}</span>
              <Input name="percentOff" type="number" min={1} max={100} step={1} inputMode="numeric" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-caption text-ink-soft">{t("field.amount")}</span>
              <Input name="amountShekels" type="number" min={0.01} step={0.01} inputMode="decimal" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-caption text-ink-soft">{t("field.expiresAt")}</span>
              <Input name="expiresAt" type="date" />
            </label>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="text-caption text-ink-soft">{t("field.note")}</span>
            <Input name="note" maxLength={300} autoComplete="off" />
          </label>
          <p className="text-micro text-ink-soft m-0 leading-relaxed">{t("valueHint")}</p>
          {formError && (
            <p role="alert" className="text-caption text-[#ff8f8f] m-0">
              {formError}
            </p>
          )}
          <div>
            <Button type="submit" disabled={adding}>
              {adding ? t("saving") : t("save")}
            </Button>
          </div>
        </form>
      </Card>

      <div className="flex gap-3 flex-wrap items-end">
        <label className="flex flex-col gap-1.5 flex-1 basis-[200px]">
          <span className="text-caption text-ink-soft">{t("searchLabel")}</span>
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("searchPlaceholder")}
            autoComplete="off"
          />
        </label>
        <label className="flex flex-col gap-1.5 basis-[160px]">
          <span className="text-caption text-ink-soft">{t("field.category")}</span>
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="all">{t("category.all")}</option>
            {COUPON_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t(`category.${c}`)}
              </option>
            ))}
          </Select>
        </label>
      </div>

      {rows.length === 0 ? (
        <Card className="p-7 text-center">
          <p className="text-ink-soft text-body-lg m-0 leading-relaxed">{t("empty")}</p>
        </Card>
      ) : shown.length === 0 ? (
        <Card className="p-6 text-center">
          <p className="text-ink-soft text-body m-0">{t("noMatch")}</p>
        </Card>
      ) : (
        <ul className="list-none p-0 m-0 flex flex-col gap-2.5">
          {shown.map((r) => {
            const status = couponStatus(r);
            const left = daysUntilExpiry(r);
            return (
              <li key={r.id}>
                <Card className={`p-4 ${status === "used" || status === "expired" ? "opacity-60" : ""}`}>
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0 flex-1 basis-[200px]">
                      <div className="font-extrabold text-body-lg">{r.merchant}</div>
                      <div className="text-body text-ink-soft mt-1">
                        {r.percentOff !== null
                          ? t("valuePercent", { percent: r.percentOff })
                          : r.amountMinor !== null
                            ? t("valueAmount", { amount: formatAgorot(r.amountMinor, bcp47) })
                            : t("valueUnstated")}
                        {r.minSpendMinor !== null
                          ? ` · ${t("minSpend", { amount: formatAgorot(r.minSpendMinor, bcp47) })}`
                          : ""}
                      </div>
                      {r.note && (
                        <div className="text-caption text-ink-soft mt-1 leading-relaxed">{r.note}</div>
                      )}
                      <div className={`text-micro mt-2 ${STATUS_STYLE[status]}`}>
                        {status === "used"
                          ? t("status.used")
                          : status === "undated"
                            ? t("status.undated")
                            : status === "expired"
                              ? t("status.expired", { date: fmtDate(r.expiresAt!) })
                              : status === "expiring"
                                ? t("status.expiring", { days: left ?? 0 })
                                : t("status.active", { date: fmtDate(r.expiresAt!) })}
                        {" · "}
                        {t(`category.${r.category}`)}
                      </div>
                    </div>

                    <div className="flex flex-col items-stretch gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => copy(r)}
                        className="rounded-xl border border-[rgba(255,255,255,0.16)] bg-transparent px-3.5 py-2 font-mono text-body text-ink cursor-pointer"
                        dir="ltr"
                        aria-label={t("copyAria", { code: r.code })}
                      >
                        {copied === r.id ? t("copied") : r.code}
                      </button>
                      <div className="flex gap-2 justify-end">
                        <Button
                          variant="ghost"
                          disabled={busy === r.id}
                          onClick={() => toggleUsed(r)}
                          className="!text-micro !px-3 !py-1.5"
                        >
                          {r.usedAt ? t("markUnused") : t("markUsed")}
                        </Button>
                        <Button
                          variant="ghost"
                          disabled={busy === r.id}
                          onClick={() => remove(r)}
                          className="!text-micro !px-3 !py-1.5 !text-[#ff8f8f] !border-[rgba(255,143,143,0.35)]"
                        >
                          {t("delete")}
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
