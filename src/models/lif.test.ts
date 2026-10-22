import { describe, expect, it } from 'vitest';
import { constantCurrent, stepCurrent } from './inputs.ts';
import {
  DEFAULT_LIF_PARAMETERS as DEFAULTS,
  createLifPopulation,
  rheobase,
  simulateLif,
  steadyStateVoltage,
  validateLifParameters,
  type LifParameters,
} from './lif.ts';

// Defaults: τ = 10 ms, R = 10 MΩ, V_rest = −65 mV, θ = −50 mV, V_reset = −65 mV, t_ref = 2 ms.
const DT = 0.1; // ms, as on the page

/** Exact time (ms) to climb from `start` to θ under a constant current I (nA), from docs/NOTES.md. */
function exactClimbTime(p: LifParameters, current: number, start: number): number {
  const target = steadyStateVoltage(p, current); // V∞ = V_rest + R·I
  return p.tau * Math.log((target - start) / (target - p.threshold));
}

describe('helpers', () => {
  it('rheobase (θ − V_rest)/R = 15 mV / 10 MΩ = 1.5 nA', () => {
    expect(rheobase(DEFAULTS)).toBeCloseTo(1.5, 12);
  });

  it('steady state V∞ = V_rest + R·I = −65 + 10 · 2 = −45 mV', () => {
    expect(steadyStateVoltage(DEFAULTS, 2)).toBe(-45);
  });

  it('reject parameters that make no sense', () => {
    expect(() => validateLifParameters(DEFAULTS)).not.toThrow();
    expect(() => validateLifParameters({ ...DEFAULTS, resetPotential: -50 })).toThrow(RangeError);
    expect(() => validateLifParameters({ ...DEFAULTS, tau: 0 })).toThrow(RangeError);
    expect(() => validateLifParameters({ ...DEFAULTS, resistance: -1 })).toThrow(RangeError);
    expect(() => validateLifParameters({ ...DEFAULTS, refractoryPeriod: -1 })).toThrow(RangeError);
    expect(() => validateLifParameters({ ...DEFAULTS, tau: Number.NaN })).toThrow(RangeError);
  });
});

describe('below the threshold: charging like a capacitor', () => {
  it('follows V(t) = V_rest + R·I·(1 − e^(−t/τ)) exactly (I = 1 nA, below the rheobase)', () => {
    const trace = simulateLif(DEFAULTS, constantCurrent(1), { duration: 100, dt: DT });
    expect(trace.spikeTimes).toEqual([]);
    trace.time.forEach((t, k) => {
      const exact = -65 + 10 * 1 * (1 - Math.exp(-t / 10));
      expect(Math.abs(trace.voltage[k] - exact)).toBeLessThan(1e-6);
    });
  });

  it('a negative current pulls the voltage below rest, toward V_rest + R·I = −85 mV', () => {
    const trace = simulateLif(DEFAULTS, constantCurrent(-2), { duration: 100, dt: DT });
    const last = trace.voltage[trace.voltage.length - 1];
    expect(last).toBeCloseTo(-65 - 20 * (1 - Math.exp(-10)), 6);
  });
});

describe('the rheobase: below it the neuron never fires', () => {
  it('never fires just below the rheobase or exactly at it, even in 2 s', () => {
    for (const current of [0, 1, 0.999 * 1.5, 1.5]) {
      expect(simulateLif(DEFAULTS, constantCurrent(current), { duration: 2000, dt: DT }).spikeTimes).toEqual([]);
    }
  });

  it('fires just above the rheobase', () => {
    expect(simulateLif(DEFAULTS, constantCurrent(1.001 * 1.5), { duration: 2000, dt: DT }).spikeTimes.length).toBeGreaterThan(0);
  });

  it('fires without any input if V_rest lies above θ (negative rheobase)', () => {
    const pacemaker = { ...DEFAULTS, restPotential: -48, resetPotential: -60 };
    expect(rheobase(pacemaker)).toBeLessThan(0);
    expect(simulateLif(pacemaker, constantCurrent(0), { duration: 100, dt: DT }).spikeTimes.length).toBeGreaterThan(0);
  });
});

