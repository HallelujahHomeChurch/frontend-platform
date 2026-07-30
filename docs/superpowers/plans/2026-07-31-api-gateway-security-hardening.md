# API Gateway Security Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove sensitive query data from gateway logs, bound unknown-JWT-key refresh traffic, and complete the public Asset download contract without widening public API access.

**Architecture:** Keep Nginx as the routing and edge-policy owner and the existing Go verifier as the JWT authority. Make the smallest changes at those shared boundaries: path-only access logs, cooldown-backed JWKS refresh, and `GET`/`HEAD` parity for public assets.

**Tech Stack:** Nginx, Go, `net/http`, existing gateway verifier and shell routing tests

## Global Constraints

- Repository: `/Users/rayselfs/Projects/hhc/account/api-gateway`.
- Never log OAuth codes, reset tokens, verification tokens, or arbitrary query strings.
- Unknown `kid` traffic may trigger at most one refresh per cooldown window per process.
- Known-key rotation must still become visible through background refresh and one bounded miss refresh.
- Only `/api/assets/public/*` gains `HEAD`; admin, protected, and upload routes remain host-isolated.
- No new proxy service or external cache.

---

### Task 1: Make Access Logs Query-Safe

**Files:**
- Modify: `nginx.conf`
- Create: `scripts/test-safe-logging.sh`

**Interfaces:**
- Produces: JSON access log fields `request_method`, `uri`, `status`, timing, host, and user-agent without raw request target

- [ ] **Step 1: Add a failing static assertion**

Create `scripts/test-safe-logging.sh` that fails when the active `log_format`
contains `$request`, `$request_uri`, or `$args`, and requires `"uri":"$uri"`.

- [ ] **Step 2: Run it and verify failure**

Run: `bash scripts/test-safe-logging.sh`

Expected: FAIL because the current format records `$request` and
`$request_uri`.

- [ ] **Step 3: Replace raw request fields**

Keep method and path as separate JSON fields:

```nginx
'"request_method":"$request_method",'
'"uri":"$uri",'
```

Do not add an allowlist parser until a concrete operational query field is
needed.

- [ ] **Step 4: Verify and commit**

```bash
bash scripts/test-safe-logging.sh
docker build -t api-gateway:log-test .
git add nginx.conf scripts/test-safe-logging.sh
git commit -m "fix: redact gateway query strings"
```

### Task 2: Bound Unknown-KID Refresh

**Files:**
- Modify: `internal/verifier/config.go`
- Modify: `internal/verifier/jwks.go`
- Modify: `internal/verifier/verifier_test.go`

**Interfaces:**
- Produces: `Config.UnknownKIDCooldown time.Duration`
- Preserves: `JWKSCache.Key(context.Context, string) (ed25519.PublicKey, error)`

- [ ] **Step 1: Add failing concurrency and cooldown tests**

Use the existing JWKS fixture to send many concurrent misses for one unknown
`kid`. Count metadata and JWKS requests and assert one refresh. Repeat inside
the cooldown and assert no new request; advance beyond the cooldown, publish a
new key, and assert one refresh discovers it.

- [ ] **Step 2: Run focused tests**

Run: `go test ./internal/verifier -run 'TestUnknownKID'`

Expected: FAIL because every miss refreshes.

- [ ] **Step 3: Implement lock-recheck and negative cooldown**

Track the most recent miss-refresh time. In `Key`, check the cache, acquire the
existing refresh mutex through a bounded helper, re-check the cache after the
lock, and skip network refresh while the cooldown is active. Update the
timestamp whether the fetched document contains the requested key so repeated
invalid values cannot amplify traffic.

- [ ] **Step 4: Verify and commit**

```bash
gofmt -w internal/verifier
go test ./internal/verifier
git add internal/verifier
git commit -m "fix: bound unknown jwt key refresh"
```

### Task 3: Complete Public Asset HEAD Routing

**Files:**
- Modify: `conf.d/default.conf`
- Modify: `scripts/test-www-routing.sh`

**Interfaces:**
- Produces: public Asset route accepts only `GET` and `HEAD`

- [ ] **Step 1: Tighten routing assertions**

Assert `limit_except GET HEAD` under `/api/assets/public/` and continue
asserting that upload, protected, and admin Asset locations are absent from the
`www` host.

- [ ] **Step 2: Run and verify failure**

Run: `bash scripts/test-www-routing.sh`

Expected: FAIL because public assets currently allow only `GET`.

- [ ] **Step 3: Allow HEAD and verify all routes**

Change only the public Asset `limit_except` declaration. Do not duplicate
backend cache logic in Nginx.

```bash
bash scripts/test-www-routing.sh
bash scripts/test-auth-routing.sh
bash scripts/test-release-policy.sh
git add conf.d/default.conf scripts/test-www-routing.sh
git commit -m "fix: allow public asset head requests"
```

### Task 4: Final Gateway Gate

**Files:**
- Verify only

- [ ] **Step 1: Run static, Go, and container checks**

```bash
go test ./...
go vet ./...
bash scripts/test-safe-logging.sh
bash scripts/test-auth-routing.sh
bash scripts/test-www-routing.sh
bash scripts/test-release-policy.sh
docker build -t api-gateway:hardening .
docker run --rm api-gateway:hardening nginx -t
git diff --check
```

- [ ] **Step 2: Run live smoke without exposing tokens**

Verify a request containing `?code=sentinel-secret` never emits that sentinel
in container logs, unknown `kid` load remains bounded, public Asset `HEAD`
returns the same validators as `GET`, and private routes remain `404`.
