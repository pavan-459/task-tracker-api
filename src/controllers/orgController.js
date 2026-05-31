const orgService = require('../services/orgService');
const { successResponse } = require('../utils/response');

// ─── Users ────────────────────────────────────────────────────────────────────

const listUsers = async (req, res, next) => {
  try {
    const users = await orgService.listUsers(req.user.orgId);
    return successResponse(res, users);
  } catch (err) {
    next(err);
  }
};

const getUser = async (req, res, next) => {
  try {
    const user = await orgService.getUser(req.params.id, req.user.orgId);
    return successResponse(res, user);
  } catch (err) {
    next(err);
  }
};

const updateUserRole = async (req, res, next) => {
  try {
    const user = await orgService.updateUserRole(
      req.user.id,
      req.params.id,
      req.user.orgId,
      req.body.role
    );
    return successResponse(res, user);
  } catch (err) {
    next(err);
  }
};

const removeUser = async (req, res, next) => {
  try {
    await orgService.removeUser(req.user.id, req.params.id, req.user.orgId);
    return successResponse(res, { message: 'User removed from organization' });
  } catch (err) {
    next(err);
  }
};

// ─── Projects ─────────────────────────────────────────────────────────────────

const listProjects = async (req, res, next) => {
  try {
    const projects = await orgService.listProjects(req.user.orgId);
    return successResponse(res, projects);
  } catch (err) {
    next(err);
  }
};

const getProject = async (req, res, next) => {
  try {
    const project = await orgService.getProject(req.params.id, req.user.orgId);
    return successResponse(res, project);
  } catch (err) {
    next(err);
  }
};

const createProject = async (req, res, next) => {
  try {
    const project = await orgService.createProject(req.user.orgId, req.user.id, req.body);
    return successResponse(res, project, 201);
  } catch (err) {
    next(err);
  }
};

const updateProject = async (req, res, next) => {
  try {
    const project = await orgService.updateProject(req.params.id, req.user.orgId, req.body);
    return successResponse(res, project);
  } catch (err) {
    next(err);
  }
};

const deleteProject = async (req, res, next) => {
  try {
    await orgService.deleteProject(req.params.id, req.user.orgId);
    return successResponse(res, { message: 'Project deleted successfully' });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  listUsers, getUser, updateUserRole, removeUser,
  listProjects, getProject, createProject, updateProject, deleteProject,
};
