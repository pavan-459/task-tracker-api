# Team Task Tracker API

A production-ready REST API for team-based task management with JWT authentication, role-based access control, Redis caching, and Docker containerization.

## Quick Start

```bash
git clone <repo-url>
cd task-tracker-api
docker compose up
```

That's it. The API will be available at **http://localhost:3000**.

- Swagger UI: http://localhost:3000/docs
- Health check: http://localhost:3000/health

The `migrate` service runs schema migrations and seeds demo data automatically on first boot.

### Demo credentials

| Role    | Email               | Password  |
|---------|---------------------|-----------|
| ADMIN   | admin@demo.com      | Password1 |
| MANAGER | manager@demo.com    | Password1 |
| MEMBER  | member@demo.com     | Password1 |

---

## Architecture

```
src/
├── config/         # DB, Redis, constants
├── controllers/    # Thin HTTP layer — no business logic
├── middleware/     # authenticate, authorize (RBAC), validate, errorHandler
├── models/         # (schema lives in scripts/migrate.js)
├── routes/         # Route definitions with middleware chain
├── services/       # Business logic (authService, taskService, orgService)
├── utils/          # jwt, cache, response helpers
└── validators/     # Joi schemas for all endpoints
```

**Key design principle:** controllers are intentionally thin — they call a service and return the result. All business logic, permission checks beyond the route-level RBAC, and cache management live in services.

---

## RBAC Design

Roles are enforced at **two layers**:

1. **Route middleware** (`src/middleware/authorize.js`) — coarse-grained. Blocks the wrong role before the controller runs. Example: `POST /tasks` requires `managerAndAbove`.
2. **Service layer** — fine-grained contextual checks. Example: status transitions require the requester to be the task's assignee *or* a manager, which can't be determined from role alone.

This keeps controllers free of permission logic entirely — every `req.user.role` check in a controller would be a bug by convention.

| Action                    | ADMIN | MANAGER | MEMBER |
|---------------------------|:-----:|:-------:|:------:|
| Manage users (role/remove)| ✅    | ❌      | ❌     |
| Create/delete projects    | ✅    | ✅      | ❌     |
| Create/update/delete tasks| ✅    | ✅      | ❌     |
| Transition task status    | ✅    | ✅      | Own tasks only |
| View tasks                | All   | All     | Own tasks only |
| View users & projects     | ✅    | ✅      | ✅     |
| Analytics                 | ✅    | ✅      | ❌     |

---

## Caching Strategy

**What is cached:** Task list results, keyed by assignee ID + serialized query params.

**Why assignee-scoped:** The most frequent query pattern is "show me my tasks" (MEMBER view). Scoping cache keys by assignee makes invalidation surgical — changing one user's task only busts that user's cache entries, not everyone's.

**Cache key format:**
```
tasks:assignee:{assigneeId}:{sha(queryParams)}
tasks:all:{sha(queryParams)}   ← for admin/manager queries without assignee filter
```

