require('dotenv').config();
const { pool } = require('../src/config/database');

const migrate = async () => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('Running migrations...');

    await client.query(`
      CREATE EXTENSION IF NOT EXISTS "pgcrypto";

      -- Organizations
      CREATE TABLE IF NOT EXISTS organizations (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name        VARCHAR(200) NOT NULL,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      -- Users
      -- Design decision: role stored directly on users table (not a join table) because
      -- in this system a user has exactly one role per organization. A join table would
      -- add complexity without benefit given the requirement spec.
      CREATE TABLE IF NOT EXISTS users (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name            VARCHAR(200) NOT NULL,
        email           VARCHAR(320) NOT NULL UNIQUE,
        password_hash   TEXT NOT NULL,
        role            VARCHAR(20) NOT NULL DEFAULT 'MEMBER'
                          CHECK (role IN ('ADMIN', 'MANAGER', 'MEMBER')),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      -- Refresh tokens (hashed, bounded per-user)
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash  TEXT NOT NULL,
        expires_at  TIMESTAMPTZ NOT NULL,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      -- Projects
      CREATE TABLE IF NOT EXISTS projects (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name            VARCHAR(200) NOT NULL,
        description     TEXT,
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (name, organization_id)
      );

      -- Tasks
      -- Indexes on status, assignee_id, due_date chosen because these are the
      -- three most common filter dimensions in the list endpoint. Composite
      -- index on (organization_id, assignee_id) covers the MEMBER list query.
      CREATE TABLE IF NOT EXISTS tasks (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title           VARCHAR(300) NOT NULL,
        description     TEXT,
        status          VARCHAR(20) NOT NULL DEFAULT 'TODO'
                          CHECK (status IN ('TODO','IN_PROGRESS','IN_REVIEW','DONE','BLOCKED')),
        priority        VARCHAR(10) NOT NULL DEFAULT 'MEDIUM'
                          CHECK (priority IN ('LOW','MEDIUM','HIGH')),
        assignee_id     UUID REFERENCES users(id) ON DELETE SET NULL,
        due_date        TIMESTAMPTZ,
        completed_at    TIMESTAMPTZ,
        project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      -- ─── Indexes ───────────────────────────────────────────────────────────
      -- Primary filter: tasks by org + assignee (covers MEMBER list query)
      CREATE INDEX IF NOT EXISTS idx_tasks_org_assignee
        ON tasks(organization_id, assignee_id);

      -- Filter by status within an org
      CREATE INDEX IF NOT EXISTS idx_tasks_org_status
        ON tasks(organization_id, status);

      -- Filter by priority within an org
      CREATE INDEX IF NOT EXISTS idx_tasks_org_priority
        ON tasks(organization_id, priority);

      -- Due date: used for overdue analytics and sorting
      CREATE INDEX IF NOT EXISTS idx_tasks_due_date
        ON tasks(due_date) WHERE due_date IS NOT NULL;

      -- Refresh token lookup by user
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user
        ON refresh_tokens(user_id);

      -- User lookup by email (unique constraint creates this, but explicit for clarity)
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

      -- User lookup by org (for listing team members)
      CREATE INDEX IF NOT EXISTS idx_users_org ON users(organization_id);
    `);

    await client.query('COMMIT');
    console.log('✅ Migrations complete');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
};

migrate().catch(() => process.exit(1));
