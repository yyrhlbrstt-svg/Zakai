"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Card, Button, Input, Select } from "@/components/ui";
import { formatAgorot, shekelsToAgorot } from "@/lib/money";
import {
  computeVatReport,
  needsAllocationNumber,
  ALLOCATION_NUMBER_THRESHOLD_AGOROT,
  VAT_RATE_PERCENT,
  type InputCategory,
  type SaleCategory,
  type VatFinding,
} from "@/lib/vat";

/**
 * Periodic VAT return builder for businesses.
 *
 * Runs entirely in the browser: no invoice ever leaves the device, which is
 * what makes it safe to hand a stranger their own books. State is a flat list
 * of rows so the whole report is one `computeVatReport` call away — the number
 * on screen is always derived, never stored, and so can never drift.
 */

interface Row {
  id: string;
  label: string;
  /** Kept as the raw string so the field can be empty while typing. */
  amount: string;
  category: string;
  hasTaxInvoice: boolean;
  hasAllocationNumber: boolean;
}

let seq = 0;
const nextId = () => `r${++seq}`;

function makeRow(category: string, amount = "", label = ""): Row {
  return {
    id: nextId(),
    label,
    amount,
    category,
    hasTaxInvoice: true,
    hasAllocationNumber: true,
  };
}

const SALE_CATEGORIES: SaleCategory[] = ["standard", "zeroRated", "exempt"];
const INPUT_CATEGORIES: InputCategory[] = [
  "standard",
  "equipment",
  "mixedBusiness",
  "mixedPrivate",
  "vehicleUpkeep",
  "vehiclePurchase",
  "hospitality",
];

const toAgorot = (amount: string) => {
  const n = Number.parseFloat(amount);
  return Number.isFinite(n) && n > 0 ? shekelsToAgorot(n) : 0;
};

