import * as React from "react";

/** Shared class fragments for the glass/dark design language. */
export const glass =
  "bg-[rgba(255,255,255,0.045)] border border-[rgba(255,255,255,0.09)] rounded-2xl backdrop-blur-xl shadow-[0_24px_60px_rgba(0,0,0,0.45)]";

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

export function Button({ variant = "primary", className = "", ...rest }: ButtonProps) {
  const base =
    "rounded-[14px] font-extrabold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-[transform,box-shadow,filter,background-color,border-color] duration-200 ease-[var(--ease-snappy)] focus-visible:outline-none";
  const styles =
    variant === "primary"
      ? "grad-bg text-[#06121A] px-7 py-4 text-[16.5px] shadow-[0_10px_30px_rgba(44,229,167,0.28)] hover:-translate-y-0.5 hover:brightness-[1.06] hover:shadow-[0_16px_42px_rgba(44,229,167,0.42)] active:translate-y-0 active:brightness-100"
      : "bg-[rgba(255,255,255,0.06)] text-ink border border-[rgba(255,255,255,0.09)] px-6 py-3.5 text-[15px] font-bold hover:bg-[rgba(255,255,255,0.1)] hover:border-[rgba(44,229,167,0.4)] active:bg-[rgba(255,255,255,0.08)]";
  return <button className={`${base} ${styles} ${className}`} {...rest} />;
}

export function Input({ className = "", ...rest }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full px-4 py-3 rounded-xl border border-[rgba(255,255,255,0.09)] bg-[rgba(255,255,255,0.05)] text-[16px] text-ink outline-none box-border transition-colors duration-200 ease-[var(--ease-out)] hover:border-[rgba(255,255,255,0.16)] ${className}`}
      {...rest}
    />
  );
}

export function Select({ className = "", children, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`w-full px-4 py-3 rounded-xl border border-[rgba(255,255,255,0.09)] bg-[rgba(255,255,255,0.05)] text-[16px] text-ink outline-none box-border ${className}`}
      {...rest}
    >
      {children}
    </select>
  );
}

export function Textarea({ className = "", ...rest }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`w-full px-4 py-3 rounded-xl border border-[rgba(255,255,255,0.09)] bg-[rgba(255,255,255,0.05)] text-[15px] leading-relaxed text-ink outline-none box-border ${className}`}
      {...rest}
    />
  );
}

export function FieldError({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return <p className="text-danger text-sm mt-2 font-semibold">{children}</p>;
}

export function Spinner({ label, sub }: { label: string; sub?: string }) {
  return (
    <div className="text-center pt-16" role="status" aria-live="polite">
      <div className="relative w-[70px] h-[70px] mx-auto mb-6">
        <div
          className="absolute inset-[-12px] rounded-full"
          style={{ background: "#3EC6FF", filter: "blur(24px)", opacity: 0.4 }}
        />
        <div className="relative w-[70px] h-[70px] rounded-full border-4 border-[rgba(255,255,255,0.1)] border-t-cyan animate-spin" />
      </div>
      <div className="font-display text-2xl">{label}</div>
      {sub ? <div className="text-ink-soft mt-2 text-[14.5px]">{sub}</div> : null}
    </div>
  );
}
