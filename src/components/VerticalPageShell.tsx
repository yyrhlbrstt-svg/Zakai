import type { ReactNode } from "react";

/**
 * Shared shell for money vertical landing pages — consistent hero rhythm.
 */
export function VerticalPageShell({
  kicker,
  title,
  sub,
  cite,
  children,
  footer,
  className,
}: {
  kicker?: string;
  title: string;
  sub: string;
  cite?: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Override default max width (e.g. bank-fees grids). */
  className?: string;
}) {
  return (
    <main
      className={
        className ??
        "max-w-[760px] mx-auto px-5 pb-24 pt-2"
      }
    >
      {kicker && (
        <div className="inline-block text-[12.5px] font-extrabold text-emerald bg-[rgba(63,203,155,0.1)] border border-[rgba(63,203,155,0.3)] rounded-full px-3.5 py-1.5 mb-4">
          {kicker}
        </div>
      )}
      <h1 className="font-display text-[clamp(26px,5vw,38px)] leading-tight m-0 text-balance">{title}</h1>
      <p className="text-ink-soft text-[15px] leading-relaxed mt-3 mb-2 max-w-[600px]">{sub}</p>
      {cite && <p className="text-[12.5px] text-ink-soft mb-6 max-w-[600px]">{cite}</p>}
      {!cite && <div className="mb-6" />}
      {children}
      {footer}
    </main>
  );
}
