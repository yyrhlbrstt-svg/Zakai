"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale , useTranslations } from "next-intl";
import { useRouter, Link } from "@/i18n/routing";
import { redirectIfOpenLoop } from "@/lib/openLoopClient";
import { Card, Button, Textarea, Input } from "@/components/ui";
import {
  scanStatement,
  type ScanResult,
  type ChargeCategory,
  type RecurringCharge,
} from "@/lib/subscriptions";
import { formatAgorot } from "@/lib/money";
import { UNIVERSAL_CANCEL_DEMO_CSV, STATEMENT_SCAN_MIN_CHARS } from "@/lib/subscriptionsDemoSample";
import { ShareResult } from "@/components/ShareResult";
import { moneyCaseHref } from "@/lib/moneyCaseHref";
import {
  buildScanShareMessage,
  scanShareKicker,
  scanShareLandingPath,
} from "@/lib/monopoly/scanShare";
import { MAX_UPLOAD_IMAGE_BYTES } from "@/lib/imageUpload";
import { estimateNextCharge } from "@/lib/nextCharge";
import { buildCommitmentWindow, worthShowing } from "@/lib/commitmentCalendar";
import { CapabilityNotice } from "@/components/CapabilityNotice";

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
    privacy:
      "אנחנו לא מבקשים ולא שומרים סיסמה לבנק. צילום מסך או קובץ תנועות — והניתוח אצלך במכשיר (או חילוץ מאובטח לצילום).",
    shotTitle: "הכי קל: צילום מסך מאפליקציית הבנק",
    shotSub: "פתח את רשימת החיובים / תנועות באפליקציה → צלם מסך → העלה כאן. זכאי יזהה חיובים קבועים.",
    shotBtn: "העלה צילום מסך",
    shotBusy: "מנתח את הצילום…",
    pasteTitle: "או הדבק / העלה קובץ תנועות",
    pastePh: "הדבק כאן ייצוא CSV/טקסט מהבנק…",
    scanBtn: "סרוק חיובים",
    loadDemo: "נסו דוגמה (סלקום + נטפליקס)",
    tooShort: "הדביקו לפחות כמה שורות מהדוח — או לחצו «נסו דוגמה».",
    uploadBtn: "העלה קובץ",
    total: "סה״כ חיובים קבועים שזוהו",
    perMonth: "לחודש",
    none: "לא מצאנו חיובים חוזרים ברורים. נסה צילום עם יותר שורות או קובץ מלא יותר.",
    act: "מה זכאי ממליץ — הסוכן פועל",
    openCase: "הסוכן פותח תיק עכשיו",
    opening: "פותח תיק…",
    opened: "✓ תיק נפתח — לכסף שלי",
    bestRoi: "הכי כדאי עכשיו",
    remember: "נשמר במכשיר שלך — בפעם הבאה תראה את הסיכום גם בלי להעלות שוב",
    lastSaved: "סיכום אחרון מהמכשיר",
    clear: "נקה סיכום שמור",
    openBankSoon:
      "חיבור בנק רשמי (Open Banking) בדרך — כשיהיה, בלי סיסמה אצלנו, רק אישור מאובטח מהבנק.",
    feeNote: "עמלה רק אם נחסך בפועל ותועד — לא על הסריקה עצמה.",
    occurrences: "הופיע {n} פעמים",
    nextStep: "לחץ על תיק — הסוכן מכין מכתב + Mandate ועוקב",
    universalCancelCta: "רק מכתבי ביטול להעתקה (בלי שליחה מזכאי)",
    errGeneric: "משהו השתבש. נסה שוב.",
    errLimit: "הגעת למגבלת התיקים. שדרג או סגור תיק קיים.",
    errNeedsEmail: "חסר אימייל לספק — הזינו כתובת שירות למטה והמשיכו.",
    outreachPh: "אימייל שירות / ביטולים של הספק",
    outreachContinue: "המשך עם האימייל",
    outreachCancel: "ביטול",
    batchOpen: "הסוכן פותח את כל התיקים המומלצים",
    batchOpening: "פותח תיקים…",
    batchDone: "✓ נפתחו {n} תיקים — לכסף שלי",
    batchPartial: "נפתחו {n} תיקים — חלק דולגו (מגבלת מסלול או חסר אימייל)",
    batchNeedsEmail: "נפתחו {n} תיקים — בחלק חסר אימייל לספק; השלימו ב«כסף שלי» לפני שליחה.",
    selectHint: "סמן חיובים ואז פתח בבת אחת (Free = תיק פעיל אחד; Pro פותח יותר)",
    cwTitle: "מה יוצא לך ב־30 הימים הקרובים",
    cwSoon: "הכי קרוב",
    cwUndated: "ועוד {n} חיובים שלא הצלחנו לתארך",
    cwDays: "בעוד {n} ימים",
    cwToday: "היום",
    cwTomorrow: "מחר",
    nextToday: "החיוב הבא — היום",
    nextTomorrow: "החיוב הבא — מחר",
    nextInDays: "החיוב הבא בעוד {n} ימים",
    approx: "ככל הנראה",
    altLetter: "חלופות (לא מסלול הסוכן)",
  },
  en: {
    privacy:
      "We never ask for or store your bank password. Screenshot or transaction file — analysis stays on-device.",
    shotTitle: "Easiest: screenshot from your bank app",
    shotSub: "Open charges in the bank app → screenshot → upload here. Zakai finds recurring payments.",
    shotBtn: "Upload screenshot",
    shotBusy: "Reading screenshot…",
    pasteTitle: "Or paste / upload a statement file",
    pastePh: "Paste CSV/text export from your bank…",
    scanBtn: "Scan charges",
    loadDemo: "Try demo (Cellcom + Netflix)",
    tooShort: "Paste at least a few statement lines — or tap Try demo.",
    uploadBtn: "Upload file",
    total: "Recurring charges found",
    perMonth: "per month",
    none: "No clear recurring charges found. Try a longer screenshot or fuller file.",
    act: "What Zakai recommends — agent acts",
    openCase: "Agent opens case now",
    opening: "Opening case…",
    opened: "✓ Case opened — My money",
    bestRoi: "Best next move",
    remember: "Saved on this device",
    lastSaved: "Last summary on this device",
    clear: "Clear saved summary",
    openBankSoon: "Official open-banking link is coming — bank consent only.",
    feeNote: "A success fee only if a real saving is documented — not for the scan itself.",
    occurrences: "Seen {n} times",
    nextStep: "Tap a case — agent drafts letter + Mandate and tracks",
    universalCancelCta: "Copy-only cancel letters (you send)",
    errGeneric: "Something went wrong. Try again.",
    errLimit: "Case limit reached. Upgrade or close an open case.",
    errNeedsEmail: "Missing provider email — enter their support address below to continue.",
    outreachPh: "Provider support / cancel email",
    outreachContinue: "Continue with email",
    outreachCancel: "Cancel",
    batchOpen: "Agent opens all recommended cases",
    batchOpening: "Opening cases…",
    batchDone: "✓ Opened {n} cases — My money",
    batchPartial: "Opened {n} cases — some skipped (plan limit or missing email)",
    batchNeedsEmail: "Opened {n} cases — some need a provider email; finish it in My money before send.",
    selectHint: "Select charges, then open together (Free = 1 active case; Pro opens more)",
    cwTitle: "Leaving your account in the next 30 days",
    cwSoon: "Soonest",
    cwUndated: "plus {n} charges we could not date",
    cwDays: "in {n} days",
    cwToday: "today",
    cwTomorrow: "tomorrow",
    nextToday: "Next charge — today",
    nextTomorrow: "Next charge — tomorrow",
    nextInDays: "Next charge in {n} days",
    approx: "probably",
    altLetter: "Alternatives (not the agent path)",
  },
  ar: {
    privacy: "لا نطلب كلمة مرور البنك.",
    shotTitle: "الأسهل: لقطة من تطبيق البنك",
    shotSub: "افتح الحركات → لقطة شاشة → ارفع هنا.",
    shotBtn: "رفع لقطة",
    shotBusy: "جارٍ التحليل…",
    pasteTitle: "أو الصق / ارفع ملفاً",
    pastePh: "الصق CSV…",
    scanBtn: "فحص",
    loadDemo: "جرّب مثالاً (Cellcom + Netflix)",
    tooShort: "الصق على الأقل بضعة أسطر من الكشف — أو اضغط «جرّب مثالاً».",
    uploadBtn: "رفع ملف",
    total: "مدفوعات متكررة",
    perMonth: "شهرياً",
    none: "لم نجد مدفوعات متكررة واضحة.",
    act: "توصية زكاي",
    openCase: "الوكيل يفتح ملفاً الآن",
    opening: "جارٍ الفتح…",
    opened: "✓ تم فتح الملف",
    bestRoi: "الأفضل الآن",
    remember: "يُحفظ على جهازك",
    lastSaved: "آخر ملخص",
    clear: "مسح",
    openBankSoon: "ربط بنكي رسمي قريباً.",
    feeNote: "عمولة فقط عند توفير موثّق.",
    occurrences: "ظهر {n} مرات",
    nextStep: "اضغط لفتح ملف مع الوكيل",
    errGeneric: "حدث خطأ.",
    errLimit: "وصلت للحد.",
    errNeedsEmail: "لا يوجد بريد للمزود.",
    outreachPh: "بريد خدمة العملاء / الإلغاء لدى المزود",
    outreachContinue: "متابعة بالبريد الإلكتروني",
    outreachCancel: "إلغاء",
    universalCancelCta: "خطابات إلغاء للنسخ فقط (بدون إرسال من زكاي)",
    altLetter: "بدائل (ليس مسار الوكيل)",
    batchOpen: "الوكيل يفتح كل الملفات الموصى بها",
    batchOpening: "جارٍ الفتح…",
    batchDone: "✓ فُتح {n} ملفات",
    batchPartial: "فُتح {n} ملفات",
    batchNeedsEmail: "فُتح {n} — بعضها بلا بريد؛ أكمل في لوحة التحكم قبل الإرسال.",
    selectHint: "اختر ثم افتح دفعة واحدة",
    cwTitle: "ما سيُخصم خلال 30 يومًا",
    cwSoon: "الأقرب",
    cwUndated: "و{n} خصومًا لم نتمكن من تأريخها",
    cwDays: "بعد {n} يومًا",
    cwToday: "اليوم",
    cwTomorrow: "غدًا",
    nextToday: "الخصم القادم — اليوم",
    nextTomorrow: "الخصم القادم — غدًا",
    nextInDays: "الخصم القادم بعد {n} يومًا",
    approx: "على الأرجح",
  },
  ru: {
    privacy: "Мы не просим пароль банка.",
    shotTitle: "Проще всего: скрин из банковского приложения",
    shotSub: "Откройте операции → скрин → загрузите сюда.",
    shotBtn: "Загрузить скрин",
    shotBusy: "Читаем…",
    pasteTitle: "Или вставьте / загрузите файл",
    pastePh: "Вставьте CSV…",
    scanBtn: "Сканировать",
    loadDemo: "Попробовать пример (Cellcom + Netflix)",
    tooShort: "Вставьте хотя бы несколько строк из выписки — или нажмите «Попробовать пример».",
    uploadBtn: "Файл",
    total: "Регулярные платежи",
    perMonth: "в месяц",
    none: "Явных регулярных платежей не найдено.",
    act: "Рекомендация Zakai",
    openCase: "Агент открывает дело",
    opening: "Открываем…",
    opened: "✓ Дело открыто",
    bestRoi: "Лучший шаг сейчас",
    remember: "Сохраняется на устройстве",
    lastSaved: "Последняя сводка",
    clear: "Очистить",
    openBankSoon: "Официальный open banking скоро.",
    feeNote: "Комиссия только с подтверждённой экономии.",
    occurrences: "Раз: {n}",
    nextStep: "Нажмите — агент откроет дело",
    universalCancelCta: "Письма для отмены — только копирование",
    altLetter: "Альтернативы (не путь агента)",
    errGeneric: "Ошибка.",
    errLimit: "Лимит дел.",
    errNeedsEmail: "Нет email поставщика.",
    outreachPh: "Email поддержки / отмены у поставщика",
    outreachContinue: "Продолжить с email",
    outreachCancel: "Отмена",
    batchOpen: "Агент открывает все рекомендованные дела",
    batchOpening: "Открываем…",
    batchDone: "✓ Открыто {n} дел",
    batchPartial: "Открыто {n} дел",
    batchNeedsEmail: "Открыто {n} — для части нужен email; укажите в дашборде перед отправкой.",
    selectHint: "Выберите и откройте пакетом",
    cwTitle: "Спишется в ближайшие 30 дней",
    cwSoon: "Ближайшее",
    cwUndated: "и ещё {n} списаний без даты",
    cwDays: "через {n} дн.",
    cwToday: "сегодня",
    cwTomorrow: "завтра",
    nextToday: "Следующее списание — сегодня",
    nextTomorrow: "Следующее списание — завтра",
    nextInDays: "Следующее списание через {n} дн.",
    approx: "вероятно",
  },
};

