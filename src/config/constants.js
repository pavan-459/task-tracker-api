const ROLES = {
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  MEMBER: 'MEMBER',
};

const TASK_STATUS = {
  TODO: 'TODO',
  IN_PROGRESS: 'IN_PROGRESS',
  IN_REVIEW: 'IN_REVIEW',
  DONE: 'DONE',
  BLOCKED: 'BLOCKED',
};

const TASK_PRIORITY = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
};

/**
 * Valid status transitions map.
 * Key: current status → Value: array of allowed next statuses
 *
 * Design decision: BLOCKED is reachable from any active state (not DONE),
 * and from BLOCKED you can only return to TODO or IN_PROGRESS to restart work.
 */
const VALID_TRANSITIONS = {
  [TASK_STATUS.TODO]: [TASK_STATUS.IN_PROGRESS, TASK_STATUS.BLOCKED],
  [TASK_STATUS.IN_PROGRESS]: [TASK_STATUS.IN_REVIEW, TASK_STATUS.BLOCKED],
  [TASK_STATUS.IN_REVIEW]: [TASK_STATUS.DONE, TASK_STATUS.BLOCKED],
  [TASK_STATUS.DONE]: [], // terminal state
  [TASK_STATUS.BLOCKED]: [TASK_STATUS.TODO, TASK_STATUS.IN_PROGRESS],
};

const isValidTransition = (from, to) => {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
};

module.exports = {
  ROLES,
  TASK_STATUS,
  TASK_PRIORITY,
  VALID_TRANSITIONS,
  isValidTransition,
};
