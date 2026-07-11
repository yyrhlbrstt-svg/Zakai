import { defineRouting } from "next-intl/routing";
import { createNavigation } from "next-intl/navigation";
import { locales, defaultLocale } from "./config";

export const routing = defineRouting({
  locales,
  defaultLocale,
  // The default locale (Hebrew) is served without a prefix ("/"), other
  // locales are prefixed ("/en", "/ar", ...).
  localePrefix: "as-needed",
});

export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
