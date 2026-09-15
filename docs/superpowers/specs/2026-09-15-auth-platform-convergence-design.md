# HHC Authentication Platform Convergence Design

**Status:** Integrated architecture; execution is governed by the unified authorization master plan and its frozen Account RBAC contract.

**Date:** 2026-09-15

## Purpose

Make authentication behavior consistent across `hhc-web`, `account-fe`, `admin-fe`, HHC Presenter Web, and HHC Presenter Desktop, while leaving a stable adapter boundary for a future mobile application. Adding another first-party website must not require another implementation of OAuth transactions, cookie-session bootstrap, token caching, refresh coordination, rate-limit cooldown, page lifecycle recovery, or auth telemetry.

This design covers authentication and generic permission transport. The
workspace documents
`hhc-web/docs/superpowers/specs/2026-09-15-hhc-unified-authorization-membership-and-entitlement-design.md`
and
`hhc-web/docs/superpowers/plans/2026-09-15-unified-authorization-account-rbac.md`
remain authoritative for permission names, role composition, business
capability groups, the explicitly empty compatibility mapping, and backend
enforcement.

## Current Evidence

- `@hallelujahhomechurch/account-client` `0.8.4` already owns cookie-session requests, CSRF, access-token issuance, permission validation, refresh coordination, and OAuth PKCE helpers.
- Consumers have drifted: `hhc-web` uses `0.6.18`; `account-fe` and `admin-fe` use `0.7.0`.
- Account and Admin construct new session clients during access-token issuance, so one application lifetime does not retain one request/cache/cooldown authority.
- All three websites independently own focus, `pageshow`, and `visibilitychange` behavior.
- Presenter Web independently implements session, CSRF, access-token issuance, refresh, PKCE, callback recovery, cache, and permission parsing.
- Presenter Desktop correctly protects refresh credentials in Electron main-process `safeStorage`, but independently implements token timing, refresh single-flight, retry classification, and lifecycle reporting.
- Account API already separates browser-cookie clients from native token-body clients. Native clients require `device_id`; browser JavaScript never receives a refresh token.
- Account API returns `429` with `Retry-After: 60`, but `AccountSessionError` discards that header.
- Account API caller documentation lists `/session/access-token` and `/refresh` for Account/Admin only, although Website and Presenter Web also call them.
- The separate authentication-transaction recovery plan covers stale or consumed `auth_request_id`, Safari Back/BFCache, registration, verification, MFA, policy, and social login. This design consumes it rather than duplicating it.

## Fixed Decisions

- First-party websites remain under `*.alive.org.tw` and use API Gateway.
- Only `account.alive.org.tw` renders password, social, registration, verification, MFA, and policy forms.
- Other websites redirect to Account and receive an authorization code at an exact registered callback.
- Browser refresh credentials remain HttpOnly host cookies. Browser access tokens remain in memory and never enter storage, URLs, or telemetry.
- Presenter Desktop is the only native adapter implemented now. Mobile is a future adapter, not an empty package in this delivery.
- HHC may apply a permissive package-level license to the shared auth client; unrelated packages retain their current license.

## Chosen Architecture

Extend the existing `@hallelujahhomechurch/account-client`; do not create a universal SDK or another state library.

```text
Account API OAuth/session contract
        |
        +-- account-client core
        |     errors, Retry-After, timing, generic permissions,
        |     lifecycle events, conformance cases
        |
        +-- account-client browser runtime
        |     cookie session, CSRF, PKCE transaction, token cache,
        |     refresh coordination, page lifecycle, hosted login
        |
        +-- Presenter Desktop native adapter
        |     system browser, deep link, main process, safeStorage
        |
        +-- future mobile adapter
              system browser, App/Universal Link, Keychain/Keystore
```

Core and browser runtime remain framework-neutral. React contexts subscribe to the runtime while keeping product profile APIs, routing, copy, and layout.

## Shared Contract

