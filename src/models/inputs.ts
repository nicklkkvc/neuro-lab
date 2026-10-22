// Input currents as functions of time, shared by all neuron models.
// Units: t in ms, current in nA (the Hodgkin–Huxley page will use µA/cm², see docs/NOTES.md).

/** The same current at all times. */
export function constantCurrent(amplitude: number): (t: number) => number {
  return () => amplitude;
}

/** `amplitude` from `start` (inclusive) to `end` (exclusive), 0 otherwise: a switched-on electrode. */
export function stepCurrent(amplitude: number, start: number, end: number): (t: number) => number {
  return (t) => (t >= start && t < end ? amplitude : 0);
}
