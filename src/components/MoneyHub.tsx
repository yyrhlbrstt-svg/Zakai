"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "next-intl";
import { Link } from "@/i18n/routing";
import { Card, Button, Textarea } from "@/components/ui";
import { scanStatement, type ScanResult, type ChargeCategory } from "@/lib/subscriptions";
import { formatAgorot } from "@/lib/money";

const STORAGE_KEY = "zakai_money_hub_v1";

const CATEGORY_COLOR: Record<ChargeCategory, string> = {
  cellular: "#3FCB9B",
  tv_internet: "#3EC6FF",
  electricity: "#F0B45C",
  insurance: "#8B5CF6",
  fitness: "#F08A6B",
  digital: "#93A6A5",
  other: "#93A6A5",
};

const copy: Record<string, Record<string, string>> = {
  he: {
    title: "הכסף שלי",
    sub: "זכאי רואה מה יורד לך כל חודש — ואומר מה לעשות. בלי סיסמת בנק. בלי לצאת לאתרים.",
    privacy: "אנחנו לא מבקשים ולא שומרים סיסמה לבנק. צילום מסך או קובץ תנועות — והניתוח אצלך במכשיר (או חילוץ מאובטח לצילום).",
    shotTitle: "הכי קל: צילום מסך מאפליקציית הבנק",
    shotSub: "פתח את רשימת החיובים / תנועות באפליקציה → צלם מסך → העלה כאן. זכאי יזהה חיובים קבועים.",
    shotBtn: "העלה צילום מסך",
    shotBusy: "מנתח את הצילום…",
    pasteTitle: "או הדבק / העלה קובץ תנועות",
    pastePh: "הדבק כאן ייצוא CSV/טקסט מהבנק…",
    scanBtn: "סרוק חיובים",
    uploadBtn: "העלה קובץ",
    total: "סה״כ חיובים קבועים שזוהו",
    perMonth: "לחודש",
    none: "לא מצאנו חיובים חוזרים ברורים. נסה צילום עם יותר שורות או קובץ מלא יותר.",
    act: "מה זכאי ממליץ",
    checkBill: "בדוק חשבון / הורד מחיר",
    electricity: "בדוק חשמל",
    insurance: "בדוק ביטוח כפול",
    rights: "מה מגיע לי",
    remember: "נשמר במכשיר שלך — בפעם הבאה תראה את הסיכום גם בלי להעלות שוב",
    lastSaved: "סיכום אחרון מהמכשיר",
    clear: "נקה סיכום שמור",
    openBankSoon: "חיבור בנק רשמי (Open Banking) בדרך — כשיהיה, בלי סיסמה אצלנו, רק אישור מאובטח מהבנק.",
    feeNote: "עמלה רק אם נחסך בפועל ותועד — לא על הסריקה עצמה.",
    occurrences: "הופיע {n} פעמים",
  },
  en: {
    title: "My money",
    sub: "Zakai shows what leaves your account every month — and what to do next. No bank password. No hopping between sites.",
    privacy: "We never ask for or store your bank password. Screenshot or transaction file — analysis stays on-device (or secure extract for screenshots).",
    shotTitle: "Easiest: screenshot from your bank app",
    shotSub: "Open charges / transactions in the bank app → screenshot → upload here. Zakai finds recurring payments.",
    shotBtn: "Upload screenshot",
    shotBusy: "Reading screenshot…",
    pasteTitle: "Or paste / upload a statement file",
    pastePh: "Paste CSV/text export from your bank…",
    scanBtn: "Scan charges",
    uploadBtn: "Upload file",
    total: "Recurring charges found",
    perMonth: "per month",
    none: "No clear recurring charges found. Try a longer screenshot or fuller file.",
    act: "What Zakai recommends",
    checkBill: "Check bill / lower price",
    electricity: "Check electricity",
    insurance: "Check duplicate insurance",
    rights: "What am I owed",
    remember: "Saved on this device — next visit you still see the summary",
    lastSaved: "Last summary on this device",
    clear: "Clear saved summary",
    openBankSoon: "Official open-banking link is coming — bank consent only, never your password with us.",
    feeNote: "A success fee only if a real saving is documented — not for the scan itself.",
    occurrences: "Seen {n} times",
  },
  ar: {
    title: "أموالي",
    sub: "زكاي يعرض ما يُخصم شهرياً وما يجب فعله. بدون كلمة مرور للبنك.",
    privacy: "لا نطلب كلمة مرور البنك.",
    shotTitle: "الأسهل: لقطة من تطبيق البنك",
    shotSub: "افتح الحركات → لقطة شاشة → ارفع هنا.",
    shotBtn: "رفع لقطة",
    shotBusy: "جارٍ التحليل…",
    pasteTitle: "أو الصق / ارفع ملفاً",
    pastePh: "الصق CSV…",
    scanBtn: "فحص",
    uploadBtn: "رفع ملف",
    total: "مدفوعات متكررة",
    perMonth: "شهرياً",
    none: "لم نجد مدفوعات متكررة واضحة.",
    act: "توصية زكاي",
    checkBill: "فحص الفاتورة",
    electricity: "فحص الكهرباء",
    insurance: "تأمين مكرر",
    rights: "ما يُستحق لي",
    remember: "يُحفظ على جهازك",
    lastSaved: "آخر ملخص",
    clear: "مسح",
    openBankSoon: "ربط بنكي رسمي قريباً.",
    feeNote: "عمولة فقط عند توفير موثّق.",
    occurrences: "ظهر {n} مرات",
  },
  ru: {
    title: "Мои деньги",
    sub: "Zakai показывает регулярные списания и что делать. Без пароля от банка.",
    privacy: "Мы не просим пароль банка.",
    shotTitle: "Проще всего: скрин из банковского приложения",
    shotSub: "Откройте операции → скрин → загрузите сюда.",
    shotBtn: "Загрузить скрин",
    shotBusy: "Читаем…",
    pasteTitle: "Или вставьте / загрузите файл",
    pastePh: "Вставьте CSV…",
    scanBtn: "Сканировать",
    uploadBtn: "Файл",
    total: "Регулярные платежи",
    perMonth: "в месяц",
    none: "Явных регулярных платежей не найдено.",
    act: "Рекомендация Zakai",
    checkBill: "Проверить счёт",
    electricity: "Электричество",
    insurance: "Двойная страховка",
    rights: "Что мне должны",
    remember: "Сохраняется на устройстве",
    lastSaved: "Последняя сводка",
    clear: "Очистить",
    openBankSoon: "Официальный open banking скоро.",
    feeNote: "Комиссия только с подтверждённой экономии.",
    occurrences: "Раз: {n}",
  },
};