export function VatReport({ bcp47 }: { bcp47: string }) {
  const t = useTranslations("vat");
  const now = new Date();

  const [year, setYear] = useState(now.getUTCFullYear());
  const [month, setMonth] = useState(now.getUTCMonth() || 12);
  const [detailed, setDetailed] = useState(false);
  const [sales, setSales] = useState<Row[]>([makeRow("standard")]);
  const [inputs, setInputs] = useState<Row[]>([makeRow("standard")]);

  const money = (a: number) => formatAgorot(a, bcp47);

  const report = useMemo(
    () =>
      computeVatReport({
        sales: sales.map((r) => ({
          id: r.id,
          label: r.label || t(`sale.${r.category}`),
          netAgorot: toAgorot(r.amount),
          category: r.category as SaleCategory,
        })),
        inputs: inputs.map((r) => ({
          id: r.id,
          label: r.label || t(`input.${r.category}`),
          netAgorot: toAgorot(r.amount),
          category: r.category as InputCategory,
          hasTaxInvoice: r.hasTaxInvoice,
          hasAllocationNumber: r.hasAllocationNumber,
        })),
        detailedReport: detailed,
        period: { year, month },
      }),
    [sales, inputs, detailed, year, month, t],
  );

  const isRefund = report.direction === "refund";
  const hasActivity = report.sales.totalNetAgorot > 0 || report.inputs.paidVatAgorot > 0;

  return (
    <div className="flex flex-col gap-5">
      {/* ── The answer, first. Everything below is the reasoning. ─────────── */}
      <Card
        className={`p-6 text-center ${
          isRefund ? "border-[rgba(63,203,155,0.45)] bg-[rgba(63,203,155,0.06)]" : ""
        }`}
      >
        <div className="text-[13px] text-ink-soft font-bold">
          {t(`direction.${report.direction}`)}
        </div>
        <div
          className={`font-display text-[clamp(34px,11vw,46px)] leading-none mt-2 tabular-nums ${
            isRefund ? "grad-text" : "text-ink"
          }`}
          aria-live="polite"
        >
          {money(Math.abs(report.netAgorot))}
        </div>

        <div className="flex flex-wrap justify-center gap-2 mt-4">
          <Pill label={t("dueBy")} value={report.filing.dueDate ?? "—"} />
          <Pill label={t("frequencyLabel")} value={t(`frequency.${report.filing.frequency}`)} />
          <Pill label={t("rateLabel")} value={`${VAT_RATE_PERCENT}%`} />
        </div>
      </Card>

      {/* ── Money on the table: the reason a business opens this page. ────── */}
      {report.inputs.recoverableVatAgorot > 0 && (
        <Card className="p-5 border-[rgba(255,176,32,0.45)] bg-[rgba(255,176,32,0.07)]">
          <div className="text-[12.5px] font-extrabold text-amber">{t("recoverableTitle")}</div>
          <div className="font-display text-3xl mt-1.5 tabular-nums text-amber">
            {money(report.inputs.recoverableVatAgorot)}
          </div>
          <p className="text-[12.5px] text-ink-soft mt-2 leading-relaxed">{t("recoverableSub")}</p>
        </Card>
      )}

      {/* ── Sales ────────────────────────────────────────────────────────── */}
      <Section
        title={t("salesTitle")}
        hint={t("salesHint")}
        addLabel={t("addSale")}
        onAdd={() => setSales((rows) => [...rows, makeRow("standard")])}
      >
        {sales.map((row) => (
          <RowEditor
            key={row.id}
            row={row}
            categories={SALE_CATEGORIES}
            categoryLabel={(c) => t(`sale.${c}`)}
            placeholder={t("labelPlaceholderSale")}
            amountLabel={t("netAmount")}
            removeLabel={t("remove")}
            canRemove={sales.length > 1}
            vatNote={
              row.category === "standard" && toAgorot(row.amount) > 0
                ? t("vatOnLine", {
                    amount: money(Math.round((toAgorot(row.amount) * VAT_RATE_PERCENT) / 100)),
                  })
                : undefined
            }
            onChange={(next) =>
              setSales((rows) => rows.map((r) => (r.id === row.id ? next : r)))
            }
            onRemove={() => setSales((rows) => rows.filter((r) => r.id !== row.id))}
          />
        ))}
      </Section>

      {/* ── Inputs ───────────────────────────────────────────────────────── */}
      <Section
        title={t("inputsTitle")}
        hint={t("inputsHint")}
        addLabel={t("addInput")}
        onAdd={() => setInputs((rows) => [...rows, makeRow("standard")])}
      >
        {inputs.map((row) => (
          <RowEditor
            key={row.id}
            row={row}
            categories={INPUT_CATEGORIES}
            categoryLabel={(c) => t(`input.${c}`)}
            placeholder={t("labelPlaceholderInput")}
            amountLabel={t("netAmount")}
            removeLabel={t("remove")}
            canRemove={inputs.length > 1}
            docs={{
              invoiceLabel: t("hasInvoice"),
              allocationLabel: t("hasAllocation"),
              // The allocation question only exists above the threshold, so we
              // hide it entirely below it rather than asking something moot.
              showAllocation: needsAllocationNumber(toAgorot(row.amount)),
              allocationHint: t("allocationHint", {
                amount: money(ALLOCATION_NUMBER_THRESHOLD_AGOROT),
              }),
            }}
            onChange={(next) =>
              setInputs((rows) => rows.map((r) => (r.id === row.id ? next : r)))
            }
            onRemove={() => setInputs((rows) => rows.filter((r) => r.id !== row.id))}
          />
        ))}
      </Section>

      {/* ── Findings: every adjustment, with its legal reference. ─────────── */}
      {report.findings.length > 0 && (
        <Card className="p-5">
          <div className="font-extrabold text-[15px] mb-1">{t("findingsTitle")}</div>
          <p className="text-[12.5px] text-ink-soft mb-4 leading-relaxed">{t("findingsSub")}</p>
          <ul className="list-none p-0 m-0 flex flex-col gap-3">
            {report.findings.map((f, i) => (
              <FindingItem key={`${f.code}-${f.lineId ?? i}`} finding={f} money={money} />
            ))}
          </ul>
        </Card>
      )}

      {/* ── The return itself, in the order the form asks for it. ─────────── */}
      <Card className="p-5">
        <div className="font-extrabold text-[15px] mb-4">{t("breakdownTitle")}</div>
        <dl className="m-0 flex flex-col gap-0.5">
          <Line label={t("rows.taxableSales")} value={money(report.sales.taxableNetAgorot)} />
          {report.sales.zeroRatedNetAgorot > 0 && (
            <Line label={t("rows.zeroRated")} value={money(report.sales.zeroRatedNetAgorot)} />
          )}
          {report.sales.exemptNetAgorot > 0 && (
            <Line label={t("rows.exempt")} value={money(report.sales.exemptNetAgorot)} />
          )}
          <Line label={t("rows.outputVat")} value={money(report.sales.outputVatAgorot)} strong />
          <Divider />
          <Line label={t("rows.equipmentVat")} value={money(report.inputs.equipmentVatAgorot)} />
          <Line label={t("rows.otherVat")} value={money(report.inputs.otherVatAgorot)} />
          <Line
            label={t("rows.deductibleVat")}
            value={money(report.inputs.deductibleVatAgorot)}
            strong
          />
          {report.inputs.disallowedVatAgorot > 0 && (
            <Line
              label={t("rows.disallowedVat")}
              value={`− ${money(report.inputs.disallowedVatAgorot)}`}
              tone="danger"
            />
          )}
          <Divider />
          <Line
            label={t(`rows.${isRefund ? "refund" : "payable"}`)}
            value={money(Math.abs(report.netAgorot))}
            strong
            tone={isRefund ? "emerald" : undefined}
          />
        </dl>
      </Card>

      {/* ── Period settings, last: sensible defaults mean most never touch it. */}
      <Card className="p-5">
        <div className="font-extrabold text-[15px] mb-4">{t("periodTitle")}</div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-[12.5px] text-ink-soft mb-1.5">{t("month")}</span>
            <Select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {t(`months.${m}`)}
                </option>
              ))}
            </Select>
          </label>
          <label className="block">
            <span className="block text-[12.5px] text-ink-soft mb-1.5">{t("year")}</span>
            <Input
              type="number"
              inputMode="numeric"
              value={year}
              min={2020}
              max={2100}
              onChange={(e) => setYear(Number(e.target.value))}
            />
          </label>
        </div>
        <label className="flex items-start gap-3 mt-4 cursor-pointer">
          <input
            type="checkbox"
            checked={detailed}
            onChange={(e) => setDetailed(e.target.checked)}
            className="mt-0.5 w-[18px] h-[18px] accent-[#3FCB9B] shrink-0"
          />
          <span className="text-[13px] leading-relaxed">
            <span className="font-bold">{t("detailedLabel")}</span>
            <span className="block text-ink-soft text-[12px]">{t("detailedHint")}</span>
          </span>
        </label>
      </Card>

      {hasActivity && (
        <button
          onClick={() => window.print()}
          className="grad-bg btn-sheen text-[#06121A] rounded-[14px] px-7 py-4 font-extrabold cursor-pointer border-0 print:hidden text-[16.5px]"
        >
          {t("print")}
        </button>
      )}

      <p className="text-[11.5px] text-ink-soft leading-relaxed">{t("disclaimer")}</p>
    </div>
  );
}

