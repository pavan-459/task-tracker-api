require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const path = require('path');

const authRoutes = require('./routes/auth');
const taskRoutes = require('./routes/tasks');
const orgRoutes = require('./routes/org');
const { errorHandler } = require('./middleware/errorHandler');
const { successResponse } = require('./utils/response');

const app = express();

// ─── Security ─────────────────────────────────────────────────────────────────

app.use(helmet());
app.use(cors());
app.disable('x-powered-by');

// ─── Rate limiting ────────────────────────────────────────────────────────────

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 429, code: 'RATE_LIMITED', message: 'Too many requests, please try again later' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { status: 429, code: 'RATE_LIMITED', message: 'Too many auth attempts, please try again later' },
});

app.use(limiter);

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(express.json({ limit: '10kb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ─── API Docs ─────────────────────────────────────────────────────────────────

try {
  const swaggerDoc = YAML.load(path.join(__dirname, '../docs/openapi.yaml'));
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDoc));
} catch {
  console.warn('OpenAPI spec not found — /docs will not be available');
}

// ─── Health ───────────────────────────────────────────────────────────────────

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
});

// ─── Routes ───────────────────────────────────────────────────────────────────

app.use('/api/v1/auth', authLimiter, authRoutes);
app.use('/api/v1/tasks', taskRoutes);
app.use('/api/v1', orgRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    status: 404,
    code: 'NOT_FOUND',
    message: `Route ${req.method} ${req.path} not found`,
  });
});

// ─── Error Handler (must be last) ────────────────────────────────────────────

app.use(errorHandler);

module.exports = app;