```ts
export type AccountIdentitySession = {
  user: AccountSessionUser;
  permissions: readonly string[];
  permissionAvailability:
    | {status: 'available'}
    | {
        status: 'unavailable';
        code: 'permission_unavailable';
        requestId?: string;
        retryAt?: number;
      };
};

export type AccountAuthState =
  | {status: 'checking'}
  | {status: 'anonymous'}
  | {status: 'authenticated'; session: AccountIdentitySession}
  | {status: 'unavailable'; error: AccountSessionError; retryAt?: number};

export type AccountAuthEvent = {
  stage: 'session' | 'authorize' | 'callback' | 'access_token' | 'refresh' | 'logout';
  outcome: 'started' | 'succeeded' | 'anonymous' | 'rejected' | 'rate_limited' | 'failed';
  status?: number;
  errorCode?: string;
  requestId?: string;
  retryAt?: number;
};

export type BrowserOAuthConfig = {
  clientId: string;
  redirectUri: string;
  scope: string;
};

export type BrowserAccountAuthRuntimeOptions = {
  client: AccountSessionClient;
  oauth?: BrowserOAuthConfig;
  now?: () => number;
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
  onEvent?: (event: AccountAuthEvent) => void;
};

export interface BrowserAccountAuthRuntime {
  start(): Promise<AccountAuthState>;
  getSnapshot(): AccountAuthState;
  subscribe(listener: () => void): () => void;
  beginSignIn(returnTo?: string): Promise<void>;
  completeSignIn(callbackUrl?: string): Promise<AccountAuthState>;
  revalidate(): Promise<AccountAuthState>;
  getAccessToken(): Promise<string | null>;
  refreshAfterUnauthorized(rejectedToken: string): Promise<string | null>;
  clear(): void;
  dispose(): void;
}

export function createBrowserAccountAuthRuntime(
  options: BrowserAccountAuthRuntimeOptions
): BrowserAccountAuthRuntime;
```

`AccountSessionUser` is identity-only. Product permission strings live only on
`AccountIdentitySession`; this prevents identity consumers from treating staff
authorization as part of the user profile.

The runtime receives exact `clientId`, `redirectUri`, and `scope` at creation.
Browser PKCE transactions expire after 10 minutes and authorization codes after
5 minutes, matching the companion recovery contract. Presenter Desktop keeps
its existing 5-minute native transaction bound.

`AccountSessionError` adds `requestId?: string` and `retryAt?: number`. `Retry-After` accepts delta-seconds and HTTP-date; an invalid or missing value on 429 uses a bounded 60-second fallback.

One runtime owns one stable session client. It caches a token until 30 seconds before expiry, coalesces concurrent issuance, and stores only a non-secret cooldown deadline so active tabs stop issuing during server cooldown. It never shares bearer tokens across tabs.

`refreshAfterUnauthorized(rejectedToken)` prevents stale-token overwrite. If another request already installed a different token, it returns that token without refreshing. Otherwise it coordinates one refresh. A domain request retries once.

## Authentication and Authorization Boundary

- Authentication produces the product-neutral `AccountIdentitySession` from
  the Shared Contract and does not interpret product capabilities.

- `permissions: []` with available status remains authenticated and means no
  staff permission.
- When permission resolution fails after identity succeeds, AuthN remains
  authenticated, clears permissions to `[]`, and publishes
  `permission_unavailable`. It never retains stale permission strings,
  refreshes, signs out, or restarts login for that condition.
- The browser session wire response keeps `user` identity-only and transports
  top-level `permissions: string[]` plus snake-case
  `permission_availability`; the runtime normalizes those fields into
  `AccountIdentitySession`. Requested and
  granted product permissions use the access token's standard `scope` claim;
  Gateway injects its verified space-delimited value as `X-HHC-Scopes`. Do not
  introduce `X-HHC-Permissions` or capability claims.
- A `401` may trigger one single-flight
  `refreshAfterUnauthorized(rejectedToken)` and one retry of the original
  request. No request receives a second auth retry.
- A `403` never refreshes, signs out, restarts login, or mutates authentication
  state.
- Frontend checks control presentation only; Gateway and owning APIs enforce access.
- Shared `hasPermission()` owns only non-empty exact-list membership and the
  canonical staff `*` wildcard. It has no prefix wildcard or domain semantics.
