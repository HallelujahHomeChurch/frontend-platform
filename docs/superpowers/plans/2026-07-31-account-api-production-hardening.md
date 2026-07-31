# Account API Production Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Account database access, concurrent registration, Redis refresh-session management, and RBAC mutations bounded and predictable before deployment.

**Architecture:** Preserve current authentication, GORM repositories, PostgreSQL migrations, and Redis token format. Add only indexes proven by existing query direction, map unique conflicts at the service boundary, pipeline Redis reads with stale cleanup, and replace request-controlled RBAC lookup loops with bounded set queries.

**Tech Stack:** Go, GORM, PostgreSQL, Redis, golang-migrate, existing Account tests

## Global Constraints

- Repository: `/Users/rayselfs/Projects/hhc/account/account-api`.
- Do not change access-token, refresh-token, cookie, MFA, OAuth, or public HTTP contracts.
- Registration remains enumeration-safe and preserves verification resend limits.
- Same user/device/client still has one active refresh session.
- Database migrations include matching down migrations and are tested through production migration files.
- Do not remove candidate redundant indexes until live `pg_stat_user_indexes` evidence exists.

---

### Task 1: Add Query-Aligned Account Indexes

**Files:**
- Create: `migrations/000008_account_query_indexes.up.sql`
- Create: `migrations/000008_account_query_indexes.down.sql`
- Modify: `internal/database/migration_integration_test.go`

**Interfaces:**
- Produces indexes:
  - `user_roles(role_id,user_id)`
  - `role_permissions(permission_id,role_id)`
  - `user_devices(last_active_at)`
  - partial avatar work queue ordered by `updated_at`

- [ ] **Step 1: Extend migration assertions**

Assert the four indexes exist after `m.Up()`, and verify migration down/up can
round-trip in an isolated PostgreSQL schema.

- [ ] **Step 2: Run the migration test**

Run with a real test database:

```bash
ACCOUNT_TEST_DATABASE_URL="$ACCOUNT_TEST_DATABASE_URL" go test ./internal/database -run TestMigrationsAndRequiredSeeds
```

Expected: FAIL because migration `000008` does not exist.

- [ ] **Step 3: Add minimal indexes**

Use `CREATE INDEX`, with the avatar index limited to rows where either pending
or retiring asset ID is non-empty and ordered by `updated_at`. The down
migration drops only these four indexes.

- [ ] **Step 4: Verify plans and commit**

Run `EXPLAIN (ANALYZE, BUFFERS)` for active-admin count, permission auth-version
bump, inactive-device deletion, and avatar work claim on representative data.

```bash
git add migrations internal/database/migration_integration_test.go
git commit -m "perf: index account maintenance queries"
```

### Task 2: Make Concurrent Registration Deterministic

**Files:**
- Modify: `internal/repository/user_repo.go`
- Modify: `internal/services/auth_service.go`
- Modify: `internal/services/auth_service_test.go`
- Create: `internal/repository/user_repo_integration_test.go`

**Interfaces:**
- Produces: repository-level recognizable duplicate-email result
- Preserves: `AuthService.Register(...) error`

- [ ] **Step 1: Add a concurrent registration test**

Start two registrations for the same normalized email. Assert exactly one user
exists and neither request produces a generic availability error. A verified
existing account maps to `ErrUserExists`; an unverified account follows the
existing bounded verification resend path.

- [ ] **Step 2: Verify failure**

Run: `go test ./internal/services -run TestAuthServiceRegisterConcurrentEmail`

- [ ] **Step 3: Map the unique constraint race**

Keep the fast pre-check, but when `CreateUser` returns the email unique
constraint, re-read the user and apply the same verified/unverified decision as
the pre-check. Do not retry arbitrary database errors.

- [ ] **Step 4: Verify and commit**

```bash
gofmt -w internal/repository internal/services
go test ./internal/services -run 'TestAuthServiceRegister'
git add internal/repository internal/services
git commit -m "fix: stabilize concurrent registration"
```

### Task 3: Bound Refresh Session Registry Work

**Files:**
- Modify: `internal/services/token_service.go`
- Modify: `internal/services/token_service_test.go`

**Interfaces:**
- Preserves Redis keys and `RefreshSession`
- Changes internal enumeration to pipelined `GET`/`DEL`/`SREM`

- [ ] **Step 1: Add stale-member and command-count tests**

Seed live and expired token hashes in a user's set. Assert listing and device
revocation return correct sessions, remove stale members, and use bounded
pipeline round trips rather than one network call per hash.

- [ ] **Step 2: Verify failure**

Run: `go test ./internal/services -run 'Test(ActiveDeviceIDs|RevokeDeviceSessions).*Stale'`

- [ ] **Step 3: Implement one internal session scan**

Add one unexported helper that obtains set members, pipelines token reads,
decodes valid sessions, and pipelines stale `SREM`. Reuse it for active-device
lookup and revocation. Revocation pipelines token deletion and active-key
cleanup but keeps replay protections unchanged.

- [ ] **Step 4: Verify replay and rotation regressions**

```bash
go test ./internal/services -run 'Test(GenerateTokenPair|RotateRefresh|ReplayedRefresh|RevokeDevice|ActiveDevice)'
git add internal/services/token_service.go internal/services/token_service_test.go
git commit -m "perf: bound refresh session registry"
```

### Task 4: Bound RBAC Assignment Queries

**Files:**
- Modify: `internal/repository/rbac_repo.go`
- Modify: `internal/repository/interfaces.go`
- Modify: `internal/services/rbac_service.go`
- Modify: `internal/services/rbac_service_test.go`
- Modify: `internal/repository/rbac_repo_integration_test.go`

**Interfaces:**
- Produces set lookup methods for role and permission IDs
- Enforces a request maximum of 100 IDs

- [ ] **Step 1: Add failing bounds and set-validation tests**

Assert over 100 IDs returns validation error before repository access, duplicate
IDs normalize once, one missing ID rejects the mutation, and valid IDs are
fetched in one set query.

- [ ] **Step 2: Implement `WHERE id IN ?` validation**

Use one repository query per resource type. Compare the returned ID set to the
normalized request before entering the existing assignment transaction. Do not
add a generic batch abstraction.

- [ ] **Step 3: Verify and commit**

```bash
gofmt -w internal/repository internal/services
go test ./internal/services ./internal/repository
git add internal/repository internal/services
git commit -m "perf: bound rbac assignments"
```

### Task 5: Account Production Gate

**Files:**
- Verify only

- [ ] **Step 1: Run complete dependencies and tests**

Start isolated PostgreSQL and Redis, run production migrations, then:

```bash
GOCACHE=/private/tmp/account-api-go-build-cache go test ./...
go vet ./...
git diff --check
```

- [ ] **Step 2: Record production evidence**

Record the four query plans, Redis command count under a representative session
set, `max replicas × DB_MAX_OPEN_CONNS`, concurrent registration result, and
rollback command. Admin search trigram indexing remains deferred until slow
query evidence shows the current small dataset needs it.
