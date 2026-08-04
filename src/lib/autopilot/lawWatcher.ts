import { createHash } from "node:crypto";
import { allMarkets } from "@/lib/global/registry";

export interface PackSourceRef {
  market: string;
  rightId: string;
  source: string;
}

const URL_RE = /^https?:\/\//i;

/** HTTP(S) citations from built-in jurisdiction packs — candidates for Law Watcher. */
export function collectPackHttpSources(): PackSourceRef[] {
  const out: PackSourceRef[] = [];
  for (const m of allMarkets()) {
    for (const r of m.pack.rights) {
      const src = r.source?.trim() ?? "";
      if (URL_RE.test(src)) {
        out.push({ market: m.code, rightId: r.id, source: src });
      }
    }
  }
  return out;
}

export function hashContent(text: string): string {
  const normalized = text.replace(/\s+/g, " ").trim().slice(0, 80_000);
  return createHash("sha256").update(normalized, "utf8").digest("hex");
}

export async function fetchSourceBody(url: string, timeoutMs = 15_000): Promise<string | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": "Zakai-LawWatcher/1.0 (+https://zakai.io)" },
      redirect: "follow",
    });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("text") && !ct.includes("html") && !ct.includes("json")) {
      return null;
    }
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

export function similarityRatio(a: string, b: string): number {
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;
  const longer = a.length >= b.length ? a : b;
  const shorter = a.length >= b.length ? b : a;
  if (longer.includes(shorter)) return shorter.length / longer.length;
  return 0;
}
