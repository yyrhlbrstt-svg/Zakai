#!/usr/bin/env node
/**
 * Minimal Zakai inbound receive handler (Node 18+, zero deps beyond jose).
 *
 * Verifies Mandates via the published trust registry (any admitted issuer),
 * not a hard-wired single JWKS — same network rule as /api/pipe/accept.
 *
 *   npm i jose
 *   node receive.mjs
 *
 * Then POST JSON matching zakai-inbound-receive.json with
 * Idempotency-Key: <mandate_jti>.
 *
 * Optional: also POST {mandate_jws, action} to ZAKAI_PIPE_ACCEPT_URL for the
 * one-shot decide path (still offline-verifiable locally first).
 */
import { createServer } from "node:http";
import { gunzipSync } from "node:zlib";
import { compactVerify, createRemoteJWKSet, decodeJwt, importJWK, jwtVerify } from "jose";

const PORT = Number(process.env.PORT || 8790);
const ORIGIN = (process.env.ZAKAI_ORIGIN || "https://zakai-3uxj.vercel.app").replace(/\/+$/, "");
const REGISTRY_URL =
  process.env.ZAKAI_TRUST_REGISTRY_URL || `${ORIGIN}/.well-known/zakai-trust-registry.json`;
const ACCEPT_URL = process.env.ZAKAI_PIPE_ACCEPT_URL || `${ORIGIN}/api/pipe/accept`;
const MARK_URL = `${ORIGIN}/api/pipe/mark`;
const STATUS_URL = (jti) =>
  process.env.ZAKAI_STATUS_URL_TEMPLATE
    ? process.env.ZAKAI_STATUS_URL_TEMPLATE.replace("{jti}", encodeURIComponent(jti))
    : `${ORIGIN}/api/mandate/status/${encodeURIComponent(jti)}`;
const FORBIDDEN = new Set([
  "pay:transfer",
  "pay:card",
  "wallet:debit",
  "funds:move",
  "payment:initiate",
]);

const seen = new Set();
/** @type {Map<string, ReturnType<typeof createRemoteJWKSet>>} */
const jwksCache = new Map();

async function loadRegistry() {
  const res = await fetch(REGISTRY_URL, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`registry_${res.status}`);
  const doc = await res.json();
  if (!Array.isArray(doc.issuers)) throw new Error("registry_malformed");
  return doc;
}

function jwksFor(uri) {
  let set = jwksCache.get(uri);
  if (!set) {
    set = createRemoteJWKSet(new URL(uri));
    jwksCache.set(uri, set);
  }
  return set;
}

/** Read one bit from a statuslist+jwt lst (IETF Token Status List). */
function readStatusBit(lst, index) {
  if (!Number.isInteger(index) || index < 0) return false;
  const bytes = gunzipSync(Buffer.from(lst, "base64url"));
  const byte = index >> 3;
  if (byte >= bytes.length) return false;
  return (bytes[byte] & (1 << (index & 7))) !== 0;
}

/**
 * Prefer signed status list when zkm.status is present; else live /status/{jti}.
 * Fail closed — never accepted:true on unknown.
 */
async function checkRevocation(jti, payload, jwksUri, issuerIss) {
  const zkm = payload.zkm && typeof payload.zkm === "object" ? payload.zkm : {};
  const status = zkm.status;
  if (status && Number.isInteger(status.idx) && typeof status.uri === "string" && status.uri) {
    try {
      const listRes = await fetch(status.uri);
      if (!listRes.ok) {
        return { http: 503, body: { error: "revocation_unknown", mandate_jti: jti, via: "status_list" } };
      }
      const listToken = await listRes.text();
      const jwksRes = await fetch(jwksUri);
      if (!jwksRes.ok) {
        return { http: 503, body: { error: "revocation_unknown", mandate_jti: jti, via: "status_list" } };
      }
      const jwks = await jwksRes.json();
      let verifiedPayload;
      for (const jwk of jwks.keys || []) {
        try {
          const result = await compactVerify(listToken, await importJWK(jwk, "EdDSA"));
          if (result.protectedHeader.typ !== "statuslist+jwt") continue;
          verifiedPayload = JSON.parse(new TextDecoder().decode(result.payload));
          break;
        } catch {
          /* try next key */
        }
      }
      if (!verifiedPayload || verifiedPayload.iss !== issuerIss) {
        return { http: 503, body: { error: "revocation_unknown", mandate_jti: jti, via: "status_list" } };
      }
      const lst = verifiedPayload.status_list?.lst;
      if (!lst) {
        return { http: 503, body: { error: "revocation_unknown", mandate_jti: jti, via: "status_list" } };
      }
      if (readStatusBit(lst, status.idx)) {
        return { http: 401, body: { error: "revoked", mandate_jti: jti, via: "status_list" } };
      }
      return { http: 200, body: { status: "active", via: "status_list" } };
    } catch {
      return { http: 503, body: { error: "revocation_unknown", mandate_jti: jti, via: "status_list" } };
    }
  }

  try {
    const sr = await fetch(STATUS_URL(jti), { headers: { accept: "application/json" } });
    if (!sr.ok) {
      return {
        http: 503,
        body: {
          error: "revocation_unknown",
          mandate_jti: jti,
          via: "live_status",
          detail: sr.status === 503 ? undefined : `status_${sr.status}`,
        },
      };
    }
    const statusDoc = await sr.json();
    if (statusDoc.status === "revoked") {
      return { http: 401, body: { error: "revoked", mandate_jti: jti, via: "live_status" } };
    }
    if (statusDoc.status !== "active") {
      return {
        http: 503,
        body: { error: "revocation_unknown", mandate_jti: jti, via: "live_status", status: statusDoc.status },
      };
    }
    return { http: 200, body: { status: "active", via: "live_status" } };
  } catch {
    return { http: 503, body: { error: "revocation_unknown", mandate_jti: jti, via: "live_status" } };
  }
}

createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        ok: true,
        registry: REGISTRY_URL,
        pipe_accept: ACCEPT_URL,
        acceptor_mark: MARK_URL,
        note: "Publish acceptor_mark on your developer portal when you process Mandates.",
      }),
    );
    return;
  }
  if (req.method !== "POST" || req.url !== "/webhooks/zakai-inbound") {
    res.writeHead(404);
    res.end();
    return;
  }

  const chunks = [];
  for await (const c of req) chunks.push(c);
  let body;
  try {
    body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    res.writeHead(400, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "malformed" }));
    return;
  }

  const jti = body.mandate_jti;
  const token = body.mandate_jws;
  if (!jti || !token) {
    res.writeHead(400, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "missing_fields" }));
    return;
  }
  if (req.headers["idempotency-key"] && req.headers["idempotency-key"] !== jti) {
    res.writeHead(400, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "idempotency_mismatch" }));
    return;
  }
  if (seen.has(jti)) {
    res.writeHead(409, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "duplicate", mandate_jti: jti }));
    return;
  }

  try {
    const iss = String(decodeJwt(token).iss || "");
    const registry = await loadRegistry();
    const issuer = registry.issuers.find((i) => i.iss === iss && i.status === "active");
    if (!issuer) {
      res.writeHead(401, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "unknown_or_inactive_issuer", iss }));
      return;
    }

    const jwksUri = issuer.jwks_uri || issuer.jwksUri;
    const { payload } = await jwtVerify(token, jwksFor(jwksUri), { algorithms: ["EdDSA"] });
    if (payload.jti !== jti) throw new Error("jti_mismatch");

    const scopes = String(payload.scope || "")
      .split(/\s+/)
      .filter(Boolean);
    if (scopes.some((s) => FORBIDDEN.has(s))) {
      res.writeHead(422, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "forbidden_scope", scopes }));
      return;
    }
    const allowed = issuer.allowed_scopes || issuer.allowedScopes || [];
    if (allowed.length && scopes.some((s) => !allowed.includes(s))) {
      res.writeHead(422, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "issuer_scope_exceeded", scopes }));
      return;
    }

    // Prefer signed status list when zkm.status is present; else live /status/{jti}.
    // Fail closed; remember jti only after accept so transient 503s do not poison retries.
    const rev = await checkRevocation(jti, payload, jwksUri, issuer.iss);
    if (rev.http !== 200) {
      res.writeHead(rev.http, { "content-type": "application/json" });
      res.end(JSON.stringify(rev.body));
      return;
    }

    // Optional one-shot decide against hosted pipe (aud extracted server-side).
    let pipeAccept = null;
    if (body.action || process.env.ZAKAI_CALL_PIPE_ACCEPT === "1") {
      try {
        const ar = await fetch(ACCEPT_URL, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            mandate_jws: token,
            action: body.action || "request:records",
          }),
        });
        pipeAccept = await ar.json().catch(() => null);
      } catch {
        pipeAccept = { error: "pipe_accept_unreachable" };
      }
    }

    seen.add(jti);

    res.writeHead(202, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        accepted: true,
        mandate_jti: jti,
        intent: body.intent,
        issuer: { iss: issuer.iss, name: issuer.name },
        pipe_accept: pipeAccept,
        acceptor_mark: MARK_URL,
      }),
    );
  } catch (err) {
    res.writeHead(401, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "mandate_rejected", reason: String(err) }));
  }
}).listen(PORT, () => {
  console.log(`zakai inbound receiver on :${PORT} (registry ${REGISTRY_URL})`);
});
