import { firstOutreachEmail } from "@/lib/outreachEmail";
import { providerContactEmail } from "@/lib/providers";

/** Same destination resolution as initial `sendOutreach` (counterparty wins). */
export function resolveCaseOutreachTo(caseRow: {
  counterpartyEmail?: string | null;
  provider: string;
  vertical: string;
}): string | null {
  return firstOutreachEmail(
    caseRow.counterpartyEmail,
    providerContactEmail(caseRow.provider, caseRow.vertical),
  );
}
