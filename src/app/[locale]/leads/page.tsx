import { redirect } from "@/i18n/routing";

/**
 * Folded into /founder — this page used to carry the full lead table while
 * /founder carried a 25-row preview of the same data, two half-built admin
 * views of one thing. /founder now has the full table (plus feedback, which
 * had no admin view at all). This redirect keeps old bookmarks working.
 */
export default async function LeadsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect({ href: "/founder", locale });
}
