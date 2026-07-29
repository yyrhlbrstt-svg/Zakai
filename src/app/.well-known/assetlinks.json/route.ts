import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Digital Asset Links — what makes a Play Store listing look like an app.
 *
 * A Trusted Web Activity is the supported way to ship a web app on Google Play:
 * the Android package is a thin shell around this site. Whether it *feels* like
 * an app turns on one thing — Chrome only hides the URL bar inside the shell
 * once the site and the package have each vouched for the other. The package
 * names the domain in its manifest; the domain names the package here.
 *
 * Without this file the app still installs and still works, and it shows a
 * browser address bar across the top of every screen. Reviewers read that as a
 * website in a wrapper, which is one of the more common reasons a TWA is
 * rejected, and users read it as not really being an app.
 *
 * WHY THE FINGERPRINT COMES FROM THE ENVIRONMENT
 *
 * It is the SHA-256 of the signing certificate, and it is not a secret — it is
 * published here, deliberately. But it differs between the upload key and the
 * key Play re-signs with, and between debug and release. Hardcoding one means
 * shipping a build whose URL bar quietly comes back, and nobody notices until a
 * user mentions it. Reading it from the environment makes that a deployment
 * setting rather than a code change.
 *
 * Take the value from Play Console → Setup → App integrity → App signing key
 * certificate. Not the upload key: Play re-signs, so the certificate users
 * actually receive is the one Play holds.
 */

const PACKAGE = process.env.ANDROID_PACKAGE_NAME || "app.zakai.twa";

/** Comma-separated, so an upload key and the Play signing key can coexist. */
function fingerprints(): string[] {
  return (process.env.ANDROID_CERT_FINGERPRINTS || "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((s) => /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(s));
}

export async function GET() {
  const certs = fingerprints();

  // An empty statement list is the honest answer before the app is signed, and
  // it is also a valid document — Chrome reads it, finds no match, and keeps
  // the URL bar. Emitting a placeholder fingerprint instead would produce a
  // file that looks configured and silently never matches.
  const body = certs.length
    ? [
        {
          relation: ["delegate_permission/common.handle_all_urls"],
          target: {
            namespace: "android_app",
            package_name: PACKAGE,
            sha256_cert_fingerprints: certs,
          },
        },
      ]
    : [];

  return NextResponse.json(body, {
    headers: {
      // Chrome caches this aggressively and a stale copy is why a correct
      // fingerprint appears not to work for hours after it is set.
      "Cache-Control": "public, max-age=300",
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
