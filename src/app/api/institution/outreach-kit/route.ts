import { NextResponse } from "next/server";
import { cacheControlHeader } from "@/lib/scale/publicCache";
import { institutionSalesEmail, institutionPilotMailto } from "@/lib/institutionPull";

export const runtime = "nodejs";
export const revalidate = 300;

/**
 * Pull kit — how institutions email Zakai (and how founder replies).
 * Not a cold-email blast list.
 */
export async function GET(request: Request) {
  const origin = new URL(request.url).origin.replace(/\/+$/, "");
  const sales = institutionSalesEmail();

  return NextResponse.json(
    {
      spec: "zakai-institution-pull-kit",
      version: "2026-08-03",
      thesis:
        "Do not cold-email banks. Create desk volume + public rails so risk/ops email you. This kit is for inbound replies and self-serve magnets.",
      honesty: "No claimed logos, win rates, or valuation.",
      how_they_find_you: [
        "Letter/email footers on every consumer SENT case → /institutions + sales inbox",
        "LLM/agent discovery via llms.txt + /agents handoff",
        "Empty Pioneer wall FOMO + consumer «ask your bank» mailto",
        "ROI calculator mailto with their own numbers",
      ],
      public_inbox: sales,
      they_email_you_via: institutionPilotMailto(),
      send_them_when_they_ask: {
        join_network: `${origin}/he/join-network`,
        pilot_package: `${origin}/api/institution/pilot-package?audience=YOUR_BANK_ID`,
        wizard: `${origin}/he/institutions/leader`,
        inbound_spec: `${origin}/.well-known/zakai-inbound-receive.json`,
        ignore_cost: `${origin}/api/institution/ignore-cost`,
      },
      founder_pull_checklist: [
        "Merge #71 — packs CDN + footers live in production",
        "Drive real SENT volume on bank-fees / telecom (creates ignore-cost)",
        "Keep leaders wall empty until a real opt-in — scarcity is the FOMO",
        "When a bank emails: reply with pilot-package?audience=their-slug only",
        "Phase D (PayPlus) after G3, not before",
      ],
      doctrine: "docs/INSTITUTIONAL_PULL.md",
    },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": cacheControlHeader("catalog"),
      },
    },
  );
}
