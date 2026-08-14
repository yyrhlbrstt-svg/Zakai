/**
 * A small, shared icon set — replacing OS emoji in real interface copy.
 *
 * WHY THIS EXISTS
 *
 * "🔒 אנחנו לא מבקשים סיסמה לבנק" is a Slack message, not a product. An emoji
 * renders at whatever weight, size and color the reader's OS ships that week
 * — Apple's lock is a different shape from Android's, neither matches this
 * app's own stroke width, and every other icon here (the password eye toggle
 * in AuthForm) is already a deliberate 24×24, 1.8px stroke, round-cap line
 * icon. Mixing that with platform emoji is the single fastest tell that a
 * screen was assembled rather than designed.
 *
 * This is not an icon library. It holds exactly the icons currently used in
 * real, non-decorative copy — the ones a reader's eye actually stops on, not
 * every emoji anywhere in the codebase. Add to it deliberately, the same way
 * `AuthForm`'s eye icon was added: because a real line-icon replaced a real
 * emoji, not because a library should be complete.
 */
import type { SVGProps } from "react";

const base = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  "aria-hidden": true,
} satisfies SVGProps<SVGSVGElement>;

const stroke = {
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function IconLock(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <rect x="5" y="11" width="14" height="9" rx="2.2" {...stroke} />
      <path d="M8 11V7.5a4 4 0 0 1 8 0V11" {...stroke} />
    </svg>
  );
}

export function IconAlertTriangle(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M12 4 3 20h18L12 4Z" {...stroke} />
      <path d="M12 10.5v4" {...stroke} />
      <circle cx="12" cy="17.2" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconBell(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M6 10a6 6 0 0 1 12 0c0 4 1.5 5.5 2 6H4c0.5-0.5 2-2 2-6Z" {...stroke} />
      <path d="M10 19a2 2 0 0 0 4 0" {...stroke} />
    </svg>
  );
}

export function IconTarget(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="8" {...stroke} />
      <circle cx="12" cy="12" r="4.4" {...stroke} />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}
