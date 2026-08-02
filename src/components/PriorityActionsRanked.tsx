import { getPriorityCatalogBoosts } from "@/lib/services/priorityBoosts";
import { PriorityActions } from "@/components/PriorityActions";

export async function PriorityActionsRanked({ limit = 5 }: { limit?: number }) {
  const catalogBoosts = await getPriorityCatalogBoosts("IL");
  return <PriorityActions limit={limit} catalogBoosts={catalogBoosts} />;
}
