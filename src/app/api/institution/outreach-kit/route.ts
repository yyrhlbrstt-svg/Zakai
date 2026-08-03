import { NextResponse } from "next/server";
import { cacheControlHeader } from "@/lib/scale/publicCache";

export const runtime = "nodejs";
export const revalidate = 300;

/**
 * Founder / BD one-pager for banks — copy-pasteable, no fake logos or traction.
 */
export async function GET(request: Request) {
  const origin = new URL(request.url).origin.replace(/\/+$/, "");
  const subject = encodeURIComponent("Zakai Mandate inbound pilot — 30 minutes, no sales call");
  const body = encodeURIComponent(
    [
      "Hi —",
      "",
      "Zakai publishes a Mandate inbound format banks can verify offline (Ed25519 JWKS).",
      "No outward money scopes. No callback team required.",
      "",
      `Pilot package (filled sample curl): ${origin}/api/institution/pilot-package?audience=YOUR_BANK_ID`,
      `Join kit: ${origin}/he/join-network`,
      `Wizard: ${origin}/he/institutions/leader`,
      "",
      "Leaders wall stays empty until you opt in — we do not invent partners.",
      "",
      "—",
    ].join("\n"),
  );

  return NextResponse.json(
    {
      spec: "zakai-institution-outreach-kit",
      version: "2026-08-03",
      honesty:
        "No claimed bank logos, win rates, or valuation. Use this to invite a real pilot.",
      ceo_priority: "G3 first reference verifier — before PayPlus / branded domain.",
      one_liner_he:
        "בנק יכול לאמת Mandate inbound ב-30 דק בלי שיחת מכירות — JWKS offline, בלי הוצאת כסף.",
      one_liner_en:
        "A bank can verify Mandate inbound in 30 minutes without a sales call — offline JWKS, no outward money.",
      mailto: `mailto:?subject=${subject}&body=${body}`,
      send_them: {
        join_network: `${origin}/he/join-network`,
        pilot_package: `${origin}/api/institution/pilot-package?audience=YOUR_BANK_ID`,
        wizard: `${origin}/he/institutions/leader`,
        inbound_spec: `${origin}/.well-known/zakai-inbound-receive.json`,
        ignore_cost: `${origin}/api/institution/ignore-cost`,
      },
      founder_checklist: [
        "Merge #71 and confirm /api/cdn/packs/il/index.json is 200",
        "Email 5 risk/ops contacts using mailto template above",
        "Walk first bank through wizard + pilot-package curl on a call-free path",
        "Only after G3: admit second issuer (G5), then chase volume",
      ],
    },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": cacheControlHeader("catalog"),
      },
    },
  );
}
