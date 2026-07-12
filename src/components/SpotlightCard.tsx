"use client";

import { useRef } from "react";
import { glass } from "./ui";

/**
 * A glass card with a subtle emerald spotlight that follows the cursor.
 * JS only writes the --mx/--my CSS variables; the glow itself is painted by the
 * compositor (see `.spotlight` in globals.css). No animation loop, no deps.
 */
export function SpotlightCard({
  className = "",
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  const ref = useRef<HTMLDivElement>(null);

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - r.left}px`);
    el.style.setProperty("--my", `${e.clientY - r.top}px`);
  }

  return (
    <div ref={ref} onMouseMove={onMove} className={`${glass} spotlight ${className}`} {...rest}>
      {children}
    </div>
  );
}
