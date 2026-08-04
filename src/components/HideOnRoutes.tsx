"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** Client gate so sticky chrome does not compete with pages that already own the CTA. */
export function HideOnRoutes({
  substrings,
  children,
}: {
  substrings: string[];
  children: ReactNode;
}) {
  const pathname = usePathname() ?? "";
  if (substrings.some((s) => pathname.includes(s))) return null;
  return <>{children}</>;
}
