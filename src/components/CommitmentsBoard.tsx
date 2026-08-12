"use client";

import { useCallback, useEffect, useState } from "react";
import { Link, useRouter } from "@/i18n/routing";
import { Button, Card, Input, FieldError } from "@/components/ui";

/**
 * The record, made visible.
 *
 * The commitments themselves, the weekly watch and every engine that reads
 * them already existed and a person could not see any of it. A record nobody
 * can look at is not a record — it is a table.
 *
 * The screen leads with what can still be acted on, because that is the only
 * part with a deadline attached. Everything else is context.
 */

interface Row {
  id: string;
  label: string;
  counterparty: string;
  category: string;
  monthlyShekels: number | null;
  renewsOn: string | null;
  noticeDays: number | null;
  actBy: string | null;
  state: "open" | "closing" | "missed" | "unknown";
  daysLeft: number | null;
}

interface Review {
  actingCount: number;
  overlapCount: number;
  monthlyTotalShekels: number;
  unpriced: number;
  unknownDeadline: number;
}

const COPY = {
  he: {
    loading: "טוען…",
    emptyTitle: "עוד אין כאן כלום",
    emptySub:
      "הוסיפו חוזה או מנוי אחד — זה שיש לו תאריך חידוש. מכאן אנחנו שומרים על התאריך שאפשר עוד לפעול בו, ומזכירים לפניו.",
    addTitle: "הוספת התחייבות",
    label: "שם (חדר כושר, ליסינג, אחסון ענן…)",
    amount: "עלות חודשית (₪) — אפשר להשאיר ריק",
    renews: "תאריך חידוש",
    notice: "כמה ימי הודעה מראש נדרשים",
    add: "הוסף",
    adding: "מוסיף…",
    actNow: "צריך לפעול עכשיו",
    everything: "כל ההתחייבויות",
    actBy: "להודיע עד",
    writeCancellation: "צור מכתב ביטול",
    emptyAct: "כבר יודעים על חוזה שרוצים לצאת ממנו?",
    loadFailed: "לא הצלחנו לטעון את הרשימה. רעננו את הדף.",
    signedOutTitle: "צריך להתחבר כדי לראות את הרישום",
    signedOutSub: "הרישום שמור לחשבון שלך בלבד. אם כבר עכשיו יש חוזה שרוצים לצאת ממנו — אפשר לייצר מכתב ביטול בלי להתחבר.",
    signIn: "התחברות",
    daysLeft: "נותרו",
    days: "ימים",
    missed: "החלון נסגר",
    unknownDeadline: "לא ידוע מתי — החוזה לא נוקב בתקופת הודעה",
    noRenewal: "בלי תאריך חידוש",
    perMonth: "לחודש",
    unpricedTag: "בלי מחיר",
    end: "הסתיים",
    ending: "מסמן…",
    totalLabel: "סה״כ חודשי ידוע",
    unpricedNote: "התחייבויות ללא מחיר ידוע (לא נכללות בסכום)",
    unknownNote: "מתחדשות בלי תקופת הודעה ידועה",
    overlapNote: "זוגות ספקים ששווה לבדוק",
    errLabel: "צריך שם",
    errGeneric: "משהו השתבש. נסו שוב.",
  },
  en: {
    loading: "Loading…",
    emptyTitle: "Nothing here yet",
    emptySub:
      "Add one contract or subscription — one that has a renewal date. From then on we hold the date you can still act on, and remind you before it.",
    addTitle: "Add a commitment",
    label: "Name (gym, lease, cloud storage…)",
    amount: "Monthly cost (₪) — can be left empty",
    renews: "Renewal date",
    notice: "Days of written notice required",
    add: "Add",
    adding: "Adding…",
    actNow: "Needs action now",
    everything: "All commitments",
    actBy: "give notice by",
    writeCancellation: "Write cancellation letter",
    emptyAct: "Already know of a contract you want out of?",
    loadFailed: "We could not load the list. Refresh the page.",
    signedOutTitle: "Sign in to see your record",
    signedOutSub: "The record is kept on your account only. If you already have a contract you want out of, you can write a cancellation letter without signing in.",
    signIn: "Sign in",
    daysLeft: "left:",
    days: "days",
    missed: "window closed",
    unknownDeadline: "unknown — the contract states no notice period",
    noRenewal: "no renewal date",
    perMonth: "per month",
    unpricedTag: "no price",
    end: "Ended",
    ending: "Marking…",
    totalLabel: "Known monthly total",
    unpricedNote: "commitments with no known price (excluded from the total)",
    unknownNote: "renew with no known notice period",
    overlapNote: "vendor pairs worth reviewing",
    errGeneric: "Something went wrong. Try again.",
    errLabel: "A name is required",
  },
} as const;

