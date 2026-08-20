import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { toVisualIfRtl } from "@/lib/ogBidi";

/**
 * Dynamic share-card image — the difference between a share landing as a bare
 * WhatsApp text link and a rich preview card with the actual amount on it.
 * Node runtime (not edge) so the bundled Hebrew font can be read straight off
 * disk with Vercel's normal file tracing, instead of fetching Google Fonts at
 * request time and having every share silently degrade to tofu if that ever
 * fails or changes shape.
 */
export const runtime = "nodejs";

const RTL_LOCALES = new Set(["he", "ar"]);

let fontDataPromise: Promise<Buffer> | null = null;
function loadFont() {
  if (!fontDataPromise) {
    fontDataPromise = readFile(join(process.cwd(), "src/app/api/og/fonts/heebo-800.ttf"));
  }
  return fontDataPromise;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const locale = searchParams.get("locale") || "he";
  const rtl = RTL_LOCALES.has(locale);
  // Satori draws logical order LTR (no bidi) — convert RTL strings to
  // visual order or every Hebrew share card renders its text reversed.
  const amount = toVisualIfRtl((searchParams.get("amount") || "").slice(0, 40));
  const kicker = toVisualIfRtl((searchParams.get("kicker") || "Zakai").slice(0, 60));
  const sub = toVisualIfRtl((searchParams.get("sub") || "").slice(0, 90));

  const fontData = await loadFont();

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#06121A",
          backgroundImage:
            "radial-gradient(circle at 50% 0%, rgba(63,203,155,0.22) 0%, rgba(6,18,26,0) 55%)",
          fontFamily: "Heebo",
          direction: rtl ? "rtl" : "ltr",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 34,
            fontWeight: 800,
            color: "#3FCB9B",
            letterSpacing: -0.5,
            marginBottom: 18,
          }}
        >
          {kicker}
        </div>
        {amount && (
          <div
            style={{
              display: "flex",
              fontSize: 148,
              fontWeight: 800,
              color: "#F4FBFA",
              lineHeight: 1,
              marginBottom: 22,
            }}
          >
            {amount}
          </div>
        )}
        {sub && (
          <div
            style={{
              display: "flex",
              fontSize: 30,
              fontWeight: 800,
              color: "rgba(244,251,250,0.7)",
              maxWidth: "900px",
              textAlign: "center",
            }}
          >
            {sub}
          </div>
        )}
        <div
          style={{
            display: "flex",
            position: "absolute",
            bottom: 40,
            fontSize: 26,
            fontWeight: 800,
            color: "rgba(244,251,250,0.55)",
          }}
        >
          zakai-3uxj.vercel.app
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [{ name: "Heebo", data: fontData, style: "normal", weight: 800 }],
    },
  );
}
