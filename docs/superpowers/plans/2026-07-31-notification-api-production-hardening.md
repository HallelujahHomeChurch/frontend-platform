# Notification API Production Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make queued notifications survive encryption-key rotation, keep retention queries indexed, bound database connections, reduce secret exposure, and expose actionable worker health.

**Architecture:** Keep the current transactional outbox, Service Bus, SMTP provider, and caller-scoped idempotency model. Add key IDs to persisted ciphertext, a small configured keyring, query-aligned retention indexes, a dedicated notification vault, and dependency-aware metrics/alerts.

**Tech Stack:** Go, PostgreSQL, Azure Service Bus, Azure Key Vault, SMTP, Bicep

## Global Constraints

- Repository: `/Users/rayselfs/Projects/hhc/account/notification-api`.
- Existing queued messages must remain decryptable during key rotation.
- Idempotency remains scoped by caller and idempotency key.
- Payload and recipient plaintext never enter logs, metrics, or dead-letter descriptions.
- API and worker identities receive no `list` access to unrelated secrets.
- Provider retries remain bounded and at-least-once delivery remains idempotent.

---

### Task 1: Version Persisted Cryptographic Material

**Files:**
- Create: `internal/migrations/sql/002_crypto_keys_and_retention_indexes.sql`
- Modify: `internal/config/config.go`
- Modify: `internal/config/config_test.go`
- Modify: `internal/crypto/envelope.go`
- Modify: `internal/crypto/envelope_test.go`
- Modify: `.env.example`

**Interfaces:**
- Adds message columns `encryption_key_id` and `hash_key_id`
- Adds env `NOTIFICATION_ACTIVE_ENCRYPTION_KEY_ID`,
  `NOTIFICATION_ENCRYPTION_KEYS_JSON`, `NOTIFICATION_ACTIVE_HASH_KEY_ID`,
  `NOTIFICATION_HASH_KEYS_JSON`

- [ ] **Step 1: Add failing keyring tests**

Parse JSON maps with the standard library. Require the active IDs to exist,
encryption keys to decode to 32 bytes, hash keys to contain at least 32 bytes,
and reject duplicate/empty IDs.

- [ ] **Step 2: Add migration test**

Existing rows receive key ID `legacy-v1`; new columns become non-null after
backfill. The deployment runbook must configure the current legacy values under
that ID before the migration runs.

- [ ] **Step 3: Implement keyring encryption and hashing**

New messages use active IDs. Decryption selects the persisted encryption ID.
Idempotency replay computes the comparison hash with the row's persisted hash
ID; new rate-limit identities use the active hash ID.

- [ ] **Step 4: Verify and commit**

```bash
gofmt -w internal/config internal/crypto
go test ./internal/config ./internal/crypto
git add internal/migrations internal/config internal/crypto .env.example
git commit -m "feat: version notification cryptographic keys"
```

### Task 2: Wire Key IDs Through Queue And Worker

**Files:**
- Modify: `internal/service/service.go`
- Modify: `internal/service/service_test.go`
- Modify: `internal/worker/worker.go`
- Modify: `internal/worker/worker_test.go`
- Modify: `internal/store/store.go`
- Modify: `internal/store/store_test.go`

**Interfaces:**
- Queue envelopes continue carrying IDs, not plaintext
- Worker resolves ciphertext using persisted `encryption_key_id`

- [ ] **Step 1: Add an in-flight rotation test**

Queue a message with key `v1`, switch active configuration to `v2` while
retaining `v1` in the decrypt keyring, and assert the worker delivers it.
Removing `v1` must fail startup while a deployment preflight detects rows that
still reference it.

- [ ] **Step 2: Implement persisted key selection**

Store key IDs in the same transaction as message, delivery, and outbox rows.
Load them with the worker claim. Keep ciphertext out of Service Bus envelopes.

- [ ] **Step 3: Verify and commit**

```bash
gofmt -w internal/service internal/worker internal/store
go test ./internal/service ./internal/worker ./internal/store
git add internal/service internal/worker internal/store
git commit -m "fix: preserve queued messages across key rotation"
```

### Task 3: Index Retention And Cascade Paths

