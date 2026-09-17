# HHC Authentication Platform Convergence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give current and future HHC clients one tested authentication behavior contract while keeping Web cookie sessions, Electron secure storage, and product authorization separate.

**Architecture:** Extend the dependency-free `account-client` with a framework-neutral browser runtime and conformance helpers. Publish it once with the final unified access contracts as a coordinated breaking package set; the unified authorization master and Account RBAC plan are authoritative for business permissions and release order.

**Tech Stack:** TypeScript 5/6, React 19 consumers, Vitest, Vite, Next, pnpm 10, Electron 41, Go 1.25, Gin, OpenAPI, Nginx Gateway, Sentry React 10.

**Spec:** `docs/superpowers/specs/2026-09-15-auth-platform-convergence-design.md`

**Program master:** `../../../../hhc-web/docs/superpowers/plans/2026-09-15-unified-authorization-master.md`

## Global Constraints

- Consume the Account RBAC plan's frozen session `permissions`,
  `permissionAvailability`, JWT `scope`, Gateway `X-HHC-Scopes`, capability
  identifiers, empty compatibility map, and 401/403 semantics verbatim; do not
  redefine them here.
- Empty permissions remain authenticated. Authentication never invokes a business capability evaluator.
- `permission_unavailable` remains authenticated with `permissions: []`, fails
  permission-gated UX closed, and never reuses stale permissions.
- A 401 permits one coordinated refresh and one retry; a 403 permits neither.
- Browser refresh credentials stay in HttpOnly cookies; browser access tokens stay in memory.
- Presenter Desktop refresh credentials stay in Electron main-process `safeStorage`.
- Do not add a state library, universal runtime, mobile package, or Sentry dependency to `account-client`.
- This is a direct breaking program. Remove superseded runtime exports and
  permission aliases in the single final package; do not add a compatibility
  or deprecation release.
- Use current `origin/main`, an isolated worktree, and separate branch/PR/CI/release gates per repository.
- Never modify existing user worktrees or untracked planning files.
- Begin behavior changes with a failing focused test.
- Never log email, user ID, cookies, tokens, codes, OAuth state, PKCE verifier, callback query, credentials, OTP, or provider payload.

---

## File Map

### `frontend-platform`

- `packages/account-client/src/index.ts`: public exports and generic permission helpers.
- `packages/account-client/src/session-client.ts`: Account HTTP, CSRF cache, response metadata, and typed errors.
- `packages/account-client/src/browser-runtime.ts`: auth state, token cache, cooldown, refresh fencing, lifecycle, and events.
- `packages/account-client/src/oauth.ts`: existing PKCE and bounded transaction helpers.
- `packages/account-client/src/conformance.ts`: reusable runtime cases with no test-framework dependency.
- `packages/account-client/LICENSE`: permissive package-level license shipped with the artifact.
- `scripts/check-package-contracts.mjs`: package/license/dependency assertions.
- `scripts/test-packed-consumers.mjs`: Vite and Next artifact smoke.

### Consumers

- `hhc-web/src/lib/browser-bootstrap.ts` and `src/components/layout/{AccountControl,WebOAuthCallback,WebPushControl}.tsx`.
- `account-fe/src/auth/auth-context.tsx` and `src/lib/api.ts`.
- `admin-fe/src/auth/auth-context.tsx` and `src/lib/api.ts`.
- `hhc-client-v2/src/renderer/src/lib/hhc-auth-browser.ts`.
- `hhc-client-v2/src/main/ipc/hhc-auth.ts` plus preload/IPC contracts.

### Service contracts

- `account-api/docs/openapi.yaml` and `docs/openapi_test.go`.
- `api-gateway/docs/openapi.yaml` and `docs/openapi_test.go` only if inspection proves a host/method gap.

---

### Task 1: Freeze the AuthN/AuthZ Seam

**Repo:** `/Users/rayselfs/Projects/hhc/website/frontend-platform`

**Files:**
- Modify: `docs/superpowers/specs/2026-09-15-auth-platform-convergence-design.md`

**Interfaces:**
- Consumes: final RBAC session permission field, availability discriminator,
  JWT/Gateway transport, wildcard rule, empty compatibility map,
  permission-unavailable state, capability identifiers, and 401/403
  definitions.
