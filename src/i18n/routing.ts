import { defineRouting } from "next-intl/routing";
import { createNavigation } from "next-intl/navigation";
import { locales, defaultLocale } from "./config";

export const routing = defineRouting({
  locales,
  defaultLocale,
  // Every locale is prefixed, including the default ("/he", "/en", ...).
  // The bare domain ("/") is handled by the middleware with a real 307 redirect
  // to the default locale, so a user never has to type "/he" themselves.
  //
  // Why "always" and not "as-needed": with an unprefixed default locale, the
  // root "/" is served via an internal rewrite to the [locale] route. That
  // works under `next start`, but on Vercel the unprefixed default route has no
  // entry in the platform routing table, so "/" returns a platform-level 404.
  // "always" turns the root into a plain redirect to a route that genuinely
  // exists ("/he"), which is robust on Vercel.
  localePrefix: "always",
});

export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
