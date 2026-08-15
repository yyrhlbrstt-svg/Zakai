#!/usr/bin/env node
/**
 * A local SMTP server that accepts everything and delivers nothing.
 *
 * WHY THIS, INSTEAD OF POINTING THE JOURNEY AT PRODUCTION
 *
 * The obvious next move after `verify-journey` reached 13/13 was to run it
 * against production, where SMTP is live, so the one ASSISTED step becomes a
 * real OK. That would have been a mistake, and it is worth writing down why so
 * nobody reaches for it later:
 *
 *   - Step 8 sends. With live mail that is a real letter to a real company,
 *     carrying a signed Mandate, on behalf of a person who does not exist.
 *   - The run writes a Case, an Authorization and a SavingsProof into the
 *     production ledger — the same rows the public counters and the outcome
 *     graph are computed from. Inventing traction is the one thing this
 *     project's own doctrine forbids outright.
 *
 * So the delivery half gets proven here instead: a real SMTP conversation, a
 * real message on the wire, written to disk instead of to a stranger. What
 * that establishes is exactly one thing — that with a working mail server the
 * message leaves the Outbox and carries what the next step needs. It does not
 * establish that any particular provider's mail server accepts it.
 *
 * Speaks only the part of RFC 5321 nodemailer needs. It is a test double, not
 * a mail server, and it should never be reachable from anywhere but here.
 *
 * Usage:
 *   node scripts/dev-smtp-sink.mjs [port] [outDir]
 */

import { createServer } from "node:net";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const PORT = Number(process.argv[2] || 2525);
const OUT = process.argv[3] || "/tmp/zakai-mail";
mkdirSync(OUT, { recursive: true });

let seq = 0;

const server = createServer((socket) => {
  let buffer = "";
  let inData = false;
  let message = "";
  let envelope = { from: "", to: [] };

  socket.write("220 zakai-sink ESMTP\r\n");

  socket.on("data", (chunk) => {
    buffer += chunk.toString("utf8");

    for (;;) {
      const idx = buffer.indexOf("\r\n");
      if (idx === -1) break;
      const line = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);

      if (inData) {
        if (line === ".") {
          inData = false;
          const name = `${String(++seq).padStart(3, "0")}-${Date.now()}.eml`;
          writeFileSync(
            join(OUT, name),
            `X-Sink-From: ${envelope.from}\r\nX-Sink-To: ${envelope.to.join(", ")}\r\n${message}`,
          );
          message = "";
          envelope = { from: "", to: [] };
          socket.write("250 2.0.0 Ok: queued\r\n");
        } else {
          // Undo dot-stuffing so the body on disk is the body that was sent.
          message += (line.startsWith("..") ? line.slice(1) : line) + "\r\n";
        }
        continue;
      }

      const verb = line.slice(0, 4).toUpperCase();
      if (verb === "EHLO") {
        socket.write("250-zakai-sink\r\n250-8BITMIME\r\n250 SMTPUTF8\r\n");
      } else if (verb === "HELO") {
        socket.write("250 zakai-sink\r\n");
      } else if (verb === "MAIL") {
        envelope.from = line.match(/<([^>]*)>/)?.[1] ?? "";
        socket.write("250 2.1.0 Ok\r\n");
      } else if (verb === "RCPT") {
        const to = line.match(/<([^>]*)>/)?.[1];
        if (to) envelope.to.push(to);
        socket.write("250 2.1.5 Ok\r\n");
      } else if (verb === "DATA") {
        inData = true;
        socket.write("354 End data with <CR><LF>.<CR><LF>\r\n");
      } else if (verb === "RSET") {
        envelope = { from: "", to: [] };
        socket.write("250 2.0.0 Ok\r\n");
      } else if (verb === "QUIT") {
        socket.write("221 2.0.0 Bye\r\n");
        socket.end();
      } else if (verb === "NOOP") {
        socket.write("250 2.0.0 Ok\r\n");
      } else {
        // Unknown verbs are refused rather than accepted: a sink that says yes
        // to everything would hide a client sending something malformed.
        socket.write("502 5.5.2 Command not implemented\r\n");
      }
    }
  });

  socket.on("error", () => {
    /* a client hanging up mid-conversation is not this script's problem */
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`smtp sink on 127.0.0.1:${PORT}, writing to ${OUT}`);
});