function tx(locale: string, key: string): string {
  // Any future gap in ar/ru must fall back to English, not Hebrew — Hebrew
  // is unreadable to a Russian visitor (see src/i18n/request.ts's fallback
  // policy, and the CaseNextStep.tsx bug this mirrors and fixes the same way).
  const familyDefault = locale === "he" || locale === "ar" ? copy.he : copy.en;
  const table = copy[locale] || familyDefault;
  return table[key] || familyDefault[key] || key;
}

/**
 * "Next charge in 6 days", when that can honestly be said.
 *
 * Renders nothing when the cadence is unclear. A guess dressed as a date is
 * the one outcome worse than silence here: somebody reads it, decides they
 * have a week, and the money leaves on Tuesday.
 */
function NextChargeLine({ charge, locale }: { charge: RecurringCharge; locale: string }) {
  const next = estimateNextCharge(charge.chargedOn);
  if (!next) return null;

  const { daysUntil, confidence } = next;
  // Beyond a couple of months the number stops informing any decision made
  // today, and starts reading as a promise about a date we cannot hold.
  if (daysUntil > 62) return null;

  const text =
    daysUntil === 0
      ? tx(locale, "nextToday")
      : daysUntil === 1
        ? tx(locale, "nextTomorrow")
        : tx(locale, "nextInDays").replace("{n}", String(daysUntil));

  // Urgency only where it is actionable — a week is the window in which
  // cancelling still beats refunding for most providers.
  const urgent = daysUntil <= 7;

  return (
    <div
      className={`text-micro mt-0.5 font-bold ${urgent ? "text-amber" : "text-ink-soft"}`}
      dir="auto"
    >
      {confidence === "low" ? `${tx(locale, "approx")} · ${text}` : text}
    </div>
  );
}


