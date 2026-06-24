/**
 * Represents an entry in a weighted random table.
 */
export interface WeightedEntry<T> {
  value: T;
  weight: number;
}

/**
 * Selects a random value from a weighted table.
 * Higher weights increase the probability of selection.
 */
export function weightedRandom<T>(table: WeightedEntry<T>[]): T {
  const totalWeight = table.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = Math.random() * totalWeight;

  for (const entry of table) {
    roll -= entry.weight;
    if (roll <= 0) return entry.value;
  }

  // Fallback for floating-point edge cases
  return table[table.length - 1]!.value;
}

/**
 * Rolls a boolean chance with the given percentage (0-100).
 * e.g. rollChance(25) has a 25% chance of returning true.
 */
export function rollChance(percentChance: number): boolean {
  return Math.random() * 100 < percentChance;
}

/**
 * Returns a random integer between min and max (inclusive).
 */
export function rollBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Returns a new shuffled copy of the array using Fisher-Yates algorithm.
 * Does not mutate the original array.
 */
export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  return shuffled;
}
