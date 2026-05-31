const Joi = require('joi');
const { ROLES, TASK_STATUS, TASK_PRIORITY } = require('../config/constants');

// ─── Auth ────────────────────────────────────────────────────────────────────

const registerSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  email: Joi.string().email().lowercase().required(),
  password: Joi.string()
    .min(8)
    .max(128)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .required()
    .messages({
      'string.pattern.base':
        'password must contain at least one uppercase letter, one lowercase letter, and one number',
    }),
  organizationName: Joi.string().min(2).max(100).when('organizationId', {
    is: Joi.exist(),
    then: Joi.forbidden().messages({
      'any.unknown': 'provide either organizationName or organizationId, not both',
    }),
    otherwise: Joi.optional(),
  }),
  organizationId: Joi.string().uuid().optional(),
});

const loginSchema = Joi.object({
  email: Joi.string().email().lowercase().required(),
  password: Joi.string().required(),
});

const refreshSchema = Joi.object({
  refreshToken: Joi.string().required(),
});

// ─── Users ───────────────────────────────────────────────────────────────────

const updateUserRoleSchema = Joi.object({
  role: Joi.string()
    .valid(...Object.values(ROLES))
    .required(),
});

// ─── Projects ────────────────────────────────────────────────────────────────

const createProjectSchema = Joi.object({
  name: Joi.string().min(2).max(200).required(),
  description: Joi.string().max(1000).optional().allow(''),
});

const updateProjectSchema = Joi.object({
  name: Joi.string().min(2).max(200).optional(),
  description: Joi.string().max(1000).optional().allow(''),
}).min(1);

// ─── Tasks ───────────────────────────────────────────────────────────────────

const createTaskSchema = Joi.object({
  title: Joi.string().min(2).max(300).required(),
  description: Joi.string().max(5000).optional().allow(''),
  priority: Joi.string()
    .valid(...Object.values(TASK_PRIORITY))
    .default(TASK_PRIORITY.MEDIUM),
  assigneeId: Joi.string().uuid().optional().allow(null),
  dueDate: Joi.date().iso().greater('now').optional().allow(null).messages({
    'date.greater': 'due_date must be a future date',
  }),
  projectId: Joi.string().uuid().required(),
});

const updateTaskSchema = Joi.object({
  title: Joi.string().min(2).max(300).optional(),
  description: Joi.string().max(5000).optional().allow(''),
  priority: Joi.string()
    .valid(...Object.values(TASK_PRIORITY))
    .optional(),
  assigneeId: Joi.string().uuid().optional().allow(null),
  dueDate: Joi.date().iso().greater('now').optional().allow(null).messages({
    'date.greater': 'due_date must be a future date',
  }),
}).min(1);

const transitionTaskSchema = Joi.object({
  status: Joi.string()
    .valid(...Object.values(TASK_STATUS))
    .required(),
});

const taskQuerySchema = Joi.object({
  status: Joi.string()
    .valid(...Object.values(TASK_STATUS))
    .optional(),
  priority: Joi.string()
    .valid(...Object.values(TASK_PRIORITY))
    .optional(),
  assigneeId: Joi.string().uuid().optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

module.exports = {
  registerSchema,
  loginSchema,
  refreshSchema,
  updateUserRoleSchema,
  createProjectSchema,
  updateProjectSchema,
  createTaskSchema,
  updateTaskSchema,
  transitionTaskSchema,
  taskQuerySchema,
};
