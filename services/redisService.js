/**
 * Redis Cache Service
 *
 * High-performance caching with Redis + in-memory fallback.
 * Supports both single-server and distributed deployments.
 *
 * Usage:
 *   const cache = require('./services/redisService');
 *   await cache.get('key', async () => fetchData(), 300);
 *   await cache.set('key', value, 300);
 *   await cache.invalidate('key');
 */

const Redis = require('ioredis');

class RedisCacheService {
  constructor() {
    this.redis = null;
    this.memoryCache = new Map();
    this.stats = { hits: 0, misses: 0, redisConnected: false };
    this.prefix = 'bt:'; // BananaTalk prefix

    this.connect();
    this.startCleanup();
  }

  /**
   * Connect to Redis
   */
  connect() {
    const redisUrl = process.env.REDIS_URL;

    if (!redisUrl) {
      console.log('⚠️ REDIS_URL not set. Using in-memory cache (not recommended for production)');
      return;
    }

    try {
      this.redis = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        retryDelayOnFailover: 100,
        enableReadyCheck: true,
        lazyConnect: true
      });

      this.redis.on('connect', () => {
        console.log('✅ Redis connected');
        this.stats.redisConnected = true;
      });

      this.redis.on('error', (err) => {
        console.error('❌ Redis error:', err.message);
        this.stats.redisConnected = false;
      });

      this.redis.on('close', () => {
        console.log('⚠️ Redis connection closed');
        this.stats.redisConnected = false;
      });

