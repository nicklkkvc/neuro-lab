// Leaky integrate-and-fire (LIF) neurons.
// Theory: docs/NOTES.md, "Leaky integrate-and-fire neuron".
//
//   τ · dV/dt = −(V − V_rest) + R · I       (between spikes)
//   when V reaches θ:  spike, V ← V_reset, hold V there for t_ref
//
// Units (design decision A6): V in mV, t in ms, I in nA, R in MΩ (so R · I is in mV).
// A population holds N neurons in arrays (A4); a single neuron is a population of size 1.
// The smooth part is integrated by the solvers from Step 2; spikes, resets and the refractory
// period are handled between steps (A3).

import { createStepper, type Derivative, type SolverMethod } from './solvers.ts';

export interface LifParameters {
  /** Membrane time constant τ = R · C (ms). */
  readonly tau: number;
  /** Membrane resistance R (MΩ). */
  readonly resistance: number;
  /** Resting potential V_rest (mV). */
  readonly restPotential: number;
  /** Threshold θ (mV): reaching it fires a spike. */
  readonly threshold: number;
  /** Reset potential V_reset (mV): the voltage right after a spike. */
  readonly resetPotential: number;
  /** Refractory period t_ref (ms): how long V is held at V_reset after a spike. */
  readonly refractoryPeriod: number;
}

/** Typical textbook values (see the parameter table in docs/NOTES.md). */
export const DEFAULT_LIF_PARAMETERS: LifParameters = {
  tau: 10,
  resistance: 10,
  restPotential: -65,
  threshold: -50,
  resetPotential: -65,
  refractoryPeriod: 2,
};

/** Throws a RangeError if the parameters make no sense for the model. */
export function validateLifParameters(parameters: LifParameters): void {
  const { tau, resistance, threshold, resetPotential, refractoryPeriod } = parameters;
  if (!(tau > 0)) throw new RangeError(`τ must be > 0 ms, got ${tau}.`);
  if (!(resistance > 0)) throw new RangeError(`R must be > 0 MΩ, got ${resistance}.`);
  if (!(refractoryPeriod >= 0)) throw new RangeError(`t_ref must be ≥ 0 ms, got ${refractoryPeriod}.`);
  // With V_reset ≥ θ the neuron would fire again right after every reset.
  if (!(resetPotential < threshold)) {
    throw new RangeError(`V_reset (${resetPotential} mV) must be below the threshold (${threshold} mV).`);
  }
}

/** Rheobase I_rheo = (θ − V_rest) / R in nA: the neuron fires only for currents above it. */
export function rheobase(parameters: LifParameters): number {
  return (parameters.threshold - parameters.restPotential) / parameters.resistance;
}

/** Steady-state voltage V∞ = V_rest + R · I in mV for a constant current I (nA), ignoring spikes. */
export function steadyStateVoltage(parameters: LifParameters, current: number): number {
  return parameters.restPotential + parameters.resistance * current;
}

/** Called for every spike with the neuron's index and the interpolated spike time (ms). */
export type SpikeListener = (neuron: number, time: number) => void;

export interface LifPopulation {
  readonly size: number;
  readonly parameters: LifParameters;
  /** Membrane potential of each neuron (mV). */
  readonly voltage: Float64Array;
  /** Time (ms) until which each neuron is refractory; −Infinity if it never spiked. */
  readonly refractoryUntil: Float64Array;
  /**
   * Advances every neuron from t to t + dt (ms). `inputCurrent` holds one current per neuron (nA),
   * held constant during the step.
   */
  step(t: number, dt: number, inputCurrent: Float64Array, onSpike?: SpikeListener): void;
  /** Puts every neuron back at rest, not refractory. */
  reset(): void;
}

// With t_ref = 0 and a huge input a neuron could spike many times within one step; this bound
// guarantees the loop ends even for absurd settings.
const MAX_SPIKES_PER_STEP = 1000;

