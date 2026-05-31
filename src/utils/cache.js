const { getRedis, CACHE_TTL } = require('../config/redis');

/**
 * Get a value from cache.
 * Returns parsed JSON or null on miss/error.
 */
const cacheGet = async (key) => {
  try {
    const redis = getRedis();
    const value = await redis.get(key);
    return value ? JSON.parse(value) : null;
  } catch (err) {
    console.error(`Cache GET error [${key}]:`, err.message);
    return null; // degrade gracefully — never block a request on cache failure
  }
};

/**
 * Set a value in cache with optional TTL.
 */
const cacheSet = async (key, value, ttl = CACHE_TTL) => {
  try {
    const redis = getRedis();
    await redis.setex(key, ttl, JSON.stringify(value));
  } catch (err) {
    console.error(`Cache SET error [${key}]:`, err.message);
  }
};

/**
 * Delete a single cache key.
 */
const cacheDel = async (key) => {
  try {
    const redis = getRedis();
    await redis.del(key);
  } catch (err) {
    console.error(`Cache DEL error [${key}]:`, err.message);
  }
};

/**
 * Delete all keys matching a glob pattern.
 * Used for invalidating an assignee's entire task cache when tasks change.
 *
 * Strategy: We use SCAN (not KEYS) to avoid blocking Redis on large keyspaces.
 */
const cacheDelPattern = async (pattern) => {
  try {
    const redis = getRedis();
    let cursor = '0';
    const keysToDelete = [];

    do {
      const [nextCursor, keys] = await redis.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        100
      );
      cursor = nextCursor;
      keysToDelete.push(...keys);
    } while (cursor !== '0');

    if (keysToDelete.length > 0) {
      await redis.del(...keysToDelete);
      console.log(`Cache: invalidated ${keysToDelete.length} keys for pattern ${pattern}`);
    }
  } catch (err) {
    console.error(`Cache DEL PATTERN error [${pattern}]:`, err.message);
  }
};

module.exports = { cacheGet, cacheSet, cacheDel, cacheDelPattern };
