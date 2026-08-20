import * as React from "react";
import { useId } from "react";
import { IconLock } from "./Icon";

/**
 * Shared class fragments for the glass/dark design language.
 *
 * The elevation shadow used to be `0 20px 50px rgba(0,0,0,0.5)` — a large,
 * soft, *black* shadow, on a page whose background is `#070b12`. A black
 * shadow cannot darken a surface that is already darker than black-at-50%;
 * measured in a real screenshot, every card in the app read as a flat,
 * bordered rectangle with no sense of sitting above the page, because the
 * one cue meant to say "elevated" was invisible by construction.
 *
 * The primary CTA button never had this problem, because its shadow is
 * *colored* — `rgba(63,203,155,…)`, emerald — and emerald against near-black
 * reads clearly (it is the visible glow under every primary button). That
 * contrast is the actual diagnosis: colored elevation works here, black does
 * not, and Card was the one thing still relying on black.
 *
 * The fix is not a colored glow on every card — glowing hundreds of ordinary
 * content cards would read as noise, not premium; the glow is earned by
 * primary actions, not the default treatment. Instead, elevation comes from
 * what actually works against a near-black page: a light rim along the top
 * edge (a surface catching light from above, the same technique Vercel's and
 * Linear's dark UIs use), a slightly richer fill so the card reads as one
 * step lighter than the page rather than merely bordered, and a tight
 * contact shadow for grounding rather than a large one that never resolves.
 */
export const glass =
  "bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.1)] rounded-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_1px_2px_rgba(0,0,0,0.5),0_12px_28px_rgba(0,0,0,0.28)]";

export function Card({
  className = "",
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`${glass} ${className}`} {...rest}>
      {children}
    </div>
  );
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost";
};

/**
 * `type` defaults to "button", not the browser's "submit".
 *
 * HTML makes an unlabelled <button> inside a <form> a submit button. That
 * default is a trap in an app like this one: most buttons here run an
 * onClick, and any of them that happened to sit inside a form quietly
 * submitted it instead — a full page reload that lands the reader back at the
 * top with nothing visibly changed. From the outside it is indistinguishable
 * from a button that does nothing, which is exactly how it was reported.
 *
 * Every form in this codebase already marks its real submit button
 * explicitly, so nothing depends on the implicit behaviour. Buttons that
 * should submit still say so; buttons that should not can no longer do it by
 * accident.
 */
export function Button({
  variant = "primary",
  className = "",
  type = "button",
  ...rest
}: ButtonProps) {
  const base =
    "rounded-[14px] font-extrabold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-[transform,box-shadow,filter,background-color,border-color] duration-200 ease-[var(--ease-snappy)]";
  const styles =
    variant === "primary"
      ? "grad-bg btn-sheen text-[#06121A] px-7 py-4 text-[16.5px] shadow-[0_12px_32px_rgba(63,203,155,0.32)] hover:-translate-y-0.5 hover:brightness-[1.07] hover:shadow-[0_18px_48px_rgba(63,203,155,0.48)] active:translate-y-0 active:scale-[0.98] active:brightness-100"
      : "bg-[rgba(255,255,255,0.06)] text-ink border border-[rgba(255,255,255,0.1)] px-6 py-3.5 text-[15px] font-bold hover:bg-[rgba(255,255,255,0.11)] hover:border-[rgba(63,203,155,0.45)] active:bg-[rgba(255,255,255,0.08)]";
  /**
   * A disabled primary action is the single most reported "this app is
   * broken" in testing: people tap it, nothing happens, and no amount of
   * explanatory text beside it gets read. ~27 tools gate their main button on
   * a readiness predicate and render <MissingFields/> above it saying exactly
   * what is missing — the text was there all along, just never brought to
   * anyone's attention.
   *
   * So a disabled button stays tappable and, when tapped, carries the person
   * to that checklist and flashes it. The real onClick is never invoked while
   * blocked, so a `disabled={busy}` guard still prevents a double submit; the
   * only thing that changes is that the button now answers.
   */
  const blocked = rest.disabled === true;
  const { disabled: _disabled, onClick, ...pass } = rest;
  if (!blocked) {
    return <button type={type} className={`${base} ${styles} ${className}`} onClick={onClick} {...pass} />;
  }
  return (
    <button
      type="button"
      aria-disabled="true"
      className={`${base} ${styles} ${className} opacity-40`}
      onClick={(e) => {
        e.preventDefault();
        const hint = document.querySelector<HTMLElement>("[data-missing-fields]");
        if (hint) {
          hint.scrollIntoView({ block: "center", behavior: "smooth" });
          hint.classList.add("missing-fields-flash");
          window.setTimeout(() => hint.classList.remove("missing-fields-flash"), 1600);
          return;
        }
        /*
         * Some tools only render the checklist once an earlier step has
         * resolved (a deposit has to be established as late before the fields
         * are named), which leaves the button blocked and the screen silent —
         * the worst case of all. Falling back to the first empty field is a
         * true answer to "why is nothing happening": that is the thing
         * standing in the way.
         */
        const scope =
          (e.currentTarget as HTMLElement).closest("form") ??
          document.querySelector("main") ??
          document.body;
        const fields = scope.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
          "input:not([type=hidden]):not([type=checkbox]):not([type=radio]), textarea",
        );
        const empty = Array.from(fields).find(
          (f) => !f.value.trim() && !f.disabled && !!(f.offsetWidth || f.offsetHeight),
        );
        if (!empty) return;
        empty.scrollIntoView({ block: "center", behavior: "smooth" });
        empty.focus();
      }}
      {...pass}
    />
  );
}

