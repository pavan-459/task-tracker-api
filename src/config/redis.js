const Redis = require('ioredis');

let redis;

const createRedisClient = () => {
  const client = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    retryStrategy: (times) => {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  });

  client.on('connect', () => console.log('✅ Redis connected'));
  client.on('error', (err) => console.error('❌ Redis error:', err.message));

  return client;
};

const getRedis = () => {
  if (!redis) {
    redis = createRedisClient();
  }
  return redis;
};

// Cache key builders — centralized to avoid key drift
const CacheKeys = {
  tasksByAssignee: (assigneeId, query = '') =>
    `tasks:assignee:${assigneeId}:${query}`,
  tasksByProject: (projectId, query = '') =>
    `tasks:project:${projectId}:${query}`,
  assigneePattern: (assigneeId) => `tasks:assignee:${assigneeId}:*`,
  projectPattern: (projectId) => `tasks:project:${projectId}:*`,
};

const CACHE_TTL = parseInt(process.env.CACHE_TTL) || 300; // 5 minutes default

module.exports = { getRedis, CacheKeys, CACHE_TTL };