- Admin capabilities, Account staff access, weekly-report qualification, Presenter cloud entitlement, and LINE folder ACL remain domain-owned.
- The RBAC plan supplies final codes, capability identifiers, and compatibility
  mapping. For this approved breaking redesign the mapping is exactly `{}`;
  removed codes are never accepted. Domain AuthZ adapters consume the names;
  AuthN modules do not import them.

## UX Contract

- Optional auth (`hhc-web`) keeps public content usable when Account is unavailable; only protected features show recovery.
- Required auth (Account/Admin) renders no protected shell while checking.
- Anonymous starts a fresh hosted login.
- Expired/consumed transactions start a new transaction; refresh and old-code resubmission are never recovery actions.
- Unavailable preserves the route and offers retry; 429 disables retry until `retryAt`.
- Forbidden is an authorization state and never appears as anonymous or unavailable.
- Reuse existing shared Spinner, EmptyState, Button, and alert primitives. Product i18n owns copy.

## Presenter and Future Mobile

- Presenter Web delegates to the browser runtime.
- Presenter Desktop retains OAuth/deep-link/refresh storage in Electron main process. Renderer receives session state and narrow token methods only.
- Native OAuth uses system browser, S256 PKCE, installation-scoped device ID, rotated refresh tokens, and registered callback.
- Future mobile implements the same conformance cases with platform secure storage and App/Universal Links. Existing clients do not change.

## Observability

Runtime events may contain stage, outcome, HTTP status, stable error code, request ID, retry deadline, release, and client ID. They never contain email, display name, user ID, cookies, tokens, authorization codes, OAuth state, verifier, callback query, form values, or provider payloads.

Each app maps events to its installed Sentry SDK. Expected anonymous, forbidden, canceled, and cooldown outcomes are breadcrumbs/metrics; unexpected failures are captured errors. `account-client` does not depend on Sentry.

## Enforcement

- After migration, consumer source may not directly call `/session/access-token`, `/refresh`, or `/oauth/token`. Presenter Desktop native OAuth exchange is the single exception.
- The package root exports AuthN and generic `hasPermission()` only. Admin
  capabilities use an explicit AuthZ subpath. CI rejects imports from AuthN
  runtime/session/OAuth modules into Admin capability, Operations entitlement,
  Presenter entitlement, or LINE ACL modules.
- Every adapter runs conformance cases for expiry, coalescing, stale-token fencing, one refresh/one retry, 403 no-refresh, 429 cooldown, sign-out invalidation, and telemetry redaction.
- New websites register exact callbacks, browser-cookie delivery, scopes, and caller inventory before release.
- New websites consume an exact published package version and hosted login.
- Packed-package CI covers Vite and Next; Presenter adds its Electron/npm consumer build.

## Rollout

1. Freeze this seam in the unified master and Account RBAC plans.
2. Implement Account RBAC plus session/scope, caller, `permission_unavailable`,
   `401`, `403`, and `429 Retry-After` contracts in the Account PR.
3. Build one breaking `frontend-platform` package set containing the shared
   runtime, generic permission transport, final domain AuthZ modules, generated
   clients, and conformance cases. Do not publish an intermediate auth-only
   package.
4. Prepare one integration PR per consumer repository: Website combines
   optional AuthN and protected bulletins; Account combines required AuthN and
   destination projection; Admin combines required AuthN and granular RBAC UI;
   Presenter combines Web runtime and Desktop adapter alignment.
5. Enable source-boundary and full conformance checks before any consumer
   merge. A future mobile adapter consumes the contract only; no mobile package
   is created now.
6. Release through the unified master plan's producer, package, consumer,
   Gateway, reconciliation, and production-verification gates.

## Non-goals

- No mobile repository, mobile SDK, mobile storage adapter, or mobile UI.
- No repository/deployment merge and no new auth service.
- No redesign of roles, capabilities, membership, or LINE ACLs.
- No credential forms outside Account FE.
- No token sharing across tabs.
- No frontend replacement for Gateway/API authorization.
- No merging with the separate auth-request recovery delivery.