describe('spike times match the exact formulas', () => {
  it('first spike at t₁ = τ·ln(R·I / (R·I − (θ − V_rest))) = 10·ln 4 ≈ 13.863 ms (I = 2 nA)', () => {
    const [first] = simulateLif(DEFAULTS, constantCurrent(2), { duration: 50, dt: DT }).spikeTimes;
    expect(exactClimbTime(DEFAULTS, 2, -65)).toBeCloseTo(10 * Math.log(4), 12);
    // Without interpolation the spike would land on the grid at 13.9 ms, 0.037 ms off.
    expect(Math.abs(first - 10 * Math.log(4))).toBeLessThan(1e-3);
  });

  it('every interval = t_ref + τ·ln((R·I − (V_reset − V_rest)) / (R·I − (θ − V_rest)))', () => {
    // V_reset = −70 mV, t_ref = 3 ms, I = 2.5 nA: 3 + 10·ln(30/10) = 3 + 10·ln 3 ≈ 13.986 ms
    const p = { ...DEFAULTS, resetPotential: -70, refractoryPeriod: 3 };
    const expectedInterval = 3 + 10 * Math.log(3);
    expect(p.refractoryPeriod + exactClimbTime(p, 2.5, p.resetPotential)).toBeCloseTo(expectedInterval, 12);

    const spikes = simulateLif(p, constantCurrent(2.5), { duration: 300, dt: DT }).spikeTimes;
    expect(spikes.length).toBeGreaterThan(15);
    expect(Math.abs(spikes[0] - exactClimbTime(p, 2.5, -65))).toBeLessThan(1e-3); // first spike starts from rest
    for (let k = 1; k < spikes.length; k++) {
      expect(Math.abs(spikes[k] - spikes[k - 1] - expectedInterval)).toBeLessThan(1e-3);
    }
  });

  it('works without refractory period, even with several spikes inside one 0.1 ms step', () => {
    // I = 500 nA, t_ref = 0: interval = 10·ln(5000/4985) ≈ 0.030 ms, about 3 spikes per step
    const p = { ...DEFAULTS, refractoryPeriod: 0 };
    const expectedInterval = exactClimbTime(p, 500, -65);
    expect(expectedInterval).toBeLessThan(DT / 3);
    const spikes = simulateLif(p, constantCurrent(500), { duration: 5, dt: DT }).spikeTimes;
    expect(spikes.length).toBeGreaterThan(150);
    // Linear interpolation misses the slight bend of the curve: each spike time can be up to
    // dt²/(8τ) = 1.25e-4 ms late, so an interval can be off by at most twice that.
    const interpolationBound = DT ** 2 / (8 * p.tau);
    for (let k = 1; k < spikes.length; k++) {
      expect(Math.abs(spikes[k] - spikes[k - 1] - expectedInterval)).toBeLessThan(2 * interpolationBound);
    }
  });

  it('a step current from 50 to 150 ms: no spikes outside, first spike at 50 ms + t₁, back to rest afterwards', () => {
    const trace = simulateLif(DEFAULTS, stepCurrent(2, 50, 150), { duration: 300, dt: DT });
    const spikes = trace.spikeTimes;
    expect(Math.abs(spikes[0] - (50 + 10 * Math.log(4)))).toBeLessThan(1e-3);
    expect(spikes.every((t) => t > 50 && t < 150)).toBe(true);
    expect(trace.voltage[trace.voltage.length - 1]).toBeCloseTo(-65, 4);
  });

  it('Euler also works, but RK4 hits the first spike time more precisely', () => {
    const exact = 10 * Math.log(4);
    const [euler] = simulateLif(DEFAULTS, constantCurrent(2), { duration: 50, dt: DT, method: 'euler' }).spikeTimes;
    const [rk4] = simulateLif(DEFAULTS, constantCurrent(2), { duration: 50, dt: DT, method: 'rk4' }).spikeTimes;
    expect(Math.abs(euler - exact)).toBeLessThan(0.2);
    expect(Math.abs(rk4 - exact)).toBeLessThan(Math.abs(euler - exact));
  });
});

describe('reset and refractory period', () => {
  it('holds V exactly at V_reset during t_ref after every spike', () => {
    const p = { ...DEFAULTS, refractoryPeriod: 5 };
    const trace = simulateLif(p, constantCurrent(3), { duration: 200, dt: DT });
    expect(trace.spikeTimes.length).toBeGreaterThan(5);
    for (const spike of trace.spikeTimes) {
      trace.time.forEach((t, k) => {
        if (t > spike && t <= spike + p.refractoryPeriod) expect(trace.voltage[k]).toBe(p.resetPotential);
      });
    }
  });

  it('never lets the voltage stay above θ', () => {
    const trace = simulateLif(DEFAULTS, constantCurrent(4), { duration: 200, dt: DT });
    expect(Math.max(...trace.voltage)).toBeLessThanOrEqual(DEFAULTS.threshold);
  });
});

describe('the trace for plotting', () => {
  it('has sorted times and two extra samples per spike (θ, then V_reset)', () => {
    const trace = simulateLif(DEFAULTS, constantCurrent(2), { duration: 100, dt: DT });
    const spikes = trace.spikeTimes.length;
    expect(trace.time).toHaveLength(1000 + 1 + 2 * spikes);
    expect(trace.voltage).toHaveLength(trace.time.length);
    expect(trace.current).toHaveLength(trace.time.length);
    for (let k = 1; k < trace.time.length; k++) expect(trace.time[k]).toBeGreaterThanOrEqual(trace.time[k - 1]);
    const firstSpikeSample = trace.time.indexOf(trace.spikeTimes[0]);
    expect(trace.voltage.slice(firstSpikeSample, firstSpikeSample + 2)).toEqual([-50, -65]);
  });
});

describe('a population of neurons', () => {
  it('3 neurons with different inputs behave exactly like 3 separate neurons', () => {
    const currents = [1, 2, 3.5]; // nA
    const population = createLifPopulation(3, DEFAULTS);
    const spikes: number[][] = [[], [], []];
    const input = Float64Array.from(currents);
    for (let k = 0; k < 1000; k++) population.step(k * DT, DT, input, (neuron, time) => spikes[neuron].push(time));

    currents.forEach((current, neuron) => {
      const alone = simulateLif(DEFAULTS, constantCurrent(current), { duration: 100, dt: DT }).spikeTimes;
      expect(spikes[neuron]).toHaveLength(alone.length);
      alone.forEach((time, k) => expect(spikes[neuron][k]).toBeCloseTo(time, 12));
    });
    expect(spikes[0]).toEqual([]); // 1 nA is below the rheobase
  });

  it('reset() puts every neuron back at rest', () => {
    const population = createLifPopulation(2, DEFAULTS);
    for (let k = 0; k < 300; k++) population.step(k * DT, DT, Float64Array.of(3, 3));
    population.reset();
    expect([...population.voltage]).toEqual([-65, -65]);
    expect([...population.refractoryUntil]).toEqual([-Infinity, -Infinity]);
  });

  it('refuses the wrong number of input currents', () => {
    expect(() => createLifPopulation(2, DEFAULTS).step(0, DT, Float64Array.of(1))).toThrow(RangeError);
  });
});
