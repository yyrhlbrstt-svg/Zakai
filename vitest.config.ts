import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

// The `*.integration.test.ts` suites talk to the real database, so they need the
// same connection variables the app uses. Vitest does not read .env files on its
// own, so load them here — the project-local file first, then the sandbox-wide
// copy — without overwriting anything already exported in the shell.
for (const envFile of [".env.development.local", "/vercel/share/.env.project"]) {
  const path = envFile.startsWith("/")
    ? envFile
    : fileURLToPath(new URL(envFile, import.meta.url));
  if (existsSync(path)) {
    try {
      process.loadEnvFile(path);
    } catch {
      // A malformed/unreadable env file must not stop the pure unit tests.
    }
  }
}

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // `server-only` is a guard for the RSC bundler; stub it out under vitest.
      "server-only": fileURLToPath(new URL("./src/test/server-only-stub.ts", import.meta.url)),
    },
  },
});
