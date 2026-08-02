"use client";

import { useEffect, useState } from "react";

/** Shows live app version from /api/version (package.json), not a hardcoded label. */
export function FooterAppVersion() {
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/version")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { version?: string } | null) => {
        if (!cancelled && d?.version) setVersion(d.version);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!version) return null;
  return <span aria-label={`Version ${version}`}> · v{version}</span>;
}
