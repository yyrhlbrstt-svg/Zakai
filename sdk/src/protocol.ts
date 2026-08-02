/**
 * Zakai protocol discovery — fetch the public manifest and network feed.
 */

export const PROTOCOL_PATH = "/.well-known/zakai-protocol.json";
export const NETWORK_PATH = "/api/network";
export const TRUST_REGISTRY_PATH = "/.well-known/zakai-trust-registry.json";

export type ZakaiProtocolDocument = {
  spec: string;
  version: number;
  laws: Array<{ id: string; summary: string }>;
  layers: Record<string, unknown>;
};

export type ZakaiNetworkFeed = {
  spec: string;
  version: number;
  protocol: string;
  outcome_graph: { totalOutcomes: number };
};

function base(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

export async function fetchZakaiProtocol(
  baseUrl: string,
  init?: RequestInit,
): Promise<ZakaiProtocolDocument> {
  const res = await fetch(`${base(baseUrl)}${PROTOCOL_PATH}`, init);
  if (!res.ok) throw new Error(`protocol_fetch_failed:${res.status}`);
  return (await res.json()) as ZakaiProtocolDocument;
}

export async function fetchNetworkFeed(
  baseUrl: string,
  init?: RequestInit,
): Promise<ZakaiNetworkFeed> {
  const res = await fetch(`${base(baseUrl)}${NETWORK_PATH}`, init);
  if (!res.ok) throw new Error(`network_fetch_failed:${res.status}`);
  return (await res.json()) as ZakaiNetworkFeed;
}
