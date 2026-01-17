/**
 * Cache Layer for Diary Data
 * Priority 2: In-memory caching with TTL (Redis alternative for edge)
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class MemoryCache {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private maxSize: number = 1000;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Cleanup expired entries every minute
    if (typeof setInterval !== 'undefined') {
      this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
    }
  }

  /**
   * Get a value from cache
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Set a value in cache with TTL (in milliseconds)
   */
  set<T>(key: string, data: T, ttlMs: number = 300000): void {
    // Enforce max size - remove oldest entries if needed
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlMs,
    });
  }

  /**
   * Delete a specific key
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Delete all keys matching a pattern
   */
  deletePattern(pattern: string): void {
    const regex = new RegExp(pattern.replace('*', '.*'));
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get cache stats
   */
  stats(): { size: number; maxSize: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
    };
  }
}

// Singleton cache instance
export const cache = new MemoryCache();

// Cache key builders
export const cacheKeys = {
  entry: (id: string) => `entry:${id}`,
  entryByDate: (userId: string, date: string) => `entry:${userId}:${date}`,
  entriesList: (userId: string, limit: number, offset: number) => 
    `entries:${userId}:${limit}:${offset}`,
  questions: (userId: string) => `questions:${userId}`,
  streak: (userId: string) => `streak:${userId}`,
  weeklyStats: (userId: string) => `stats:weekly:${userId}`,
  monthlyStats: (userId: string) => `stats:monthly:${userId}`,
};

// Cache TTLs (in milliseconds)
export const cacheTTL = {
  entry: 5 * 60 * 1000,        // 5 minutes
  entriesList: 2 * 60 * 1000,  // 2 minutes
  questions: 10 * 60 * 1000,   // 10 minutes
  streak: 5 * 60 * 1000,       // 5 minutes
  stats: 15 * 60 * 1000,       // 15 minutes
};

/**
 * Cached wrapper for database operations
 */
export async function getWithCache<T>(
  key: string,
  ttlMs: number,
  fetchFn: () => Promise<T>
): Promise<T> {
  // Try cache first
  const cached = cache.get<T>(key);
  if (cached !== null) {
    return cached;
  }

  // Fetch from database
  const data = await fetchFn();
  
  // Store in cache
  cache.set(key, data, ttlMs);
  
  return data;
}

/**
 * Invalidate cache on mutation
 */
export function invalidateEntryCache(userId: string, entryId?: string): void {
  // Invalidate specific entry
  if (entryId) {
    cache.delete(cacheKeys.entry(entryId));
  }
  
  // Invalidate list caches
  cache.deletePattern(`entries:${userId}:*`);
  
  // Invalidate streak
  cache.delete(cacheKeys.streak(userId));
  
  // Invalidate stats
  cache.delete(cacheKeys.weeklyStats(userId));
  cache.delete(cacheKeys.monthlyStats(userId));
}
