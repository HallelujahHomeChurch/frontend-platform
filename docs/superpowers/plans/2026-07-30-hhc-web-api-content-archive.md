# HHC Web API Content Archive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add version-checked archive/restore, server-side content list queries, and the missing published News detail projection without hard delete or a database migration.

**Architecture:** Extend the existing content service and repository contracts. Archive is allowed only when content is not public and no publish workflow is running; restore moves archived content to Draft. Both operations use the existing `If-Match`, revision snapshot, actor, and HTTP error conventions.

**Tech Stack:** Go, `net/http`, PostgreSQL, OpenAPI 3, existing `content.Service`

## Global Constraints

- Repository: `/Users/rayselfs/Projects/hhc/hhc-web-api`.
- Execute only after `2026-07-31-hhc-web-api-production-hardening.md` passes;
  reuse its paginated revision contract and migration state.
- Reuse the existing `archived` status; do not add a migration or hard delete.
- Routes require `cms:write` and `If-Match`.
- Archive rejects `IsPublished`, `publishing`, and `unpublishing` content.
- Restore accepts only `archived` content and returns it to `draft`.
- Every successful transition increments `version`, writes `updated_by`/`updated_at`, and inserts a revision in the same transaction.

---

### Task 1: Define Lifecycle Rules In The Content Service

**Files:**
- Modify: `internal/content/types.go`
- Modify: `internal/content/service.go`
- Modify: `internal/content/service_test.go`

**Interfaces:**
- Produces: `Repository.ArchiveContent(context.Context, Module, string, int64, string, time.Time) (Item, error)`
- Produces: `Repository.RestoreArchivedContent(context.Context, Module, string, int64, string, time.Time) (Item, error)`
- Produces: matching `Service` methods

- [ ] **Step 1: Add failing service tests**

Add table tests that assert:

```go
_, err := service.ArchiveContent(ctx, ModuleNews, "news-1", 3, "user-1")
// published, publishing, unpublishing, or stale version => ErrConflict/ErrPrecondition

item, err := service.RestoreArchivedContent(ctx, ModuleNews, "news-1", 4, "user-1")
// archived => draft; non-archived => ErrConflict
```

Update `serviceRepository` with call counters so tests prove rejected transitions never reach repository mutation methods.

- [ ] **Step 2: Verify the tests fail**

Run: `go test ./internal/content -run 'Test(ServiceArchive|ServiceRestoreArchived)'`

Expected: FAIL because the methods and repository contract do not exist.

- [ ] **Step 3: Add the minimal service contract**

Add the two repository methods and service methods. Validate module, ID, and positive version; read the current item before mutation; compare the version; enforce state rules; then delegate with `s.now().UTC()`.

Use existing errors:

```go
if item.Version != expected {
	return Item{}, ErrPrecondition
}
if item.IsPublished || item.Status == StatusPublishing || item.Status == StatusUnpublishing {
	return Item{}, ErrConflict
}
```

Restore requires `item.Status == StatusArchived`.

- [ ] **Step 4: Run content unit tests**

Run: `go test ./internal/content`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add internal/content/types.go internal/content/service.go internal/content/service_test.go
git commit -m "feat: define content archive lifecycle"
```

### Task 2: Persist Archive And Restore Atomically

**Files:**
- Modify: `internal/postgres/content_repository.go`
- Modify: `internal/postgres/repository_integration_test.go`

**Interfaces:**
- Consumes: the two `content.Repository` methods from Task 1
- Produces: atomic PostgreSQL implementations with revision snapshots

- [ ] **Step 1: Add failing repository integration coverage**

Extend the existing content lifecycle integration test:

```go
archived, err := repository.ArchiveContent(ctx, content.ModuleHistory, item.ID, item.Version, "user-2", now)
// assert archived.Status == content.StatusArchived and archived.Version == item.Version+1