/**
 * Every form control ends up with a name a screen reader can announce.
 *
 * An axe run across all 136 routes found eleven controls with none at all —
 * three of them on the institutional contact form, two on the bank-fee flow.
 * The visible `<label>` beside them was a plain sibling with no `htmlFor`, so
 * it labelled nothing: clicking it did not focus the field, and a blind person
 * reached an input announced as "edit text, blank" with no way to know what it
 * wanted. On a product whose entire purpose is getting money back for people
 * without the time or leverage to chase it themselves, that is the wrong group
 * to lock out — and in Israel web accessibility is a legal duty, not a
 * courtesy.
 *
 * Preference order, best first:
 *   1. `label` — renders a real `<label htmlFor>`, so the click target works too.
 *   2. An `aria-label` / `aria-labelledby` the caller passed deliberately.
 *   3. The placeholder, as a floor.
 *
 * Three is a floor and not a target. A placeholder disappears the moment
 * somebody types, so it is a poor label for anyone with working memory
 * loaded — but it is a real accessible name, and it is enormously better than
 * the nothing that was there.
 */
function useFieldName(
  rest: { id?: string; "aria-label"?: string; "aria-labelledby"?: string; placeholder?: string },
  label: string | undefined,
  generatedId: string,
): { id: string; ariaLabel?: string } {
  const id = rest.id ?? generatedId;
  if (label || rest["aria-label"] || rest["aria-labelledby"]) return { id };
  return { id, ariaLabel: rest.placeholder || undefined };
}

/** The visible, properly associated label. */
function FieldLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="text-caption text-ink-soft font-bold">
      {children}
    </label>
  );
}

