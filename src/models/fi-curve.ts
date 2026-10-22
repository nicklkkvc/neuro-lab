// The f-I curve of the LIF neuron: firing rate as a function of a constant input current.
// Theory: docs/NOTES.md, "Firing rate and the f-I curve".
// Units: currents in nA, intervals in ms, rates in Hz (spikes per second).

import { createLifPopulation, type LifParameters } from './lif.ts';
import type { SolverMethod } from './solvers.ts';

/**
 * Exact interspike interval T (ms) for a constant current I (nA):
 *
 *   T = t_ref + τ · ln((R·I − (V_reset − V_rest)) / (R·I − (θ − V_rest)))
 *
 * Infinity if I is not above the rheobase, because then the neuron never fires.
 */
export function interspikeInterval(parameters: LifParameters, current: number): number {
  const { tau, resistance, restPotential, threshold, resetPotential, refractoryPeriod } = parameters;
  const drive = resistance * current; // R·I (mV): how far the input pushes the target above rest
  const distanceFromReset = drive - (resetPotential - restPotential); // V∞ − V_reset (mV)
  const distanceFromThreshold = drive - (threshold - restPotential); // V∞ − θ (mV)
  // V∞ must lie above θ, otherwise the voltage never gets there (current ≤ rheobase).
  if (!(distanceFromThreshold > 0)) return Infinity;
  return refractoryPeriod + tau * Math.log(distanceFromReset / distanceFromThreshold);
}

/** Exact firing rate f = 1000 / T in Hz (T in ms); 0 if the neuron never fires. */
export function exactFiringRate(parameters: LifParameters, current: number): number {
  const interval = interspikeInterval(parameters, current);
  return Number.isFinite(interval) ? 1000 / interval : 0;
}

export interface RateSimulationOptions {
  /** Simulated time per current (ms). */
  readonly duration: number;
  /** Time step (ms). */
  readonly dt: number;
  readonly method?: SolverMethod;
}

export interface SimulatedRates {
  /**
   * Measured rate per current (Hz): 1000 / mean interval between spikes. The first spike starts
   * from rest, so only the intervals after it count. 0 if the neuron didn't spike at all;
   * null if it spiked only once (no interval to measure).
   */
  readonly rates: (number | null)[];
  readonly spikeCounts: number[];
}

/**
 * Simulates one neuron per current, all together as one population (design decision A4), each
 * starting at rest with its own constant current, and measures the firing rates.
 */
export function simulateFiringRates(
  parameters: LifParameters,
  currents: readonly number[],
  options: RateSimulationOptions,
): SimulatedRates {
  const { duration, dt, method = 'rk4' } = options;
  const count = currents.length;
  const population = createLifPopulation(count, parameters, method);
  const input = Float64Array.from(currents);
  const firstSpike = new Float64Array(count); // ms
  const lastSpike = new Float64Array(count); // ms
  const spikeCounts = new Array<number>(count).fill(0);

  const recordSpike = (neuron: number, time: number) => {
    if (spikeCounts[neuron] === 0) firstSpike[neuron] = time;
    lastSpike[neuron] = time;
    spikeCounts[neuron]++;
  };
  const steps = Math.round(duration / dt);
  for (let k = 0; k < steps; k++) population.step(k * dt, dt, input, recordSpike);

  const rates = spikeCounts.map((spikes, i) => {
    if (spikes === 0) return 0;
    if (spikes === 1) return null;
    const meanInterval = (lastSpike[i] - firstSpike[i]) / (spikes - 1); // ms
    return 1000 / meanInterval;
  });
  return { rates, spikeCounts };
}

export interface RateComparison {
  /** Largest |simulated − exact| / exact over all measured points (0 if there are none). */
  readonly largestRelativeDifference: number;
  /** Points with at least two spikes, where a rate could be measured and compared. */
  readonly measuredPoints: number;
  /** Points that should fire but spiked fewer than twice in the simulated time: too slow to measure. */
  readonly tooSlowPoints: number;
}

/**
 * Compares simulated rates with the exact formula. A neuron that fires although the formula says
 * it never does counts as an infinite difference, because that would be a real error.
 */
export function compareWithExact(
  parameters: LifParameters,
  currents: readonly number[],
  simulated: SimulatedRates,
): RateComparison {
  let largestRelativeDifference = 0;
  let measuredPoints = 0;
  let tooSlowPoints = 0;
  currents.forEach((current, i) => {
    const exact = exactFiringRate(parameters, current);
    const spikes = simulated.spikeCounts[i];
    if (exact === 0) {
      if (spikes > 0) largestRelativeDifference = Infinity;
      return;
    }
    const rate = simulated.rates[i];
    if (spikes < 2 || rate === null) {
      tooSlowPoints++;
      return;
    }
    measuredPoints++;
    largestRelativeDifference = Math.max(largestRelativeDifference, Math.abs(rate - exact) / exact);
  });
  return { largestRelativeDifference, measuredPoints, tooSlowPoints };
}
