# HHC Web API Production Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove list-path N+1 queries, enforce database-level result bounds, paginate revisions, and keep CMS workflow/outbox data bounded before adding more Admin traffic.

**Architecture:** Preserve the typed CMS tables, transactional publication workflow, and OpenAPI contracts. Replace per-row hydration with a small fixed set of batch queries, push limits into SQL, and add one migration containing only query-direction and retention indexes justified by current repository code.

**Tech Stack:** Go, `database/sql`, PostgreSQL, OpenAPI 3, existing CMS repositories

## Global Constraints

- Repository: `/Users/rayselfs/Projects/hhc/hhc-web-api`.
- Preserve content, bulletin, publication, idempotency, and public projection semantics.
- List query count is constant relative to page size.
- No nested database query runs while an outer `Rows` remains open.
- Public list limits execute in SQL.
- Search trigram indexing remains evidence-driven; do not enable `pg_trgm` solely because `ILIKE` exists.
- This plan runs before `2026-07-30-hhc-web-api-content-archive.md`.

---

### Task 1: Batch Content List Hydration

**Files:**
- Modify: `internal/postgres/content_repository.go`
- Modify: `internal/postgres/repository_integration_test.go`

**Interfaces:**
- Preserves: `Repository.ListContent(...)`
- Produces: unexported batch loader for content IDs

- [ ] **Step 1: Add a one-connection regression test**

Configure the integration test database with `SetMaxOpenConns(1)`, seed several
items with translations, call `ListContent` under a short context timeout, and
assert the full page returns. The current nested query must fail or time out.

- [ ] **Step 2: Read page IDs, close rows, then batch**

Scan all page IDs, check `rows.Err()`, and close rows before hydration. Load
entries, module-specific rows, translations, and publication state with
`WHERE ... = ANY($1)` queries, then assemble items in the original ID order.
Do not create a generic ORM or reflection mapper.

- [ ] **Step 3: Verify fixed query behavior**

Run: `go test ./internal/postgres -run TestListContentWithSingleConnection`

Expected: PASS for page sizes `1` and `100`.

- [ ] **Step 4: Commit**

```bash
gofmt -w internal/postgres
go test ./internal/postgres
git add internal/postgres/content_repository.go internal/postgres/repository_integration_test.go
git commit -m "perf: batch content list hydration"
```

### Task 2: Batch Bulletin Versions

**Files:**
- Modify: `internal/postgres/repository.go`
- Modify: `internal/postgres/repository_integration_test.go`

**Interfaces:**
- Preserves: `Repository.ListIssues(...)`
- Produces: `versionsByIssueIDs` internal helper

- [ ] **Step 1: Add the single-connection bulletin test**

Seed 100 issues with three locale versions and workflow rows. With one open
connection, assert `ListIssues` returns every version in locale order before
the context deadline.

- [ ] **Step 2: Implement one batch version query**

Read and close issue rows first. Query all versions using issue IDs and one
lateral latest-workflow join, group by issue ID, then attach them in page
order. Keep single-issue `GetIssue` behavior unchanged.

- [ ] **Step 3: Verify and commit**

```bash
gofmt -w internal/postgres
go test ./internal/postgres -run 'Test(ListIssues|GetIssue)'
git add internal/postgres/repository.go internal/postgres/repository_integration_test.go
git commit -m "perf: batch bulletin list versions"
```

### Task 3: Apply Public Limits In PostgreSQL

**Files:**
- Modify: `internal/postgres/content_repository.go`
- Modify: `internal/postgres/repository_integration_test.go`

**Interfaces:**
- Preserves: `PublicContent(context.Context, Module, string, int)`

- [ ] **Step 1: Add bounded-result tests**

Seed more rows than requested for News, History, and Videos. Assert the
repository returns only the requested limit in the existing deterministic
module order.

- [ ] **Step 2: Move ordering and limit into SQL**

Use module-specific allowlisted SQL ordering:

- News: published/display date descending
- History: sort order ascending
- Videos: deterministic existing home ordering

