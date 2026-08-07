import type { Config } from "tailwindcss";

/**
 * Design language: "relief, not celebration".
 * Calm dark canvas, a single restrained gradient for the moment of savings,
 * a display face reserved for the number that is the star of the screen.
 */
const config: Config = {
  content: [
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#070B12",
        surface: "rgba(255,255,255,0.045)",
        "surface-border": "rgba(255,255,255,0.09)",
        ink: "#F2F6F5",
        "ink-soft": "#93A6A5",
        emerald: "#2CE5A7",
        cyan: "#3EC6FF",
        violet: "#8B5CF6",
        amber: "#F0B45C",
        danger: "#F08A6B",
      },
      fontFamily: {
        display: ["var(--font-display)", "serif"],
        body: ["var(--font-body)", "sans-serif"],
      },
      /**
       * The type scale.
       *
       * WHY THIS EXISTS
       *
       * There was no scale. Every size in the product was written as an
       * arbitrary bracket value, and they accreted into **28 distinct sizes**
       * across 2,104 usages — including half-pixel steps: 12px, 12.5px, 13px
       * and 13.5px all in use, together, hundreds of times each.
       *
       * Sizes that close together do not read as deliberate; they read as
       * noise. Hierarchy is what tells a reader where to look, and hierarchy
       * needs visible distance between steps. Four sizes inside a two-pixel
       * band produce no hierarchy at all — just a page that feels vaguely
       * unresolved without anyone being able to say why.
       *
       * So: eleven steps with real distance between them, each paired with a
       * line-height chosen for its size (tight for display, generous for the
       * body copy people actually read). Named, so the intent survives — a
       * future reader sees `text-body` and knows it was a decision, where
       * `text-[13.5px]` only ever recorded a nudge.
       *
       * These are additive. Existing bracket values keep working; a ratchet
       * (`src/lib/typeScale.test.ts`) stops the count from growing while the
       * migration happens screen by screen, which is the only way to move
       * 2,104 call sites without a rewrite nobody can review.
       */
      fontSize: {
        micro: ["11px", { lineHeight: "1.45" }], // legal lines, timestamps
        caption: ["12px", { lineHeight: "1.5" }], // hints, secondary labels
        body: ["13px", { lineHeight: "1.6" }], // the workhorse
        "body-lg": ["14px", { lineHeight: "1.6" }], // comfortable reading
        lead: ["15px", { lineHeight: "1.55" }], // intros, emphasised body
        title: ["17px", { lineHeight: "1.4" }], // card and section titles
        h4: ["19px", { lineHeight: "1.35" }],
        h3: ["22px", { lineHeight: "1.3" }],
        h2: ["27px", { lineHeight: "1.22" }],
        h1: ["32px", { lineHeight: "1.15" }],
        hero: ["40px", { lineHeight: "1.05", letterSpacing: "-0.02em" }],
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        spin: { to: { transform: "rotate(360deg)" } },
      },
      animation: {
        fadeUp: "fadeUp 600ms cubic-bezier(0.16,1,0.3,1) both",
        spin: "spin 0.85s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
