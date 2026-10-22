import { describe, expect, it } from 'vitest';
import { createEulerStepper, createRK4Stepper, createStepper, integrate, type Derivative, type SolverMethod } from './solvers.ts';

// Test problem from docs/NOTES.md: a passive membrane relaxing back to rest.
//   dV/dt = −V/τ    V in mV (distance from rest), t in ms
//   exact: V(t) = V0 · e^(−t/τ)
const TAU = 10; // ms
const V0 = 10; // mV
const decay: Derivative = (_t, y, dydt) => {
  dydt[0] = -y[0] / TAU;
};

/** |numerical − exact| for the decay at time `endTime`, using `method` with step size `dt`. */
function decayError(method: SolverMethod, dt: number, endTime = 20): number {
  const y = Float64Array.of(V0);
  integrate(createStepper(method, 1), decay, y, { t0: 0, dt, steps: Math.round(endTime / dt) });
  return Math.abs(y[0] - V0 * Math.exp(-endTime / TAU));
}

/** error(dt) / error(dt/2) for each neighboring pair: ≈ 2^order if the method has that order. */
function halvingRatios(errors: number[]): number[] {
  return errors.slice(1).map((error, index) => errors[index] / error);
}

function expectBetween(value: number, low: number, high: number): void {
  expect(value).toBeGreaterThan(low);
  expect(value).toBeLessThan(high);
}

describe('one step, checked by hand (V0 = 10 mV, τ = 10 ms, dt = 1 ms)', () => {
  it('Euler: V1 = 10 + 1 · (−10/10) = 9', () => {
    const y = Float64Array.of(V0);
    createEulerStepper(1).step(decay, 0, y, 1);
    expect(y[0]).toBe(9);
  });

  it('RK4: V1 = 9.048375', () => {
    // k1 = −10/10                 = −1
    // k2 = −(10 − 0.5 · 1)/10     = −0.95
    // k3 = −(10 − 0.5 · 0.95)/10  = −0.9525
    // k4 = −(10 − 1 · 0.9525)/10  = −0.90475
    // V1 = 10 + (1/6)(−1 − 2·0.95 − 2·0.9525 − 0.90475) = 10 − 0.951625 = 9.048375
    const y = Float64Array.of(V0);
    createRK4Stepper(1).step(decay, 0, y, 1);
    expect(y[0]).toBeCloseTo(9.048375, 12);
  });

  it('RK4 step factor = first five terms of the series of e^(−x), x = dt/τ', () => {
    const x = 0.1;
    const factor = 1 - x + x ** 2 / 2 - x ** 3 / 6 + x ** 4 / 24;
    const y = Float64Array.of(V0);
    createRK4Stepper(1).step(decay, 0, y, x * TAU);
    expect(y[0]).toBeCloseTo(V0 * factor, 12);
  });
});

describe('order of accuracy on dV/dt = −V/τ (exact solution V0·e^(−t/τ), error at t = 20 ms)', () => {
  const stepSizes = [1, 0.5, 0.25, 0.125]; // ms, each half the previous one

  it('Euler: halving dt halves the error (order 1)', () => {
    const ratios = halvingRatios(stepSizes.map((dt) => decayError('euler', dt)));
    for (const ratio of ratios) expectBetween(ratio, 1.9, 2.1);
  });

  it('RK4: halving dt divides the error by about 16 (order 4)', () => {
    const ratios = halvingRatios(stepSizes.map((dt) => decayError('rk4', dt)));
    for (const ratio of ratios) expectBetween(ratio, 15, 17);
  });

  it('the ratios approach exactly 2 and 16 as dt gets smaller', () => {
    const eulerRatios = halvingRatios(stepSizes.map((dt) => decayError('euler', dt)));
    const rk4Ratios = halvingRatios(stepSizes.map((dt) => decayError('rk4', dt)));
    for (let i = 1; i < eulerRatios.length; i++) {
      expect(Math.abs(eulerRatios[i] - 2)).toBeLessThan(Math.abs(eulerRatios[i - 1] - 2));
      expect(Math.abs(rk4Ratios[i] - 16)).toBeLessThan(Math.abs(rk4Ratios[i - 1] - 16));
    }
  });

  it('at the same dt, RK4 is far more accurate than Euler', () => {
    expect(decayError('rk4', 1)).toBeLessThan(decayError('euler', 1) / 1000);
  });
});

