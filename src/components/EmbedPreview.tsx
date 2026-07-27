"use client";

import { useEffect } from "react";

/** Mounts public/embed.js into a host node for the partners docs page. */
export function EmbedPreview({ locale }: { locale: string }) {
  useEffect(() => {
    const existing = document.querySelector('script[data-zakai-embed-loader]');
    if (existing) {
      // Re-run mount if script already present
      const ev = new Event("DOMContentLoaded");
      document.dispatchEvent(ev);
      return;
    }
    const s = document.createElement("script");
    s.src = "/embed.js";
    s.async = true;
    s.setAttribute("data-zakai-embed-loader", "1");
    document.body.appendChild(s);
  }, []);

  return (
    <div
      id="zakai-embed"
      data-locale={locale}
      data-ref="partners-preview"
      className="min-h-[120px]"
    />
  );
}
