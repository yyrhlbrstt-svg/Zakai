import "server-only";
import { prisma } from "@/lib/prisma";
import { decide, review, digest } from "./engine";
import { EXPERIMENTS, automatableExperiments, experimentById } from "./experiments";
import { seededRng } from "../strategy/selector";
import type { Arm, Review, Trial } from "./types";

/**
 * The loop, closed.
 *
 * `engine.ts` is pure maths and `experiments.ts` is a list; neither of them
 * changes anything. This file is where the system actually reaches into the
 * product: it picks what the visitor sees, records what happened, and — on a
 * schedule, with no human in the loop — adopts whatever turned out to work.
 *
 * Everything here fails open to the baseline. A self-improving system whose
 * failure mode is "the site breaks" would have to be switched off the first
 * time the database is slow, and a system that is switched off improves
 * nothing. Its failure mode is "the product behaves exactly as it did before
 * the engine existed", which is a state we know is safe.
 */

/** Trials older than this stop counting: the product they were measuring is gone. */
const EVIDENCE_WINDOW_DAYS = 90;

/**
 * What the product should do right now for a given experiment.
 *
 * Once an arm has been promoted it becomes the default, but sampling does not
 * stop — a promotion that turns out to be wrong has to be visible in the same
 * data that produced it. A system that stops measuring the moment it decides
 * cannot notice that it decided badly.
 */
export async function currentArm<T>(experimentId: string): Promise<Arm<T> | null> {
  const experiment = experimentById(experimentId);
  if (!experiment) return null;
  const baseline = (experiment.arms.find((a) => a.baseline) ?? experiment.arms[0]) as Arm<T>;
  if (experiment.humanOnly) return baseline;

  try {
    const [promotion, rows] = await Promise.all([
      prisma.experimentPromotion.findFirst({
        where: { experimentId, revertedAt: null },
        orderBy: { promotedAt: "desc" },
        select: { armId: true },
      }),
      loadTrials(experimentId),
    ]);

    // A promoted arm becomes the baseline for future comparisons, so the
    // engine asks "is anything better than what we do now" rather than
    // re-litigating a decision it already made.
    const arms = promotion
      ? experiment.arms.map((a) => ({ ...a, baseline: a.id === promotion.armId }))
      : experiment.arms;

    return decide({ ...experiment, arms }, rows, {
      rng: seededRng((Date.now() / 1000) | 0),
    }) as Arm<T>;
  } catch (err) {
    console.warn(`[evolve] ${experimentId}: falling back to baseline —`, err);
    return baseline;
  }
}

/** Convenience for the common case: just the payload. */
export async function currentPayload<T>(experimentId: string, fallback: T): Promise<T> {
  const arm = await currentArm<T>(experimentId);
  return (arm?.payload as T) ?? fallback;
}

/**
 * Record what happened. Non-blocking and best-effort — measurement must never
 * be able to break the thing it is measuring.
 */
export async function recordTrial(input: {
  experimentId: string;
  armId: string;
  converted: boolean;
  value?: number;
  guardrails?: Record<string, number>;
}): Promise<void> {
  try {
    await prisma.experimentTrial.create({
      data: {
        experimentId: input.experimentId,
        armId: input.armId,
        converted: input.converted,
        value: input.value ?? (input.converted ? 1 : 0),
        guardrails: input.guardrails ?? undefined,
      },
    });
  } catch (err) {
    console.warn("[evolve] could not record trial:", err);
  }
}

async function loadTrials(experimentId: string): Promise<Trial[]> {
  const since = new Date(Date.now() - EVIDENCE_WINDOW_DAYS * 86_400_000);
  const rows = await prisma.experimentTrial.findMany({
    where: { experimentId, createdAt: { gte: since } },
    select: { experimentId: true, armId: true, converted: true, value: true, guardrails: true },
    take: 50_000,
  });
  return rows.map((r) => ({
    experimentId: r.experimentId,
    armId: r.armId,
    converted: r.converted,
    value: r.value,
    guardrailValues: (r.guardrails as Record<string, number> | null) ?? undefined,
  }));
}

export interface CycleResult {
  reviews: Review[];
  promoted: string[];
  digest: string[];
}

/**
 * One turn of the wheel: look at every experiment, and adopt what won.
 *
 * This is the part that makes the system self-improving rather than merely
 * instrumented. It runs on a schedule and nobody approves its conclusions —
 * which is exactly why `review()` refuses to conclude anything without enough
 * data, an intact guardrail, an effect worth having, and separated posteriors.
 * The permission to act without asking is bought by being hard to convince.
 */
export async function runEvolutionCycle(): Promise<CycleResult> {
  const reviews: Review[] = [];
  const promoted: string[] = [];

  for (const experiment of EXPERIMENTS) {
    let trials: Trial[] = [];
    try {
      trials = await loadTrials(experiment.id);
    } catch (err) {
      console.warn(`[evolve] ${experiment.id}: could not load trials —`, err);
      continue;
    }

    // Compare against what the product does today, not against the original
    // baseline — otherwise a second improvement is measured from the wrong
    // starting point and looks larger than it is.
    let active = experiment.arms;
    try {
      const promotion = await prisma.experimentPromotion.findFirst({
        where: { experimentId: experiment.id, revertedAt: null },
        orderBy: { promotedAt: "desc" },
        select: { armId: true },
      });
      if (promotion) {
        active = experiment.arms.map((a) => ({ ...a, baseline: a.id === promotion.armId }));
      }
    } catch {
      // Fall through with the declared baseline.
    }

    const result = review({ ...experiment, arms: active }, trials, { rng: seededRng(7) });
    reviews.push(result);

    if (result.verdict.kind === "promote") {
      try {
        await prisma.experimentPromotion.create({
          data: {
            experimentId: experiment.id,
            armId: result.verdict.armId,
            relativeLift: result.verdict.relativeLift,
            samples: result.verdict.samples,
            explanation: result.explanation,
          },
        });
        promoted.push(`${experiment.id} → ${result.verdict.armId}`);
      } catch (err) {
        console.warn(`[evolve] ${experiment.id}: could not persist promotion —`, err);
      }
    }
  }

  return { reviews, promoted, digest: digest(reviews) };
}

/**
 * Undo a promotion. Kept deliberately simple and always available: the
 * strongest argument for letting a machine change the product is that any
 * change it makes can be taken back in one call.
 */
export async function revertPromotion(experimentId: string): Promise<boolean> {
  try {
    const latest = await prisma.experimentPromotion.findFirst({
      where: { experimentId, revertedAt: null },
      orderBy: { promotedAt: "desc" },
      select: { id: true },
    });
    if (!latest) return false;
    await prisma.experimentPromotion.update({
      where: { id: latest.id },
      data: { revertedAt: new Date() },
    });
    return true;
  } catch {
    return false;
  }
}

/** What the engine has changed about the product, newest first. */
export async function promotionHistory(limit = 50) {
  try {
    return await prisma.experimentPromotion.findMany({
      orderBy: { promotedAt: "desc" },
      take: limit,
    });
  } catch {
    return [];
  }
}

/** Experiments the engine may act on — used by the status surface. */
export function automatable(): string[] {
  return automatableExperiments().map((e) => e.id);
}