describe('a system of two coupled equations: harmonic oscillator', () => {
  // x' = v, v' = −ω²x with ω = 1 rad/ms, x(0) = 1, v(0) = 0. Exact: x = cos(t), v = −sin(t).
  const oscillator: Derivative = (_t, y, dydt) => {
    dydt[0] = y[1];
    dydt[1] = -y[0];
  };
  function oscillatorError(method: SolverMethod, dt: number, endTime: number): number {
    const y = Float64Array.of(1, 0);
    integrate(createStepper(method, 2), oscillator, y, { t0: 0, dt, steps: Math.round(endTime / dt) });
    return Math.hypot(y[0] - Math.cos(endTime), y[1] + Math.sin(endTime));
  }

  it('RK4 keeps order 4 when variables depend on each other', () => {
    const ratios = halvingRatios([0.2, 0.1, 0.05].map((dt) => oscillatorError('rk4', dt, 6)));
    for (const ratio of ratios) expectBetween(ratio, 15, 17);
  });

  it('Euler keeps order 1 when variables depend on each other', () => {
    const ratios = halvingRatios([0.01, 0.005, 0.0025].map((dt) => oscillatorError('euler', dt, 6)));
    for (const ratio of ratios) expectBetween(ratio, 1.9, 2.1);
  });
});

describe('right-hand sides that depend on time', () => {
  it('RK4 is exact for dy/dt = 4t³ (it equals Simpson’s rule, which is exact for cubics)', () => {
    // Only exact if the slopes are measured at t, t + dt/2 and t + dt, so this checks those times.
    const y = Float64Array.of(0);
    const cubicSlope: Derivative = (t, _y, dydt) => {
      dydt[0] = 4 * t ** 3;
    };
    integrate(createRK4Stepper(1), cubicSlope, y, { t0: 0, dt: 0.5, steps: 4 });
    expect(y[0]).toBeCloseTo(16, 12); // exact: y(2) = 2⁴ = 16
  });

  it('Euler on dy/dt = t is a left Riemann sum: error = T · dt / 2', () => {
    // y(2) ≈ 0.5 · (0 + 0.5 + 1 + 1.5) = 1.5, exact 2²/2 = 2, error 2 · 0.5 / 2 = 0.5
    const y = Float64Array.of(0);
    const linearSlope: Derivative = (t, _y, dydt) => {
      dydt[0] = t;
    };
    integrate(createEulerStepper(1), linearSlope, y, { t0: 0, dt: 0.5, steps: 4 });
    expect(y[0]).toBe(1.5);
  });

  it('steppers measure the slope at the right times', () => {
    const times: Record<SolverMethod, number[]> = { euler: [], rk4: [] };
    for (const method of ['euler', 'rk4'] as const) {
      const recordTime: Derivative = (t, _y, dydt) => {
        times[method].push(t);
        dydt[0] = 0;
      };
      createStepper(method, 1).step(recordTime, 3, Float64Array.of(0), 0.5);
    }
    expect(times.euler).toEqual([3]);
    expect(times.rk4).toEqual([3, 3.25, 3.25, 3.5]);
  });
});

describe('many neurons at once', () => {
  it('1000 independent decays with different τ each match their exact solution', () => {
    const count = 1000;
    const tau = Float64Array.from({ length: count }, (_, i) => 1 + i / 100); // 1 to 11 ms
    const y = new Float64Array(count).fill(V0);
    const manyDecays: Derivative = (_t, state, dydt) => {
      for (let i = 0; i < count; i++) dydt[i] = -state[i] / tau[i];
    };
    integrate(createRK4Stepper(count), manyDecays, y, { t0: 0, dt: 0.01, steps: 500 }); // to t = 5 ms
    for (let i = 0; i < count; i++) {
      const exact = V0 * Math.exp(-5 / tau[i]);
      expect(Math.abs(y[i] - exact) / exact).toBeLessThan(1e-8);
    }
  });
});

