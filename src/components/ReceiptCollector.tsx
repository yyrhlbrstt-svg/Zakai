"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { Card, Button, Textarea } from "@/components/ui";
import { formatAgorot } from "@/lib/money";
import type { ReceiptCategory } from "@/lib/receipts";
import type { PlanId } from "@/lib/plans";
import { MAX_UPLOAD_IMAGE_BYTES } from "@/lib/imageUpload";

export interface ReceiptRow {
  id: string;
  vendor: string;
  amountAgorot: number;
  currency: string;
  occurredAt: string | null;
  category: string;
  hasVat: boolean;
  flagged: boolean;
}

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  let bin = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

interface BulkFlaggedRow {
  vendor: string;
  amountAgorot: number;
}

export function ReceiptCollector({
  bcp47,
  initialReceipts,
  plan,
}: {
  bcp47: string;
  initialReceipts: ReceiptRow[];
  plan: PlanId;
}) {
  const t = useTranslations("receipts");
  const fileRef = useRef<HTMLInputElement>(null);
  const [receipts, setReceipts] = useState<ReceiptRow[]>(initialReceipts);
  const [busy, setBusy] = useState(false);
  const [unreadable, setUnreadable] = useState(false);
  const [tooBig, setTooBig] = useState(false);
  const [inboxJoined, setInboxJoined] = useState<Record<string, boolean>>({});
  const [bulkCsv, setBulkCsv] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkResult, setBulkResult] = useState<{
    imported: number;
    skipped: number;
    flagged: BulkFlaggedRow[];
  } | null>(null);

  async function onUpload(file?: File | null) {
    if (!file) return;
    setUnreadable(false);
    setTooBig(false);
    // Checked before upload: base64 inflates size ~4/3, and a request near
    // Vercel's ~4.5MB serverless body limit fails at the platform level with
    // an opaque error — indistinguishable from "receipt scanning is broken".
    if (file.size > MAX_UPLOAD_IMAGE_BYTES) {
      setTooBig(true);
      return;
    }
    setBusy(true);
    try {
      const imageBase64 = await fileToBase64(file);
      const res = await fetch("/api/receipts/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64, mediaType: file.type || "image/jpeg" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.readable) {
        setUnreadable(true);
        return;
      }
      setReceipts((prev) => [
        {
          id: data.receipt.id,
          vendor: data.receipt.vendor,
          amountAgorot: data.receipt.amountAgorot,
          currency: data.receipt.currency,
          occurredAt: data.receipt.occurredAt,
          category: data.receipt.category,
          hasVat: data.receipt.hasVat,
          flagged: data.receipt.flagged,
        },
        ...prev,
      ]);
    } catch {
      setUnreadable(true);
    } finally {
      setBusy(false);
    }
  }

  async function bulkImport() {
    if (bulkCsv.trim().length < 12) return;
    setBulkBusy(true);
    setBulkResult(null);
    try {
      const res = await fetch("/api/receipts/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: bulkCsv }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setBulkResult(data);
        setBulkCsv("");
      }
    } finally {
      setBulkBusy(false);
    }
  }

  async function joinInboxWaitlist(provider: "gmail" | "outlook") {
    setInboxJoined((prev) => ({ ...prev, [provider]: true }));
    try {
      await fetch("/api/receipts/inbox-interest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });
    } catch {
      // Best-effort — the button already shows joined; a retry costs nothing.
    }
  }

  const flagged = receipts.find((r) => r.flagged);

  return (
    <div className="pb-28">
      <Card className="p-6">
        <label className="block">
          <span className="text-[13.5px] text-ink-soft">{t("uploadLabel")}</span>
        </label>
        <div className="flex gap-3 mt-3 flex-wrap">
          <Button disabled={busy} onClick={() => fileRef.current?.click()}>
            {busy ? t("scanning") : t("uploadBtn")}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => onUpload(e.target.files?.[0])}
          />
        </div>
        {tooBig && (
          <p className="text-danger text-body font-semibold mt-3 mb-0">{t("tooBig")}</p>
        )}
        {unreadable && (
          <p className="text-danger text-body font-semibold mt-3 mb-0">{t("unreadable")}</p>
        )}
      </Card>

      {flagged && (
        <Card className="mt-4 p-5 border border-[rgba(240,138,107,0.4)] bg-[rgba(240,138,107,0.08)]">
          <div className="text-[12px] font-extrabold text-[#f08a6b] uppercase tracking-wide">
            {t("duplicateTitle")}
          </div>
          <p className="text-[13.5px] mt-2 mb-3 leading-relaxed">
            {t("duplicateBody", {
              vendor: flagged.vendor,
              amount: formatAgorot(flagged.amountAgorot, bcp47),
            })}
          </p>
          <Link
            href={`/refund-chase?company=${encodeURIComponent(flagged.vendor)}&amount=${Math.round(flagged.amountAgorot / 100)}`}
            className="no-underline"
          >
            <Button className="w-full">{t("openCaseCta")}</Button>
          </Link>
        </Card>
      )}

      <Card className="mt-4 p-5">
        <div className="font-extrabold text-[15px]">{t("bulkTitle")}</div>
        {plan === "BUSINESS" ? (
          <>
            <p className="text-ink-soft text-body mt-1.5 mb-3 leading-relaxed">{t("bulkBody")}</p>
            <Textarea
              rows={6}
              dir="ltr"
              className="font-mono text-[12.5px]"
              placeholder={t("bulkPlaceholder")}
              value={bulkCsv}
              onChange={(e) => setBulkCsv(e.target.value)}
            />
            <Button
              className="mt-3"
              disabled={bulkBusy || bulkCsv.trim().length < 12}
              onClick={bulkImport}
            >
              {bulkBusy ? t("scanning") : t("bulkCta")}
            </Button>
            {bulkResult && (
              <div className="mt-4">
                <p className="text-body text-ink-soft m-0">
                  {t("bulkResult", { imported: bulkResult.imported, skipped: bulkResult.skipped })}
                </p>
                {bulkResult.flagged.map((f, i) => (
                  <div
                    key={`${f.vendor}-${i}`}
                    className="flex items-center justify-between gap-3 mt-2 rounded-xl border border-[rgba(240,138,107,0.35)] bg-[rgba(240,138,107,0.08)] px-4 py-2.5"
                  >
                    <span className="text-body font-bold">
                      {f.vendor} · {formatAgorot(f.amountAgorot, bcp47)}
                    </span>
                    <Link
                      href={`/refund-chase?company=${encodeURIComponent(f.vendor)}&amount=${Math.round(f.amountAgorot / 100)}`}
                      className="no-underline"
                    >
                      <Button variant="ghost" className="!px-3 !py-1.5 !text-[12.5px]">
                        {t("openCaseCta")}
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <p className="text-ink-soft text-body mt-1.5 mb-3 leading-relaxed">{t("bulkUpsell")}</p>
            <Link href="/pricing" className="no-underline">
              <Button variant="ghost">{t("bulkUpsellCta")}</Button>
            </Link>
          </>
        )}
      </Card>

      <h2 className="text-[15px] font-extrabold mt-8 mb-3 text-ink-soft">{t("recentTitle")}</h2>
      {receipts.length === 0 ? (
        <Card className="p-6 text-ink-soft text-[14px] text-center">{t("empty")}</Card>
      ) : (
        <Card className="py-1.5">
          {receipts.map((r, i) => (
            <div
              key={r.id}
              className="flex items-center gap-3.5 px-5 py-4 flex-wrap"
              style={{
                borderBottom: i < receipts.length - 1 ? "1px solid rgba(255,255,255,0.09)" : "none",
              }}
            >
              <div className="flex-1 basis-[150px]">
                <div className="font-extrabold text-[15px]">{r.vendor}</div>
                <div className="text-[11.5px] text-ink-soft mt-0.5">
                  {t(`categories.${r.category as ReceiptCategory}`)}
                  {r.hasVat ? ` · ${t("vatBadge")}` : ""}
                </div>
              </div>
              {r.flagged && (
                <div className="text-[11px] font-extrabold rounded-full px-2.5 py-1 text-[#f08a6b] bg-[rgba(240,138,107,0.12)] border border-[rgba(240,138,107,0.35)]">
                  {t("flaggedBadge")}
                </div>
              )}
              <div className="font-display text-lg">{formatAgorot(r.amountAgorot, bcp47)}</div>
            </div>
          ))}
        </Card>
      )}

      <Card className="mt-6 p-5">
        <div className="font-extrabold text-[15px]">{t("exportTitle")}</div>
        <p className="text-ink-soft text-body mt-1.5 mb-3 leading-relaxed">{t("exportBody")}</p>
        <a href="/api/receipts/export" className="no-underline">
          <Button variant="ghost">{t("exportCta")}</Button>
        </a>
      </Card>

      <Card className="mt-4 p-5">
        <div className="font-extrabold text-[15px]">{t("inboxTitle")}</div>
        <p className="text-ink-soft text-body mt-1.5 mb-3 leading-relaxed">{t("inboxBody")}</p>
        <div className="flex gap-3 flex-wrap">
          <Button
            variant="ghost"
            disabled={inboxJoined.gmail}
            onClick={() => joinInboxWaitlist("gmail")}
          >
            {inboxJoined.gmail ? t("inboxJoined") : t("inboxGmail")}
          </Button>
          <Button
            variant="ghost"
            disabled={inboxJoined.outlook}
            onClick={() => joinInboxWaitlist("outlook")}
          >
            {inboxJoined.outlook ? t("inboxJoined") : t("inboxOutlook")}
          </Button>
        </div>
      </Card>
    </div>
  );
}