export function createLifPopulation(
  size: number,
  parameters: LifParameters = DEFAULT_LIF_PARAMETERS,
  method: SolverMethod = 'rk4',
): LifPopulation {
  validateLifParameters(parameters);
  const { tau, resistance, restPotential, threshold, resetPotential, refractoryPeriod } = parameters;

  const voltage = new Float64Array(size).fill(restPotential); // mV
  const refractoryUntil = new Float64Array(size).fill(-Infinity); // ms
  const voltageBefore = new Float64Array(size); // mV, voltage at the start of the current step
  // 1 = this neuron is refractory at the start of the step, so the shared step must not move it.
  const heldAtStart = new Uint8Array(size);
  let input: Float64Array = new Float64Array(size); // nA, the current of the step being computed

  // τ dV/dt = −(V − V_rest) + R·I  for all neurons at once; held neurons get slope 0.
  const populationDerivative: Derivative = (_t, v, dvdt) => {
    for (let i = 0; i < size; i++) {
      dvdt[i] = heldAtStart[i] === 1 ? 0 : (-(v[i] - restPotential) + resistance * input[i]) / tau;
    }
  };
  const populationStepper = createStepper(method, size);

  // A one-neuron solver for partial steps: when a refractory period ends in the middle of a
  // step, only that neuron is moved, from the end of its refractory period to the end of the step.
  let partialNeuron = 0;
  const partialVoltage = new Float64Array(1);
  const partialDerivative: Derivative = (_t, v, dvdt) => {
    dvdt[0] = (-(v[0] - restPotential) + resistance * input[partialNeuron]) / tau;
  };
  const partialStepper = createStepper(method, 1);

  /** Voltage (mV) of `neuron` after evolving freely from `startVoltage` at time `from` to time `to`. */
  function evolveFreely(neuron: number, startVoltage: number, from: number, to: number): number {
    partialNeuron = neuron;
    partialVoltage[0] = startVoltage;
    partialStepper.step(partialDerivative, from, partialVoltage, to - from);
    return partialVoltage[0];
  }

  function step(t: number, dt: number, inputCurrent: Float64Array, onSpike?: SpikeListener): void {
    if (inputCurrent.length !== size) {
      throw new RangeError(`Expected ${size} input currents, got ${inputCurrent.length}.`);
    }
    input = inputCurrent;
    const stepEnd = t + dt;

    // 1. One shared solver step for every neuron that is free for the whole step.
    for (let i = 0; i < size; i++) {
      heldAtStart[i] = refractoryUntil[i] > t ? 1 : 0;
      voltageBefore[i] = voltage[i];
    }
    populationStepper.step(populationDerivative, t, voltage, dt);

    // 2. Per neuron: finish partial steps and turn threshold crossings into spikes.
    for (let i = 0; i < size; i++) {
      // The neuron moved freely from `segmentStart` (ms, at voltage `segmentStartVoltage`) to stepEnd.
      let segmentStart = t;
      let segmentStartVoltage = voltageBefore[i];
      if (heldAtStart[i] === 1) {
        if (refractoryUntil[i] >= stepEnd) continue; // refractory for the whole step: V stays at V_reset
        segmentStart = refractoryUntil[i];
        segmentStartVoltage = resetPotential;
        voltage[i] = evolveFreely(i, resetPotential, segmentStart, stepEnd);
      }

      // "Above θ", not "at least θ": exactly at the rheobase V approaches θ forever in theory, but in
      // floating-point numbers it can land exactly on θ after a few hundred ms. That must not count.
      for (let spikes = 0; voltage[i] > threshold && spikes < MAX_SPIKES_PER_STEP; spikes++) {
        // Linear interpolation of the crossing time within the free segment (see docs/NOTES.md).
        // If the segment already started at or above θ (only possible when V_rest ≥ θ), the
        // spike happens right at its start.
        const rise = voltage[i] - segmentStartVoltage;
        const fraction = rise > 0 ? Math.min(1, Math.max(0, (threshold - segmentStartVoltage) / rise)) : 0;
        const spikeTime = segmentStart + fraction * (stepEnd - segmentStart);
        onSpike?.(i, spikeTime);

        voltage[i] = resetPotential;
        refractoryUntil[i] = spikeTime + refractoryPeriod;
        if (refractoryUntil[i] >= stepEnd) break;

        // The refractory period ended before the step did: evolve freely for the rest of it.
        segmentStart = refractoryUntil[i];
        segmentStartVoltage = resetPotential;
        voltage[i] = evolveFreely(i, resetPotential, segmentStart, stepEnd);
      }
    }
  }

  function reset(): void {
    voltage.fill(restPotential);
    refractoryUntil.fill(-Infinity);
  }

  return { size, parameters, voltage, refractoryUntil, step, reset };
}

export interface LifTrace {
  /**
   * Sample times (ms): every time step, plus two extra samples at each spike time, so that a plot
   * shows the exact moment the voltage drops from θ to V_reset.
   */
  readonly time: number[];
  /** Membrane potential at each sample (mV). */
  readonly voltage: number[];
  /** Input current at each sample (nA). */
  readonly current: number[];
  /** Interpolated spike times (ms). */
  readonly spikeTimes: number[];
}

export interface SimulationOptions {
  /** Simulated time (ms). */
  readonly duration: number;
  /** Time step (ms). */
  readonly dt: number;
  readonly method?: SolverMethod;
}

/**
 * Simulates one neuron starting at rest. `current(t)` gives the input (nA) at time t (ms); it is
 * evaluated at the start of each step and held constant during the step.
 */
export function simulateLif(
  parameters: LifParameters,
  current: (t: number) => number,
  options: SimulationOptions,
): LifTrace {
  const { duration, dt, method = 'rk4' } = options;
  const neuron = createLifPopulation(1, parameters, method);
  const steps = Math.round(duration / dt);
  const stepInput = new Float64Array(1);
  const trace = { time: [0], voltage: [neuron.voltage[0]], current: [current(0)], spikeTimes: [] as number[] };

  for (let k = 0; k < steps; k++) {
    const t = k * dt; // computed, not summed up, so the time doesn't drift (see integrate() in solvers.ts)
    stepInput[0] = current(t);
    neuron.step(t, dt, stepInput, (_neuron, spikeTime) => {
      trace.spikeTimes.push(spikeTime);
      trace.time.push(spikeTime, spikeTime);
      trace.voltage.push(parameters.threshold, parameters.resetPotential);
      trace.current.push(stepInput[0], stepInput[0]);
    });
    trace.time.push((k + 1) * dt);
    trace.voltage.push(neuron.voltage[0]);
    trace.current.push(current((k + 1) * dt));
  }
  return trace;
}
