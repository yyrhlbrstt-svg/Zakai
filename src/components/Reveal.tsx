"use client";

import { useEffect, useRef } from "react";
import type { ElementType } from "react";

/**
 * Restrained scroll-reveal: a small fade + rise as the element enters the
 * viewport, via IntersectionObserver (never scroll listeners — those hurt INP).
 * The hidden state lives in CSS scoped to `.js .reveal`, so without JavaScript
 * content stays visible, and reduced-motion forces it visible too.
 */
export function Reveal({
  children,
  delay = 0,
  className = "",
  as: Tag = "div",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  /**
   * The element to render as. Defaults to a div, which is right almost
   * everywhere and wrong inside a list.
   *
   * Wrapping each `<li>` in a Reveal produced `<ol><div><li>` — which breaks
   * the list in both directions at once: the `<ol>` no longer directly
   * contains list items, and the `<li>` is no longer inside a list. A screen
   * reader stops announcing "list, five items" entirely, so somebody who
   * cannot see the numbered circles loses the count and the ordering — on
   * pages whose whole content is a numbered sequence of steps to claim money.
   * `<Reveal as="li">` keeps the animation and the semantics.
   */
  as?: ElementType;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      el.classList.add("is-visible");
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            el.classList.add("is-visible");
            io.unobserve(el);
          }
        }
      },
      { threshold: 0.05, rootMargin: "0px 0px 80px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      className={`reveal ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </Tag>
  );
}
