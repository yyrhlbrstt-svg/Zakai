#!/usr/bin/env node
/**
 * Zero-friction Node gate — run from repo after `cd sdk && npm ci && npm run build`:
 *   node examples/ready.mjs
 *   node examples/ready.mjs --origin https://zakai-3uxj.vercel.app
 *
 * Prefer: npm run ready  (same gate, packaged bin)
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const bin = join(here, "..", "dist", "ready-bin.js");
const originIdx = process.argv.indexOf("--origin");
const args = originIdx >= 0 ? process.argv.slice(originIdx) : [];
const r = spawnSync(process.execPath, [bin, ...args], { stdio: "inherit" });
process.exit(r.status ?? 1);