Apply `LIMIT $3` in each query. Remove Go-side full collection sorting and
slicing.

- [ ] **Step 3: Verify and commit**

```bash
gofmt -w internal/postgres
go test ./internal/postgres -run TestPublicContent
git add internal/postgres/content_repository.go internal/postgres/repository_integration_test.go
git commit -m "perf: bound public content queries"
```

### Task 4: Add Query-Direction Indexes

**Files:**
- Create: `internal/migrations/sql/008_query_and_retention_indexes.sql`
- Create: `internal/migrations/migrations_test.go`
- Modify: `internal/postgres/repository_integration_test.go`

**Interfaces:**
- Adds:
  - `content_entry(module,updated_at DESC)`
  - `publication_workflow(resource_id,locale,created_at DESC)`
  - `public_projection(resource_type,locale)`
  - partial processing outbox index on `(claimed_until,created_at)`

- [ ] **Step 1: Add migration and query-plan fixtures**

Create representative status distributions and assert the migration checksum is
registered. Capture `EXPLAIN (ANALYZE, BUFFERS)` for unfiltered module lists,
latest workflow lookup, public projection filtering, and expired processing
claims.

- [ ] **Step 2: Add only the four confirmed indexes**

Do not add a trigram title index in this migration. Record Admin search timing;
add `pg_trgm` in a later measured migration only if representative search
exceeds the agreed latency budget.

- [ ] **Step 3: Verify and commit**

```bash
go test ./internal/migrations ./internal/postgres
git add internal/migrations internal/postgres/repository_integration_test.go
git commit -m "perf: index cms query directions"
```

### Task 5: Paginate Revisions And Retain Worker History

**Files:**
- Modify: `internal/content/types.go`
- Modify: `internal/content/service.go`
- Modify: `internal/content/service_test.go`
- Modify: `internal/postgres/content_repository.go`
- Modify: `internal/postgres/repository.go`
- Modify: `internal/httpapi/content_handlers.go`
- Modify: `internal/httpapi/content_handlers_test.go`
- Modify: `openapi.yaml`
- Create: `internal/retention/worker.go`
- Create: `internal/retention/worker_test.go`
- Modify: `cmd/server/main.go`

**Interfaces:**
- Changes revisions endpoint to `page` and `pageSize`, default `1/20`, maximum `100`
- Retains latest 100 revisions per entry and all revisions newer than two years
- Retains completed/delivered workflow history for 90 days and failed history for 180 days

- [ ] **Step 1: Add failing pagination tests**

Assert metadata total, stable version-descending pages, defaults, maximum size,
and invalid parameter responses.

- [ ] **Step 2: Add retention tests**

Assert active publication/outbox rows are never removed. Old history is deleted
in batches using `FOR UPDATE SKIP LOCKED`; recent, failed-within-180-days, and
latest-100 revisions remain.

- [ ] **Step 3: Implement repository, HTTP, and OpenAPI changes**

Use separate count and paged revision queries. Run the retention worker on the
existing service process schedule; do not add another deployable service.

- [ ] **Step 4: Verify and commit**

```bash
gofmt -w internal/content internal/postgres internal/httpapi internal/retention
go test ./internal/content ./internal/postgres ./internal/httpapi ./internal/retention
git add internal openapi.yaml
git commit -m "feat: bound cms history retention"
```

### Task 6: HHC Web API Production Gate

**Files:**
- Verify only

- [ ] **Step 1: Run full tests with PostgreSQL enabled**

```bash
HHW_TEST_DATABASE_URL="$HHW_TEST_DATABASE_URL" GOCACHE=/private/tmp/hhc-web-api-go-build-cache go test ./...
go vet ./...
git diff --check
```

- [ ] **Step 2: Record load and plan evidence**

Verify content and bulletin pages of 100 complete with one DB connection,
public limit queries return bounded rows, retention claims do not conflict
across workers, all four plans use their intended indexes, and the configured
`max replicas × DB_MAX_OPEN_CONNS` remains inside the database budget.
