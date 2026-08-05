import "server-only";

import { prisma } from "@/lib/prisma";
import {
  collectPackHttpSources,
  fetchSourceBody,
  hashContent,
  similarityRatio,
} from "../lawWatcher";
import type { AutopilotFinding } from "../findings";

const MAX_SOURCES_PER_RUN = 12;

export async function runLawWatcher(): Promise<{
  ok: boolean;
  summary: string;
  findings: AutopilotFinding[];
}> {
  const sources = collectPackHttpSources().slice(0, MAX_SOURCES_PER_RUN);
  const findings: AutopilotFinding[] = [];
  let checked = 0;
  let changed = 0;

  for (const ref of sources) {
    const body = await fetchSourceBody(ref.source);
    if (!body) {
      findings.push({
        kind: "law_source_fetch_failed",
        severity: "note",
        message: `Could not fetch ${ref.source}`,
        meta: { ...ref } as Record<string, unknown>,
      });
      continue;
    }
    checked++;
    const hash = hashContent(body);

    const prev = await prisma.autopilotSourceSnapshot.findUnique({
      where: { sourceUrl: ref.source },
    });

    if (!prev) {
      await prisma.autopilotSourceSnapshot.create({
        data: {
          sourceUrl: ref.source,
          market: ref.market,
          rightId: ref.rightId,
          contentHash: hash,
        },
      });
      continue;
    }

    if (prev.contentHash === hash) continue;

    changed++;
    const oldBody = prev.lastSnippet ?? "";
    const sim = oldBody ? similarityRatio(oldBody, body.slice(0, 20_000)) : 0;

    await prisma.autopilotSourceSnapshot.update({
      where: { sourceUrl: ref.source },
      data: {
        contentHash: hash,
        market: ref.market,
        rightId: ref.rightId,
        lastSnippet: body.slice(0, 20_000),
        lastChangedAt: new Date(),
      },
    });

    findings.push({
      kind: "law_source_changed",
      severity: sim < 0.8 ? "critical" : "warning",
      message: `Source changed for ${ref.rightId} (${ref.market})`,
      meta: { ...ref, similarity: sim, sourceUrl: ref.source },
    });

    await maybeOpenMaintainerTask(ref, sim);
  }

  return {
    ok: true,
    summary: `Law Watcher: checked ${checked}/${sources.length}, ${changed} change(s).`,
    findings,
  };
}

async function maybeOpenMaintainerTask(
  ref: { market: string; rightId: string; source: string },
  similarity: number,
): Promise<void> {
  const token = process.env.GITHUB_TOKEN?.trim();
  const repo = process.env.AUTOPILOT_GITHUB_REPO?.trim(); // owner/zakai-packs
  if (!token || !repo) return;

  const title = `[law-watcher] ${ref.market}/${ref.rightId} source may have changed`;
  const body = `Automated Law Watcher detected a content change.

- Market: ${ref.market}
- Right: ${ref.rightId}
- Source: ${ref.source}
- Similarity to previous snapshot: ${(similarity * 100).toFixed(1)}%

Human maintainer must verify and update ZML in \`zakai-packs\`. Zakai does not auto-merge legal text.`;

  await fetch(`https://api.github.com/repos/${repo}/issues`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ title, body, labels: ["law-watcher", "autopilot"] }),
  }).catch(() => undefined);
}
