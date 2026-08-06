/**
 * Branded HTML wrapper for outgoing letters — a thin visual frame around the
 * exact plain-text body that was already built (letters, verification
 * codes, notifications). Never rewords or restyles the letter itself: these
 * are legal correspondence sent under Mandate, and the letter's content is
 * the person's own words, not marketing copy (see letterFooter.ts). The
 * wrapper adds only what a human reader needs to recognize the email
 * visually — the Zakai mark and a thin accent line — nothing that changes
 * who the letter is legally from.
 *
 * Sent as the `html` alternative alongside the existing `text` body, so
 * every email client that can render HTML shows this, and every client that
 * can't (or a user who reads plain text on principle) still gets the exact
 * same words.
 */

const DEFAULT_ORIGIN = "https://zakai-3uxj.vercel.app";

function origin(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || DEFAULT_ORIGIN).replace(/\/$/, "");
}

const HEBREW_RE = /[֐-׿]/;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildBrandedEmailHtml(subject: string, body: string): string {
  const dir = HEBREW_RE.test(body) ? "rtl" : "ltr";
  const align = dir === "rtl" ? "right" : "left";
  const site = origin();
  const logoUrl = `${site}/icons/icon-192.png`;
  const siteLabel = site.replace(/^https?:\/\//, "");
  const safeBody = escapeHtml(body);
  const safeSubject = escapeHtml(subject);

  return `<!doctype html>
<html dir="${dir}" lang="${dir === "rtl" ? "he" : "en"}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${safeSubject}</title>
</head>
<body style="margin:0;padding:0;background:#eef2f1;font-family:Arial,Helvetica,sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:28px 16px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e2e8e6;">
    <tr>
      <td style="height:4px;background:linear-gradient(90deg,#3fcb9b,#3ec6ff 55%,#8b5cf6);line-height:4px;font-size:0;">&nbsp;</td>
    </tr>
    <tr>
      <td style="padding:22px 28px 6px;text-align:${align};">
        <img src="${logoUrl}" width="28" height="28" alt="Zakai" style="border-radius:7px;vertical-align:middle;" />
        <span style="font-size:15px;font-weight:800;color:#0b1512;vertical-align:middle;margin-inline-start:8px;">Zakai · זכאי</span>
      </td>
    </tr>
    <tr>
      <td style="padding:14px 28px 4px;text-align:${align};">
        <p style="margin:0;font-size:13px;font-weight:800;color:#3fa383;text-transform:uppercase;letter-spacing:0.03em;">${safeSubject}</p>
      </td>
    </tr>
    <tr>
      <td style="padding:10px 28px 26px;text-align:${align};direction:${dir};">
        <div style="white-space:pre-wrap;font-size:14.5px;line-height:1.7;color:#1a2624;">${safeBody}</div>
      </td>
    </tr>
    <tr>
      <td style="padding:16px 28px;border-top:1px solid #eef2f1;text-align:${align};">
        <p style="margin:0;font-size:11.5px;color:#7c8a88;line-height:1.6;">
          ${dir === "rtl" ? `נשלח באמצעות זכאי (${siteLabel}) — סוכן כסף צרכני עם הרשאה חתומה (Mandate).` : `Sent via Zakai (${siteLabel}) — a consumer money agent acting under a signed Mandate.`}
        </p>
      </td>
    </tr>
  </table>
</div>
</body>
</html>`;
}