**Files:**
- Modify: `internal/migrations/sql/002_crypto_keys_and_retention_indexes.sql`
- Modify: `internal/retention/worker_integration_test.go`

**Interfaces:**
- Adds:
  - `notification_messages(terminal_at,id)`
  - partial unpurged payload index on `(terminal_at,id)`
  - `notification_deliveries(message_id)`
  - `notification_outbox(delivery_id)`

- [ ] **Step 1: Add representative retention fixtures**

Create terminal, non-terminal, purged, and unpurged messages with child rows.
Assert bounded batches delete only eligible records and cascades use the FK
indexes.

- [ ] **Step 2: Verify query plans**

Run `EXPLAIN (ANALYZE, BUFFERS)` for payload purge, message deletion, and FK
cascade on representative data. Record the plans with deployment evidence.

- [ ] **Step 3: Verify and commit**

```bash
go test ./internal/retention
git add internal/migrations/sql/002_crypto_keys_and_retention_indexes.sql internal/retention/worker_integration_test.go
git commit -m "perf: index notification retention"
```

### Task 4: Bound Database Connections

**Files:**
- Modify: `internal/config/config.go`
- Modify: `internal/config/config_test.go`
- Modify: `internal/database/database.go`
- Create: `internal/database/database_test.go`
- Modify: `.env.example`
- Modify: `infra/main.bicep`

**Interfaces:**
- Adds `DB_MAX_OPEN_CONNS`, `DB_MAX_IDLE_CONNS`,
  `DB_CONN_MAX_LIFETIME`

- [ ] **Step 1: Add config and pool tests**

Default to `10`, `5`, and `30m`; reject non-positive values and idle greater
than open. Assert `database.Open` applies all settings.

- [ ] **Step 2: Implement and document total budget**

Calculate API plus worker maximum replicas multiplied by their connection
limits and keep the result below the PostgreSQL service budget.

- [ ] **Step 3: Verify and commit**

```bash
gofmt -w internal/config internal/database
go test ./internal/config ./internal/database
git add internal/config internal/database .env.example infra/main.bicep
git commit -m "ops: bound notification database connections"
```

### Task 5: Isolate Secrets And Complete Operational Signals

**Files:**
- Modify: `infra/main.bicep`
- Modify: `infra/alerts.bicep`
- Modify: `cmd/notification/main.go`
- Modify: `cmd/notification/main_test.go`
- Modify: `docs/runbook.md`

**Interfaces:**
- Produces a notification-specific Key Vault or equivalent secret scope
- Produces metrics/alerts for outbox age, DLQ growth, provider failures, and worker absence

- [ ] **Step 1: Replace shared-vault list access**

Provision or reference a notification-specific vault containing only
notification encryption/hash, Service Bus, and SMTP secrets. Grant each runtime
identity `get` only for the secrets it consumes; migration receives DB secret
access only. Remove `list`.

- [ ] **Step 2: Add worker dependency signals**

Keep `/health` as liveness. `/ready` verifies DB and that queue/provider clients
were initialized; expose last successful queue receive and provider attempt as
metrics rather than making readiness send email.

- [ ] **Step 3: Add actionable alerts**

Alert on oldest pending outbox age, Service Bus active/dead-letter counts,
worker replica absence, and sustained provider failure ratio. Include owner,
threshold, evaluation window, and runbook link.

- [ ] **Step 4: Verify and commit**

```bash
go test ./cmd/notification
az bicep build --file infra/main.bicep
az bicep build --file infra/alerts.bicep
git add cmd/notification infra docs/runbook.md
git commit -m "ops: harden notification dependencies"
```

### Task 6: Notification Production Gate

**Files:**
- Verify only

- [ ] **Step 1: Run full checks**

```bash
go test ./...
go vet ./...
az bicep build --file infra/main.bicep
az bicep build --file infra/alerts.bicep
git diff --check
```

- [ ] **Step 2: Run rotation and delivery smoke**

With PostgreSQL, Service Bus, and SMTP test delivery, prove a `v1` queued
message delivers after `v2` activation, idempotent replay is stable, retention
plans use indexes, DLQ/provider alerts can fire, and rollback retains both keys
until no row references the retiring key.
