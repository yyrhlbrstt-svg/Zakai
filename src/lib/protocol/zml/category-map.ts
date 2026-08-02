import type { RightCategory } from "@/lib/global/types";
import type { ZmlCategory } from "./types";

const MAP: Record<RightCategory, ZmlCategory> = {
  tax: "tax",
  social_security: "health",
  municipal: "housing",
  banking: "finance",
  consumer: "consumer_protection",
  health: "health",
  work: "employment",
  transport: "transport",
  education: "education",
  military: "employment",
  family: "consumer_protection",
  senior: "health",
  housing: "housing",
  energy: "energy",
};

export function packCategoryToZml(category: RightCategory): ZmlCategory {
  return MAP[category];
}
