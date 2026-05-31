const { v4: uuidv4 } = require('uuid');
const { query } = require('../config/database');
const { CacheKeys } = require('../config/redis');
const { cacheGet, cacheSet, cacheDelPattern } = require('../utils/cache');
const { Errors } = require('../utils/response');
const { ROLES, isValidTransition } = require('../config/constants');

// ─── List Tasks ───────────────────────────────────────────────────────────────

/**
 * List tasks with pagination and filtering.
 *
 * Caching strategy:
 * - Cache keyed by assigneeId + serialized query params
 * - Cache is invalidated whenever a task assigned to that user is created,
 *   updated, or has its status changed
 * - Members only see their own tasks (enforced here, not in routes)
 */
const listTasks = async (user, filters) => {
  const { status, priority, assigneeId, page, limit } = filters;
  const offset = (page - 1) * limit;

  // MEMBERs can only see their own tasks
  const effectiveAssigneeId =
    user.role === ROLES.MEMBER ? user.id : assigneeId || null;

  // Build cache key from the effective query
  const queryFingerprint = JSON.stringify({ status, priority, effectiveAssigneeId, page, limit });
  const cacheKey = effectiveAssigneeId
    ? CacheKeys.tasksByAssignee(effectiveAssigneeId, queryFingerprint)
    : `tasks:all:${queryFingerprint}`;

  const cached = await cacheGet(cacheKey);
  if (cached) {
    return { ...cached, fromCache: true };
  }

  // Dynamic query builder
  const conditions = ['t.organization_id = $1'];
  const params = [user.orgId];
  let idx = 2;

  if (effectiveAssigneeId) {
    conditions.push(`t.assignee_id = $${idx++}`);
    params.push(effectiveAssigneeId);
  }
  if (status) {
    conditions.push(`t.status = $${idx++}`);
    params.push(status);
  }
  if (priority) {
    conditions.push(`t.priority = $${idx++}`);
    params.push(priority);
  }

  const where = conditions.join(' AND ');

  const [taskResult, countResult] = await Promise.all([
    query(
      `SELECT
         t.id, t.title, t.description, t.status, t.priority,
         t.due_date, t.created_at, t.updated_at,
         t.project_id,
         p.name AS project_name,
         t.assignee_id,
         u.name AS assignee_name,
         u.email AS assignee_email,
         creator.name AS creator_name
       FROM tasks t
       LEFT JOIN projects p ON t.project_id = p.id
       LEFT JOIN users u ON t.assignee_id = u.id
       LEFT JOIN users creator ON t.created_by = creator.id
       WHERE ${where}
       ORDER BY
         CASE t.priority WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END,
         t.due_date ASC NULLS LAST,
         t.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset]
    ),
    query(
      `SELECT COUNT(*) FROM tasks t WHERE ${where}`,
      params
    ),
  ]);

  const total = parseInt(countResult.rows[0].count);
  const result = {
    tasks: taskResult.rows.map(formatTask),
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };

  await cacheSet(cacheKey, result);
  return result;
};

// ─── Get Single Task ──────────────────────────────────────────────────────────

const getTask = async (user, taskId) => {
  const result = await query(
    `SELECT
       t.id, t.title, t.description, t.status, t.priority,
       t.due_date, t.created_at, t.updated_at,
       t.project_id, p.name AS project_name,
       t.assignee_id, u.name AS assignee_name, u.email AS assignee_email,
       t.created_by, creator.name AS creator_name
     FROM tasks t
     LEFT JOIN projects p ON t.project_id = p.id
     LEFT JOIN users u ON t.assignee_id = u.id
     LEFT JOIN users creator ON t.created_by = creator.id
     WHERE t.id = $1 AND t.organization_id = $2`,
    [taskId, user.orgId]
  );

  if (result.rows.length === 0) throw Errors.notFound('Task');

  const task = result.rows[0];

  // MEMBERs may only view tasks assigned to them
  if (user.role === ROLES.MEMBER && task.assignee_id !== user.id) {
    throw Errors.forbidden();
  }

  return formatTask(task);
};

// ─── Create Task ──────────────────────────────────────────────────────────────

const createTask = async (user, data) => {
  const { title, description, priority, assigneeId, dueDate, projectId } = data;

  // Verify project belongs to this org
  const project = await query(
    'SELECT id FROM projects WHERE id = $1 AND organization_id = $2',
    [projectId, user.orgId]
  );
  if (project.rows.length === 0) throw Errors.notFound('Project');

  // Verify assignee is in same org
  if (assigneeId) {
    const assignee = await query(
      'SELECT id FROM users WHERE id = $1 AND organization_id = $2',
      [assigneeId, user.orgId]
    );
    if (assignee.rows.length === 0) throw Errors.notFound('Assignee');
  }

  const taskId = uuidv4();
  const result = await query(
    `INSERT INTO tasks
       (id, title, description, priority, status, assignee_id, due_date, project_id, organization_id, created_by)
     VALUES ($1,$2,$3,$4,'TODO',$5,$6,$7,$8,$9)
     RETURNING *`,
    [taskId, title, description || null, priority, assigneeId || null, dueDate || null, projectId, user.orgId, user.id]
  );

  // Invalidate cache for affected assignee
  if (assigneeId) {
    await cacheDelPattern(CacheKeys.assigneePattern(assigneeId));
  }

  return getTask(user, taskId);
};

// ─── Update Task ──────────────────────────────────────────────────────────────

const updateTask = async (user, taskId, data) => {
  const existing = await getTask(user, taskId);

  if (user.role === ROLES.MEMBER) {
    throw Errors.forbidden('Members cannot edit task details');
  }

  if (data.assigneeId) {
    const assignee = await query(
      'SELECT id FROM users WHERE id = $1 AND organization_id = $2',
      [data.assigneeId, user.orgId]
    );
    if (assignee.rows.length === 0) throw Errors.notFound('Assignee');
  }

  const fields = [];
  const values = [];
  let idx = 1;

  const updateMap = {
    title: data.title,
    description: data.description,
    priority: data.priority,
    assignee_id: data.assigneeId,
    due_date: data.dueDate,
  };

  for (const [col, val] of Object.entries(updateMap)) {
    if (val !== undefined) {
      fields.push(`${col} = $${idx++}`);
      values.push(val);
    }
  }

  if (fields.length === 0) return existing;

  fields.push(`updated_at = NOW()`);
  values.push(taskId, user.orgId);

  await query(
    `UPDATE tasks SET ${fields.join(', ')} WHERE id = $${idx++} AND organization_id = $${idx}`,
    values
  );

  // Invalidate cache for old and new assignee
  const affectedAssignees = new Set([existing.assigneeId, data.assigneeId].filter(Boolean));
  for (const id of affectedAssignees) {
    await cacheDelPattern(CacheKeys.assigneePattern(id));
  }

  return getTask(user, taskId);
};

// ─── Transition Task Status ───────────────────────────────────────────────────

/**
 * Enforces valid status transitions.
 * Only assignee or MANAGER+ can advance status.
 */
const transitionTask = async (user, taskId, newStatus) => {
  const task = await getTask(user, taskId);

  // Permission check: only assignee or MANAGER+ can change status
  const isAssignee = task.assigneeId === user.id;
  const isManagerOrAbove = [ROLES.ADMIN, ROLES.MANAGER].includes(user.role);

  if (!isAssignee && !isManagerOrAbove) {
    throw Errors.forbidden('Only the task assignee or a manager can change task status');
  }

  if (!isValidTransition(task.status, newStatus)) {
    throw Errors.invalidTransition(task.status, newStatus);
  }

  const completedAt = newStatus === 'DONE' ? 'NOW()' : 'NULL';

  await query(
    `UPDATE tasks
     SET status = $1, completed_at = ${completedAt}, updated_at = NOW()
     WHERE id = $2 AND organization_id = $3`,
    [newStatus, taskId, user.orgId]
  );

  // Invalidate assignee's cache
  if (task.assigneeId) {
    await cacheDelPattern(CacheKeys.assigneePattern(task.assigneeId));
  }

  return getTask(user, taskId);
};

// ─── Delete Task ──────────────────────────────────────────────────────────────

const deleteTask = async (user, taskId) => {
  const task = await getTask(user, taskId);

  await query(
    'DELETE FROM tasks WHERE id = $1 AND organization_id = $2',
    [taskId, user.orgId]
  );

  if (task.assigneeId) {
    await cacheDelPattern(CacheKeys.assigneePattern(task.assigneeId));
  }
};

// ─── Analytics ────────────────────────────────────────────────────────────────

const getAnalytics = async (user) => {
  const [overdueResult, completionResult] = await Promise.all([
    query(
      `SELECT
         u.id, u.name, u.email,
         COUNT(t.id) AS overdue_count
       FROM users u
       LEFT JOIN tasks t ON t.assignee_id = u.id
         AND t.due_date < NOW()
         AND t.status NOT IN ('DONE', 'BLOCKED')
       WHERE u.organization_id = $1
       GROUP BY u.id, u.name, u.email
       ORDER BY overdue_count DESC`,
      [user.orgId]
    ),
    query(
      `SELECT
         u.id, u.name,
         AVG(
           EXTRACT(EPOCH FROM (t.completed_at - t.created_at)) / 3600
         ) AS avg_completion_hours,
         COUNT(t.id) FILTER (WHERE t.status = 'DONE') AS completed_count
       FROM users u
       LEFT JOIN tasks t ON t.assignee_id = u.id AND t.completed_at IS NOT NULL
       WHERE u.organization_id = $1
       GROUP BY u.id, u.name`,
      [user.orgId]
    ),
  ]);

  // Merge results by user id
  const completionMap = {};
  for (const row of completionResult.rows) {
    completionMap[row.id] = {
      avgCompletionHours: row.avg_completion_hours
        ? parseFloat(row.avg_completion_hours).toFixed(2)
        : null,
      completedCount: parseInt(row.completed_count),
    };
  }

  return overdueResult.rows.map((row) => ({
    userId: row.id,
    name: row.name,
    email: row.email,
    overdueCount: parseInt(row.overdue_count),
    ...completionMap[row.id],
  }));
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatTask = (row) => ({
  id: row.id,
  title: row.title,
  description: row.description,
  status: row.status,
  priority: row.priority,
  dueDate: row.due_date,
  projectId: row.project_id,
  projectName: row.project_name,
  assigneeId: row.assignee_id,
  assigneeName: row.assignee_name,
  assigneeEmail: row.assignee_email,
  creatorName: row.creator_name,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

module.exports = { listTasks, getTask, createTask, updateTask, transitionTask, deleteTask, getAnalytics };
