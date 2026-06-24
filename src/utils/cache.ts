import NodeCache from 'node-cache';

const defaultTTL = parseInt(process.env.CACHE_TTL_SECONDS || '300');

const cache = new NodeCache({
  stdTTL: defaultTTL,
  checkperiod: defaultTTL * 0.2,
  useClones: false,
});

export function cacheGet<T>(key: string): T | undefined {
  return cache.get<T>(key);
}

export function cacheSet<T>(key: string, value: T, ttl?: number): boolean {
  return cache.set(key, value, ttl ?? defaultTTL);
}

export function cacheDel(key: string): number {
  return cache.del(key);
}

export function cacheFlush(): void {
  cache.flushAll();
}

export { cache };
