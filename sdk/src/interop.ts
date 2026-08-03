/**
 * Zakai Interoperability Standard — discovery + live probe client.
 */

export const INTEROP_WELL_KNOWN = "/.well-known/zakai-interop.json";
export const INTEROP_PROBE_PATH = "/api/interop?probe=1";

export type InteropLiveProbe = {
  probed_at: string;
  profiles: Array<{ id: string; status: "pass" | "fail"; failed_checks: string[] }>;
};

export type ZakaiInteropDocument = {
  spec: string;
  version: string;
  profiles: Array<{ id: string; title: string; summary: string }>;
  well_known: Record<string, string>;
  api: Record<string, string>;
};

function base(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

export async function fetchInteropDocument(
  baseUrl: string,
  init?: RequestInit,
): Promise<ZakaiInteropDocument> {
  const res = await fetch(`${base(baseUrl)}${INTEROP_WELL_KNOWN}`, init);
  if (!res.ok) throw new Error(`interop_fetch_failed:${res.status}`);
  return (await res.json()) as ZakaiInteropDocument;
}

export async function probeReferenceNode(
  baseUrl: string,
  init?: RequestInit,
): Promise<{ reference_node: boolean; live: InteropLiveProbe }> {
  const res = await fetch(`${base(baseUrl)}${INTEROP_PROBE_PATH}`, init);
  const body = (await res.json()) as {
    reference_node?: boolean;
    live?: InteropLiveProbe;
  };
  return {
    reference_node: body.reference_node === true && res.ok,
    live: body.live ?? { probed_at: "", profiles: [] },
  };
}
