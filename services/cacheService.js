/**
 * In-Memory Cache Service
 *
 * Simple TTL-based cache for frequently accessed data.
 * Can be swapped to Redis for distributed caching later.
 *
 * Usage:
 *   const cache = require('./services/cacheService');
 *   await cache.get('key', async () => fetchData(), 300); // 5min TTL
 */

class CacheService {
  constructor() {
    this.cache = new Map();
    this.stats = { hits: 0, misses: 0 };

    // Cleanup expired entries every minute
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Get value from cache or fetch and cache it
   * @param {string} key - Cache key
   * @param {Function} fetcher - Async function to fetch data if not cached
   * @param {number} ttlSeconds - Time to live in seconds (default: 300 = 5min)
   * @returns {Promise<any>} - Cached or fetched value
   */
  async get(key, fetcher, ttlSeconds = 300) {
    const cached = this.cache.get(key);

    if (cached && cached.expiresAt > Date.now()) {
      this.stats.hits++;
      return cached.value;
    }

    this.stats.misses++;
    const value = await fetcher();

    this.cache.set(key, {
      value,
      expiresAt: Date.now() + (ttlSeconds * 1000)
    });

    return value;
  }

  /**
   * Set a value directly in cache
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number} ttlSeconds - Time to live in seconds
   */
  set(key, value, ttlSeconds = 300) {
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + (ttlSeconds * 1000)
    });
  }

  /**
   * Invalidate a specific cache key
   * @param {string} key - Cache key to invalidate
   */
  invalidate(key) {
    this.cache.delete(key);
  }

  /**
   * Invalidate all keys matching a pattern
   * @param {string} pattern - Pattern to match (simple startsWith)
   */
  invalidatePattern(pattern) {
    for (const key of this.cache.keys()) {
      if (key.startsWith(pattern)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear entire cache
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const hitRate = this.stats.hits + this.stats.misses > 0
      ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(2)
      : 0;

    return {
      size: this.cache.size,
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: `${hitRate}%`
    };
  }

  /**
   * Remove expired entries
   */
  cleanup() {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt <= now) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`🧹 Cache cleanup: removed ${cleaned} expired entries`);
    }
  }

  /**
   * Stop the cleanup interval (for graceful shutdown)
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

// Export singleton instance
module.exports = new CacheService();