export function CommitmentsBoard({ locale }: { locale: string }) {
  const router = useRouter();
  const c = locale === "he" || locale === "ar" ? COPY.he : COPY.en;

  const [rows, setRows] = useState<Row[] | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [needsLogin, setNeedsLogin] = useState(false);
  /** Separate from `err`, which belongs to the add form below. A list that
   *  failed to load must not then claim there is nothing in it. */
  const [loadErr, setLoadErr] = useState("");

  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [renews, setRenews] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/commitments");
      /**
       * A failed load must leave a state that is not "loading".
       *
       * This used to `return` on any non-OK response, which left `rows` null
       * forever — and since the list is behind a session, that meant every
       * logged-out visitor to this page sat looking at "Loading…" with no
       * error, no sign-in prompt and no way onward, indefinitely. A spinner
       * that never resolves is worse than an error: it gives a person nothing
       * to act on and no reason to stop waiting.
       */
      if (res.status === 401) {
        setNeedsLogin(true);
        setRows([]);
        return;
      }
      if (!res.ok) {
        setLoadErr(c.loadFailed);
        setRows([]);
        return;
      }
      const data = await res.json();
      setRows(data.commitments ?? []);
      setReview(data.review ?? null);
    } catch {
      setLoadErr(c.loadFailed);
      setRows([]);
    }
  }, [c.loadFailed]);

  useEffect(() => {
    void load();
  }, [load]);

  async function add() {
    if (!label.trim()) {
      setErr(c.errLabel);
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/commitments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: label.trim(),
          // An empty box means "not known", never zero. A commitment priced at
          // nothing would drop out of every total the person is shown.
          monthlyShekels: amount.trim() === "" ? null : Number(amount),
          renewsOn: renews || undefined,
          noticeDays: notice.trim() === "" ? null : Number(notice),
          source: "manual",
        }),
      });
      if (!res.ok) {
        setErr(c.errGeneric);
        return;
      }
      setLabel("");
      setAmount("");
      setRenews("");
      setNotice("");
      await load();
      router.refresh();
    } catch {
      setErr(c.errGeneric);
    } finally {
      setBusy(false);
    }
  }

  async function end(id: string) {
    setBusy(true);
    try {
      await fetch(`/api/commitments/${id}`, { method: "DELETE" });
      await load();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (rows === null) {
    return <p className="text-ink-soft text-body">{c.loading}</p>;
  }

  const acting = rows.filter((r) => r.state === "closing" || r.state === "missed");

  const deadlineText = (r: Row) => {
    if (r.state === "missed") return `${c.missed} · ${r.actBy}`;
    if (r.actBy) return `${c.actBy} ${r.actBy} · ${c.daysLeft} ${r.daysLeft} ${c.days}`;
    if (r.renewsOn) return c.unknownDeadline;
    return c.noRenewal;
  };

  const line = (r: Row, urgent: boolean) => (
    <li
      key={r.id}
      className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[rgba(255,255,255,0.06)] py-2.5 last:border-0"
    >
      <span className="flex flex-col">
        <span className="text-body font-extrabold">{r.label}</span>
        <span className={`text-micro ${urgent ? "text-[#f08a6b]" : "text-ink-soft"}`}>
          {deadlineText(r)}
        </span>
      </span>
      <span className="flex items-center gap-3">
        <span className="text-micro text-ink-soft">
          {r.monthlyShekels === null ? c.unpricedTag : `₪${r.monthlyShekels} ${c.perMonth}`}
        </span>
        {/* "End" only updates our record. On a contract whose notice window is
            actually open, the thing that changes the outcome is the letter to
            the provider — and until now this screen offered bookkeeping and no
            way to act, which is the whole reason it counted as a dead end. */}
        {urgent && (
          <Link href="/cancel" className="no-underline">
            <Button variant="ghost" className="!text-micro">
              {c.writeCancellation}
            </Button>
          </Link>
        )}
        <Button variant="ghost" className="!text-micro" disabled={busy} onClick={() => end(r.id)}>
          {busy ? c.ending : c.end}
        </Button>
      </span>
    </li>
  );

  return (
    <div className="flex flex-col gap-6">
      {acting.length > 0 && (
        <Card className="p-5 border-[rgba(240,138,107,0.5)] bg-[rgba(240,138,107,0.08)]">
          <h2 className="text-title font-extrabold m-0 mb-2">{c.actNow}</h2>
          <ul className="list-none p-0 m-0">{acting.map((r) => line(r, true))}</ul>
        </Card>
      )}

      {rows.length > 0 && (
        <Card className="p-5">
          <h2 className="text-title font-extrabold m-0 mb-2">{c.everything}</h2>
          <ul className="list-none p-0 m-0">{rows.map((r) => line(r, false))}</ul>

          {review && (
            <div className="mt-4 flex flex-col gap-1 text-micro text-ink-soft">
              <span>
                {c.totalLabel}: ₪{review.monthlyTotalShekels}
              </span>
              {/* Stated separately, never folded into the total: a contract
                  nobody has priced is not a free one. */}
              {review.unpriced > 0 && (
                <span>
                  {review.unpriced} {c.unpricedNote}
                </span>
              )}
              {review.unknownDeadline > 0 && (
                <span>
                  {review.unknownDeadline} {c.unknownNote}
                </span>
              )}
              {review.overlapCount > 0 && (
                <span>
                  {review.overlapCount} {c.overlapNote}
                </span>
              )}
            </div>
          )}
        </Card>
      )}

      {needsLogin && (
        <Card className="p-5">
          <h2 className="text-title font-extrabold m-0 mb-1.5">{c.signedOutTitle}</h2>
          <p className="text-ink-soft text-body m-0 mb-3 leading-relaxed">{c.signedOutSub}</p>
          <div className="flex flex-wrap gap-2">
            <Link href="/login?return=/commitments" className="no-underline">
              <Button variant="ghost" className="!text-body">{c.signIn}</Button>
            </Link>
            <Link href="/cancel" className="no-underline">
              <Button variant="ghost" className="!text-body">{c.writeCancellation}</Button>
            </Link>
          </div>
        </Card>
      )}

      {loadErr !== "" && (
        <Card className="p-5">
          <p role="alert" className="text-[#ff8f8f] text-body m-0">{loadErr}</p>
        </Card>
      )}

      {!needsLogin && loadErr === "" && rows.length === 0 && (
        <Card className="p-5">
          <h2 className="text-title font-extrabold m-0 mb-1.5">{c.emptyTitle}</h2>
          <p className="text-ink-soft text-body m-0 leading-relaxed">{c.emptySub}</p>
          {/* The way out has to be here in the empty state too. Offering it only
              once a row exists means the page leads nowhere for every person
              arriving for the first time — which is everybody, once. */}
          <p className="text-ink-soft text-body mt-3 mb-0 leading-relaxed">
            {c.emptyAct}{" "}
            <Link href="/cancel" className="text-emerald font-bold no-underline">
              {c.writeCancellation}
            </Link>
          </p>
        </Card>
      )}

      <Card className="p-5 flex flex-col gap-2.5">
        <h2 className="text-title font-extrabold m-0">{c.addTitle}</h2>
        <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={c.label} aria-label={c.label} />
        <Input
          type="number"
          inputMode="decimal"
          min={0}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={c.amount}
          aria-label={c.amount}
        />
        <Input type="date" value={renews} onChange={(e) => setRenews(e.target.value)} aria-label={c.renews} />
        <Input
          type="number"
          min={0}
          value={notice}
          onChange={(e) => setNotice(e.target.value)}
          placeholder={c.notice}
          aria-label={c.notice}
        />
        {err && <FieldError>{err}</FieldError>}
        <Button disabled={busy} onClick={add} className="w-full sm:w-auto">
          {busy ? c.adding : c.add}
        </Button>
      </Card>
    </div>
  );
}
