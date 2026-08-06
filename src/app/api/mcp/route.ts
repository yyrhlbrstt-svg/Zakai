import { NextResponse } from "next/server";
import { buildCatalogResponse } from "@/lib/protocol/zml/catalog";
import { buildZakaiProtocolDocument } from "@/lib/protocol/discovery";
import { rateLimit, clientIp } from "@/lib/ratelimit";

export const runtime = "nodejs";

/**
 * A minimal, spec-compliant MCP (Model Context Protocol) server — the thing
 * an AI agent (Claude, ChatGPT, etc.) connects to directly instead of
 * scraping the .well-known JSON files. Deliberately narrow for a first
 * version: two read-only tools over public data, no auth, no Mandate
 * issuance or money. Stateless single-response mode (every request gets one
 * JSON body back immediately) — no SSE stream, no session to manage, which
 * is allowed by the Streamable HTTP transport for a server with nothing to
 * push server-initiated.
 */

const PROTOCOL_VERSION = "2025-06-18";
const SERVER_INFO = { name: "zakai", version: "1.0.0" };

interface McpTool {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, { type: string; description: string }>;
    required?: string[];
  };
}

const TOOLS: McpTool[] = [
  {
    name: "check_rights",
    description:
      "Look up real, citation-backed consumer rights and entitlements a person may be owed in a given country (e.g. flight delay compensation, bank fee refunds, tax credits). Never invents a right — returns only what is in Zakai's rights catalog with its legal source.",
    inputSchema: {
      type: "object",
      properties: {
        market: { type: "string", description: "ISO 3166-1 alpha-2 country code, e.g. IL, US, GB, DE" },
        category: { type: "string", description: "Optional category filter, e.g. flights, banking, telecom" },
      },
      required: ["market"],
    },
  },
  {
    name: "protocol_status",
    description:
      "Get Zakai's live protocol status: whether Mandate signing is active in production, outbound email delivery status, and links to the machine-readable protocol layers (Mandate spec, JWKS, verify API).",
    inputSchema: { type: "object", properties: {} },
  },
];

type JsonRpcId = string | number | null;

function rpcResult(id: JsonRpcId, result: unknown) {
  return NextResponse.json({ jsonrpc: "2.0", id, result });
}

function rpcError(id: JsonRpcId, code: number, message: string, status = 200) {
  return NextResponse.json({ jsonrpc: "2.0", id, error: { code, message } }, { status });
}

/** JSON-RPC notifications carry no `id` and MUST NOT receive a body in response. */
function accepted() {
  return new NextResponse(null, { status: 202 });
}

async function callTool(name: unknown, args: Record<string, unknown>, origin: string) {
  if (name === "check_rights") {
    const market = String(args.market ?? "IL").toUpperCase();
    const category = typeof args.category === "string" ? args.category : undefined;
    const catalog = await buildCatalogResponse(origin, market, { category, limit: 25 });
    if (!catalog) {
      return [{ type: "text" as const, text: `No rights catalog available for market "${market}".` }];
    }
    return [{ type: "text" as const, text: JSON.stringify(catalog, null, 2) }];
  }
  if (name === "protocol_status") {
    const doc = buildZakaiProtocolDocument(origin);
    const summary = {
      mandate_signing_live: doc.layers.authority.live,
      payments_live: doc.operations.payments_live,
      email_delivery: doc.operations.email_delivery,
      mandate_spec: doc.layers.authority.mandate_spec,
      jwks: doc.layers.authority.jwks,
      verify: doc.layers.authority.verify,
      outcome_graph_report: doc.layers.outcome_graph.report,
    };
    return [{ type: "text" as const, text: JSON.stringify(summary, null, 2) }];
  }
  throw new Error(`Unknown tool: ${String(name)}`);
}

export async function POST(request: Request) {
  const limited = await rateLimit("mcp", clientIp(request), 120, 60);
  if (!limited.ok) {
    return rpcError(null, -32000, "rate_limited", 429);
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || (body as Record<string, unknown>).jsonrpc !== "2.0") {
    return rpcError(null, -32600, "Invalid Request", 400);
  }

  const { id, method, params } = body as {
    id?: JsonRpcId;
    method?: string;
    params?: Record<string, unknown>;
  };
  const rpcId = id ?? null;
  const isNotification = id === undefined;

  try {
    switch (method) {
      case "initialize":
        return rpcResult(rpcId, {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: { tools: {} },
          serverInfo: SERVER_INFO,
        });
      case "notifications/initialized":
      case "notifications/cancelled":
        return accepted();
      case "tools/list":
        return rpcResult(rpcId, { tools: TOOLS });
      case "tools/call": {
        const origin = new URL(request.url).origin;
        const toolName = params?.name;
        const args = (params?.arguments ?? {}) as Record<string, unknown>;
        const content = await callTool(toolName, args, origin);
        return rpcResult(rpcId, { content, isError: false });
      }
      default:
        if (isNotification) return accepted();
        return rpcError(rpcId, -32601, `Method not found: ${method}`);
    }
  } catch (err) {
    if (isNotification) return accepted();
    const message = err instanceof Error ? err.message : "Internal error";
    return rpcResult(rpcId, { content: [{ type: "text", text: message }], isError: true });
  }
}

/** Stateless single-response mode only — no server-initiated SSE stream to open. */
export async function GET() {
  return NextResponse.json(
    { error: "This MCP server accepts POST (stateless JSON-RPC) only." },
    { status: 405 },
  );
}
