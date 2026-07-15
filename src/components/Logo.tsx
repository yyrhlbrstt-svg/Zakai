/**
 * Zakai brand marks.
 *
 * - `Logo`: the "ZAKAI" wordmark (Manrope 800) over a thin arc that hints at a
 *   "return" motion — the primary logo. Emerald #3FCB9B on dark, #0EA372 on light.
 * - `LogoMark`: a geometric "Z" monogram in a rounded square — for small places
 *   (favicon, app icon). Colour is fixed by the mark itself.
 *
 * Shapes are taken verbatim from the brand spec; only sizing/colour are wired.
 */

export function Logo({
  tone = "dark",
  className = "",
  height = 22,
}: {
  tone?: "dark" | "light";
  className?: string;
  height?: number;
}) {
  const color = tone === "light" ? "#0EA372" : "#3FCB9B";
  return (
    <span
      className={`inline-flex flex-col items-center leading-none select-none ${className}`}
      style={{ color }}
      aria-label="ZAKAI"
      role="img"
      dir="ltr"
    >
      <span
        style={{
          fontFamily: "var(--font-wordmark), system-ui, sans-serif",
          fontWeight: 800,
          letterSpacing: "0.16em",
          fontSize: height,
          lineHeight: 1,
        }}
      >
        ZAKAI
      </span>
      <svg
        viewBox="0 0 200 26"
        width="100%"
        height={height * 0.34}
        preserveAspectRatio="none"
        aria-hidden
        style={{ display: "block", marginTop: height * 0.12 }}
      >
        <path
          d="M 8 6 C 60 34, 140 34, 192 6"
          fill="none"
          stroke="currentColor"
          strokeWidth={6}
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

export function LogoMark({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 110 110"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="Zakai"
    >
      <rect x="4" y="4" width="102" height="102" rx="26" fill="#3FCB9B" />
      <path
        d="M 32 34 H 78 L 34 76 H 80"
        fill="none"
        stroke="#0E1F1A"
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
