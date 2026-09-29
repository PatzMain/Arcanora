import type { Resources } from './types.js';

export const ZERO: Resources = { timber: 0, provisions: 0, essence: 0 };
export function resources(value: Partial<Resources> = {}): Resources {
  return { timber: value.timber ?? 0, provisions: value.provisions ?? 0, essence: value.essence ?? 0 };
}
export function addResources(left: Resources, right: Partial<Resources>): Resources {
  return { timber: left.timber + (right.timber ?? 0), provisions: left.provisions + (right.provisions ?? 0), essence: left.essence + (right.essence ?? 0) };
}
export function canAfford(stock: Resources, cost: Partial<Resources>): boolean {
  return stock.timber >= (cost.timber ?? 0) && stock.provisions >= (cost.provisions ?? 0) && stock.essence >= (cost.essence ?? 0);
}
export function subtractResources(stock: Resources, cost: Partial<Resources>): Resources {
  return { timber: stock.timber - (cost.timber ?? 0), provisions: stock.provisions - (cost.provisions ?? 0), essence: stock.essence - (cost.essence ?? 0) };
}
export function clamp(value: number, minimum: number, maximum: number): number { return Math.min(maximum, Math.max(minimum, value)); }