/* ── Presentation helpers ───────────────────────────────────────────────── */

function Pill({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-baseline gap-1.5 rounded-full border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.05)] px-3 py-1.5">
      <span className="text-[11px] text-ink-soft">{label}</span>
      <span className="text-[12.5px] font-extrabold tabular-nums">{value}</span>
    </span>
  );
}

function Section({
  title,
  hint,
  addLabel,
  onAdd,
  children,
}: {
  title: string;
  hint: string;
  addLabel: string;
  onAdd: () => void;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-5">
      <div className="font-extrabold text-[15px]">{title}</div>
      <p className="text-[12.5px] text-ink-soft mt-1 mb-4 leading-relaxed">{hint}</p>
      <div className="flex flex-col gap-3">{children}</div>
      <Button variant="ghost" onClick={onAdd} className="mt-4 w-full print:hidden">
        {addLabel}
      </Button>
    </Card>
  );
}

function RowEditor({
  row,
  categories,
  categoryLabel,
  placeholder,
  amountLabel,
  removeLabel,
  canRemove,
  vatNote,
  docs,
  onChange,
  onRemove,
}: {
  row: Row;
  categories: readonly string[];
  categoryLabel: (c: string) => string;
  placeholder: string;
  amountLabel: string;
  removeLabel: string;
  canRemove: boolean;
  vatNote?: string;
  docs?: {
    invoiceLabel: string;
    allocationLabel: string;
    showAllocation: boolean;
    allocationHint: string;
  };
  onChange: (row: Row) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] p-3.5">
      <div className="flex flex-col gap-2.5">
        <Input
          value={row.label}
          placeholder={placeholder}
          onChange={(e) => onChange({ ...row, label: e.target.value })}
          aria-label={placeholder}
        />
        <div className="flex gap-2.5">
          <label className="flex-1 min-w-0">
            <span className="sr-only">{amountLabel}</span>
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={row.amount}
              placeholder={amountLabel}
              onChange={(e) => onChange({ ...row, amount: e.target.value })}
            />
          </label>
          <label className="flex-1 min-w-0">
            <span className="sr-only">{categoryLabel(row.category)}</span>
            <Select
              value={row.category}
              onChange={(e) => onChange({ ...row, category: e.target.value })}
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {categoryLabel(c)}
                </option>
              ))}
            </Select>
          </label>
        </div>

        {vatNote && <div className="text-[11.5px] text-ink-soft tabular-nums">{vatNote}</div>}

        {docs && (
          <div className="flex flex-col gap-2 pt-0.5">
            <Toggle
              label={docs.invoiceLabel}
              checked={row.hasTaxInvoice}
              onChange={(v) => onChange({ ...row, hasTaxInvoice: v })}
            />
            {docs.showAllocation && (
              <Toggle
                label={docs.allocationLabel}
                hint={docs.allocationHint}
                checked={row.hasAllocationNumber}
                onChange={(v) => onChange({ ...row, hasAllocationNumber: v })}
              />
            )}
          </div>
        )}

        {canRemove && (
          <button
            onClick={onRemove}
            className="self-start text-[12px] font-bold text-ink-soft hover:text-danger bg-transparent border-0 p-0 cursor-pointer print:hidden"
          >
            {removeLabel}
          </button>
        )}
      </div>
    </div>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-2.5 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 w-[17px] h-[17px] accent-[#3FCB9B] shrink-0"
      />
      <span className="text-[12.5px] leading-snug">
        {label}
        {hint && <span className="block text-ink-soft text-[11px] mt-0.5">{hint}</span>}
      </span>
    </label>
  );
}

