import "server-only";
import { chooseStance } from "@/lib/strategy/store";
import { applyStance, stanceAffects, type Letter } from "@/lib/strategy/applyStance";
import { variantById } from "@/lib/strategy/variants";

/**
 * Choose a measurable stance and apply it to a deterministic letter.
 * Only returns strategyVariant when the letter actually changed — never
 * attributes an outcome to a no-op stance.
 */
export async function stageLetterWithStance(
  letter: Letter,
  context: { market?: string; vertical: string; counterparty: string },
): Promise<{
  letter: Letter;
  strategyVariant?: string;
  strategySeed?: number;
  stanceInstructions: string[];
}> {
  const stance = await chooseStance({
    market: context.market ?? "IL",
    vertical: context.vertical,
    counterparty: context.counterparty.slice(0, 64),
  });
  const variant = variantById(stance.variantId);
  if (!variant) {
    return { letter, stanceInstructions: stance.instructions };
  }
  const staged = applyStance(letter, variant);
  if (!stanceAffects(letter, variant)) {
    return { letter, stanceInstructions: stance.instructions };
  }
  return {
    letter: staged,
    strategyVariant: stance.variantId,
    strategySeed: stance.seed,
    stanceInstructions: stance.instructions,
  };
}