- Produces: approved written generic invariants; no product capability names.

- [ ] **Step 1: Copy the shared seam from the RBAC plan**

Copy the exact `AccountIdentitySession` seam from the Account RBAC plan. Stop
if RBAC makes token acquisition depend on a product permission, treats empty
permissions as anonymous, preserves stale permissions after resolver failure,
or introduces a second permission header.

- [ ] **Step 2: Review the complete seam**

Confirm the design distinguishes available empty permissions from
`permission_unavailable`, allows at most one coordinated refresh and one retry
only for 401, forbids refresh for 403, keeps `hasPermission()` generic, and
leaves product capability groups outside AuthN modules.

- [ ] **Step 3: Commit the frozen design**

```bash
git add docs/superpowers/specs/2026-09-15-auth-platform-convergence-design.md
git commit -m "docs: freeze authentication authorization boundary"
```

### Task 2: Make Session HTTP Stateful and Error-Aware

**Repo:** `/Users/rayselfs/Projects/hhc/website/frontend-platform`

**Files:**
- Create: `packages/account-client/src/session-client.ts`
- Create: `packages/account-client/src/session-client.test.ts`
- Create: `packages/account-client/src/auth-contract.test.ts`
- Modify: `packages/account-client/src/index.ts`
- Modify: `packages/account-client/src/index.test.ts`

**Interfaces:**
- Produces: `AccountSessionError` with `status`, `code?`, `requestId?`, and `retryAt?`.
- Produces: `authActionForStatus(status): 'refresh-once' | 'forbidden' | 'cooldown' | 'fail'`.
- Preserves: `createAccountSessionClient`, session types, `resolveAccountAuth`, `createRefreshCoordinator`, and `retrySupersededRefresh`.

- [ ] **Step 1: Add failing metadata and CSRF tests**

Cover delta-seconds and HTTP-date `Retry-After`, `X-Request-ID`, invalid JSON, concurrent protected calls sharing one CSRF request, recognized CSRF rejection clearing cache, and non-CSRF 403 remaining forbidden.

```ts
await expect(client.issueAccessToken()).rejects.toMatchObject({
  status: 429,
  code: 'ACC_AUTH_RATE_LIMITED',
  requestId: 'req-1',
  retryAt: now + 60_000
});
expect(csrfRequests).toBe(1);
```

Add the generic authorization boundary assertions in `auth-contract.test.ts`:

```ts
expect(isAccountSession({
  authenticated: true,
  user: identityUser(),
  permissions: [],
  permission_availability: {status: 'available'}
})).toBe(true);
expect(resolveAccountAuth({
  authenticated: true,
  user: identityUser(),
  permissions: [],
  permission_availability: {status: 'unavailable', code: 'permission_unavailable'}
}).status).toBe('authenticated');
expect(authActionForStatus(401)).toBe('refresh-once');
expect(authActionForStatus(403)).toBe('forbidden');
expect(authActionForStatus(429)).toBe('cooldown');
```

- [ ] **Step 2: Confirm failures**

Run `pnpm --filter @hallelujahhomechurch/account-client test:run -- session-client.test.ts auth-contract.test.ts`.

- [ ] **Step 3: Extract the current client and add one instance cache**

Move request logic to `session-client.ts`. Keep one `csrfValue`, `csrfInFlight`, and injected clock in the client closure. Parse response headers before throwing. Retry a protected call once only for recognized CSRF codes.

```ts
throw new AccountSessionError(response.status, code, message, {
  requestId: response.headers.get('x-request-id') ?? undefined,
  retryAt: retryAtFrom(response.headers.get('retry-after'), now())
});
```

- [ ] **Step 4: Implement status classification**

```ts
export function authActionForStatus(status: number) {
  if (status === 401) return 'refresh-once';
  if (status === 403) return 'forbidden';
  if (status === 429) return 'cooldown';
  return 'fail';
}
```

- [ ] **Step 5: Verify and commit**

Run `pnpm --filter @hallelujahhomechurch/account-client lint` and `pnpm --filter @hallelujahhomechurch/account-client test:run`.

```bash
git add packages/account-client/src
git commit -m "feat: preserve account session retry metadata"
```

