import { providerHebrewName } from "@/lib/providers";
import { institutionPullFooterLine, institutionSalesEmail } from "@/lib/institutionPull";
import { FOUNDER_EMAIL } from "@/lib/contact";

/**
 * Single source of truth for the printable Mandate document (HTML).
 * Used by: /api/authorization/[code]/pdf, email attachment on first send
 * and agent follow-up rounds. No external assets — opens offline / prints to PDF.
 */

export interface MandateDocInput {
  code: string;
  principalName: string;
  /** Masked or full — caller decides what is safe for the audience. */
  principalContact: string;
  provider: string;
  scope: string;
  issuedAt: Date | string;
  status: string;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderMandateHtml(auth: MandateDocInput): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://zakai-3uxj.vercel.app";
  const verifyUrl = `${appUrl}/verify?code=${auth.code}`;
  const active = auth.status === "ACTIVE";
  const issued = new Date(auth.issuedAt).toLocaleString("he-IL", {
    dateStyle: "long",
    timeStyle: "short",
  });
  const providerName = providerHebrewName(auth.provider);

  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>ייפוי כוח — זכאי ${esc(auth.code)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: "Segoe UI", "Arial", "Helvetica Neue", sans-serif;
    background: #f0f2f5;
    color: #0d1622;
    line-height: 1.55;
    padding: 24px 16px;
  }
  .sheet {
    max-width: 720px;
    margin: 0 auto;
    background: #fff;
    border-radius: 16px;
    padding: 40px 36px;
    box-shadow: 0 12px 40px rgba(0,0,0,0.12);
  }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 2px solid #0d1622;
    padding-bottom: 16px;
    margin-bottom: 24px;
    gap: 16px;
    flex-wrap: wrap;
  }
  .brand { font-size: 14px; font-weight: 800; letter-spacing: 0.04em; color: #0a5b8a; }
  .title { font-size: 22px; font-weight: 800; margin-top: 6px; }
  .subtitle { font-size: 13px; color: #5a6b6a; margin-top: 4px; }
  .badge {
    font-size: 12px;
    font-weight: 800;
    border-radius: 999px;
    padding: 4px 12px;
    white-space: nowrap;
  }
  .badge-active { color: #0a7a52; background: #d6f7ea; border: 1px solid #0a7a52; }
  .badge-revoked { color: #a3341f; background: #fbe2da; border: 1px solid #a3341f; }
  .row {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 0;
    border-bottom: 1px solid #e2e8e7;
    font-size: 15px;
  }
  .row .label { color: #5a6b6a; font-size: 13px; }
  .row .value { font-weight: 700; text-align: start; }
  .section { margin-top: 24px; }
  .section h2 { font-size: 16px; font-weight: 800; margin-bottom: 6px; }
  .section p { font-size: 14.5px; }
  .disclosure {
    margin-top: 20px;
    background: #f2f6f5;
    border-radius: 12px;
    padding: 14px 16px;
    font-size: 13.5px;
  }
  .verify {
    margin-top: 24px;
    border-top: 1px solid #c9d3d2;
    padding-top: 18px;
  }
  .verify .code {
    font-size: 18px;
    font-weight: 800;
    letter-spacing: 0.08em;
  }
  .verify a { color: #0a5b8a; font-weight: 700; word-break: break-all; }
  .footer {
    margin-top: 28px;
    font-size: 11px;
    color: #8a9a99;
    text-align: center;
  }
  @media print {
    body { background: #fff; padding: 0; }
    .sheet { box-shadow: none; border-radius: 0; padding: 12mm; max-width: none; }
  }
</style>
</head>
<body>
  <div class="sheet">
    <div class="header">
      <div>
        <div class="brand">זכאי · Zakai</div>
        <div class="title">ייפוי כוח לפעולה מול ספק</div>
        <div class="subtitle">מסמך הרשאה — שירות זכאי</div>
      </div>
      <div class="badge ${active ? "badge-active" : "badge-revoked"}">
        סטטוס: ${active ? "בתוקף" : "בוטל"}
      </div>
    </div>

    <div class="row">
      <span class="label">הממנה (הלקוח)</span>
      <span class="value">${esc(auth.principalName)} · ${esc(auth.principalContact)}</span>
    </div>
    <div class="row">
      <span class="label">מיופה הכוח</span>
      <span class="value">זכאי — שירות סוכן דיגיטלי אוטומטי</span>
    </div>
    <div class="row">
      <span class="label">הספק</span>
      <span class="value">${esc(providerName)}</span>
    </div>
    <div class="row">
      <span class="label">הופק בתאריך</span>
      <span class="value">${esc(issued)}</span>
    </div>

    <div class="section">
      <h2>היקף ההרשאה</h2>
      <p>${esc(auth.scope)}</p>
    </div>

    <div class="disclosure">
      זכאי הוא סוכן דיגיטלי אוטומטי הפועל מטעם הלקוח. זכאי אינו מתחזה ללקוח.
      הספק מוזמן ליצור קשר עם הלקוח ישירות בפרטים המופיעים במסמך.
    </div>

    <div class="verify">
      <h2 style="font-size:15px;font-weight:800;margin-bottom:6px">אימות מול הספק</h2>
      <p style="font-size:13.5px;margin-bottom:10px">
        כדי לוודא שמסמך זה אמיתי ובתוקף, היכנס לכתובת הבאה והזן את קוד האימות:
      </p>
      <div style="margin-bottom:6px">
        <span style="color:#5a6b6a;font-size:13px">קוד אימות: </span>
        <span class="code">${esc(auth.code)}</span>
      </div>
      <a href="${esc(verifyUrl)}">${esc(verifyUrl)}</a>
    </div>

    <div class="footer">
      מסמך זה הופק אוטומטית על ידי זכאי · ${esc(appUrl)}<br/>
      ${esc(institutionPullFooterLine("he", appUrl))}<br/>
      ${esc(institutionSalesEmail())}
    </div>
  </div>
</body>
</html>`;
}

/** Ready-to-attach payload for nodemailer / sendEmail. */
export function mandateEmailAttachment(auth: MandateDocInput) {
  return {
    filename: `zakai-mandate-${auth.code}.html`,
    content: renderMandateHtml(auth),
    contentType: "text/html; charset=utf-8" as const,
  };
}

/**
 * Public address users forward provider replies to (closed-loop SavingsProof).
 * The fallback must be a real, controlled inbox — "proofs@zakai.app" was a
 * domain a different company owns, so forwarded provider correspondence
 * (proof of a saving) could silently reach a stranger instead of Zakai.
 */
export function proofsInboundAddress(): string {
  return (
    process.env.NEXT_PUBLIC_PROOFS_EMAIL ||
    process.env.PROOFS_INBOUND_EMAIL ||
    FOUNDER_EMAIL
  );
}

/**
 * The proofs inbox ONLY when a real one is configured — null on the
 * founder-inbox fallback. Public marketing surfaces print the address only
 * then; the paste-in-dashboard path works either way, so no capability is
 * hidden along with the personal address.
 */
export function configuredProofsInboundAddress(): string | null {
  return process.env.NEXT_PUBLIC_PROOFS_EMAIL || process.env.PROOFS_INBOUND_EMAIL || null;
}
