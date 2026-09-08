// The same mulberry32 the battle engine uses. Packs are rolled on the server
// from a stored seed so an opening can be replayed and audited.

export interface Rng {
  /** Next float in [0, 1). */
  next(): number;
  /** Current seed, for storing alongside the result. */
  seed(): number;
}

export function makeRng(seed: number): Rng {
  let s = seed >>> 0;
  return {
    next() {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    seed() {
      return s >>> 0;
    },
  };
}

export function randomSeed(): number {
  return (Math.random() * 0xffffffff) >>> 0;
}

/**
 * Picks an entry from a weighted table. Weights are percentages and must sum to
 * 100, which `assertSumsTo100` checks at module load so a bad table cannot ship.
 */
export function pickWeighted<T>(rng: Rng, entries: readonly { value: T; weight: number }[]): T {
  const roll = rng.next() * 100;
  let seen = 0;
  for (const entry of entries) {
    seen += entry.weight;
    if (roll < seen) return entry.value;
  }
  // Only reachable through floating point drift on the very last entry
  return entries[entries.length - 1].value;
}

export function assertSumsTo100(name: string, weights: readonly number[]): void {
  const total = weights.reduce((a, b) => a + b, 0);
  // Rates are given to one decimal place, so anything past a thousandth is a typo
  if (Math.abs(total - 100) > 0.001) {
    throw new Error(`${name} must sum to 100, got ${total}`);
  }
}
