/**
 * Measuring whether the Oracle's numbers deserve to be trusted.
 *
 * This is the part that turns a model into an asset. Anyone can emit a
 * probability; what makes one worth money is evidence that when it says 0.7,
 * the thing happens about 70% of the time. Without that, "0.7" is decoration —
 * and decoration multiplied by a shekel amount is how a funding business
 * discovers it has been mispricing for a year.
 *
 * The failure mode this exists to catch is specific and quiet: a model can be
 * highly *accurate* and badly *calibrated*. It sorts claims correctly, looks
 * right on every case a human spot-checks, and is systematically overconfident
 * in a way that only shows up in aggregate — by which point the money is gone.
 * Accuracy is graded on which side of 0.5 you landed; calibration is graded on
 * whether the number itself meant anything.
 *
 * So these run continuously, not once at launch. A calibration that held last
 * quarter says nothing about this one: counterparties change policy, the
 * Strategy Engine changes what we send, and both shift the true rates under a
 * model that has no idea anything moved.
 */

export interface Forecast {
  /** What the model said. */
  predicted: number;
  /** What actually happened. */
  outcome: boolean;
}

/**
 * Brier score: mean squared error of the probabilities. Lower is better; 0 is
 * perfect and 0.25 is what you get by always guessing 0.5.
 *
 * Preferred to accuracy because it is a *proper* scoring rule — it is minimised
 * only by reporting your true belief. A model rewarded on accuracy learns to
 * round to 0 and 1, which maximises the score and destroys the pricing signal.
 */
export function brierScore(forecasts: readonly Forecast[]): number {
  if (forecasts.length === 0) return 0;
  const total = forecasts.reduce(
    (sum, f) => sum + Math.pow(f.predicted - (f.outcome ? 1 : 0), 2),
    0,
  );
  return total / forecasts.length;
}

/**
 * The reference point: how good is Brier from predicting the base rate every
 * time? A model that cannot beat this has learned nothing, however impressive
 * its absolute score looks on an imbalanced dataset.
 */
export function baseRateBrier(forecasts: readonly Forecast[]): number {
  if (forecasts.length === 0) return 0;
  const rate = forecasts.filter((f) => f.outcome).length / forecasts.length;
  return forecasts.reduce((s, f) => s + Math.pow(rate - (f.outcome ? 1 : 0), 2), 0) / forecasts.length;
}

/**
 * Brier skill score: how much better than the base rate, as a fraction.
 * 1 is perfect, 0 is no better than guessing the average, negative is worse
 * than having no model at all — which is a state worth being able to name.
 */
export function skillScore(forecasts: readonly Forecast[]): number {
  const reference = baseRateBrier(forecasts);
  if (reference === 0) return 0;
  return 1 - brierScore(forecasts) / reference;
}

export interface ReliabilityBin {
  /** Bin bounds, [lo, hi). */
  range: [number, number];
  count: number;
  /** Mean predicted probability in this bin. */
  meanPredicted: number;
  /** Fraction that actually happened. */
  observedRate: number;
}

/**
 * The reliability curve: for each band of predicted probability, what fraction
 * actually happened. A calibrated model sits on the diagonal.
 *
 * Reported as bins rather than a single number because the shape matters and a
 * scalar hides it. Overconfidence at the top end — claiming 0.9 and delivering
 * 0.6 — is the expensive failure, and it can coexist with an unremarkable
 * average error.
 */
export function reliabilityCurve(
  forecasts: readonly Forecast[],
  bins = 10,
): ReliabilityBin[] {
  const out: ReliabilityBin[] = [];
  for (let i = 0; i < bins; i++) {
    const lo = i / bins;
    const hi = (i + 1) / bins;
    const inBin = forecasts.filter(
      (f) => f.predicted >= lo && (i === bins - 1 ? f.predicted <= hi : f.predicted < hi),
    );
    out.push({
      range: [lo, hi],
      count: inBin.length,
      meanPredicted: inBin.length
        ? inBin.reduce((s, f) => s + f.predicted, 0) / inBin.length
        : 0,
      observedRate: inBin.length ? inBin.filter((f) => f.outcome).length / inBin.length : 0,
    });
  }
  return out;
}

/**
 * Expected calibration error: the average gap between what was promised and
 * what happened, weighted by how many forecasts fell in each band.
 *
 * This is the single number to put on a dashboard and alert on. Under about
 * 0.05 is a model you can price with; over 0.10 is one that will cost money in
 * a direction nobody notices until the quarter closes.
 */
export function expectedCalibrationError(
  forecasts: readonly Forecast[],
  bins = 10,
): number {
  if (forecasts.length === 0) return 0;
  return reliabilityCurve(forecasts, bins).reduce(
    (sum, bin) =>
      sum + (bin.count / forecasts.length) * Math.abs(bin.meanPredicted - bin.observedRate),
    0,
  );
}

export type CalibrationVerdict = "priceable" | "usable" | "unreliable" | "insufficient_data";

export interface CalibrationReport {
  samples: number;
  brier: number;
  skill: number;
  ece: number;
  curve: ReliabilityBin[];
  verdict: CalibrationVerdict;
  /** One sentence, for the dashboard and for whoever has to decide. */
  summary: string;
}

/** Below this, any calibration figure is itself noise. */
const MIN_FORECASTS = 200;

/**
 * Grade the model.
 *
 * `priceable` is the only verdict that permits underwriting money against these
 * numbers. `usable` is fine for telling a person which claim to file first,
 * where being directionally right is enough and nobody loses capital if it is
 * not. Keeping those two apart is the whole point: the same model can be good
 * enough to advise and nowhere near good enough to bet on.
 */
export function assessCalibration(forecasts: readonly Forecast[]): CalibrationReport {
  const samples = forecasts.length;
  const brier = brierScore(forecasts);
  const skill = skillScore(forecasts);
  const ece = expectedCalibrationError(forecasts);
  const curve = reliabilityCurve(forecasts);

  let verdict: CalibrationVerdict;
  let summary: string;

  if (samples < MIN_FORECASTS) {
    verdict = "insufficient_data";
    summary = `Only ${samples} settled forecasts. Below ${MIN_FORECASTS} the calibration figure is itself noise, so it says nothing yet.`;
  } else if (ece <= 0.05 && skill > 0) {
    verdict = "priceable";
    summary = `Calibration error ${(ece * 100).toFixed(1)}% over ${samples} forecasts, beating the base rate. These probabilities can carry money.`;
  } else if (ece <= 0.1) {
    verdict = "usable";
    summary = `Calibration error ${(ece * 100).toFixed(1)}% — good enough to rank what to file first, not good enough to underwrite against.`;
  } else {
    verdict = "unreliable";
    summary = `Calibration error ${(ece * 100).toFixed(1)}% over ${samples} forecasts. The numbers do not mean what they say; do not price on them.`;
  }

  return { samples, brier, skill, ece, curve, verdict, summary };
}
