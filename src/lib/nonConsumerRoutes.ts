/**
 * Routes nobody browses casually while a case is open — admin, protocol and
 * institutional surfaces, not consumer tool pages.
 *
 * WHY THIS EXISTS
 *
 * `OpenLoopResumeBar` — "you have an open case, here's how to finish it" —
 * was hidden on exactly two routes, `/dashboard` and `/money`, because those
 * two already show the loop status themselves. Everywhere else was assumed
 * to be "some consumer tool page a logged-in user might be browsing," which
 * was true when the bar was built.
 *
 * It stopped being true. The founder reached `/founder` — his own
 * ADMIN_EMAIL-gated ops dashboard, dense with release-gate scores and
 * `gravity_tier` shorthand, never meant for a consumer's eyes — with the
 * resume pill for an unrelated open case still pinned over it. Two screens
 * that share nothing read as one broken one.
 *
 * The failure wasn't really "the pill is on the wrong page." It's that the
 * two-route denylist could never have caught this: every internal page this
 * product has shipped since — `/network-proof`, `/registry`, `/protocol`,
 * `/institutions`, and the rest below — was added without anyone touching
 * that list, because nothing prompted them to. A denylist only grows when
 * someone remembers to grow it, and the whole point of this file is to be
 * the one place that has to be remembered.
 *
 * WHAT DOES NOT BELONG HERE
 *
 * A route the classification was actually wrong about costs more than one
 * left off. `/authority` — a logged-in consumer's own list of authorizations
 * — looks administrative by name and was checked directly (it 302s an
 * anonymous visitor to `/login?return=/authority`, exactly like a consumer
 * page does) before being kept out of this list. When in doubt, leave the
 * bar showing: an unnecessary nudge on a page it doesn't quite fit is a
 * minor miss, and this file existing at all is what makes the next such page
 * a one-line addition instead of a repeat of the `/founder` screenshot.
 */
export const NON_CONSUMER_ROUTES: readonly string[] = [
  "/founder", // ADMIN_EMAIL-gated ops dashboard
  "/network-proof", // public institutional trust ledger
  "/protocol", // Mandate protocol manifest / dev docs
  "/registry", // delegated-issuer registry
  "/pipe", // protocol pipe manifest
  "/trust", // trust registry page
  "/standard", // protocol standard docs
  "/institutions", // institutional landing
  "/partners", // B2B partner integration
  "/integrations", // institutional integration guide
  "/agents", // AI-agent developer docs
  "/domains", // internal monopoly-domain tracking
  "/status", // system status page
  "/fairness-certified", // institutional certification program
];
