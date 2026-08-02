import type { ReactNode } from "react";

/** Reserved tri-gradient frame — savings moment / primary conversion only. */
export function GradientCtaCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={className ?? "mt-12 rounded-2xl p-[1px] bg-[linear-gradient(105deg,#3fcb9b,#3ec6ff_55%,#8b5cf6)]"}>
      <div className="rounded-2xl bg-[#0a1119] px-6 py-7 text-center">{children}</div>
    </div>
  );
}
