import * as Sentry from "@sentry/nextjs";
import { baseSentryOptions } from "@/lib/observability/sentry";

/**
 * Client-side reporting.
 *
 * Session Replay is deliberately NOT enabled. It records the DOM, and this
 * product's DOM contains bank statements and case evidence — the single
 * richest source of exactly the data we promise never to hand to a third
 * party. The dead-button class of bug this was bought to catch shows up as a
 * caught exception and a breadcrumb trail without it.
 */
Sentry.init(baseSentryOptions());
