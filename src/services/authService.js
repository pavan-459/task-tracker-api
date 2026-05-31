const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../config/database');
const { generateTokenPair, verifyRefreshToken } = require('../utils/jwt');
const { Errors } = require('../utils/response');
const { ROLES } = require('../config/constants');

const SALT_ROUNDS = 12;

const register = async ({ name, email, password, organizationName, organizationId }) => {
  // Check email uniqueness
  const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rows.length > 0) {
    throw Errors.conflict('An account with this email already exists');
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const userId = uuidv4();

  // Determine org — create new or join existing
  let orgId = organizationId;

  if (!orgId) {
    // First user creates the org and becomes ADMIN
    orgId = uuidv4();
    const orgName = organizationName || `${name}'s Organization`;
    await query(
      'INSERT INTO organizations (id, name) VALUES ($1, $2)',
      [orgId, orgName]
    );
  } else {
    // Joining existing org — verify it exists
    const org = await query('SELECT id FROM organizations WHERE id = $1', [orgId]);
    if (org.rows.length === 0) {
      throw Errors.notFound('Organization');
    }
  }

  // First user in org = ADMIN, subsequent = MEMBER
  const orgUsers = await query(
    'SELECT COUNT(*) FROM users WHERE organization_id = $1',
    [orgId]
  );
  const role = parseInt(orgUsers.rows[0].count) === 0 ? ROLES.ADMIN : ROLES.MEMBER;

  await query(
    `INSERT INTO users (id, name, email, password_hash, role, organization_id)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [userId, name, email, passwordHash, role, orgId]
  );

  const user = { id: userId, email, role, organization_id: orgId };
  const tokens = generateTokenPair(user);

  // Store refresh token (hashed)
  await storeRefreshToken(userId, tokens.refreshToken);

  return {
    user: { id: userId, name, email, role, organizationId: orgId },
    ...tokens,
  };
};

const login = async ({ email, password }) => {
  const result = await query(
    'SELECT id, name, email, password_hash, role, organization_id FROM users WHERE email = $1',
    [email]
  );

  const user = result.rows[0];
  if (!user) {
    throw Errors.unauthorized('Invalid email or password');
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    throw Errors.unauthorized('Invalid email or password');
  }

  const tokens = generateTokenPair(user);
  await storeRefreshToken(user.id, tokens.refreshToken);

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      organizationId: user.organization_id,
    },
    ...tokens,
  };
};

/**
 * Refresh token rotation:
 * 1. Verify the refresh token is valid and matches stored hash
 * 2. Delete old refresh token (one-time use)
 * 3. Issue fresh token pair
 */
const refreshTokens = async (refreshToken) => {
  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch {
    throw Errors.unauthorized('Invalid or expired refresh token');
  }

  const userId = decoded.sub;
  const stored = await query(
    'SELECT id, token_hash FROM refresh_tokens WHERE user_id = $1 AND expires_at > NOW()',
    [userId]
  );

  if (stored.rows.length === 0) {
    throw Errors.unauthorized('Refresh token not found or expired');
  }

  // Validate token matches stored hash
  const match = await Promise.any(
    stored.rows.map(async (row) => {
      const ok = await bcrypt.compare(refreshToken, row.token_hash);
      if (!ok) throw new Error('no match');
      return row.id;
    })
  ).catch(() => null);

  if (!match) {
    // Possible token reuse — revoke all tokens for this user
    await query('DELETE FROM refresh_tokens WHERE user_id = $1', [userId]);
    throw Errors.unauthorized('Refresh token reuse detected. Please login again.');
  }

  // Delete used token
  await query('DELETE FROM refresh_tokens WHERE id = $1', [match]);

  const userResult = await query(
    'SELECT id, email, role, organization_id FROM users WHERE id = $1',
    [userId]
  );
  const user = userResult.rows[0];

  const tokens = generateTokenPair(user);
  await storeRefreshToken(userId, tokens.refreshToken);

  return tokens;
};

const logout = async (userId) => {
  await query('DELETE FROM refresh_tokens WHERE user_id = $1', [userId]);
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const storeRefreshToken = async (userId, token) => {
  const hash = await bcrypt.hash(token, 8); // lower rounds — token is already strong
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await query(
    `INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [uuidv4(), userId, hash, expiresAt]
  );

  // Keep max 5 refresh tokens per user (multi-device support, bounded storage)
  await query(
    `DELETE FROM refresh_tokens
     WHERE user_id = $1
       AND id NOT IN (
         SELECT id FROM refresh_tokens
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT 5
       )`,
    [userId]
  );
};

module.exports = { register, login, refreshTokens, logout };
