import * as React from "react";

/** Shared class fragments for the glass/dark design language. */
export const glass =
  "bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.06)]";

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
    "rounded-[14px] font-extrabold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-[transform,box-shadow,filter,background-color,border-color] duration-200 ease-[var(--ease-snappy)] focus-visible:outline-none";
  const styles =
    variant === "primary"
      ? "grad-bg btn-sheen text-[#06121A] px-7 py-4 text-[16.5px] shadow-[0_12px_32px_rgba(63,203,155,0.32)] hover:-translate-y-0.5 hover:brightness-[1.07] hover:shadow-[0_18px_48px_rgba(63,203,155,0.48)] active:translate-y-0 active:scale-[0.98] active:brightness-100"
      : "bg-[rgba(255,255,255,0.06)] text-ink border border-[rgba(255,255,255,0.1)] px-6 py-3.5 text-[15px] font-bold hover:bg-[rgba(255,255,255,0.11)] hover:border-[rgba(63,203,155,0.45)] active:bg-[rgba(255,255,255,0.08)]";
  return <button type={type} className={`${base} ${styles} ${className}`} {...rest} />;
}

export function Input({ className = "", ...rest }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full px-4 py-3 rounded-xl border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.05)] text-[16px] text-ink outline-none box-border transition-[border-color,box-shadow] duration-200 ease-[var(--ease-out)] hover:border-[rgba(255,255,255,0.18)] focus:shadow-[0_0_0_3px_rgba(63,203,155,0.18)] ${className}`}
      {...rest}
    />
  );
}

export function Select({ className = "", children, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`w-full px-4 py-3 rounded-xl border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.05)] text-[16px] text-ink outline-none box-border focus:shadow-[0_0_0_3px_rgba(63,203,155,0.18)] ${className}`}
      {...rest}
    >
      {children}
    </select>
  );
}

export function Textarea({ className = "", ...rest }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`w-full px-4 py-3 rounded-xl border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.05)] text-[15px] leading-relaxed text-ink outline-none box-border focus:shadow-[0_0_0_3px_rgba(63,203,155,0.18)] ${className}`}
      {...rest}
    />
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
            className={`rounded-full px-3.5 py-2 text-[13px] font-bold cursor-pointer border transition-colors duration-200 ${
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