### Task 3: Add the Browser Runtime and Conformance Cases

**Repo:** `/Users/rayselfs/Projects/hhc/website/frontend-platform`

**Files:**
- Create: `packages/account-client/src/browser-runtime.ts`
- Create: `packages/account-client/src/browser-runtime.test.ts`
- Create: `packages/account-client/src/conformance.ts`
- Modify: `packages/account-client/src/index.ts`

**Interfaces:**
- Produces: `AccountAuthState`, `AccountAuthEvent`, `BrowserOAuthConfig`, `BrowserAccountAuthRuntime`, and `createBrowserAccountAuthRuntime(options)`.
- Produces: `getAccessToken()` and `refreshAfterUnauthorized(rejectedToken)` as the only consumer token lifecycle methods.
- Produces: `beginSignIn(returnTo?)` and `completeSignIn(callbackUrl?)` as the only initiating-website OAuth lifecycle methods.

- [ ] **Step 1: Write failing state and timing tests**

Assert checking transitions, anonymous/authenticated/unavailable, one issuance for concurrent reads, reuse until 30 seconds before expiry, sign-out fencing a late result, and no token in snapshots.

```ts
const [first, second] = await Promise.all([runtime.getAccessToken(), runtime.getAccessToken()]);
expect(first).toBe(second);
expect(issueAccessToken).toHaveBeenCalledOnce();
expect(JSON.stringify(runtime.getSnapshot())).not.toContain('access-');
```

Construct the runtime with the exact spec options: one stable
`AccountSessionClient`, optional OAuth client metadata, injected clock/storage,
and a sanitized event callback. Do not let the runtime instantiate a second
session client.

- [ ] **Step 2: Write failing cooldown and stale-token tests**

```ts
await expect(runtime.getAccessToken()).rejects.toMatchObject({status: 429});
await expect(runtime.getAccessToken()).rejects.toMatchObject({status: 429});
expect(issueAccessToken).toHaveBeenCalledOnce();
expect(await runtime.refreshAfterUnauthorized('old-token')).toBe('new-token');
expect(refresh).not.toHaveBeenCalled();
```

- [ ] **Step 3: Add reusable conformance cases**

`runAccountAuthConformance(createRuntime)` covers expiry, coalescing, stale-token fencing, one refresh, 403 no-refresh, cooldown, sign-out invalidation, and event redaction.

Add browser OAuth cases for exact callback origin, S256 PKCE, state mismatch,
10-minute transaction expiry, 5-minute authorization-code handling, sanitized
return route, successful callback replacement, and Safari pageshow after a
consumed transaction. Store verifier/state/return route only in bounded
session storage and remove them after any terminal callback.

- [ ] **Step 4: Confirm failure**

Run `pnpm --filter @hallelujahhomechurch/account-client test:run -- browser-runtime.test.ts`.

- [ ] **Step 5: Implement one private state authority**

Keep token, expiry, token promise, refresh promise, generation, state, and listeners private. Persist only cooldown deadline under `hhc:account-access-token-retry-at`. Never share a bearer token across tabs.

- [ ] **Step 6: Add bounded page revalidation**

Attach focus, pageshow, and visible visibilitychange in `start()`; remove them in `dispose()`. Coalesce through one revalidation promise. Page activity must not mint a token.

- [ ] **Step 7: Verify and commit**

Run package lint, test, and build.

```bash
git add packages/account-client/src
git commit -m "feat: add shared browser authentication runtime"
```

### Task 4: Publish One Breaking Auth And Access Platform Release

**Repo:** `/Users/rayselfs/Projects/hhc/website/frontend-platform`

**Files:**
- Modify: root/package manifests and `pnpm-lock.yaml`
- Modify: `scripts/check-package-contracts.mjs`
- Modify: `scripts/test-packed-consumers.mjs`
- Create: `packages/account-client/LICENSE`

**Interfaces:**
- Produces: exact final coordinated workspace package version `1.0.4`, from
  immutable tag `v1.0.4` at `7c6de6c409518ab5966f71cb0ce96f43bb58cc5e`;
  superseded exports and permission aliases are absent.
