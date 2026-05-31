const taskService = require('../services/taskService');
const { successResponse } = require('../utils/response');

const list = async (req, res, next) => {
  try {
    const result = await taskService.listTasks(req.user, req.query);
    return successResponse(res, result.tasks, 200, result.meta);
  } catch (err) {
    next(err);
  }
};

const get = async (req, res, next) => {
  try {
    const task = await taskService.getTask(req.user, req.params.id);
    return successResponse(res, task);
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  try {
    const task = await taskService.createTask(req.user, req.body);
    return successResponse(res, task, 201);
  } catch (err) {
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const task = await taskService.updateTask(req.user, req.params.id, req.body);
    return successResponse(res, task);
  } catch (err) {
    next(err);
  }
};

const transition = async (req, res, next) => {
  try {
    const task = await taskService.transitionTask(req.user, req.params.id, req.body.status);
    return successResponse(res, task);
  } catch (err) {
    next(err);
  }
};

const remove = async (req, res, next) => {
  try {
    await taskService.deleteTask(req.user, req.params.id);
    return successResponse(res, { message: 'Task deleted successfully' });
  } catch (err) {
    next(err);
  }
};

const analytics = async (req, res, next) => {
  try {
    const data = await taskService.getAnalytics(req.user);
    return successResponse(res, data);
  } catch (err) {
    next(err);
  }
};

module.exports = { list, get, create, update, transition, remove, analytics };
