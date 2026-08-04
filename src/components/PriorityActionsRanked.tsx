import { getPriorityCatalogBoosts } from "@/lib/services/priorityBoosts";
import { PriorityActions } from "@/components/PriorityActions";
import type { RankPriorityOpts } from "@/lib/priority";

export async function PriorityActionsRanked({
  limit = 5,
  pinIds,
  excludeIds,
}: {
  limit?: number;
} & RankPriorityOpts) {
  const catalogBoosts = await getPriorityCatalogBoosts("IL");
  return (
    <PriorityActions
      limit={limit}
      catalogBoosts={catalogBoosts}
      pinIds={pinIds}
      excludeIds={excludeIds}
    />
  );
}