function CommitmentWindowCard({
  result,
  locale,
  bcp47,
}: {
  result: ScanResult;
  locale: string;
  bcp47: string;
}) {
  const win = buildCommitmentWindow(result.recurring);
  // An empty calendar is not a feature; it is a panel that makes the product
  // look like it did nothing.
  if (!worthShowing(win)) return null;

  const when = (days: number) =>
    days === 0
      ? tx(locale, "cwToday")
      : days === 1
        ? tx(locale, "cwTomorrow")
        : tx(locale, "cwDays").replace("{n}", String(days));

  return (
    <Card className="p-5 mb-4">
      <div className="text-caption text-ink-soft font-bold">{tx(locale, "cwTitle")}</div>
      <div className="font-display grad-text text-h1 mt-1.5">
        {formatAgorot(win.datedAgorot, bcp47)}
      </div>
      <div className="mt-3 flex flex-col gap-2">
        {win.dated.slice(0, 6).map((e, i) => (
          <div key={`${e.merchant}-${i}`} className="flex items-baseline justify-between gap-3">
            <span className="font-bold text-body">{e.merchant}</span>
            <span className="text-caption text-ink-soft">
              {when(e.next!.daysUntil)} · {formatAgorot(e.monthlyAgorot, bcp47)}
            </span>
          </div>
        ))}
      </div>
      {win.undated.length > 0 && (
        <p className="text-caption text-ink-soft mt-3 mb-0">
          {tx(locale, "cwUndated").replace("{n}", String(win.undated.length))}
        </p>
      )}
    </Card>
  );
}