- Produces: package-level `MIT` for `account-client`; other licenses remain.
- Integrates: Unified authorization Frontend Task 1, including final Admin
  AuthZ subpath, Operations/Website generated clients, and access resolver.

- [ ] **Step 1: Add failing artifact checks**

Assert account-client license, no runtime dependencies, runtime exports,
executable runtime initialization/disposal in packed Vite and Next consumers,
and the one-way source boundary: AuthN modules cannot import any domain AuthZ
module. The package root remains product-neutral; Admin capability exports use
an explicit subpath.

- [ ] **Step 2: Confirm failure**

Run `pnpm check:packages`, `pnpm pack:packages`, and `pnpm test:consumers`.

- [ ] **Step 3: Set version and metadata**

Set all aligned workspace packages to the final exact `1.0.4`. Earlier
planned `1.0.0` is superseded by the recorded immutable tag above; consumers
must not choose an ad hoc replacement. Change only account-client's package
license to `MIT` and ship
`packages/account-client/LICENSE` in the artifact.
Remove old runtime exports and the `legacyPermissions` map. Export domain
capabilities from an AuthZ-specific subpath that AuthN modules cannot import.

- [ ] **Step 4: Run the full gate**

Run `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm check:packages`, `pnpm pack:packages`, and `pnpm test:consumers`.

- [ ] **Step 5: Commit and open the package PR**

```bash
git add package.json packages scripts pnpm-lock.yaml
git commit -m "feat: publish unified authentication runtime"
```

Stop until CI passes and the immutable package containing both AuthN runtime
and final access contracts is published. There is no intermediate auth-only
package release.

### Task 5: Fold Authentication Metadata Into The Account RBAC Contract

**Repo:** `account-api`; execute as Account RBAC Task 4, not as a second PR.

**Files:**
- Modify: `account-api/docs/openapi.yaml`
- Modify: `account-api/docs/openapi_test.go`

**Interfaces:**
- Produces: accurate callers; session permission availability; JWT `scope` /
  Gateway `X-HHC-Scopes`; and documented 401, 403, and 429 `Retry-After`.

- [ ] **Step 1: Write failing caller assertions**

```go
"post /api/account/v1/session/access-token": {"hhc-web", "account-fe", "admin-fe", "hhc-desktop"},
"post /api/account/v1/refresh":              {"hhc-web", "account-fe", "admin-fe", "hhc-desktop"},
```

Also assert the session availability discriminator, JWT `scope` contract, and
401/403/429 responses including `Retry-After`.

- [ ] **Step 2: Confirm failure**

Run `go test ./docs -run TestOpenAPI -count=1`.

- [ ] **Step 3: Publish the frozen contract**

Update caller lists, session availability, and 401/403/429 response schemas.
Do not add product capability fields or a new Gateway permission header.

- [ ] **Step 4: Verify Gateway transport**

Run Gateway `go test ./docs ./internal/verifier -count=1`. Assert the verifier
maps granted token `scope` to stripped-and-rebuilt `X-HHC-Scopes`. Any missing
route assertion belongs in the unified cutover Gateway PR, not this Account PR.

- [ ] **Step 5: Verify and commit Account API**

Run `go test ./docs ./internal/handlers ./internal/routes -count=1`.

```bash
git add docs/openapi.yaml docs/openapi_test.go
git commit -m "docs: correct authentication route consumers"
```

Record any Gateway gap in Cutover Tasks 1-2; do not create a duplicate Gateway
task here.

### Task 6: Integrate hhc-web Optional Auth And Protected Bulletin UX

**Repo:** `/Users/rayselfs/Projects/hhc/website/hhc-web`

**Files:**
- Modify: package manifest/lockfile
- Modify: `src/lib/browser-bootstrap.ts`
- Modify: `src/components/layout/AccountControl.tsx`
- Modify: `src/components/layout/WebOAuthCallback.tsx`
- Modify: `src/components/layout/WebPushControl.tsx`
- Modify: focused tests
- Create: `src/lib/auth-boundary.test.ts`

**Interfaces:**
- Consumes: the single final breaking `frontend-platform` package set.
- Produces: reference optional-auth behavior.
- Integrates: Unified authorization Frontend Task 6 in the same repository PR.

