import { z } from "zod";
import { isCollectiveVertical } from "@/lib/collective/verticals";

export const collectiveIntentBodySchema = z.object({
  market: z
    .string()
    .length(2)
    .regex(/^[A-Z]{2}$/),
  vertical: z.string().refine(isCollectiveVertical, { message: "unknown_vertical" }),
});
