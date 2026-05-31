require('dotenv').config();
const app = require('./app');
const { pool } = require('./config/database');
const { getRedis } = require('./config/redis');

const PORT = process.env.PORT || 3000;

const start = async () => {
  // Wait for Postgres
  let pgReady = false;
  let attempts = 0;
  while (!pgReady && attempts < 20) {
    try {
      await pool.query('SELECT 1');
      pgReady = true;
      console.log('✅ Postgres connected');
    } catch {
      attempts++;
      console.log(`⏳ Waiting for Postgres... (${attempts}/20)`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  if (!pgReady) {
    console.error('❌ Could not connect to Postgres. Exiting.');
    process.exit(1);
  }

  // Connect Redis (non-blocking — API works without cache)
  try {
    const redis = getRedis();
    await redis.connect();
  } catch (err) {
    console.warn('⚠️  Redis not available — caching disabled:', err.message);
  }

  const server = app.listen(PORT, () => {
    console.log(`🚀 Task Tracker API running on port ${PORT}`);
    console.log(`📖 API Docs: http://localhost:${PORT}/docs`);
    console.log(`❤️  Health:   http://localhost:${PORT}/health`);
  });

  // Graceful shutdown
  const shutdown = async (signal) => {
    console.log(`\n${signal} received — shutting down gracefully`);
    server.close(async () => {
      await pool.end();
      try {
        await getRedis().quit();
      } catch {}
      console.log('Goodbye 👋');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};

start();
