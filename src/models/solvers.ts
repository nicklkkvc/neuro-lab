// Numerical solvers for systems of ordinary differential equations (ODEs):
//
//   dy/dt = f(t, y),   with the state vector y = (y[0], y[1], ..., y[n-1])
//
// Theory, error orders and limits: docs/NOTES.md, "Solving differential equations numerically".
//
// Design decisions:
// - A2: the state is a Float64Array (64-bit numbers, about 16 significant digits).
// - A3: a solver only integrates the smooth part of a model. Jumps (spike threshold and reset,
//   refractory periods, synaptic delays) are applied by the model between steps, see `afterStep`.
//   Steppers allocate their buffers once, so stepping creates no garbage for the browser to clean
//   up; that keeps large networks (300+ neurons) running smoothly.
//
// Units: the solvers don't care about units, but t and dt must use the same time unit as the
// derivative. In Neuro Lab that is always ms (design decision A6).

export type SolverMethod = 'euler' | 'rk4';

/**
 * The right-hand side of the system, dy/dt = f(t, y).
 * It must write the derivative of every state variable into `dydt` (same length as `y`) and must
 * not change `y`. Both arrays are buffers that get reused, so don't keep references to them.
 */
export type Derivative = (t: number, y: Float64Array, dydt: Float64Array) => void;

export interface Stepper {
  readonly method: SolverMethod;
  /** Global order p: halving dt divides the error at a fixed time by about 2^p. */
  readonly order: number;
  /** Number of state variables the stepper was created for. */
  readonly size: number;
  /** Advances the state `y` in place from time t to t + dt. */
  step(f: Derivative, t: number, y: Float64Array, dt: number): void;
}

function checkSize(y: Float64Array, size: number): void {
  if (y.length !== size) {
    throw new RangeError(`The state has ${y.length} values, but the stepper was made for ${size}.`);
  }
}

/** Euler's method: y ← y + dt · f(t, y). One slope per step, order 1. */
export function createEulerStepper(size: number): Stepper {
  const slope = new Float64Array(size); // f(t, y), reused every step
  return {
    method: 'euler',
    order: 1,
    size,
    step(f, t, y, dt) {
      checkSize(y, size);
      f(t, y, slope);
      for (let i = 0; i < size; i++) y[i] += dt * slope[i];
    },
  };
}

/** Classic fourth-order Runge–Kutta method: four slopes per step, weighted 1:2:2:1. Order 4. */
export function createRK4Stepper(size: number): Stepper {
  const k1 = new Float64Array(size);
  const k2 = new Float64Array(size);
  const k3 = new Float64Array(size);
  const k4 = new Float64Array(size);
  const yTrial = new Float64Array(size); // the trial point where the next slope is measured
  return {
    method: 'rk4',
    order: 4,
    size,
    step(f, t, y, dt) {
      checkSize(y, size);
      const halfDt = dt / 2;

      // k1: slope at the start of the step
      f(t, y, k1);

      // k2: slope at the middle of the step, at the point reached by following k1
      for (let i = 0; i < size; i++) yTrial[i] = y[i] + halfDt * k1[i];
      f(t + halfDt, yTrial, k2);

      // k3: slope at the middle again, now reached with the better slope k2
      for (let i = 0; i < size; i++) yTrial[i] = y[i] + halfDt * k2[i];
      f(t + halfDt, yTrial, k3);

      // k4: slope at the end of the step, reached with k3
      for (let i = 0; i < size; i++) yTrial[i] = y[i] + dt * k3[i];
      f(t + dt, yTrial, k4);

      // Weighted average of the four slopes, like Simpson's rule: the middle counts most.
      const dtOver6 = dt / 6;
      for (let i = 0; i < size; i++) y[i] += dtOver6 * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
    },
  };
}

/** Creates a stepper by name, e.g. for a "solver" dropdown on a page. */
export function createStepper(method: SolverMethod, size: number): Stepper {
  switch (method) {
    case 'euler':
      return createEulerStepper(size);
    case 'rk4':
      return createRK4Stepper(size);
  }
}

export interface IntegrateOptions {
  /** Start time (ms). */
  readonly t0: number;
  /** Step size (ms). */
  readonly dt: number;
  /** Number of steps to take. */
  readonly steps: number;
  /**
   * Called after every step with the new time and state: the place to record values and
   * (from Step 3 on) to apply jumps such as a spike reset.
   */
  readonly afterStep?: (t: number, y: Float64Array) => void;
}

/**
 * Takes `steps` steps of size `dt` starting at time `t0`, updating `y` in place.
 * Returns the final time t0 + steps · dt.
 *
 * The time of step k is computed as t0 + k · dt instead of adding dt again and again, because
 * repeated addition collects rounding errors: adding 0.1 a thousand times gives 99.9999999999986,
 * not 100.
 */
export function integrate(stepper: Stepper, f: Derivative, y: Float64Array, options: IntegrateOptions): number {
  const { t0, dt, steps, afterStep } = options;
  if (!Number.isInteger(steps) || steps < 0) {
    throw new RangeError(`steps must be a whole number ≥ 0, got ${steps}.`);
  }
  for (let k = 0; k < steps; k++) {
    stepper.step(f, t0 + k * dt, y, dt);
    afterStep?.(t0 + (k + 1) * dt, y);
  }
  return t0 + steps * dt;
}
