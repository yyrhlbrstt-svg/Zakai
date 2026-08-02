import type { ReactNode } from "react";

/** Emerald pill used atop marketing / vertical pages. */
export function PageKicker({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={
        className ??
        "inline-block text-[12.5px] font-extrabold text-emerald bg-[rgba(63,203,155,0.1)] border border-[rgba(63,203,155,0.3)] rounded-full px-3.5 py-1.5 mb-4"
      }
    >
      {children}
    </div>
  );
}
