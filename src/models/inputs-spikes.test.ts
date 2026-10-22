import { describe, expect, it } from 'vitest';
import { constantCurrent, stepCurrent } from './inputs.ts';
import { countSpikes, firingRate } from './spikes.ts';

describe('input currents', () => {
  it('constant current is the same at every time', () => {
    const current = constantCurrent(2);
    expect([current(0), current(77.7), current(1e6)]).toEqual([2, 2, 2]);
  });

  it('step current is on from start (inclusive) to end (exclusive)', () => {
    const current = stepCurrent(2, 50, 150);
    expect([current(49.9), current(50), current(149.9), current(150)]).toEqual([0, 2, 2, 0]);
  });
});

describe('spike train measurements (checked by hand)', () => {
  const spikes = [10, 20, 30, 150]; // ms

  it('counts spikes in [from, to)', () => {
    expect(countSpikes(spikes, 0, 100)).toBe(3);
    expect(countSpikes(spikes, 20, 150)).toBe(2); // 20 counts, 150 doesn't
  });

  it('firing rate = spikes / seconds: 3 spikes in 100 ms = 30 Hz', () => {
    expect(firingRate(spikes, 0, 100)).toBeCloseTo(30, 12);
    expect(firingRate(spikes, 50, 50)).toBe(0); // empty window
  });
});