export function Input({
  className = "",
  label,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  const generated = useId();
  const { id, ariaLabel } = useFieldName(rest, label, generated);
  const field = (
    <input
      id={id}
      aria-label={ariaLabel}
      className={`w-full px-4 py-3 rounded-xl border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.05)] text-[16px] text-ink box-border transition-[border-color,box-shadow] duration-200 ease-[var(--ease-out)] hover:border-[rgba(255,255,255,0.18)] focus:shadow-[0_0_0_3px_rgba(63,203,155,0.18)] ${className}`}
      {...rest}
    />
  );
  if (!label) return field;
  return (
    <span className="flex flex-col gap-1.5">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {field}
    </span>
  );
}

export function Select({
  className = "",
  children,
  label,
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  const generated = useId();
  const { id, ariaLabel } = useFieldName(rest, label, generated);
  const field = (
    <select
      id={id}
      aria-label={ariaLabel}
      className={`w-full px-4 py-3 rounded-xl border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.05)] text-[16px] text-ink box-border focus:shadow-[0_0_0_3px_rgba(63,203,155,0.18)] ${className}`}
      {...rest}
    >
      {children}
    </select>
  );
  if (!label) return field;
  return (
    <span className="flex flex-col gap-1.5">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {field}
    </span>
  );
}

export function Textarea({
  className = "",
  label,
  ...rest
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  /** So a caller can focus the box — used to rescue an empty primary action. */
  ref?: React.Ref<HTMLTextAreaElement>;
}) {
  const generated = useId();
  const { id, ariaLabel } = useFieldName(rest, label, generated);
  const field = (
    <textarea
      id={id}
      aria-label={ariaLabel}
      className={`w-full px-4 py-3 rounded-xl border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.05)] text-[15px] leading-relaxed text-ink box-border focus:shadow-[0_0_0_3px_rgba(63,203,155,0.18)] ${className}`}
      {...rest}
    />
  );
  if (!label) return field;
  return (
    <span className="flex flex-col gap-1.5">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {field}
    </span>
  );
}

export function FieldError({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return <p className="text-danger text-sm mt-2 font-semibold">{children}</p>;
}

/**
 * A keyboard-correct chip radiogroup.
 *
 * THE GAP THIS CLOSES
 *
 * This exact shape — `<button role="radio" aria-checked>` chips inside a
 * `role="radiogroup"` container, with no keyboard handler at all — is
 * duplicated across roughly a dozen components (age bands, employment,
 * country pickers, and more). A screen reader announces "radio button, 1 of
 * N, radiogroup" for every one of them, which sets an expectation — arrow
 * keys move between options and select as they go, the WAI-ARIA radiogroup
 * pattern every screen-reader user has learned from native radio inputs —
 * that nothing behind any of those components has ever fulfilled. The role
 * was promising a keyboard behaviour the component never had.
 *
 * Every option in the group is reachable by Tab today (each `<button>` is
 * independently focusable), which is not broken so much as it is the wrong
 * shape: a radiogroup should be one stop in the tab order, with the arrow
 * keys moving — and selecting — within it. Roving `tabIndex` here (0 on the
 * selected option, -1 on the rest) is what makes that true.
 *
 * RTL handling: Left/Right are mirrored by reading direction (checked via
 * the rendered element's computed `direction`, not assumed from locale),
 * matching the WAI-ARIA authoring practice that horizontal arrow keys follow
 * visual order; Up/Down always mean previous/next regardless of direction.
 */
export function RadioChips<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  className = "",
}: {
  value: T;
  onChange: (next: T) => void;
  options: readonly { value: T; label: React.ReactNode }[];
  ariaLabel: string;
  className?: string;
}) {
  const buttonRefs = React.useRef<Record<string, HTMLButtonElement | null>>({});

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const idx = options.findIndex((o) => o.value === value);
    if (idx === -1) return;

    const rtl = getComputedStyle(e.currentTarget).direction === "rtl";
    let delta = 0;
    if (e.key === "ArrowDown" || (e.key === "ArrowRight" && !rtl) || (e.key === "ArrowLeft" && rtl)) {
      delta = 1;
    } else if (
      e.key === "ArrowUp" ||
      (e.key === "ArrowLeft" && !rtl) ||
      (e.key === "ArrowRight" && rtl)
    ) {
      delta = -1;
    } else if (e.key === "Home") {
      delta = -idx; // jump to 0
    } else if (e.key === "End") {
      delta = options.length - 1 - idx; // jump to last
    } else {
      return;
    }

    e.preventDefault();
    const next = options[(idx + delta + options.length) % options.length];
    onChange(next.value);
    buttonRefs.current[next.value]?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      className={`flex gap-2 flex-wrap ${className}`}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => {
              buttonRefs.current[o.value] = el;
            }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(o.value)}
            className={`rounded-full px-3.5 py-2 text-body font-bold cursor-pointer border transition-colors duration-200 ${
              active
                ? "bg-[rgba(63,203,155,0.16)] border-[rgba(63,203,155,0.55)] text-emerald shadow-[0_0_0_1px_rgba(63,203,155,0.12)]"
                : "bg-[rgba(255,255,255,0.05)] border-[rgba(255,255,255,0.1)] text-ink-soft hover:border-[rgba(255,255,255,0.22)]"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Multi-select chip group — checkbox semantics with roving focus + arrow keys. */
export function CheckboxChips<T extends string>({
  selected,
  onToggle,
  options,
  ariaLabel,
  className = "",
}: {
  selected: (value: T) => boolean;
  onToggle: (value: T) => void;
  options: readonly { value: T; label: React.ReactNode }[];
  ariaLabel: string;
  className?: string;
}) {
  const buttonRefs = React.useRef<Record<string, HTMLButtonElement | null>>({});
  const [focusValue, setFocusValue] = React.useState<T | null>(options[0]?.value ?? null);

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const idx = options.findIndex((o) => o.value === focusValue);
    if (idx === -1) return;

    const rtl = getComputedStyle(e.currentTarget).direction === "rtl";
    let delta = 0;
    if (e.key === "ArrowDown" || (e.key === "ArrowRight" && !rtl) || (e.key === "ArrowLeft" && rtl)) {
      delta = 1;
    } else if (
      e.key === "ArrowUp" ||
      (e.key === "ArrowLeft" && !rtl) ||
      (e.key === "ArrowRight" && rtl)
    ) {
      delta = -1;
    } else if (e.key === "Home") {
      delta = -idx;
    } else if (e.key === "End") {
      delta = options.length - 1 - idx;
    } else {
      return;
    }

    e.preventDefault();
    const next = options[(idx + delta + options.length) % options.length];
    setFocusValue(next.value);
    buttonRefs.current[next.value]?.focus();
  }

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      className={`grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))] ${className}`}
    >
      {options.map((o) => {
        const on = selected(o.value);
        const focused = focusValue === o.value;
        return (
          <button
            key={o.value}
            ref={(el) => {
              buttonRefs.current[o.value] = el;
            }}
            type="button"
            role="checkbox"
            aria-checked={on}
            tabIndex={focused ? 0 : -1}
            onFocus={() => setFocusValue(o.value)}
            onClick={() => onToggle(o.value)}
            className={`rounded-xl px-4 py-3 text-[15px] font-bold border transition-colors duration-200 text-start leading-snug cursor-pointer ${
              on
                ? "bg-[rgba(63,203,155,0.16)] border-emerald text-ink shadow-[0_0_0_1px_rgba(63,203,155,0.12)]"
                : "bg-[rgba(255,255,255,0.04)] border-[rgba(255,255,255,0.1)] text-ink-soft hover:border-[rgba(63,203,155,0.4)]"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * The "we never ask for your bank password" line, byte-identical in
 * `MoneyHub` and `StatementScan` before this — same copy key, same wrapper,
 * same 🔒 emoji, just written twice. Extracted so the two can never drift,
 * and so the emoji-to-icon fix only had to happen once.
 */
export function PrivacyNote({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex items-start gap-2.5 text-body text-emerald font-bold bg-[rgba(63,203,155,0.08)] border border-[rgba(63,203,155,0.25)] rounded-xl px-4 py-3 ${className}`}
    >
      <IconLock className="shrink-0 mt-0.5" />
      <span>{children}</span>
    </div>
  );
}

export function Spinner({ label, sub }: { label: string; sub?: string }) {
  return (
    <div className="text-center pt-16" role="status" aria-live="polite">
      <div className="relative w-[70px] h-[70px] mx-auto mb-6">
        <div
          className="absolute inset-[-12px] rounded-full"
          style={{ background: "#3FCB9B", filter: "blur(24px)", opacity: 0.35 }}
        />
        <div className="relative w-[70px] h-[70px] rounded-full border-4 border-[rgba(255,255,255,0.1)] border-t-[var(--emerald)] animate-spin" />
      </div>
      <div className="font-display text-2xl">{label}</div>
      {sub ? <div className="text-ink-soft mt-2 text-[14.5px]">{sub}</div> : null}
    </div>
  );
}
