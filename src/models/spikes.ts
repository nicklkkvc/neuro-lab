// Measurements on spike trains. Spike times in ms, rates in Hz (spikes per second).

/** Number of spikes with from ≤ time < to. */
export function countSpikes(spikeTimes: readonly number[], from: number, to: number): number {
  let count = 0;
  for (const time of spikeTimes) if (time >= from && time < to) count++;
  return count;
}

/** Average firing rate (Hz) between `from` and `to` (ms): spikes divided by the duration in seconds. */
export function firingRate(spikeTimes: readonly number[], from: number, to: number): number {
  const durationInSeconds = (to - from) / 1000;
  return durationInSeconds > 0 ? countSpikes(spikeTimes, from, to) / durationInSeconds : 0;
}