      this.redis.connect().catch(err => {
        console.error('❌ Redis connection failed:', err.message);
      });
    } catch (err) {
      console.error('❌ Redis initialization error:', err.message);
    }
  }

  /**
   * Check if Redis is available
   */
  isRedisAvailable() {
    return this.redis && this.stats.redisConnected;
  }

  /**
   * Get value from cache or fetch and cache it
   * @param {string} key - Cache key
   * @param {Function} fetcher - Async function to fetch data if not cached
   * @param {number} ttlSeconds - Time to live in seconds (default: 300 = 5min)
   * @returns {Promise<any>} - Cached or fetched value
   */
  async get(key, fetcher, ttlSeconds = 300) {
    const fullKey = this.prefix + key;

    try {
      // Try Redis first
      if (this.isRedisAvailable()) {
        const cached = await this.redis.get(fullKey);
        if (cached) {
          this.stats.hits++;
          return JSON.parse(cached);
        }
      } else {
        // Fallback to memory cache
        const memCached = this.memoryCache.get(fullKey);
        if (memCached && memCached.expiresAt > Date.now()) {
          this.stats.hits++;
          return memCached.value;
        }
      }

      // Cache miss - fetch data
      this.stats.misses++;
      const value = await fetcher();

      // Store in cache
      await this.set(key, value, ttlSeconds);

      return value;
    } catch (err) {
      console.error('Cache get error:', err.message);
      // On error, just fetch fresh
      return fetcher();
    }
  }

  /**
   * Set a value in cache
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number} ttlSeconds - Time to live in seconds
   */
  async set(key, value, ttlSeconds = 300) {
    const fullKey = this.prefix + key;

    try {
      if (this.isRedisAvailable()) {
        await this.redis.setex(fullKey, ttlSeconds, JSON.stringify(value));
      } else {
        this.memoryCache.set(fullKey, {
          value,
          expiresAt: Date.now() + (ttlSeconds * 1000)
        });
      }
    } catch (err) {
      console.error('Cache set error:', err.message);
      // Fallback to memory
      this.memoryCache.set(fullKey, {
        value,
        expiresAt: Date.now() + (ttlSeconds * 1000)
      });
    }
  }

  /**
   * Invalidate a specific cache key
   * @param {string} key - Cache key to invalidate
   */
  async invalidate(key) {
    const fullKey = this.prefix + key;

    try {
      if (this.isRedisAvailable()) {
        await this.redis.del(fullKey);
      }
      this.memoryCache.delete(fullKey);
    } catch (err) {
      console.error('Cache invalidate error:', err.message);
    }
  }

  /**
   * Invalidate all keys matching a pattern
   * @param {string} pattern - Pattern to match
   */
  async invalidatePattern(pattern) {
    const fullPattern = this.prefix + pattern;

    try {
      if (this.isRedisAvailable()) {
        const keys = await this.redis.keys(fullPattern + '*');
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
      }

      // Also clear memory cache
      for (const key of this.memoryCache.keys()) {
        if (key.startsWith(fullPattern)) {
          this.memoryCache.delete(key);
        }
      }
    } catch (err) {
      console.error('Cache invalidatePattern error:', err.message);
    }
  }

  /**
   * Clear entire cache
   */
  async clear() {
    try {
      if (this.isRedisAvailable()) {
        const keys = await this.redis.keys(this.prefix + '*');
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
      }
      this.memoryCache.clear();
    } catch (err) {
      console.error('Cache clear error:', err.message);
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? (this.stats.hits / total * 100).toFixed(2) : 0;

    return {
      redisConnected: this.stats.redisConnected,
      memoryCacheSize: this.memoryCache.size,
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: `${hitRate}%`
    };
  }

  // ============================================
  // SPECIALIZED CACHE METHODS
  // ============================================

  /**
   * Cache user profile
   */
  async cacheUser(userId, userData, ttl = 600) {
    await this.set(`user:${userId}`, userData, ttl);
  }

  /**
   * Get cached user profile
   */
  async getCachedUser(userId, fetcher) {
    return this.get(`user:${userId}`, fetcher, 600);
  }

  /**
   * Invalidate user cache
   */
  async invalidateUser(userId) {
    await this.invalidatePattern(`user:${userId}`);
  }

  /**
   * Cache conversation list
   */
  async cacheConversations(userId, conversations, ttl = 120) {
    await this.set(`convos:${userId}`, conversations, ttl);
  }

  /**
   * Cache leaderboard
   */
  async cacheLeaderboard(type, data, ttl = 300) {
    await this.set(`leaderboard:${type}`, data, ttl);
  }

  /**
   * Get cached leaderboard
   */
  async getCachedLeaderboard(type, fetcher) {
    return this.get(`leaderboard:${type}`, fetcher, 300);
  }

  /**
   * Cache language partner recommendations
   */
  async cacheRecommendations(userId, recommendations, ttl = 1800) {
    await this.set(`recommendations:${userId}`, recommendations, ttl);
  }

  // ============================================
  // RATE LIMITING (using Redis for distributed)
  // ============================================

  /**
   * Check rate limit
   * @param {string} key - Rate limit key (e.g., 'api:userId')
   * @param {number} limit - Max requests allowed
   * @param {number} windowSeconds - Time window in seconds
   * @returns {Object} { allowed: boolean, remaining: number, resetIn: number }
   */
  async checkRateLimit(key, limit, windowSeconds) {
    const fullKey = this.prefix + 'ratelimit:' + key;

    if (!this.isRedisAvailable()) {
      // No rate limiting without Redis
      return { allowed: true, remaining: limit, resetIn: 0 };
    }

    try {
      const multi = this.redis.multi();
      multi.incr(fullKey);
      multi.ttl(fullKey);

      const results = await multi.exec();
      const count = results[0][1];
      let ttl = results[1][1];

      // Set expiry on first request
      if (ttl === -1) {
        await this.redis.expire(fullKey, windowSeconds);
        ttl = windowSeconds;
      }

      const allowed = count <= limit;
      const remaining = Math.max(0, limit - count);

      return { allowed, remaining, resetIn: ttl };
    } catch (err) {
      console.error('Rate limit check error:', err.message);
      return { allowed: true, remaining: limit, resetIn: 0 };
    }
  }

  // ============================================
  // SORTED SET OPERATIONS (for leaderboards)
  // ============================================

  /**
   * Add score to leaderboard
   */
  async addToLeaderboard(leaderboard, memberId, score) {
    if (!this.isRedisAvailable()) return;

    const key = this.prefix + 'lb:' + leaderboard;
    await this.redis.zadd(key, score, memberId);
  }

  /**
   * Get leaderboard (top N)
   */
  async getLeaderboard(leaderboard, limit = 100) {
    if (!this.isRedisAvailable()) return [];

    const key = this.prefix + 'lb:' + leaderboard;
    return this.redis.zrevrange(key, 0, limit - 1, 'WITHSCORES');
  }

  /**
   * Get user rank in leaderboard
   */
  async getLeaderboardRank(leaderboard, memberId) {
    if (!this.isRedisAvailable()) return null;

    const key = this.prefix + 'lb:' + leaderboard;
    const rank = await this.redis.zrevrank(key, memberId);
    return rank !== null ? rank + 1 : null;
  }

  /**
   * Increment leaderboard score
   */
  async incrementLeaderboardScore(leaderboard, memberId, increment) {
    if (!this.isRedisAvailable()) return;

    const key = this.prefix + 'lb:' + leaderboard;
    await this.redis.zincrby(key, increment, memberId);
  }

  // ============================================
  // CLEANUP
  // ============================================

  startCleanup() {
    // Cleanup memory cache every minute
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      let cleaned = 0;

      for (const [key, entry] of this.memoryCache.entries()) {
        if (entry.expiresAt <= now) {
          this.memoryCache.delete(key);
          cleaned++;
        }
      }

      if (cleaned > 0) {
        console.log(`🧹 Memory cache cleanup: removed ${cleaned} expired entries`);
      }
    }, 60000);
  }

  /**
   * Graceful shutdown
   */
  async destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    if (this.redis) {
      await this.redis.quit();
    }
  }
}

// Export singleton
module.exports = new RedisCacheService();
