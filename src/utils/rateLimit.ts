const WINDOW_MS = 10_000; // 10 seconds
const MAX_ACTIONS = 5;

interface RateLimitEntry {
  timestamps: number[];
}

const limiters = new Map<string, RateLimitEntry>();

// Clean up old entries every 60 seconds to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of limiters) {
    entry.timestamps = entry.timestamps.filter((t) => now - t < WINDOW_MS);
    if (entry.timestamps.length === 0) limiters.delete(key);
  }
}, 60_000);

/**
 * Checks whether a user has exceeded the rate limit (5 actions per 10 seconds).
 * If not limited, records the current timestamp and allows the action.
 */
export function checkRateLimit(userId: string): { limited: boolean; retryAfterMs: number } {
  const now = Date.now();
  let entry = limiters.get(userId);

  if (!entry) {
    entry = { timestamps: [] };
    limiters.set(userId, entry);
  }

  // Remove expired timestamps
  entry.timestamps = entry.timestamps.filter((t) => now - t < WINDOW_MS);

  if (entry.timestamps.length >= MAX_ACTIONS) {
    const oldest = entry.timestamps[0]!;
    return { limited: true, retryAfterMs: WINDOW_MS - (now - oldest) };
  }

  entry.timestamps.push(now);
  return { limited: false, retryAfterMs: 0 };
}
