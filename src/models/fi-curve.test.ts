import { describe, expect, it } from 'vitest';
import { compareWithExact, exactFiringRate, interspikeInterval, simulateFiringRates } from './fi-curve.ts';
import { DEFAULT_LIF_PARAMETERS as DEFAULTS, type LifParameters } from './lif.ts';

// Defaults: τ = 10 ms, R = 10 MΩ, V_rest = −65 mV, θ = −50 mV, V_reset = −65 mV, t_ref = 2 ms.
const DT = 0.1; // ms
const DURATION = 1000; // ms, as on the page

describe('exact interval and rate (hand calculations from docs/NOTES.md)', () => {
  it('defaults, I = 2 nA: T = 2 + 10·ln 4 ≈ 15.863 ms, f = 1000/T ≈ 63.04 Hz', () => {
    expect(interspikeInterval(DEFAULTS, 2)).toBeCloseTo(2 + 10 * Math.log(4), 12);
    expect(exactFiringRate(DEFAULTS, 2)).toBeCloseTo(1000 / (2 + 10 * Math.log(4)), 10);
    expect(exactFiringRate(DEFAULTS, 2)).toBeCloseTo(63.04, 2);
  });

  it('general reset: V_reset = −70 mV, t_ref = 3 ms, I = 2.5 nA: T = 3 + 10·ln(30/10)', () => {
    expect(interspikeInterval({ ...DEFAULTS, resetPotential: -70, refractoryPeriod: 3 }, 2.5)).toBeCloseTo(3 + 10 * Math.log(3), 12);
  });

  it('never fires at or below the rheobase (1.5 nA): T = ∞, f = 0', () => {
    for (const current of [-1, 0, 1.4, 1.5]) {
      expect(interspikeInterval(DEFAULTS, current)).toBe(Infinity);
      expect(exactFiringRate(DEFAULTS, current)).toBe(0);
    }
  });

  it('starts continuously at 0 Hz just above the rheobase and rises from there', () => {
    expect(exactFiringRate(DEFAULTS, 1.5 * (1 + 1e-9))).toBeLessThan(10);
    let previous = 0;
    for (let current = 1.51; current <= 10; current += 0.01) {
      const rate = exactFiringRate(DEFAULTS, current);
      expect(rate).toBeGreaterThan(previous);
      previous = rate;
    }
  });

  it('large currents: the rate approaches 1/t_ref = 500 Hz', () => {
    const rate = exactFiringRate(DEFAULTS, 1e6);
    expect(Math.abs(rate - 500) / 500).toBeLessThan(1e-3);
  });

  it('without refractory period: f ≈ R·I / (τ·(θ − V_reset)), growing in proportion to I', () => {
    const p = { ...DEFAULTS, refractoryPeriod: 0 };
    const approximation = (1000 * (10 * 1000)) / (10 * 15); // Hz, for I = 1000 nA
    expect(Math.abs(exactFiringRate(p, 1000) - approximation) / approximation).toBeLessThan(1e-3);
  });
});

/** Currents from 0 to `max` nA in `points` equal steps. */
function currentGrid(max: number, points: number): number[] {
  return Array.from({ length: points }, (_, i) => (max * i) / (points - 1));
}

/** Checks every simulated point against the formula, with the error bound from docs/NOTES.md. */
function expectSimulationMatchesFormula(p: LifParameters, currents: number[]): void {
  const simulated = simulateFiringRates(p, currents, { duration: DURATION, dt: DT });
  currents.forEach((current, i) => {
    const exact = exactFiringRate(p, current);
    const spikes = simulated.spikeCounts[i];
    if (exact === 0) {
      expect(spikes, `I = ${current} nA must never fire`).toBe(0);
      expect(simulated.rates[i]).toBe(0);
      return;
    }
    const interval = interspikeInterval(p, current); // ms
    if (spikes < 2) {
      // Allowed only if two spikes really don't fit: the first spike starts from rest (Step 3 formula).
      const firstSpike = p.tau * Math.log((p.resistance * current) / (p.resistance * current - (p.threshold - p.restPotential)));
      expect(firstSpike + interval, `I = ${current} nA should have been measurable`).toBeGreaterThan(DURATION - 1);
      return;
    }
    // Relative error of the rate ≤ Δt² / (4·τ·T), with a factor 2 of safety margin.
    const bound = (2 * DT ** 2) / (4 * p.tau * interval);
    const rate = simulated.rates[i]!;
    expect(Math.abs(rate - exact) / exact, `I = ${current} nA`).toBeLessThan(bound);
  });
}

describe('simulated rates agree with the formula', () => {
  it('defaults, 41 currents from 0 to 7.5 nA', () => {
    expectSimulationMatchesFormula(DEFAULTS, currentGrid(7.5, 41));
  });

  it('another parameter set: τ = 20 ms, R = 15 MΩ, V_reset = −70 mV, t_ref = 3 ms', () => {
    expectSimulationMatchesFormula({ ...DEFAULTS, tau: 20, resistance: 15, resetPotential: -70, refractoryPeriod: 3 }, currentGrid(5, 41));
  });

  it('without refractory period, up to high rates', () => {
    expectSimulationMatchesFormula({ ...DEFAULTS, refractoryPeriod: 0 }, currentGrid(20, 21));
  });

  it('a neuron that spikes once gives no rate, one that never spikes gives 0 Hz', () => {
    // I just above the rheobase: first spike after ≈ 10·ln(15.003/0.003) ≈ 85 ms, then one every ≈ 87 ms;
    // in 100 ms that is exactly one spike.
    const simulated = simulateFiringRates(DEFAULTS, [0, 1.5003], { duration: 100, dt: DT });
    expect(simulated.spikeCounts).toEqual([0, 1]);
    expect(simulated.rates).toEqual([0, null]);
  });
});

describe('compareWithExact', () => {
  it('compares only measurable points and counts the ones that fire too slowly', () => {
    // I = 2 nA: exact 63.04 Hz, pretend we measured 1 % more; I = 1.5003 nA: only one spike.
    const exact = exactFiringRate(DEFAULTS, 2);
    const comparison = compareWithExact(DEFAULTS, [0, 2, 1.5003], { rates: [0, exact * 1.01, null], spikeCounts: [0, 10, 1] });
    expect(comparison.largestRelativeDifference).toBeCloseTo(0.01, 10);
    expect(comparison.measuredPoints).toBe(1);
    expect(comparison.tooSlowPoints).toBe(1);
  });

  it('a spike below the rheobase is a real error: infinite difference', () => {
    const comparison = compareWithExact(DEFAULTS, [1], { rates: [10], spikeCounts: [3] });
    expect(comparison.largestRelativeDifference).toBe(Infinity);
  });
});
