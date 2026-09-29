/** Mulberry32 with the complete generator state stored in the save. */
export function nextRandom(state: number): { state: number; value: number } {
  const next = (state + 0x6d2b79f5) >>> 0;
  let value = next;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return { state: next, value: ((value ^ (value >>> 14)) >>> 0) / 0x100000000 };
}

export function draw(state: { rngState: number }, maximum: number): number {
  const result = nextRandom(state.rngState);
  state.rngState = result.state;
  return Math.floor(result.value * maximum);
}

export function weightedIndex(state: { rngState: number }, weights: number[]): number {
  const total = weights.reduce((sum, weight) => sum + Math.max(0, weight), 0);
  if (total <= 0) return 0;
  let ticket = draw(state, total);
  for (let index = 0; index < weights.length; index++) {
    ticket -= Math.max(0, weights[index]);
    if (ticket < 0) return index;
  }
  return weights.length - 1;
}
