import type { ReactNode } from "react";
import { PageKicker } from "@/components/PageKicker";

const WIDTH = {
  default: "max-w-[760px]",
  wide: "max-w-[900px]",
  narrow: "max-w-[640px]",
} as const;

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
  width = "default",
  heroGlow = false,
  dir,
}: {
  kicker?: string;
  title: string;
  sub: string;
  cite?: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Override default max width (e.g. bank-fees grids). */
  className?: string;
  width?: keyof typeof WIDTH;
  /** Soft emerald ambient behind the hero — marketing pages only. */
  heroGlow?: boolean;
  dir?: "ltr" | "rtl";
}) {
  return (
    <div className={heroGlow ? "page-hero-wrap" : undefined} dir={dir}>
      {heroGlow && <div className="page-hero-glow" aria-hidden />}
      <main className={className ?? `${WIDTH[width]} mx-auto px-5 pb-24 pt-3 relative`}>
        {kicker && <PageKicker>{kicker}</PageKicker>}
        <h1 className="font-display text-[clamp(28px,5vw,40px)] leading-[1.12] m-0 text-balance tracking-[-0.02em]">{title}</h1>
        <p className="text-ink-soft text-[15.5px] leading-relaxed mt-3.5 mb-2 max-w-[600px]">{sub}</p>
        {cite && <p className="text-[12.5px] text-ink-soft mb-7 max-w-[600px]">{cite}</p>}
        {!cite && <div className="mb-7" />}
        {children}
        {footer}
      </main>
    </div>
  );
}