restored, err := repository.RestoreArchivedContent(ctx, content.ModuleHistory, item.ID, archived.Version, "user-3", now.Add(time.Minute))
// assert restored.Status == content.StatusDraft and restored.Version == archived.Version+1
```

Also assert stale versions return `content.ErrPrecondition` and that two new revision rows contain the archive and restored snapshots.

- [ ] **Step 2: Verify the integration test fails**

```bash
go test ./internal/postgres
```

Expected: compile failure until repository methods exist. PostgreSQL integration
assertions run when `HHW_TEST_DATABASE_URL` is configured and otherwise follow
the existing test skip behavior.

- [ ] **Step 3: Implement the two transactions**

For archive, reuse `lockContentVersion`, update `content_entry`, load the item, call `insertRevision`, and commit:

```sql
UPDATE hhc_web.content_entry
SET status='archived', version=version+1, updated_by=$2, updated_at=$3
WHERE id=$1
```

For restore, lock the row directly because `lockContentVersion` intentionally rejects archived content. Require `status='archived'` and the expected version, then set `status='draft'`, increment version, load, insert revision, and commit.

- [ ] **Step 4: Run repository tests**

Run: `go test ./internal/postgres`

Expected: PASS, or integration tests SKIP only when the documented database variable is absent.

- [ ] **Step 5: Commit**

```bash
git add internal/postgres/content_repository.go internal/postgres/repository_integration_test.go
git commit -m "feat: persist content archive lifecycle"
```

### Task 3: Expose Version-Checked HTTP Routes

**Files:**
- Modify: `internal/httpapi/content_handlers.go`
- Modify: `internal/httpapi/content_handlers_test.go`

**Interfaces:**
- Produces: `POST /api/admin/content/{module}/{contentID}/archive`
- Produces: `POST /api/admin/content/{module}/{contentID}/restore`

- [ ] **Step 1: Add failing handler tests**

Cover:

```text
missing cms:write    -> 403
missing If-Match     -> 428
stale If-Match       -> 412
published archive    -> 409
valid archive        -> 200 + ETag for the new version
valid restore        -> 200 + status draft
```

Update the handler test repository to implement and record both methods.

- [ ] **Step 2: Verify handler tests fail**

Run: `go test ./internal/httpapi -run 'TestContent(Archive|RestoreArchived)'`

Expected: FAIL because the routes are not registered.

- [ ] **Step 3: Register and implement handlers**

Register both routes with `requireScope("cms:write", ...)`. Parse `If-Match` through the existing helper, call the corresponding service method, and return through `writeContentItem`. Do not add request bodies.

- [ ] **Step 4: Run HTTP tests**

Run: `go test ./internal/httpapi`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add internal/httpapi/content_handlers.go internal/httpapi/content_handlers_test.go
git commit -m "feat: expose content archive routes"
```

### Task 4: Add Server-Side Content Search And Sort

**Files:**
- Modify: `internal/content/types.go`
- Modify: `internal/content/service.go`
- Modify: `internal/content/service_test.go`
- Modify: `internal/postgres/content_repository.go`
- Modify: `internal/postgres/repository_integration_test.go`
- Modify: `internal/httpapi/content_handlers.go`
- Modify: `internal/httpapi/content_handlers_test.go`

**Interfaces:**
- Produces: `content.ListOptions`
- Changes: `Repository.ListContent(context.Context, Module, ListOptions) (Page, error)`
- Produces query parameters `q`, `sort`, and `direction`

- [ ] **Step 1: Add failing option-validation tests**

Define expected behavior:

```go
ListOptions{Page: 1, PageSize: 20, Query: "  worship  ", Sort: "updatedAt", Direction: "desc"}
```

The service trims query text, rejects queries over 100 characters, defaults
page/page size/direction, and rejects unsupported module/sort combinations.
Allowed sorts are `updatedAt` for all modules, `displayDate` for News, and
`sortOrder` for History.

- [ ] **Step 2: Add failing repository and handler tests**

Repository integration coverage proves search matches any localized title and
does not alter `meta.total` incorrectly. Handler coverage proves query options
reach the repository and invalid sort combinations return `400`.

- [ ] **Step 3: Verify tests fail**

```bash
go test ./internal/content ./internal/httpapi ./internal/postgres
```

Expected: compile or assertion failure until `ListOptions` is wired through.

- [ ] **Step 4: Implement parameterized filtering and allowlisted ordering**

Use `EXISTS` against `content_translation` with `ILIKE` and a bound parameter
for search. Build `ORDER BY` only from the validated allowlist; never interpolate
request values. Keep the current natural module ordering when sort is omitted.