describe('stability: too big steps make the solution explode (docs/NOTES.md)', () => {
  /** V after `steps` steps of size dt, for the decay with τ = 10 ms. */
  function decayAfter(method: SolverMethod, dt: number, steps: number): number {
    const y = Float64Array.of(V0);
    integrate(createStepper(method, 1), decay, y, { t0: 0, dt, steps });
    return y[0];
  }
  const rk4Factor = (x: number) => 1 - x + x ** 2 / 2 - x ** 3 / 6 + x ** 4 / 24; // x = dt/τ

  it('Euler with τ < dt < 2τ: the sign flips every step, but the size still shrinks', () => {
    expect(decayAfter('euler', 15, 1)).toBe(-5); // factor 1 − 15/10 = −0.5
    expect(decayAfter('euler', 15, 10)).toBeCloseTo(V0 * (-0.5) ** 10, 12);
  });

  it('Euler with dt > 2τ grows without limit, although the true solution decays', () => {
    const after10 = decayAfter('euler', 25, 10); // factor 1 − 25/10 = −1.5
    expect(after10).toBeCloseTo(V0 * (-1.5) ** 10, 9); // ≈ 576.7 mV instead of ≈ 0
    expect(Math.abs(after10)).toBeGreaterThan(V0);
  });

  it('RK4 is still stable at dt = 2.5τ but explodes at dt = 3τ (limit ≈ 2.8τ)', () => {
    expect(rk4Factor(2.5)).toBeCloseTo(0.6484375, 12);
    expect(rk4Factor(3)).toBeCloseTo(1.375, 12);
    expect(decayAfter('rk4', 25, 10)).toBeCloseTo(V0 * rk4Factor(2.5) ** 10, 9);
    expect(decayAfter('rk4', 30, 10)).toBeCloseTo(V0 * rk4Factor(3) ** 10, 9);
    expect(Math.abs(decayAfter('rk4', 30, 10))).toBeGreaterThan(V0);
  });
});

describe('integrate()', () => {
  it('computes times as t0 + k · dt, so 1000 steps of 0.1 ms end at exactly 100 ms', () => {
    const times: number[] = [];
    const end = integrate(createEulerStepper(1), decay, Float64Array.of(V0), {
      t0: 0,
      dt: 0.1,
      steps: 1000,
      afterStep: (t) => times.push(t),
    });
    expect(end).toBe(100);
    expect(times).toHaveLength(1000);
    expect(times[0]).toBe(0.1);
    expect(times[999]).toBe(100);

    // The claim in the comment of integrate(): repeated addition drifts.
    let sum = 0;
    for (let k = 0; k < 1000; k++) sum += 0.1;
    expect(sum).toBe(99.9999999999986);
  });

  it('afterStep can apply a jump between steps (how a spike reset will work)', () => {
    // Decay from 10 mV; whenever V falls below 5 mV, set it back to 10 mV.
    // Falling to half takes τ · ln 2 ≈ 6.93 ms, so within 10 ms there is exactly one reset.
    let resets = 0;
    const y = Float64Array.of(V0);
    integrate(createRK4Stepper(1), decay, y, {
      t0: 0,
      dt: 0.1,
      steps: 100,
      afterStep: (_t, state) => {
        if (state[0] < 5) {
          state[0] = V0;
          resets++;
        }
      },
    });
    expect(resets).toBe(1);
    expect(y[0]).toBeGreaterThan(5);
  });

  it('does nothing for 0 steps and rejects invalid step counts', () => {
    const y = Float64Array.of(V0);
    expect(integrate(createRK4Stepper(1), decay, y, { t0: 2, dt: 0.1, steps: 0 })).toBe(2);
    expect(y[0]).toBe(V0);
    expect(() => integrate(createRK4Stepper(1), decay, y, { t0: 0, dt: 0.1, steps: 1.5 })).toThrow(RangeError);
    expect(() => integrate(createRK4Stepper(1), decay, y, { t0: 0, dt: 0.1, steps: -1 })).toThrow(RangeError);
  });
});

describe('steppers', () => {
  it('report their method, order and size', () => {
    expect(createStepper('euler', 3)).toMatchObject({ method: 'euler', order: 1, size: 3 });
    expect(createStepper('rk4', 5)).toMatchObject({ method: 'rk4', order: 4, size: 5 });
  });

  it('refuse a state of the wrong size', () => {
    expect(() => createRK4Stepper(2).step(decay, 0, Float64Array.of(1), 0.1)).toThrow(RangeError);
  });
});