function FindingItem({
  finding,
  money,
}: {
  finding: VatFinding;
  money: (a: number) => string;
}) {
  const t = useTranslations("vat.findings");
  const tone =
    finding.severity === "blocked"
      ? "text-danger"
      : finding.severity === "recoverable"
        ? "text-amber"
        : finding.severity === "reduced"
          ? "text-ink"
          : "text-ink-soft";

  return (
    <li className="flex gap-3 items-start">
      {/* SVG rather than "↻ / ✕" text glyphs, which are missing from many
          system fonts and render as tofu boxes (□). */}
      <span className={`shrink-0 mt-[3px] ${tone}`} aria-hidden>
        {finding.severity === "info" ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <circle cx="12" cy="12" r="4" />
          </svg>
        ) : finding.severity === "recoverable" ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M20 11a8 8 0 1 0-2.3 5.7" />
            <polyline points="20 4 20 11 13 11" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden>
            <line x1="6" y1="6" x2="18" y2="18" />
            <line x1="18" y1="6" x2="6" y2="18" />
          </svg>
        )}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <span className="font-bold text-[13.5px]">{t(`${finding.code}.title`)}</span>
          <span className={`font-extrabold text-[13.5px] tabular-nums ${tone}`}>
            {money(finding.amountAgorot)}
          </span>
        </div>
        {finding.lineLabel && (
          <div className="text-[11.5px] text-ink-soft mt-0.5 truncate">{finding.lineLabel}</div>
        )}
        <div className="text-[12px] text-ink-soft mt-1 leading-relaxed">
          {t(`${finding.code}.body`)}
          {finding.reference && (
            <span className="ms-1.5 inline-block text-[10.5px] font-extrabold text-ink-soft border border-[rgba(255,255,255,0.14)] rounded-full px-2 py-0.5 align-middle">
              {finding.reference}
            </span>
          )}
        </div>
      </div>
    </li>
  );
}

function Line({
  label,
  value,
  strong,
  tone,
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: "emerald" | "danger";
}) {
  const color = tone === "emerald" ? "text-emerald" : tone === "danger" ? "text-danger" : "";
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <dt className={`text-[13px] ${strong ? "font-extrabold" : "text-ink-soft"}`}>{label}</dt>
      <dd
        className={`m-0 tabular-nums ${strong ? "font-extrabold text-[15px]" : "text-[13px]"} ${color}`}
      >
        {value}
      </dd>
    </div>
  );
}

function Divider() {
  return <div className="h-px bg-[rgba(255,255,255,0.09)] my-2" />;
}
