# Asset API Production Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bound direct uploads, make derivative processing retryable, enforce coherent purge/retention state, and provide efficient stable public downloads.

**Architecture:** Preserve direct-to-Blob upload sessions and Asset API ownership. Treat SAS as authorization, not a byte-limit control: inspect Blob properties before any stream, delete oversize objects immediately, then scan/process. Add explicit worker retry state, database pool budgets, and HTTP validators at the existing service boundaries.

**Tech Stack:** Go, PostgreSQL, Azure Blob Storage, ClamAV, Bicep, existing Asset workers

## Global Constraints

- Repository: `/Users/rayselfs/Projects/hhc/asset-api`.
- Browser never receives Azure account credentials; SAS remains short-lived and object-scoped.
- Oversize, MIME-invalid, infected, purged, or terminally failed assets never become downloadable.
- `account.avatar`, bulletin PDF, CMS image, and private-drive policies remain namespace-owned.
- ClamAV remains the malware scanner at `172.16.65.5:3310`; do not enable paid Defender scanning.
- Stable public URLs never expose Blob URLs or SAS.

---

### Task 1: Reject Oversize Azure Blobs Before Streaming

**Files:**
- Modify: `internal/assets/service.go`
- Modify: `internal/assets/service_test.go`
- Modify: `internal/storage/azure/store.go`
- Modify: `internal/storage/local/store.go`

**Interfaces:**
- Produces: Blob metadata inspection containing size, content type, and ETag
- Preserves: existing upload-session HTTP contract

- [ ] **Step 1: Add a failing oversize completion test**

Use a fake Blob store that records `InspectProperties`, stream open, and delete
calls. Assert an object larger than `upload_sessions.max_size_bytes` is deleted,
the stream is never opened, and the asset transitions to failed.

- [ ] **Step 2: Verify failure**

Run: `go test ./internal/assets -run TestCompleteUploadRejectsOversizeBeforeRead`

- [ ] **Step 3: Split metadata inspection from content inspection**

Add one Blob-store metadata method backed by Azure `GetProperties` and local
`os.Stat`. Completion checks the authoritative remote size first. Only a
bounded object proceeds to MIME detection, hashing, scan, and derivative work.
Do not attempt to encode a nonexistent maximum-byte constraint into SAS.

- [ ] **Step 4: Verify and commit**

```bash
gofmt -w internal/assets internal/storage
go test ./internal/assets ./internal/storage/...
git add internal/assets internal/storage
git commit -m "fix: reject oversize blobs before streaming"
```

### Task 2: Allow Account Avatar Upload Origins

**Files:**
- Modify: `infra/main.bicep`
- Modify: `README.md`

**Interfaces:**
- Produces Storage CORS origins for Account production and test hosts

- [ ] **Step 1: Add a Bicep assertion**

Use the repository's Bicep validation pattern to require:

```text
https://account.alive.org.tw
https://account-test.alive.org.tw
```

Keep Admin origins and allow only the methods/headers needed by signed Blob
upload.

- [ ] **Step 2: Update CORS and validate**

```bash
az bicep build --file infra/main.bicep
git diff --check
git add infra README.md
git commit -m "fix: allow account avatar uploads"
```

### Task 3: Retry Derivatives And Keep Purge State Coherent

**Files:**
- Create: `internal/migrations/sql/007_processing_retry_and_retention.sql`
- Modify: `internal/derivatives/worker.go`
- Modify: `internal/derivatives/worker_test.go`
- Modify: `internal/postgres/store.go`
- Create: `internal/postgres/store_integration_test.go`

**Interfaces:**
- Adds: `processing_attempts`, `processing_next_attempt_at`,
  `processing_claimed_until`
- Produces: bounded derivative claim/retry with terminal failure

- [ ] **Step 1: Add failing worker state tests**

Assert temporary Blob/DB failures schedule exponential backoff with a maximum
attempt count, partial derivative objects are deleted, terminal validation
errors fail immediately, and purged assets cannot be claimed or requeued.