**Invalidation triggers (any of these busts the affected assignee's cache):**
- Task created with an assignee
- Task updated (fields or reassigned)
- Task status transitioned
- Task deleted

**Invalidation method:** Pattern-based scan using Redis `SCAN` (not `KEYS`) to avoid blocking on large keyspaces. All keys matching `tasks:assignee:{id}:*` are deleted atomically.

**Failure mode:** Cache errors are caught and logged — the request falls through to the database. The cache is a performance layer, never a dependency for correctness.

**TTL:** 5 minutes (configurable via `CACHE_TTL` env var).

---

## Database Schema

```
organizations
  id (PK), name, created_at, updated_at

users
  id (PK), name, email (UNIQUE), password_hash,
  role (ADMIN|MANAGER|MEMBER), organization_id (FK), created_at

refresh_tokens
  id (PK), user_id (FK), token_hash, expires_at, created_at

projects
  id (PK), name, description, organization_id (FK), created_by (FK), created_at

tasks
  id (PK), title, description, status, priority,
  assignee_id (FK), due_date, completed_at,
  project_id (FK), organization_id (FK), created_by (FK), created_at
```

### Design Decision: Role on the users table

Role is stored directly as a column on `users` rather than a separate `user_roles` join table. The rationale: the spec defines exactly one role per user per organization, and users belong to exactly one organization. A join table would add a join on every authenticated request with no benefit for this data shape. If multi-org membership were required in the future, migrating to a join table is straightforward — `ALTER TABLE` to remove `role`, create `org_memberships(user_id, org_id, role)`.

### Indexes

| Index | Columns | Rationale |
|-------|---------|-----------|
| `idx_tasks_org_assignee` | `(organization_id, assignee_id)` | Primary filter for MEMBER list queries |
| `idx_tasks_org_status` | `(organization_id, status)` | Status filter in list endpoint |
| `idx_tasks_org_priority` | `(organization_id, priority)` | Priority filter in list endpoint |
| `idx_tasks_due_date` | `(due_date)` WHERE NOT NULL | Overdue analytics query + sort |
| `idx_refresh_tokens_user` | `(user_id)` | Token lookup on every refresh |
| `idx_users_email` | `(email)` | Login lookup |
| `idx_users_org` | `(organization_id)` | Team member listing |

---

## Status Transitions

```
TODO ──────────────► IN_PROGRESS ──────► IN_REVIEW ──────► DONE
  │                      │                   │               (terminal)
  └──► BLOCKED ◄──────────┴───────────────────┘
         │
         └──► TODO | IN_PROGRESS  (restart from blocked)
```

Only the **task assignee** or a **MANAGER/ADMIN** can transition status.

---

## API Reference

Full interactive docs at `/docs` (Swagger UI).

### Auth
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/auth/register` | Register + get token pair |
| POST | `/api/v1/auth/login` | Login |
| POST | `/api/v1/auth/refresh` | Rotate refresh token |
| POST | `/api/v1/auth/logout` | Revoke all refresh tokens |
| GET  | `/api/v1/auth/me` | Current user |

### Tasks
| Method | Path | Role |
|--------|------|------|
| GET | `/api/v1/tasks` | All |
| POST | `/api/v1/tasks` | MANAGER+ |
| GET | `/api/v1/tasks/:id` | All |
| PATCH | `/api/v1/tasks/:id` | MANAGER+ |
| PATCH | `/api/v1/tasks/:id/status` | Assignee or MANAGER+ |
| DELETE | `/api/v1/tasks/:id` | MANAGER+ |
| GET | `/api/v1/tasks/analytics` | MANAGER+ |

### Users & Projects
| Method | Path | Role |
|--------|------|------|
| GET | `/api/v1/users` | All |
| PATCH | `/api/v1/users/:id/role` | ADMIN |
| DELETE | `/api/v1/users/:id` | ADMIN |
| GET | `/api/v1/projects` | All |
| POST | `/api/v1/projects` | MANAGER+ |
| PATCH | `/api/v1/projects/:id` | MANAGER+ |
| DELETE | `/api/v1/projects/:id` | ADMIN |

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `DB_HOST` | `postgres` | Postgres host |
| `DB_NAME` | `tasktracker` | Database name |
| `DB_USER` | `taskuser` | DB user |
| `DB_PASSWORD` | `taskpassword` | DB password |
| `REDIS_HOST` | `redis` | Redis host |
| `JWT_ACCESS_SECRET` | — | **Change in production** |
| `JWT_REFRESH_SECRET` | — | **Change in production** |
| `JWT_ACCESS_EXPIRES_IN` | `15m` | Access token TTL |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | Refresh token TTL |
| `CACHE_TTL` | `300` | Redis cache TTL (seconds) |

---

## What I'd Improve Given More Time

1. **Tests** — integration tests for the auth flow (register → login → refresh → logout) and the status transition rules are the highest-value additions. Would use `jest` + `supertest` with a test database.

2. **WebSocket notifications** — when a task's status changes, emit a `task:status_changed` event over Socket.io to the task's assignee. The service layer already has the hook point (end of `transitionTask`).

3. **Audit log table** — append-only `task_history` table recording every status transition with who made it and when. Useful for compliance and the analytics endpoint.

4. **Pagination cursor** — replace page/offset with cursor-based pagination for large datasets. Offset-based pagination degrades at high page numbers because Postgres must scan and discard rows.

5. **Secrets management** — JWT secrets via Docker secrets or a secrets manager (Vault, AWS SSM) rather than environment variables in docker-compose.

6. **Rate limiting per user** — current rate limiting is IP-based. Per-authenticated-user limiting would be more accurate.

7. **Search** — full-text search on task title/description using Postgres `tsvector`.
