const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');
const { authenticate } = require('../middleware/authenticate');
const { anyRole, managerAndAbove, adminOnly } = require('../middleware/authorize');
const { validate } = require('../middleware/validate');
const {
  createTaskSchema,
  updateTaskSchema,
  transitionTaskSchema,
  taskQuerySchema,
} = require('../validators');

// All task routes require authentication
router.use(authenticate);

// Analytics — manager and above only
router.get('/analytics', managerAndAbove, taskController.analytics);

// List — all roles (service layer restricts MEMBER to their own tasks)
router.get('/', anyRole, validate(taskQuerySchema, 'query'), taskController.list);

// Single task — all roles (service layer enforces MEMBER restriction)
router.get('/:id', anyRole, taskController.get);

// Create — managers and above
router.post('/', managerAndAbove, validate(createTaskSchema), taskController.create);

// Update task fields — managers and above
router.patch('/:id', managerAndAbove, validate(updateTaskSchema), taskController.update);

// Transition status — any role (service layer enforces assignee-or-manager rule)
router.patch('/:id/status', anyRole, validate(transitionTaskSchema), taskController.transition);

// Delete — managers and above
router.delete('/:id', managerAndAbove, taskController.remove);

module.exports = router;
