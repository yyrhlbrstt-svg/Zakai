import type { ReactNode } from "react";

/** Emerald pill used atop marketing / vertical pages. */
export function PageKicker({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={
        className ??
        "inline-block text-[12.5px] font-extrabold tracking-wide text-emerald bg-[rgba(63,203,155,0.12)] border border-[rgba(63,203,155,0.35)] rounded-full px-3.5 py-1.5 mb-4 shadow-[0_0_24px_rgba(63,203,155,0.12)]"
      }
    >
      {children}
    </div>
  );
}
