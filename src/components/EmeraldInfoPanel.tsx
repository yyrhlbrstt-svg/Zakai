import type { ReactNode } from "react";

export function EmeraldInfoPanel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={
        className ??
        "rounded-2xl border border-[rgba(63,203,155,0.35)] bg-[rgba(63,203,155,0.08)] px-5 py-4 text-[13.5px] leading-relaxed"
      }
    >
      {children}
    </div>
  );
}
