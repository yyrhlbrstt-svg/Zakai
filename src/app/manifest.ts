import type { MetadataRoute } from "next";

/**
 * PWA manifest — makes Zakai installable on the phone home screen
 * ("הוספה למסך הבית"). Standalone display hides the browser chrome so it
 * feels like a native app; Hebrew, RTL, brand colors.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "זכאי — הכסף שמגיע לך חוזר אליך",
    short_name: "זכאי",
    description:
      "סוכן דיגיטלי שבודק את החשבונות שלך, פועל בשמך מול הספקים, וגובה עמלה רק על חיסכון מתועד.",
    id: "/he",
    start_url: "/he",
    display: "standalone",
    dir: "rtl",
    lang: "he",
    background_color: "#070B12",
    theme_color: "#070B12",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
