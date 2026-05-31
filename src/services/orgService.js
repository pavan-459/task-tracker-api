const { v4: uuidv4 } = require('uuid');
const { query } = require('../config/database');
const { Errors } = require('../utils/response');

// ─── Users ────────────────────────────────────────────────────────────────────

const listUsers = async (orgId) => {
  const result = await query(
    `SELECT id, name, email, role, created_at
     FROM users
     WHERE organization_id = $1
     ORDER BY name`,
    [orgId]
  );
  return result.rows;
};

const getUser = async (userId, orgId) => {
  const result = await query(
    'SELECT id, name, email, role, created_at FROM users WHERE id = $1 AND organization_id = $2',
    [userId, orgId]
  );
  if (result.rows.length === 0) throw Errors.notFound('User');
  return result.rows[0];
};

const updateUserRole = async (requesterId, targetUserId, orgId, newRole) => {
  if (requesterId === targetUserId) {
    throw Errors.validation('You cannot change your own role');
  }

  const user = await getUser(targetUserId, orgId);
  await query(
    'UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2',
    [newRole, targetUserId]
  );

  return { ...user, role: newRole };
};

const removeUser = async (requesterId, targetUserId, orgId) => {
  if (requesterId === targetUserId) {
    throw Errors.validation('You cannot remove yourself from the organization');
  }

  await getUser(targetUserId, orgId); // ensure exists

  // Unassign their tasks
  await query(
    'UPDATE tasks SET assignee_id = NULL, updated_at = NOW() WHERE assignee_id = $1 AND organization_id = $2',
    [targetUserId, orgId]
  );

  await query('DELETE FROM users WHERE id = $1', [targetUserId]);
};

// ─── Projects ─────────────────────────────────────────────────────────────────

const listProjects = async (orgId) => {
  const result = await query(
    `SELECT p.id, p.name, p.description, p.created_at,
       COUNT(t.id) AS task_count
     FROM projects p
     LEFT JOIN tasks t ON t.project_id = p.id
     WHERE p.organization_id = $1
     GROUP BY p.id
     ORDER BY p.name`,
    [orgId]
  );
  return result.rows.map((r) => ({ ...r, taskCount: parseInt(r.task_count) }));
};

const getProject = async (projectId, orgId) => {
  const result = await query(
    `SELECT p.id, p.name, p.description, p.created_at,
       COUNT(t.id) AS task_count
     FROM projects p
     LEFT JOIN tasks t ON t.project_id = p.id
     WHERE p.id = $1 AND p.organization_id = $2
     GROUP BY p.id`,
    [projectId, orgId]
  );
  if (result.rows.length === 0) throw Errors.notFound('Project');
  const r = result.rows[0];
  return { ...r, taskCount: parseInt(r.task_count) };
};

const createProject = async (orgId, userId, { name, description }) => {
  const existing = await query(
    'SELECT id FROM projects WHERE name = $1 AND organization_id = $2',
    [name, orgId]
  );
  if (existing.rows.length > 0) {
    throw Errors.conflict('A project with this name already exists');
  }

  const id = uuidv4();
  await query(
    'INSERT INTO projects (id, name, description, organization_id, created_by) VALUES ($1,$2,$3,$4,$5)',
    [id, name, description || null, orgId, userId]
  );

  return getProject(id, orgId);
};

const updateProject = async (projectId, orgId, data) => {
  await getProject(projectId, orgId); // ensure exists

  const fields = [];
  const values = [];
  let idx = 1;

  if (data.name !== undefined) { fields.push(`name = $${idx++}`); values.push(data.name); }
  if (data.description !== undefined) { fields.push(`description = $${idx++}`); values.push(data.description); }

  if (fields.length === 0) return getProject(projectId, orgId);

  fields.push(`updated_at = NOW()`);
  values.push(projectId, orgId);

  await query(
    `UPDATE projects SET ${fields.join(', ')} WHERE id = $${idx++} AND organization_id = $${idx}`,
    values
  );

  return getProject(projectId, orgId);
};

const deleteProject = async (projectId, orgId) => {
  await getProject(projectId, orgId);

  const taskCount = await query(
    'SELECT COUNT(*) FROM tasks WHERE project_id = $1',
    [projectId]
  );
  if (parseInt(taskCount.rows[0].count) > 0) {
    throw Errors.validation(
      'Cannot delete a project with existing tasks. Remove tasks first.'
    );
  }

  await query('DELETE FROM projects WHERE id = $1 AND organization_id = $2', [projectId, orgId]);
};

module.exports = {
  listUsers, getUser, updateUserRole, removeUser,
  listProjects, getProject, createProject, updateProject, deleteProject,
};
