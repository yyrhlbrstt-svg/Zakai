#!/usr/bin/env node
/**
 * stdio entry point: `npx zakai-mandate-mcp` (or a direct node invocation)
 * gives any MCP client a running Mandate verifier with zero configuration.
 * ZAKAI_BASE_URL overrides the issuer for staging/self-hosted deployments.
 */
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMandateMcpServer } from "./mcp.js";

const server = createMandateMcpServer({
  baseUrl: process.env.ZAKAI_BASE_URL || undefined,
});

const transport = new StdioServerTransport();
await server.connect(transport);
