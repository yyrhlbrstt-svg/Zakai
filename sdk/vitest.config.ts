import { defineConfig } from "vitest/config";

export default defineConfig({
  // Prevent Vite from walking up to the Next app's postcss/tailwind config.
  root: import.meta.dirname,
  css: {
    postcss: {
      plugins: [],
    },
  },
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
  },
});
