"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Card, Button } from "@/components/ui";

/**
 * The MCP server has worked for a while — four tools, stateless JSON-RPC —
 * and nothing in the product ever told a human it existed or how to reach it.
 * "Nobody knows what the infrastructure does" is not a gap in the
 * infrastructure; it is a gap in the one paragraph that hands somebody the
 * URL. This is that paragraph, with the line they paste.
 */
const TOOLS = [
  { name: "check_rights", key: "toolCheckRights" },
  { name: "counterparty_playbook", key: "toolPlaybook" },
  { name: "start_claim", key: "toolStartClaim" },
  { name: "protocol_status", key: "toolStatus" },
] as const;

export function McpConnectCard({ origin }: { origin: string }) {
  const t = useTranslations("mcpConnect");
  const [copied, setCopied] = useState(false);
  const snippet = `{
  "mcpServers": {
    "zakai": { "url": "${origin}/api/mcp" }
  }
}`;

  return (
    <Card className="p-6 mb-4 border-[rgba(62,198,255,0.4)] bg-[rgba(62,198,255,0.06)]">
      <h2 className="font-display text-h4 mt-0 mb-2">{t("title")}</h2>
      <p className="text-ink-soft text-body leading-relaxed mt-0 mb-3">{t("intro")}</p>
      <pre
        dir="ltr"
        className="overflow-x-auto rounded-xl border border-[rgba(255,255,255,0.1)] bg-[rgba(0,0,0,0.28)] p-3.5 text-caption leading-relaxed m-0"
      >
        {snippet}
      </pre>
      <Button
        variant="ghost"
        className="mt-3"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(snippet);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            // Clipboard refusals are common enough that silence would make
            // this button look broken; the block above stays selectable.
            setCopied(false);
          }
        }}
      >
        {copied ? t("copied") : t("copy")}
      </Button>
      <ul className="list-none p-0 mt-4 mb-0 flex flex-col gap-2">
        {TOOLS.map((tool) => (
          <li key={tool.name} className="text-caption text-ink-soft leading-relaxed">
            <code dir="ltr" className="text-cyan font-bold">
              {tool.name}
            </code>{" "}
            — {t(tool.key)}
          </li>
        ))}
      </ul>
    </Card>
  );
}