- [ ] **Step 1: Add failing regressions**

Assert public content survives auth outage, protected actions show recovery, page activity revalidates without token issuance, 429 disables retry until deadline, and app source contains no direct token endpoint after migration.

- [ ] **Step 2: Confirm failure**

Run focused AccountControl, callback, and auth-boundary tests.

- [ ] **Step 3: Install one runtime**

Replace the raw client in browser bootstrap with one module-scoped runtime. Pass its token methods to existing domain clients; never expose token in React state.

- [ ] **Step 4: Remove delegated lifecycle code**

Delete local activity listeners and callback/token exchange now owned by runtime. Keep route rendering and localized copy. Map sanitized runtime events to existing Sentry helpers.

- [ ] **Step 5: Verify and deliver**

Run lint, typecheck, all tests, and build. Commit as `refactor: use shared browser authentication runtime`; complete the repository's independent PR and CI gate, then hold its incompatible release for the unified cutover.

Live smoke includes public navigation, authenticated weekly access, hosted-login return, one sanitized Sentry event, and no access-token burst on focus.

### Task 7: Integrate Account And Admin Required Auth

**Repos:** `account-fe` and `admin-fe`; one PR and release per repository, held
for the coordinated cutover.

**Files per repo:**
- Modify: package manifest/lockfile
- Modify: `src/auth/auth-context.tsx`
- Modify: `src/lib/api.ts`
- Modify: auth/API tests
- Create: `src/auth/auth-boundary.test.ts`

**Interfaces:**
- Consumes: final package and conformance contract; does not wait for a
  production hhc-web release.
- Preserves: Account hosted credential flows and Admin domain API clients.
- Integrates: Account destination work and Admin granular RBAC/navigation from
  the unified authorization frontend plan. Do not create later auth-only PRs.

- [ ] **Step 1: Add Account regressions**

Assert no protected shell while checking, empty permissions remain authenticated, 401 refreshes once, 403 is forbidden without refresh, activity does not mint, and stale 401 cannot overwrite a newer token.

- [ ] **Step 2: Migrate Account**

Create one runtime for AuthProvider lifetime. Replace new session clients inside `issueAccessToken()` with runtime methods. Retain password, registration, verification, provider, MFA, policy, profile, security, and device API ownership.

- [ ] **Step 3: Verify Account**

Run lint, typecheck, all tests, and build, including companion auth-request timeout/BFCache regressions. Complete its independent PR and CI gate, then hold release for the unified cutover.

- [ ] **Step 4: Add Admin regressions**

Assert domain clients call `refreshAfterUnauthorized(rejectedToken)` after 401 and never refresh after 403.

- [ ] **Step 5: Migrate Admin**

Let runtime own token timing and stale-response fencing. Keep profile, routes, CMS clients, and RBAC business capability mapping in Admin.

- [ ] **Step 6: Verify Admin**

Run lint, typecheck, all tests, and build. Complete its independent PR and CI gate, then hold release for the unified cutover.

Use commit message `refactor: use shared browser authentication runtime` in each repository.

### Task 8: Integrate Presenter Web, Desktop, And Access Projection

**Repo:** `/Users/rayselfs/Projects/hhc/hhc-client-v2`

**Files:**
- Modify: package manifest/lockfile
- Modify: `src/shared/hhc-auth.ts`
- Modify: `src/renderer/src/lib/hhc-auth-browser.ts`
- Modify: `src/renderer/src/lib/hhc-auth-electron.ts`
- Modify: `src/main/ipc/hhc-auth.ts`
- Modify: IPC/preload contracts and focused tests
- Create: `src/shared/auth-boundary.test.ts`

**Interfaces:**
- Presenter Web wraps the shared browser runtime.
- Desktop retains native OAuth/storage but conforms to timing, stale-token, error, and event rules.
- Presenter menu/entitlement projection from the unified authorization frontend
  plan ships in this same repository PR.

- [ ] **Step 1: Add package and failing Web conformance**

Run shared conformance against current `BrowserHhcAuthAdapter`. Expected failures are cooldown/error behavior and direct browser endpoint ownership.

- [ ] **Step 2: Replace Presenter Web duplication**