function tx(locale: string, key: string): string {
  return (copy[locale] || copy.he)[key] || copy.he[key] || key;
}

interface SavedSummary {
  totalMonthlyAgorot: number;
  count: number;
  merchants: string[];
  savedAt: string;
}

export function MoneyHub({
  bcp47,
  screenshotEnabled,
}: {
  bcp47: string;
  screenshotEnabled: boolean;
}) {
  const locale = useLocale();
  const [text, setText] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [shotBusy, setShotBusy] = useState(false);
  const [shotError, setShotError] = useState(false);
  const [saved, setSaved] = useState<SavedSummary | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const shotRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setSaved(JSON.parse(raw) as SavedSummary);
    } catch {
      /* ignore */
    }
  }, []);

  function persist(scan: ScanResult) {
    const summary: SavedSummary = {
      totalMonthlyAgorot: scan.totalMonthlyAgorot,
      count: scan.recurring.length,
      merchants: scan.recurring.slice(0, 8).map((r) => r.merchant),
      savedAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(summary));
      setSaved(summary);
    } catch {
      /* private mode */
    }
  }

  function runScan(input: string) {
    const scan = scanStatement(input);
    setResult(scan);
    if (scan.recurring.length > 0) persist(scan);
  }

  async function onFile(file?: File | null) {
    if (!file) return;
    const content = await file.text();
    setText(content);
    runScan(content);
  }

  async function onScreenshot(file?: File | null) {
    if (!file) return;
    setShotError(false);
    setShotBusy(true);
    try {
      const buf = await file.arrayBuffer();
      let bin = "";
      const bytes = new Uint8Array(buf);
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      const res = await fetch("/api/scan/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: btoa(bin), mediaType: file.type || "image/jpeg" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.csv) {
        setShotError(true);
        return;
      }
      const merged = text.trim() ? `${text}\n${data.csv}` : data.csv;
      setText(merged);
      runScan(merged);
    } catch {
      setShotError(true);
    } finally {
      setShotBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start gap-2.5 text-[13px] text-emerald font-bold bg-[rgba(63,203,155,0.08)] border border-[rgba(63,203,155,0.25)] rounded-xl px-4 py-3">
        <span aria-hidden>🔒</span>
        <span>{tx(locale, "privacy")}</span>
      </div>

      {saved && !result && (
        <Card className="p-5">
          <div className="text-[12.5px] text-ink-soft font-bold">{tx(locale, "lastSaved")}</div>
          <div className="font-display grad-text text-3xl mt-1">
            {formatAgorot(saved.totalMonthlyAgorot, bcp47)}
          </div>
          <div className="text-[13px] text-ink-soft mt-1">
            {saved.count} · {saved.merchants.slice(0, 4).join(", ")}
            {saved.merchants.length > 4 ? "…" : ""}
          </div>
          <p className="text-[12px] text-ink-soft mt-2">{tx(locale, "remember")}</p>
          <button
            type="button"
            className="mt-2 bg-transparent border-0 text-emerald text-[13px] font-bold cursor-pointer p-0"
            onClick={() => {
              localStorage.removeItem(STORAGE_KEY);
              setSaved(null);
            }}
          >
            {tx(locale, "clear")}
          </button>
        </Card>
      )}

      <Card className="p-6">
        <div className="font-extrabold text-[16px]">{tx(locale, "shotTitle")}</div>
        <p className="text-ink-soft text-[13.5px] mt-1.5 leading-relaxed">{tx(locale, "shotSub")}</p>
        {screenshotEnabled ? (
          <Button
            className="mt-4"
            disabled={shotBusy}
            onClick={() => shotRef.current?.click()}
          >
            {shotBusy ? tx(locale, "shotBusy") : tx(locale, "shotBtn")}
          </Button>
        ) : (
          <p className="text-[13px] text-ink-soft mt-3">
            {locale === "he"
              ? "חילוץ מצילום ידלק כשחיבור ה-AI פעיל בשרת."
              : "Screenshot extract needs AI configured on the server."}
          </p>
        )}
        <input
          ref={shotRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => onScreenshot(e.target.files?.[0])}
        />
        {shotError && (
          <p className="text-danger text-[13px] font-semibold mt-3 mb-0">
            {locale === "he" ? "לא הצלחנו לקרוא את הצילום. נסה תמונה חדה יותר או קובץ CSV." : "Could not read screenshot. Try a clearer image or a CSV."}
          </p>
        )}
      </Card>

      <Card className="p-6">
        <div className="font-extrabold text-[15px]">{tx(locale, "pasteTitle")}</div>
        <Textarea
          rows={5}
          dir="ltr"
          className="mt-2 font-mono text-[12.5px]"
          placeholder={tx(locale, "pastePh")}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="flex gap-3 mt-3 flex-wrap">
          <Button onClick={() => runScan(text)} disabled={text.trim().length === 0}>
            {tx(locale, "scanBtn")}
          </Button>
          <Button variant="ghost" onClick={() => fileRef.current?.click()}>
            {tx(locale, "uploadBtn")}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.tsv,.txt"
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
        </div>
      </Card>

      <p className="text-[12.5px] text-ink-soft leading-relaxed px-1">{tx(locale, "openBankSoon")}</p>

      {result && (
        <div className="flex flex-col gap-4">
          {result.recurring.length === 0 ? (
            <Card className="p-8 text-center">
              <div className="font-display text-xl">{tx(locale, "none")}</div>
            </Card>
          ) : (
            <>
              <Card className="p-6 text-center">
                <div className="text-[13px] text-ink-soft font-bold">{tx(locale, "total")}</div>
                <div className="font-display grad-text text-4xl mt-1.5">
                  {formatAgorot(result.totalMonthlyAgorot, bcp47)}
                </div>
                <div className="text-[12px] text-ink-soft mt-1">{tx(locale, "perMonth")}</div>
                <p className="text-[12px] text-ink-soft mt-3">{tx(locale, "remember")}</p>
              </Card>

              <div className="text-[13px] font-extrabold text-emerald">{tx(locale, "act")}</div>
              <div className="flex flex-wrap gap-2">
                <Link href="/check" className="no-underline">
                  <Button className="!text-[13px] !py-2">{tx(locale, "checkBill")}</Button>
                </Link>
                <Link href="/electricity" className="no-underline">
                  <Button variant="ghost" className="!text-[13px] !py-2">{tx(locale, "electricity")}</Button>
                </Link>
                <Link href="/duplicate-insurance" className="no-underline">
                  <Button variant="ghost" className="!text-[13px] !py-2">{tx(locale, "insurance")}</Button>
                </Link>
                <Link href="/what-am-i-owed" className="no-underline">
                  <Button variant="ghost" className="!text-[13px] !py-2">{tx(locale, "rights")}</Button>
                </Link>
              </div>

              <Card className="py-1.5">
                {result.recurring.map((r, i) => (
                  <div
                    key={`${r.merchant}-${i}`}
                    className="flex items-center gap-3 px-5 py-3.5 flex-wrap"
                    style={{
                      borderBottom:
                        i < result.recurring.length - 1 ? "1px solid rgba(255,255,255,0.09)" : "none",
                    }}
                  >
                    <div className="flex-1 basis-[140px]">
                      <div className="font-extrabold text-[15px]">{r.merchant}</div>
                      <div className="text-[11.5px] text-ink-soft mt-0.5">
                        {tx(locale, "occurrences").replace("{n}", String(r.occurrences))}
                      </div>
                    </div>
                    <div
                      className="text-[11px] font-extrabold rounded-full px-2.5 py-1"
                      style={{
                        color: CATEGORY_COLOR[r.category],
                        background: `${CATEGORY_COLOR[r.category]}18`,
                        border: `1px solid ${CATEGORY_COLOR[r.category]}44`,
                      }}
                    >
                      {r.category}
                    </div>
                    <div className="font-display text-lg">
                      {formatAgorot(r.monthlyAgorot, bcp47)}
                    </div>
                    {r.providerKey && (
                      <Link href="/check" className="no-underline">
                        <Button variant="ghost" className="!px-3 !py-1.5 !text-[12.5px]">
                          {tx(locale, "checkBill")}
                        </Button>
                      </Link>
                    )}
                  </div>
                ))}
              </Card>

              <p className="text-[12px] text-ink-soft">{tx(locale, "feeNote")}</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
