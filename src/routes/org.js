const express = require('express');
const router = express.Router();
const orgController = require('../controllers/orgController');
const { authenticate } = require('../middleware/authenticate');
const { adminOnly, managerAndAbove, anyRole } = require('../middleware/authorize');
const { validate } = require('../middleware/validate');
const {
  updateUserRoleSchema,
  createProjectSchema,
  updateProjectSchema,
} = require('../validators');

router.use(authenticate);

// ─── Users ────────────────────────────────────────────────────────────────────

// View team members — all roles can see who's in the org
router.get('/users', anyRole, orgController.listUsers);
router.get('/users/:id', anyRole, orgController.getUser);

// User management — admin only
router.patch('/users/:id/role', adminOnly, validate(updateUserRoleSchema), orgController.updateUserRole);
router.delete('/users/:id', adminOnly, orgController.removeUser);

// ─── Projects ─────────────────────────────────────────────────────────────────

// View projects — all roles
router.get('/projects', anyRole, orgController.listProjects);
router.get('/projects/:id', anyRole, orgController.getProject);

// Project management — manager and above
router.post('/projects', managerAndAbove, validate(createProjectSchema), orgController.createProject);
router.patch('/projects/:id', managerAndAbove, validate(updateProjectSchema), orgController.updateProject);
router.delete('/projects/:id', adminOnly, orgController.deleteProject);

module.exports = router;
