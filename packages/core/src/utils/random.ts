export interface WeightedEntry<T> {
  value: T;
  weight: number;
}

export function weightedRandom<T>(table: WeightedEntry<T>[]): T {
  const totalWeight = table.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = Math.random() * totalWeight;

  for (const entry of table) {
    roll -= entry.weight;
    if (roll <= 0) return entry.value;
  }

  return table[table.length - 1]!.value;
}

export function rollChance(percentChance: number): boolean {
  return Math.random() * 100 < percentChance;
}

export function rollBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  return shuffled;
}
