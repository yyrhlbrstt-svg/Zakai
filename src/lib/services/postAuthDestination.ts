import "server-only";

import { findOpenLoopBlock } from "@/lib/services/expressCaseOpen";

/**
 * Where a session should land after login / already-authed /login visit.
 * Open loop → ranked finish href (/money?case= or fee checkout). Else Money OS.
 */
export async function postAuthDestination(userId: string): Promise<string> {
  const block = await findOpenLoopBlock(userId);
  if (block?.nextHref) return block.nextHref;
  return "/money";
}
