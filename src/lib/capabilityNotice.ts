/**
 * When the agent cannot act, say so — and hand over the route that works.
 *
 * WHY THIS EXISTS
 *
 * With no SMTP configured, "send via Zakai" writes an Outbox row that stays
 * QUEUED forever. The screen looks like it worked. Nothing leaves. The reader
 * waits for a reply that was never sent, and eventually concludes the product
 * does nothing.
 *
 * That is also what an outside reviewer concluded from the UI — "a directory
 * of tools, not an agent" — while the dispatch service, the inbound webhook,
 * the vision OCR and the verification page were all sitting in the codebase,
 * built and unreachable. When the agent cannot execute, it is invisible, and
 * silence reads as absence.
 *
 * A product that admits "automatic sending is off right now — here is the
 * letter, send it from your own mail, then paste me the reply" is behaving
 * like an agent. A screen that quietly does nothing is a brochure.
 *
 * WHAT THIS IS NOT
 *
 * Not an error, and not an apology. The capability being off is a fact about
 * this deployment, and the person on the other side needs one thing from it:
 * what to do instead. Every notice therefore carries an alternative, and a
 * notice with no alternative is not emitted at all — a dead end announced is
 * still a dead end.
 *
 * Copy lives in the message catalogues; this returns keys. Nothing here can
 * invent a sentence.
 */

export interface Capabilities {
  /** Outbound mail actually works — see smtpFullyConfigured(). */
  mail: boolean;
  /** An AI provider is configured — see aiAvailable(). */
  ai: boolean;
}

export type NoticeId = "mailOff" | "aiOff";

export interface CapabilityNotice {
  id: NoticeId;
  /** i18n key for what cannot happen right now. */
  headlineKey: string;
  /** i18n key for the route that does work. Never absent. */
  alternativeKey: string;
  /**
   * Where the alternative lives, when it is a different screen. Null when the
   * alternative is right here — most of the time it is, and sending someone
   * away from a working control is worse than pointing at it.
   */
  href: string | null;
  /**
   * "blocking" stops the advertised path entirely; "degraded" means it still
   * works, just less well. Callers style them differently, and conflating them
   * either alarms people needlessly or hides a real dead end.
   */
  severity: "blocking" | "degraded";
}

const NOTICES: Record<NoticeId, Omit<CapabilityNotice, "id">> = {
  mailOff: {
    headlineKey: "capability.mailOff.headline",
    alternativeKey: "capability.mailOff.alternative",
    href: null,
    severity: "blocking",
  },
  aiOff: {
    // Manual entry is a complete path, not a consolation prize: it produces
    // exactly the same case, letter and mandate.
    headlineKey: "capability.aiOff.headline",
    alternativeKey: "capability.aiOff.alternative",
    href: null,
    severity: "degraded",
  },
};

/**
 * Everything this deployment cannot currently do, worst first.
 *
 * Returns an empty array when everything works — the common case in a healthy
 * production, and the reason nothing renders there.
 */
export function capabilityNotices(caps: Capabilities): CapabilityNotice[] {
  const out: CapabilityNotice[] = [];
  if (!caps.mail) out.push({ id: "mailOff", ...NOTICES.mailOff });
  if (!caps.ai) out.push({ id: "aiOff", ...NOTICES.aiOff });

  return out.sort((a, b) =>
    a.severity === b.severity ? 0 : a.severity === "blocking" ? -1 : 1,
  );
}

/**
 * The single notice worth putting at the top of a screen.
 *
 * Stacking every limitation turns a page into a wall of warnings that people
 * learn to scroll past, which costs more than it saves. One, or none.
 */
export function primaryNotice(caps: Capabilities): CapabilityNotice | null {
  return capabilityNotices(caps)[0] ?? null;
}

/** True when the agent can carry a case all the way to a provider itself. */
export function agentCanDeliver(caps: Capabilities): boolean {
  return caps.mail;
}