- [ ] **Step 5: Run focused tests and commit**

```bash
go test ./internal/content ./internal/httpapi ./internal/postgres
git add internal/content internal/postgres/content_repository.go internal/postgres/repository_integration_test.go internal/httpapi/content_handlers.go internal/httpapi/content_handlers_test.go
git commit -m "feat: query admin content lists"
```

Expected: PASS.

### Task 5: Add The Published News Detail Projection

**Files:**
- Modify: `internal/content/types.go`
- Modify: `internal/content/service.go`
- Modify: `internal/content/service_test.go`
- Modify: `internal/postgres/content_repository.go`
- Modify: `internal/postgres/repository_integration_test.go`
- Modify: `internal/httpapi/content_handlers.go`
- Modify: `internal/httpapi/content_handlers_test.go`

**Interfaces:**
- Produces: `Repository.PublicNewsBySlug(context.Context, string, string) (PublicItem, error)`
- Produces: `Service.PublicNewsBySlug(context.Context, string, string) (PublicItem, error)`
- Produces: `GET /api/news/{slug}?locale={locale}`

- [ ] **Step 1: Add failing service, repository, and handler tests**

Cover valid locale/slug, invalid locale, published projection lookup, unknown
slug `404`, and the public cache header. The repository integration test must
publish a News item, read it by slug, unpublish it, then assert the same lookup
returns `content.ErrNotFound`.

- [ ] **Step 2: Verify tests fail**

Run:

```bash
go test ./internal/content -run TestPublicNewsBySlug
go test ./internal/httpapi -run TestPublicNewsBySlug
```

Expected: FAIL because the contract and route do not exist.

- [ ] **Step 3: Implement the projection lookup**

Validate locale and a non-empty trimmed slug in the service. In PostgreSQL,
read `payload_json` from `hhc_web.public_projection` where
`resource_type='news'`, locale matches, and `route_path` equals
`/{locale}/news/{slug}`. Unmarshal into `content.PublicItem`; map no row to
`content.ErrNotFound`.

Register the unauthenticated route and return:

```text
Cache-Control: public, max-age=60, stale-while-revalidate=300
```

- [ ] **Step 4: Run focused and integration tests**

```bash
go test ./internal/content ./internal/httpapi ./internal/postgres
```

Expected: PASS, with database-dependent tests following the repository's
existing skip rule.

- [ ] **Step 5: Commit**

```bash
git add internal/content internal/postgres/content_repository.go internal/postgres/repository_integration_test.go internal/httpapi/content_handlers.go internal/httpapi/content_handlers_test.go
git commit -m "feat: expose published news details"
```

### Task 6: Publish The OpenAPI Contract

**Files:**
- Modify: `openapi.yaml`
- Modify: `README.md`

**Interfaces:**
- Produces operation IDs `archiveContent` and `restoreArchivedContent`
- Produces response schema `ContentItem` with existing ETag behavior

- [ ] **Step 1: Add both OpenAPI paths**

Each operation uses bearer auth, `x-required-scopes: [cms:write]`, `ContentModule`, `ContentID`, and `IfMatch`. Document `200`, `409`, and `412` responses.

- [ ] **Step 2: Document the state machine**

Add the archive/restore paths, list query parameters, and `GET /news/{slug}`
with `locale`, `200`, and `404` responses. Add one concise README lifecycle
table:

```text
unpublished/draft -> archive -> archived -> restore -> draft
published         -> unpublish first
```

- [ ] **Step 3: Validate the contract**

```bash
go test ./...
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add openapi.yaml README.md
git commit -m "docs: publish content archive contract"
```

### Task 7: Final Verification

**Files:**
- Verify only

- [ ] **Step 1: Run formatting and tests**

```bash
gofmt -w internal/content internal/postgres internal/httpapi
GOCACHE=/private/tmp/hhc-web-api-go-build-cache go test ./...
git diff --check
```

Expected: all commands PASS and the worktree contains only intended changes.

- [ ] **Step 2: Confirm compatibility**

Confirm existing publish, unpublish, and revision-restore tests still pass. No migration, route removal, or response-field change is allowed.