- [ ] **Step 2: Add migration and claim integration tests**

Verify concurrent workers claim each asset once through
`FOR UPDATE SKIP LOCKED`. Add indexes supporting pending processing claims,
`asset_scan_events(asset_id)`, and `asset_grants(asset_id)` for retention
deletion.

- [ ] **Step 3: Implement bounded retry**

Store attempts and next-attempt timestamps. Classify validation errors as
terminal and dependency errors as retryable. Requeue uses the same state guard
as claim and always includes `purged_at IS NULL`.

- [ ] **Step 4: Verify and commit**

```bash
gofmt -w internal/derivatives internal/postgres
go test ./internal/derivatives ./internal/postgres
git add internal/migrations internal/derivatives internal/postgres
git commit -m "fix: make asset processing retryable"
```

### Task 4: Add Explicit Database Pool Budgets

**Files:**
- Modify: `internal/config/config.go`
- Modify: `internal/config/config_test.go`
- Modify: `cmd/server/main.go`
- Modify: `.env.example`
- Modify: `infra/main.bicep`

**Interfaces:**
- Adds: `DB_MAX_OPEN_CONNS`, `DB_MAX_IDLE_CONNS`,
  `DB_CONN_MAX_LIFETIME`

- [ ] **Step 1: Add failing configuration tests**

Require positive values, idle not greater than open, and defaults `10`, `5`,
and `30m`.

- [ ] **Step 2: Apply pool settings immediately after `sql.Open`**

Set open, idle, and lifetime before migrations or workers begin. Document and
verify `max ACA replicas × DB_MAX_OPEN_CONNS` fits the PostgreSQL budget.

- [ ] **Step 3: Verify and commit**

```bash
gofmt -w internal/config cmd/server
go test ./internal/config ./cmd/server
git add internal/config cmd/server .env.example infra/main.bicep
git commit -m "ops: bound asset database connections"
```

### Task 5: Complete Public Cache And Retention Contracts

**Files:**
- Modify: `internal/httpapi/handler.go`
- Modify: `internal/httpapi/handler_test.go`
- Modify: `internal/lifecycle/worker.go`
- Modify: `internal/lifecycle/worker_test.go`
- Modify: `internal/postgres/store.go`

**Interfaces:**
- Produces: `GET`/`HEAD`, `ETag`, `Last-Modified`, conditional `304`
- Produces: hard metadata deletion after 180 days in purged state

- [ ] **Step 1: Add HTTP contract tests**

Assert `HEAD` returns the same status, type, length, ETag, and cache policy as
`GET` with no body. Matching `If-None-Match` returns `304` without opening the
Blob stream.

- [ ] **Step 2: Add retention tests**

Assert the lifecycle worker keeps purge audit metadata for 180 days, then
deletes the asset and cascaded grants/events in bounded batches. Rows not yet
purged or within retention remain.

- [ ] **Step 3: Implement with existing handlers and worker**

Use stored ETag/size metadata before obtaining a Blob reader. Add no separate
download controller or scheduler.

- [ ] **Step 4: Verify and commit**

```bash
gofmt -w internal/httpapi internal/lifecycle internal/postgres
go test ./internal/httpapi ./internal/lifecycle ./internal/postgres
git add internal/httpapi internal/lifecycle internal/postgres
git commit -m "feat: complete asset download lifecycle"
```

### Task 6: Asset Production Gate

**Files:**
- Verify only

- [ ] **Step 1: Run repository and infrastructure checks**

```bash
go test ./...
go vet ./...
az bicep build --file infra/main.bicep
git diff --check
```

- [ ] **Step 2: Run dependency smoke**

Against PostgreSQL, Azure test Blob storage, and private ClamAV, verify oversize
rejection before download, clean/infected scan outcomes, retry recovery, public
conditional `HEAD`/`GET`, retention, CORS preflight, and rollback. Record query
plans for processing and purge claims before changing any additional indexes.
