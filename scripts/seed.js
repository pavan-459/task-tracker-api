require('dotenv').config();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../src/config/database');

const seed = async () => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('Seeding database...');

    // Clean existing seed data
    await client.query("DELETE FROM organizations WHERE name = 'Acme Corp (Demo)'");

    const orgId = uuidv4();
    await client.query(
      "INSERT INTO organizations (id, name) VALUES ($1, 'Acme Corp (Demo)')",
      [orgId]
    );

    const password = await bcrypt.hash('Password1', 12);

    // Create users
    const adminId = uuidv4();
    const managerId = uuidv4();
    const memberId = uuidv4();

    await client.query(
      `INSERT INTO users (id, name, email, password_hash, role, organization_id) VALUES
       ($1, 'Alice Admin',   'admin@demo.com',   $4, 'ADMIN',   $7),
       ($2, 'Mark Manager',  'manager@demo.com', $5, 'MANAGER', $7),
       ($3, 'Eve Member',    'member@demo.com',  $6, 'MEMBER',  $7)`,
      [adminId, managerId, memberId, password, password, password, orgId]
    );

    // Create projects
    const proj1 = uuidv4();
    const proj2 = uuidv4();
    await client.query(
      `INSERT INTO projects (id, name, description, organization_id, created_by) VALUES
       ($1, 'Backend API', 'Core backend services', $3, $4),
       ($2, 'Marketing Site', 'Public-facing website', $3, $4)`,
      [proj1, proj2, orgId, adminId]
    );

    // Create tasks
    const tasks = [
      { title: 'Setup CI/CD pipeline', status: 'DONE', priority: 'HIGH', assigneeId: memberId, projectId: proj1 },
      { title: 'Implement auth service', status: 'IN_PROGRESS', priority: 'HIGH', assigneeId: memberId, projectId: proj1 },
      { title: 'Write API documentation', status: 'TODO', priority: 'MEDIUM', assigneeId: memberId, projectId: proj1 },
      { title: 'Database optimization', status: 'TODO', priority: 'LOW', assigneeId: managerId, projectId: proj1 },
      { title: 'Landing page redesign', status: 'IN_REVIEW', priority: 'HIGH', assigneeId: memberId, projectId: proj2 },
      { title: 'SEO audit', status: 'BLOCKED', priority: 'MEDIUM', assigneeId: null, projectId: proj2 },
    ];

    for (const t of tasks) {
      await client.query(
        `INSERT INTO tasks (id, title, status, priority, assignee_id, project_id, organization_id, created_by, due_date, completed_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,
           NOW() + INTERVAL '14 days',
           ${t.status === 'DONE' ? 'NOW() - INTERVAL \'2 days\'' : 'NULL'})`,
        [uuidv4(), t.title, t.status, t.priority, t.assigneeId, t.projectId, orgId, adminId]
      );
    }

    await client.query('COMMIT');

    console.log('✅ Seed complete');
    console.log('');
    console.log('Demo credentials:');
    console.log('  ADMIN   → admin@demo.com   / Password1');
    console.log('  MANAGER → manager@demo.com / Password1');
    console.log('  MEMBER  → member@demo.com  / Password1');
    console.log(`  Org ID  → ${orgId}`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Seed failed:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
};

seed().catch(() => process.exit(1));
