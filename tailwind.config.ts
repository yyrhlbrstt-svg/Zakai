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