interface SavedSummary {
  totalMonthlyAgorot: number;
  count: number;
  merchants: string[];
  savedAt: string;
}

function topRoi(recurring: RecurringCharge[]): RecurringCharge | null {
  if (recurring.length === 0) return null;
  return [...recurring].sort((a, b) => b.monthlyAgorot - a.monthlyAgorot)[0];
}

function topN(recurring: RecurringCharge[], n: number): RecurringCharge[] {
  return [...recurring].sort((a, b) => b.monthlyAgorot - a.monthlyAgorot).slice(0, n);
}

export function MoneyHub({
  mailLive = true,
  bcp47,
  screenshotEnabled,
  referralCode,
}: {
  bcp47: string;
  screenshotEnabled: boolean;
  /** False when no SMTP: the agent cannot actually deliver anything. */
  mailLive?: boolean;
  referralCode?: string;
}) {
  const locale = useLocale();
  const he = locale === "he" || locale === "ar";
  const tIcomponents_MoneyHub = useTranslations("inline_components_MoneyHub");
  const router = useRouter();
  const [text, setText] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [shotBusy, setShotBusy] = useState(false);
  const [shotError, setShotError] = useState(false);
  /** Read fine, nothing in it — different advice from a failed read. */
  const [shotNoTx, setShotNoTx] = useState(false);
  const [shotNeedsLogin, setShotNeedsLogin] = useState(false);
  const [shotTooBig, setShotTooBig] = useState(false);
  const [saved, setSaved] = useState<SavedSummary | null>(null);
  const [busyMerchant, setBusyMerchant] = useState<string | null>(null);
  const [batchBusy, setBatchBusy] = useState(false);
  const [openedId, setOpenedId] = useState<string | null>(null);
  const [batchCount, setBatchCount] = useState<number | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [pendingOutreach, setPendingOutreach] = useState<RecurringCharge | null>(null);
  /** Soft-open already created this case — Continue must not POST from-scan again. */
  const [pendingCaseId, setPendingCaseId] = useState<string | null>(null);
  const [outreachEmail, setOutreachEmail] = useState("");
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

  useEffect(() => {
    if (typeof window === "undefined") return;
    // `#zakai-money-start` is kept working because it shipped in one release
    // and may sit in somebody's history or a nudge email already sent.
    const hash = window.location.hash;
    if (hash !== "#zakai-money-scan" && hash !== "#zakai-money-start") return;
    document.getElementById("zakai-money-scan")?.scrollIntoView({ behavior: "smooth", block: "start" });
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
    setOpenedId(null);
    setBatchCount(null);
    setError(null);
    // Pre-select top 3 by monthly amount — keys must match checkbox indices.
    const tops = topN(scan.recurring, 3);
    const keys = tops
      .map((r) => scan.recurring.findIndex((x) => x === r))
      .filter((i) => i >= 0)
      .map((i) => String(i));
    setSelected(new Set(keys));
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
    setShotNoTx(false);
    setShotNeedsLogin(false);
    setShotTooBig(false);
    // Checked before any upload attempt: base64 inflates size ~4/3, and a
    // request near Vercel's ~4.5MB serverless body limit fails at the
    // platform level with an opaque error — indistinguishable from "broken".
    if (file.size > MAX_UPLOAD_IMAGE_BYTES) {
      setShotTooBig(true);
      return;
    }
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
      // Not logged in: the read is a real 401, not a blurry photo — say so,
      // or the CSV/paste path below (which needs no login) looks broken too.
      if (res.status === 401) {
        setShotNeedsLogin(true);
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (data.error === "noTransactions") {
        setShotNoTx(true);
        return;
      }
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

  function toggleSelect(index: number) {
    const key = String(index);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else if (next.size < 5) next.add(key);
      return next;
    });
  }

  /** Attach outreach email to an already-opened soft-open case, then finish on /money. */
  async function finishPendingOutreach(caseId: string, email: string) {
    setBusyMerchant(pendingOutreach?.merchant ?? "…");
    try {
      const approveRes = await fetch(`/api/cases/${caseId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ counterpartyEmail: email }),
      });
      if (!approveRes.ok) {
        const data = await approveRes.json().catch(() => ({}));
        if (data.error !== "ALREADY_SENT") {
          setError(tx(locale, "errNeedsEmail"));
          return;
        }
      }
      const dispatchRes = await fetch(`/api/cases/${caseId}/dispatch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ counterpartyEmail: email }),
      });
      const data = await dispatchRes.json().catch(() => ({}));
      setPendingOutreach(null);
      setPendingCaseId(null);
      setOpenedId(caseId);
      router.push(
        moneyCaseHref(caseId, {
          delivered: dispatchRes.ok && data.delivered === true,
        }),
      );
    } catch {
      setError(tx(locale, "errGeneric"));
    } finally {
      setBusyMerchant(null);
    }
  }

  async function openCase(r: RecurringCharge, contactEmail?: string) {
    setError(null);
    // Soft-open already created the case — never double from-scan.
    if (pendingCaseId && pendingOutreach?.merchant === r.merchant && contactEmail?.trim()) {
      await finishPendingOutreach(pendingCaseId, contactEmail.trim());
      return;
    }
    setBusyMerchant(r.merchant);
    try {
      const monthlyShekels = Math.max(1, Math.round(r.monthlyAgorot / 100));
      const res = await fetch("/api/cases/from-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          merchant: r.merchant,
          product: r.merchant,
          monthlyShekels,
          category: r.category,
          contactEmail: contactEmail?.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        router.replace(`/login?return=/money`);
        return;
      }
      if (!res.ok) {
        if (redirectIfOpenLoop(data, router.push)) return;
        if (data.error === "needsOutreachEmail") {
          setPendingOutreach(r);
          setPendingCaseId(null);
          setOutreachEmail("");
          setError(tx(locale, "errNeedsEmail"));
          return;
        }
        setError(data.error === "caseLimit" ? tx(locale, "errLimit") : tx(locale, "errGeneric"));
        return;
      }
      // Soft-open: case exists, Mandate not sent — collect inbox here (no second create).
      if (data.needsOutreachEmail && data.caseId) {
        setPendingOutreach(r);
        setPendingCaseId(data.caseId);
        setOpenedId(data.caseId);
        setOutreachEmail(contactEmail?.trim() || "");
        setError(tx(locale, "errNeedsEmail"));
        return;
      }
      setPendingOutreach(null);
      setPendingCaseId(null);
      setOpenedId(data.caseId);
      // Finish on /money — never send the user to the dashboard portfolio.
      router.push(
        moneyCaseHref(data.caseId, { delivered: data.delivered }),
      );
    } catch {
      setError(tx(locale, "errGeneric"));
    } finally {
      setBusyMerchant(null);
    }
  }

  async function openBatch() {
    if (!result || selected.size === 0) return;
    setError(null);
    setBatchBusy(true);
    try {
      const items = result.recurring
        .map((r, i) => ({ r, i }))
        .filter(({ i }) => selected.has(String(i)))
        .slice(0, 5)
        .map(({ r }) => ({
          merchant: r.merchant,
          product: r.merchant,
          monthlyShekels: Math.max(1, Math.round(r.monthlyAgorot / 100)),
          category: r.category,
        }));

      const res = await fetch("/api/cases/from-scan/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        router.replace(`/login?return=/money`);
        return;
      }
      if (!res.ok) {
        if (redirectIfOpenLoop(data, router.push)) return;
        setError(tx(locale, "errGeneric"));
        return;
      }
      const n = data.openedCount ?? 0;
      const skipped =
        (data.skipped as Array<{ merchant?: string; reason?: string }> | undefined) ?? [];
      const opened =
        (data.opened as Array<{ caseId?: string; needsOutreachEmail?: boolean }> | undefined) ??
        [];
      setBatchCount(n);

      if (n > 0) {
        if (data.skippedCount > 0) {
          setError(tx(locale, "batchPartial").replace("{n}", String(n)));
        } else if (opened.some((o) => o.needsOutreachEmail)) {
          setError(tx(locale, "batchNeedsEmail").replace("{n}", String(n)));
        }
        // Prefer a case that still needs outreach email so CaseNextStep can collect it.
        const needEmail = opened.find((o) => o.needsOutreachEmail && o.caseId);
        const firstId = (needEmail?.caseId || opened[0]?.caseId) as string | undefined;
        setTimeout(
          () => router.push(firstId ? `/money?case=${firstId}` : "/money"),
          600,
        );
      } else if (data.skippedCount > 0) {
        const allLimit = skipped.length > 0 && skipped.every((s) => s.reason === "caseLimit");
        if (allLimit) setError(tx(locale, "errLimit"));
        else setError(tx(locale, "errGeneric"));
      }
    } catch {
      setError(tx(locale, "errGeneric"));
    } finally {
      setBatchBusy(false);
    }
  }

  const best = result ? topRoi(result.recurring) : null;
  const canScan = text.trim().length >= STATEMENT_SCAN_MIN_CHARS;

  function loadDemo() {
    setText(UNIVERSAL_CANCEL_DEMO_CSV);
    runScan(UNIVERSAL_CANCEL_DEMO_CSV);
  }

  return (
    <div className="flex flex-col gap-5 pb-28">
      <div className="flex items-start gap-2.5 text-body text-emerald font-bold bg-[rgba(63,203,155,0.08)] border border-[rgba(63,203,155,0.25)] rounded-xl px-4 py-3">
        <span aria-hidden>🔒</span>
        <span>{tx(locale, "privacy")}</span>
      </div>

      {saved && !result && (
        <Card className="p-5">
          <div className="text-[12.5px] text-ink-soft font-bold">{tx(locale, "lastSaved")}</div>
          <div className="font-display grad-text text-3xl mt-1">
            {formatAgorot(saved.totalMonthlyAgorot, bcp47)}
          </div>
          <div className="text-body text-ink-soft mt-1">
            {saved.count} · {saved.merchants.slice(0, 4).join(", ")}
            {saved.merchants.length > 4 ? "…" : ""}
          </div>
          <p className="text-[12px] text-ink-soft mt-2">{tx(locale, "remember")}</p>
          <button
            type="button"
            className="mt-2 bg-transparent border-0 text-emerald text-body font-bold cursor-pointer p-0"
            onClick={() => {
              localStorage.removeItem(STORAGE_KEY);
              setSaved(null);
            }}
          >
            {tx(locale, "clear")}
          </button>
        </Card>
      )}

      {/* Stated once, before anything is attempted. With no outbound mail the
          agent cannot deliver, and a screen that stays silent about that reads
          as a product that simply does nothing. */}
      <CapabilityNotice mailLive={mailLive} aiLive={screenshotEnabled} />

      {/* The anchor sixteen "start here / photograph your bill" links point at.

          It used to sit on the paste card below, so every one of them —
          the homepage hero, the Zakameter's "צלמו חשבונית", the header, the
          footer, the dashboard, the signup redirect — landed somebody on a
          textarea asking for a CSV export from their bank. The camera, which
          is the whole reason the product is usable on a phone, was one card
          above the fold they arrived at, and therefore invisible.

          Moving the id rather than editing sixteen links keeps them all
          honest at once, and any new one inherits the fix. */}
      <Card className="p-6" id="zakai-money-scan">
        <div className="font-extrabold text-[16px]">{tx(locale, "shotTitle")}</div>
        <p className="text-ink-soft text-[13.5px] mt-1.5 leading-relaxed">{tx(locale, "shotSub")}</p>
        {screenshotEnabled ? (
          <Button className="mt-4" disabled={shotBusy} onClick={() => shotRef.current?.click()}>
            {shotBusy ? tx(locale, "shotBusy") : tx(locale, "shotBtn")}
          </Button>
        ) : (
          <p className="text-body text-ink-soft mt-3">
            {tIcomponents_MoneyHub("t_292af8ba")}
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
        {shotNeedsLogin && (
          <p className="text-body font-semibold mt-3 mb-0">
            {tIcomponents_MoneyHub("shotNeedsLoginPrefix")}
            <Link href="/login?return=/money" className="text-emerald underline">
              {tIcomponents_MoneyHub("shotNeedsLoginLink")}
            </Link>
            {tIcomponents_MoneyHub("shotNeedsLoginSuffix")}
          </p>
        )}
        {shotTooBig && (
          <p className="text-danger text-body font-semibold mt-3 mb-0">
            {tIcomponents_MoneyHub("shotTooBig")}
          </p>
        )}
        {shotError && (
          <p className="text-danger text-body font-semibold mt-3 mb-0">
            {tIcomponents_MoneyHub("t_da95e09c")}
          </p>
        )}
        {shotNoTx && (
          <p className="text-body font-semibold mt-3 mb-0">
            {tIcomponents_MoneyHub("shotNoTransactions")}
          </p>
        )}
      </Card>

      <Card className="p-6" id="zakai-money-paste">
        <div className="font-extrabold text-[15px]">{tx(locale, "pasteTitle")}</div>
        <Textarea
          rows={5}
          dir="ltr"
          className="mt-2 font-mono text-[12.5px]"
          placeholder={tx(locale, "pastePh")}
          // Named explicitly: a placeholder disappears the moment someone
          // types, so it cannot be the only thing identifying the field.
          aria-label={tx(locale, "pasteTitle")}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (result) setResult(null);
          }}
        />
        <div className="flex gap-3 mt-3 flex-wrap">
          <Button className="flex-1 min-w-[140px]" onClick={() => runScan(text)} disabled={!canScan}>
            {tx(locale, "scanBtn")}
          </Button>
          <Button variant="ghost" onClick={() => fileRef.current?.click()}>
            {tx(locale, "uploadBtn")}
          </Button>
          <Button variant="ghost" className="!text-body" type="button" onClick={loadDemo}>
            {tx(locale, "loadDemo")}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.tsv,.txt"
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
        </div>
        {/* Shown whenever the scan button is blocked, including on an empty
            box. Requiring text before explaining meant the primary CTA of the
            main entry page sat disabled and silent on first load — the exact
            "I press it and nothing happens" people reported. The copy already
            names both ways forward (paste lines, or load the demo). */}
        {!canScan && (
          <p className="text-[12px] text-ink-soft mt-2 mb-0">{tx(locale, "tooShort")}</p>
        )}
      </Card>

      {!result && canScan && (
        <div className="fixed inset-x-3 bottom-3 z-[9990] mx-auto max-w-[520px] md:hidden">
          <Button className="w-full shadow-lg" onClick={() => runScan(text)}>
            {tx(locale, "scanBtn")}
          </Button>
        </div>
      )}

      <p className="text-[12.5px] text-ink-soft leading-relaxed px-1">{tx(locale, "openBankSoon")}</p>

      {result && (
        <div className="flex flex-col gap-4">
          {result.recurring.length === 0 ? (
            <Card className="p-8 text-center">
              <div className="font-display text-xl">{tx(locale, "none")}</div>
            </Card>
          ) : (
            <>
              {/* The forward half of the scan. Every banking app shows what
                  was charged; none shows what is already committed for the
                  weeks ahead — which is the thing people actually worry about,
                  and the only moment when cancelling still costs nothing. */}
              <CommitmentWindowCard result={result} locale={locale} bcp47={bcp47} />

              <Card className="p-6 text-center">
                <div className="text-body text-ink-soft font-bold">{tx(locale, "total")}</div>
                <div className="font-display grad-text text-4xl mt-1.5">
                  {formatAgorot(result.totalMonthlyAgorot, bcp47)}
                </div>
                <div className="text-[12px] text-ink-soft mt-1">{tx(locale, "perMonth")}</div>
                <p className="text-[12px] text-ink-soft mt-3">{tx(locale, "remember")}</p>
                <div className="mt-4">
                  <ShareResult
                    message={buildScanShareMessage(locale, {
                      amountLabel: formatAgorot(result.totalMonthlyAgorot, bcp47),
                      recurringCount: result.recurring.length,
                    })}
                    path={scanShareLandingPath()}
                    amountLabel={formatAgorot(result.totalMonthlyAgorot, bcp47)}
                    kicker={scanShareKicker(locale)}
                    referralCode={referralCode}
                  />
                </div>
              </Card>

              {best && (
                <Card className="p-5 border border-[rgba(63,203,155,0.4)] bg-[rgba(63,203,155,0.08)]">
                  <div className="text-[12px] font-extrabold text-emerald uppercase tracking-wide">
                    {tx(locale, "bestRoi")}
                  </div>
                  <div className="font-extrabold text-[17px] mt-1.5">{best.merchant}</div>
                  <div className="text-ink-soft text-body mt-0.5">
                    {formatAgorot(best.monthlyAgorot, bcp47)} {tx(locale, "perMonth")} · {best.category}
                  </div>
                  <Button
                    className="mt-3 w-full"
                    disabled={busyMerchant === best.merchant || batchBusy}
                    onClick={() => openCase(best)}
                  >
                    {busyMerchant === best.merchant
                      ? tx(locale, "opening")
                      : openedId
                        ? tx(locale, "opened")
                        : tx(locale, "openCase")}
                  </Button>
                </Card>
              )}

              {/* Batch open — founder-grade: one scan → many agent cases */}
              {result.recurring.length >= 2 && (
                <Card className="p-5 border border-[rgba(62,198,255,0.35)] bg-[rgba(62,198,255,0.07)]">
                  <div className="text-body font-extrabold">{tx(locale, "selectHint")}</div>
                  <p className="text-[12px] text-ink-soft mt-1 mb-3">
                    {selected.size} / 5
                  </p>
                  <Button
                    className="w-full"
                    disabled={batchBusy || selected.size === 0}
                    onClick={openBatch}
                  >
                    {batchBusy
                      ? tx(locale, "batchOpening")
                      : batchCount != null
                        ? tx(locale, "batchDone").replace("{n}", String(batchCount))
                        : tx(locale, "batchOpen")}
                  </Button>
                </Card>
              )}

              <div className="rounded-xl border border-[rgba(63,203,155,0.3)] bg-[rgba(63,203,155,0.06)] px-4 py-3 text-[13.5px] font-bold">
                {tx(locale, "nextStep")}
              </div>
              {/* With no outbound mail the agent cannot deliver anything, so
                  the letters you send yourself are not an "alternative" — they
                  are the only route that reaches a provider. Burying them in a
                  collapsed <details> labelled "not the agent path" hid the one
                  thing that works behind the one that does not. */}
              {mailLive ? (
                <details className="text-body text-ink-soft">
                  <summary className="cursor-pointer font-bold select-none">
                    {tx(locale, "altLetter")}
                  </summary>
                  <Link href="/cancel/universal" className="no-underline block mt-2">
                    <Button variant="ghost" className="w-full !text-body">
                      {tx(locale, "universalCancelCta")}
                    </Button>
                  </Link>
                </details>
              ) : (
                <Link href="/cancel/universal" className="no-underline block">
                  <Button className="w-full !text-body">
                    {tx(locale, "universalCancelCta")}
                  </Button>
                </Link>
              )}

              {error && <p className="text-body text-amber font-semibold m-0">{error}</p>}

              {pendingOutreach && (
                <Card className="p-4 border border-[rgba(240,180,92,0.4)] bg-[rgba(240,180,92,0.08)]">
                  <div className="font-extrabold text-[14px] mb-2">{pendingOutreach.merchant}</div>
                  <Input
                    type="email"
                    value={outreachEmail}
                    onChange={(e) => setOutreachEmail(e.target.value)}
                    placeholder={tx(locale, "outreachPh")}
                    dir="ltr"
                    className="text-body mb-2"
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      disabled={
                        busyMerchant === pendingOutreach.merchant || !/@/.test(outreachEmail.trim())
                      }
                      onClick={() => openCase(pendingOutreach, outreachEmail.trim())}
                    >
                      {busyMerchant === pendingOutreach.merchant
                        ? tx(locale, "opening")
                        : tx(locale, "outreachContinue")}
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setPendingOutreach(null);
                        setPendingCaseId(null);
                        setOutreachEmail("");
                        setError(null);
                      }}
                    >
                      {tx(locale, "outreachCancel")}
                    </Button>
                  </div>
                </Card>
              )}

              <div className="text-body font-extrabold text-emerald">{tx(locale, "act")}</div>

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
                    <label className="flex items-center gap-2 cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        checked={selected.has(String(i))}
                        onChange={() => toggleSelect(i)}
                        className="w-4 h-4 accent-[#3FCB9B]"
                      />
                    </label>
                    <div className="flex-1 basis-[120px]">
                      <div className="font-extrabold text-[15px]">{r.merchant}</div>
                      <div className="text-[11.5px] text-ink-soft mt-0.5">
                        {tx(locale, "occurrences").replace("{n}", String(r.occurrences))}
                      </div>
                      {/* The one number that changes what someone does today.
                          Cancelling before the charge keeps the money;
                          cancelling after it starts a refund chase. Shown only
                          when the cadence is clear enough to state — an
                          estimate presented as a certainty is worse than
                          silence, because someone waits on it. */}
                      <NextChargeLine charge={r} locale={locale} />
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
                    <div className="font-display text-lg">{formatAgorot(r.monthlyAgorot, bcp47)}</div>
                    <Button
                      variant="ghost"
                      className="!px-3 !py-1.5 !text-[12.5px]"
                      disabled={busyMerchant === r.merchant || batchBusy}
                      onClick={() => openCase(r)}
                    >
                      {busyMerchant === r.merchant ? tx(locale, "opening") : tx(locale, "openCase")}
                    </Button>
                  </div>
                ))}
              </Card>

              <div className="flex flex-wrap gap-2">
                {/* "My dashboard" — which is /dashboard. This linked to /money,
                    the page it is rendered on, so pressing it re-navigated to
                    the current URL: the view scrolled to the top and nothing
                    else changed. Reported as a button that "does nothing and
                    is misleading", which is exactly what it was. */}
                <Link href="/dashboard" className="no-underline">
                  <Button variant="ghost" className="!text-body !py-2">
                    {tIcomponents_MoneyHub("t_38d0577a")}
                  </Button>
                </Link>
                <Link href="/cancel" className="no-underline">
                  <Button variant="ghost" className="!text-body !py-2">
                    {tIcomponents_MoneyHub("t_c4584cd0")}
                  </Button>
                </Link>
              </div>

              <p className="text-[12px] text-ink-soft">{tx(locale, "feeNote")}</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
