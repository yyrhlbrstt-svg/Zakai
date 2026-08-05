import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/api";
import { exportReceiptsCsv } from "@/lib/services/receipts";
import { rateLimit } from "@/lib/ratelimit";

export async function GET() {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;

  const limited = await rateLimit("receipts-export", auth.userId, 20, 3600);
  if (!limited.ok) {
    return NextResponse.json({ error: "tooManyRequests" }, { status: 429 });
  }

  const csv = await exportReceiptsCsv(auth.userId);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="zakai-receipts.csv"`,
    },
  });
}