Keep `HhcAuthAdapter` for renderer consumers but delegate session/token/CSRF/lifecycle to the shared runtime. Retain Presenter-specific sign-in window behavior only where not owned by runtime.

- [ ] **Step 3: Add Desktop regressions**

Assert stale rejected token returns current token without refresh, refresh is coalesced, OAuth token 429 respects `Retry-After`, rotated refresh token is persisted before access publication, and events contain no secrets.

- [ ] **Step 4: Align IPC**

Replace unconditional `refreshAccessToken()` recovery with `refreshAfterUnauthorized(rejectedToken)`. Keep refresh token, device ID, exchange, and `safeStorage` in main process.

- [ ] **Step 5: Enforce source boundary**

Permit `/oauth/token` only in Desktop main-process native exchange and shared package. Permit no browser cookie-token endpoints in Presenter source. Assert renderer IPC and diagnostics contain no refresh token.

- [ ] **Step 6: Verify and deliver**

Run lint, typecheck, tests, build, Web build, and browser E2E. Deliver with commit `refactor: align presenter authentication runtime`; complete its independent PR and CI gate, then hold release for the unified cutover. Verify Presenter Web callback and Desktop deep link separately.

### Task 9: Close Drift and Production Gates

**Repos:** all migrated consumers and `frontend-platform`.

**Files:** existing boundary tests plus new `frontend-platform/docs/auth-client-integration.md`.

**Interfaces:**
- Produces: enforced no-direct-token-endpoint rule and new-website integration path.

- [ ] **Step 1: Write the integration guide**

Document exact OAuth registration fields, runtime initialization, optional/required auth, hosted callback, Sentry observer, permission boundary, tests, and smoke gates.

- [ ] **Step 2: Enable every boundary test**

The only allowed direct token endpoint is Presenter Desktop native OAuth exchange. Shared package source remains the browser protocol owner.

- [ ] **Step 3: Verify releases and real behavior**

Record PR, merge SHA, release run, deployed revision/artifact, and health per repo. Test anonymous optional auth, password return, available social providers, required restore, expired transaction, 401 refresh, 403 no-refresh, 429 cooldown, Presenter Web callback, Presenter Desktop deep link, and sanitized Sentry output.

- [ ] **Step 4: Compare production token rates**

Group Gateway logs by host/client ID for `/session/access-token`, `/refresh`, and 429. Acceptance requires no activity-triggered mint burst and no calls during `Retry-After`; deployment health alone is insufficient.

- [ ] **Step 5: Attach evidence to the unified cutover manifest**

Record the frozen Account transport, final package version/digest, consumer
SHAs, conformance results, Sentry-redaction checks, and token-rate comparison
in the unified authorization cutover evidence. The Account RBAC contract is an
upstream input, so there is no reverse "handoff to RBAC" step.

## Integrated Cross-Repository Sequence

1. Freeze the unified authorization and AuthN/AuthZ contracts; no code release.
2. Admit `operations-api` and `audit-log` foundations dark.
3. Complete the backward-safe Account deletion diagnostic/root-cause release,
   then prepare Account RBAC/session/scope and Operations domain producer PRs; hold
   incompatible merges while final OpenAPI is frozen.
4. Prepare and verify Operations Resource reservations, final DSR owners,
   domain audit outboxes, `hhc-web-api`, `asset-api`, and `engagement-api`
   contracts in their dependency order.
5. Build and publish the one breaking `frontend-platform` package set.
6. Prepare one consumer integration PR per repository: `hhc-web`, `account-fe`,
   `admin-fe`, and `hhc-client-v2`; prepare LINE against protected bulletin
   contracts. These may run in parallel after the package is immutable.
7. Prepare the single Gateway route-policy PR and staging harness, including
   exact Operations and Audit query routes. Deploy only backward-safe
   infrastructure plus dark `operations-api`/`audit-log` before cutover.
8. In the authorized release window, use the unified cutover manifest for
   Account and domain APIs, consumers, Gateway switch, retained-data import,
   session invalidation, grant/cache reconciliation, and real-client checks.

Each repository still uses its own branch, PR, required CI, merge, immutable
release, deployed-revision check, and production smoke evidence. Passing one
repository does not satisfy another repository's gate.
