# First-Party SSO And Admin CRUD Correction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every HHC first-party browser product restore central Account SSO without sharing refresh cookies, and replace Admin split inspectors with the approved full-width list and dedicated detail/editor interaction model.

**Architecture:** `frontend-platform` owns framework-neutral PKCE/token-exchange helpers and semantic UI tokens. Each product remains responsible for lifecycle and routing: protected products perform local-session-first authorization, while the public website performs at most one hinted passive attempt. Admin keeps business tables and editors application-owned and navigates from full-width lists to dedicated routes.

**Tech Stack:** React 19, TypeScript 6, React Router, React Aria Components, Vitest, Testing Library, Vite, pnpm, OAuth 2.0 Authorization Code with PKCE.

## Global Constraints

- Refresh and authorization-server cookies remain Secure, HttpOnly, SameSite=Lax, Path=/, and host-only; never add `Domain=.alive.org.tw` to authentication cookies.
- `hhc_sso_hint` is only a performance hint and is never accepted as authentication evidence.
- Keep Account API and API Gateway contracts unchanged; existing OAuth clients and same-origin token routes already support this flow.
- Preserve exact pathname, query, and hash through authorization.
- A failed or mismatched OAuth callback may restart once and must not loop.
- Primary filled controls use Primary solid plus On primary; focus, selected text, progress, and soft states continue using Primary accent.
- Admin management pages never use a persistent table-plus-inspector split.
- Hard delete is not added for users or CMS content; use disable, archive, and restore contracts.
- All visible strings remain complete in `zh-Hant`, `zh-Hans`, and `en`.
- Implement behavior changes test-first and commit each repository task separately.

---

### Task 1: Publish Shared Primary And OAuth Contracts

**Repository:** `frontend-platform`

**Files:**
- Modify: `packages/ui/src/styles.css`
- Modify: `packages/ui/src/primitives.test.tsx`
- Modify: `packages/account-client/src/oauth.ts`
- Modify: `packages/account-client/src/oauth.test.ts`
- Modify: `packages/account-client/src/index.ts`
- Modify: package versions and lockfile for release `0.2.1`

**Interfaces:**
- Produces: `exchangeAuthorizationCode(config, transaction, code, fetcher?)`
- Produces tokens: `--hhc-primary-solid`, `--hhc-primary-solid-hover`, `--hhc-on-primary`
- Consumes: existing `OAuthClientConfig`, `OAuthTransaction`, and same-origin `/oauth/token`

- [ ] **Step 1: Write failing OAuth exchange tests**

Assert the helper sends `grant_type=authorization_code`, `code`, `client_id`,
`redirect_uri`, and `code_verifier` as form data, uses `credentials: include`,
and throws on a non-2xx response.

- [ ] **Step 2: Run the focused test and confirm RED**

```bash
pnpm --filter @hallelujahhomechurch/account-client test -- --run oauth.test.ts
```

Expected: failure because `exchangeAuthorizationCode` is not exported.

- [ ] **Step 3: Implement the minimal exchange helper**

Keep transaction persistence and redirect decisions in each app. The helper
only performs the same-origin request, validates the response, and returns the
decoded token response.

- [ ] **Step 4: Add the filled-primary semantic pair**

```css
:root {
  --hhc-primary-solid: #ad493f;
  --hhc-primary-solid-hover: #9d3d35;
  --hhc-on-primary: #fff8f4;
}

:root[data-theme='dark'] {
  --hhc-primary-solid: #b64e45;
  --hhc-primary-solid-hover: #a9433b;
  --hhc-on-primary: #fff8f4;
}
```

Apply the pair to primary Button and Avatar fallback content. Keep Progress,
focus rings, selected tabs, and soft states on `--hhc-primary`. Correct Button
layout once with `inline-flex`, centered content, stable gap,
`white-space: nowrap`, and non-shrinking icons.

- [ ] **Step 5: Verify packages and consumers**

```bash
pnpm test -- --run
pnpm lint
pnpm build
pnpm pack
```

- [ ] **Step 6: Commit and publish**

```bash
git add packages package.json pnpm-lock.yaml
git commit -m "feat: add first-party auth and primary color contracts"
```

Publish `@hallelujahhomechurch/account-client@0.2.1` and
`@hallelujahhomechurch/ui@0.2.1` before upgrading application lockfiles.

### Task 2: Complete Account First-Party SSO Bootstrap

**Repository:** `account-fe`

**Files:**
- Modify: `src/lib/redirects.ts`
- Modify: `src/lib/api.ts`
- Modify: `src/auth/auth-context.tsx`
- Modify: `src/auth/auth-context.test.tsx`
- Replace: `src/pages/OAuthCallbackPage.tsx`
- Create: `src/pages/OAuthCallbackPage.test.tsx`
- Modify: `src/auth/auth-routes.ts`
- Modify: `package.json`, lockfile, and localized callback messages

**Interfaces:**
- Consumes: `exchangeAuthorizationCode`, existing PKCE helpers, client ID `account-console`
- Produces: local-session-first Account bootstrap and a real `/oauth/callback`

- [ ] **Step 1: Write failing lifecycle tests**

Assert:

1. An authenticated Account session refreshes and loads `/me` without redirect.
2. A missing Account session on a protected route saves one PKCE transaction and starts authorization with the exact return location.
3. Public auth and callback routes do not start another transaction.
4. StrictMode effect replay creates only one transaction.
5. `login_required` returns to localized Account login once and clears state.
6. A valid callback validates state, exchanges the code, clears state, and restores the saved route.
7. Invalid state is rejected before code exchange.

- [ ] **Step 2: Run tests and confirm RED**

```bash
pnpm test -- --run src/auth/auth-context.test.tsx src/pages/OAuthCallbackPage.test.tsx
```

Expected: callback assertions fail because the page is a placeholder, and
missing-session assertions fail because bootstrap currently stops signed out.

- [ ] **Step 3: Add Account OAuth defaults**

```text
clientId: account-console
redirectUri: {window.location.origin}/oauth/callback
scope: openid profile email
authorizeBaseUrl: /api/account/v1
tokenUrl: /api/account/v1/oauth/token
```

- [ ] **Step 4: Implement local-session-first authorization**

Protected routes check `/session`, refresh when authenticated, and otherwise
start one authorization transaction. A valid central session returns a code
without rendering login; absence of central SSO renders the existing login
through the authorization request.

- [ ] **Step 5: Implement the callback page**

Validate state before exchange. Handle `access_denied`, `login_required`,
missing code, expired transaction, request failure, and one bounded retry with
localized recovery UI.

- [ ] **Step 6: Apply primary-solid tokens to Account-owned controls**

Update the profile-avatar camera badge, filled `.button-link`, and every
Account-owned solid-primary control containing text or an icon.

- [ ] **Step 7: Verify and commit**

```bash
pnpm test -- --run
pnpm lint
pnpm build
git add src package.json pnpm-lock.yaml
git commit -m "feat: add seamless account sso bootstrap"
```

### Task 3: Normalize Admin Table And Action Foundations

**Repository:** `admin-fe`

**Files:**
- Modify: `src/index.css`
- Modify: `src/App.test.tsx`
- Modify: `package.json` and lockfile

**Interfaces:**
- Consumes: `@hallelujahhomechurch/ui@0.2.1`
- Produces: one full-width table, page-action, row-menu, and narrow-viewport contract

- [ ] **Step 1: Write failing layout assertions**

Assert primary actions keep icon and label in one button, action menus use the
entire item hit area, and management routes render no `.split-view`,
`.cms-split-view`, `.content-editor-layout`, or inspector card.

- [ ] **Step 2: Run the focused test and confirm RED**

```bash
pnpm test -- --run src/App.test.tsx
```

- [ ] **Step 3: Add the list-page CSS contract**

Use one bounded table surface with horizontal overflow only when columns cannot
fit. Keep Actions visible. Page actions may move below the title on narrow
screens, but icon and text cannot wrap inside a button.

- [ ] **Step 4: Remove obsolete inspector CSS after Tasks 4-6 migrate**

Delete `.split-view`, `.cms-split-view`, `.cms-inspector`,
`.content-editor-layout`, and selected-inspector rules when no JSX references
remain.

### Task 4: Replace Users Inspector With List And Detail Routes

**Repository:** `admin-fe`

**Files:**
- Modify: `src/App.tsx`
- Refactor: `src/pages/UsersPage.tsx` into the list route
- Create: `src/pages/UserDetailPage.tsx`
- Create: `src/pages/UserDetailPage.test.tsx`
- Modify: `src/App.test.tsx`
- Modify: localized messages

**Interfaces:**
- Produces routes: `/users`, `/users/:userId`
- Consumes: existing user list/detail, status, role, and direct-permission APIs

- [ ] **Step 1: Write failing list and detail tests**

Assert the list renders identity, roles, MFA, status, recent activity when
available, and a fixed Actions menu. Manage navigates to detail without fetching
every row's detail. The detail route owns status, identity, role, permission,
and security mutations.

- [ ] **Step 2: Run tests and confirm RED**

```bash
pnpm test -- --run src/App.test.tsx src/pages/UserDetailPage.test.tsx
```

- [ ] **Step 3: Implement the full-width list**

Preserve debounce, AbortController, latest-request-wins, URL query state,
server totals, and previous successful rows during refresh. Do not fetch roles,
permissions, or user detail on the list route.

- [ ] **Step 4: Implement `/users/:userId`**

Render Basic information, Roles and permissions, and Security as full-width
sections. Use Dialog for role/direct-permission editing and AlertDialog for
enable/disable. Keep final-active-admin errors visible.

- [ ] **Step 5: Verify and commit**

```bash
pnpm test -- --run src/App.test.tsx src/pages/UserDetailPage.test.tsx
git add src
git commit -m "feat: replace user inspector with detail routes"
```

### Task 5: Replace Content Split Editors With Routes

**Repository:** `admin-fe`

**Files:**
- Modify: `src/App.tsx`
- Split: `src/pages/content/ContentModulePage.tsx`
- Create: `src/pages/content/ContentModuleListPage.tsx`
- Create: `src/pages/content/ContentEditorPage.tsx`
- Create: `src/pages/content/ContentModuleRoutes.test.tsx`
- Modify: localized messages

**Interfaces:**
- Produces routes: `/content/:module`, `/content/:module/new`, `/content/:module/:contentId`
- Supports modules: `news`, `history`, `videos`

- [ ] **Step 1: Write failing route and dirty-state tests**

Assert each list renders a semantic table and Actions menu. Create navigates to
`/new`, Edit navigates to `/:contentId`, query state remains URL-backed, and
dirty editor navigation requires explicit discard.

- [ ] **Step 2: Run tests and confirm RED**

```bash
pnpm test -- --run src/pages/content/ContentModuleRoutes.test.tsx
```

- [ ] **Step 3: Implement module-aware tables**

News columns: title, locales, status, display date, updated time, Actions.
History columns: event/date label, locales, status, sort order, updated time,
Actions. Videos columns: title, YouTube ID, locales, homepage eligibility,
status, Actions.

- [ ] **Step 4: Move typed fields into editor routes**

Preserve locale tabs, cover upload and processing status, revision restore,
version checks, Save Draft, Publish, Unpublish, Archive, Restore, and dirty
navigation protection. Keep business editor code outside shared UI.

- [ ] **Step 5: Verify and commit**

```bash
pnpm test -- --run src/pages/content/ContentModuleRoutes.test.tsx
git add src
git commit -m "feat: add dedicated content editor routes"
```

### Task 6: Replace Weekly Bulletin Inspector With A Detail Route

**Repository:** `admin-fe`

**Files:**
- Modify: `src/App.tsx`
- Refactor: `src/pages/CmsPage.tsx` into the list route
- Create: `src/pages/BulletinDetailPage.tsx`
- Create: `src/pages/BulletinDetailPage.test.tsx`
- Modify: localized messages

**Interfaces:**
- Produces routes: `/content/bulletins`, `/content/bulletins/:issueId`
- Consumes: existing create, upload, complete, publish, unpublish, archive, and restore APIs

- [ ] **Step 1: Write failing list and detail tests**

Assert the list renders issue date, locale coverage, lifecycle status, and an
Actions menu. Manage navigates to detail. Detail shows all three locale PDF rows
with independent upload and publication state.

- [ ] **Step 2: Run tests and confirm RED**

```bash
pnpm test -- --run src/pages/BulletinDetailPage.test.tsx
```

- [ ] **Step 3: Implement list and detail routes**

Keep Create issue as an issue-date Dialog and navigate to detail after success.
Keep PDF upload as a Dialog and lifecycle changes as explicit AlertDialogs.
Preserve server pagination and natural issue-date order.

- [ ] **Step 4: Verify and commit**

```bash
pnpm test -- --run src/pages/BulletinDetailPage.test.tsx
git add src
git commit -m "feat: add weekly bulletin detail routes"
```

### Task 7: Align Access, OAuth Clients, And Overview

**Repository:** `admin-fe`

**Files:**
- Modify: `src/App.tsx`
- Refactor: `src/pages/AccessPage.tsx`
- Create: `src/pages/RoleDetailPage.tsx`
- Create: `src/pages/RoleDetailPage.test.tsx`
- Modify: `src/pages/OAuthClientsPage.tsx`
- Modify: `src/pages/DashboardPage.tsx`
- Modify: `src/App.test.tsx`
- Modify: localized messages

**Interfaces:**
- Produces routes: `/access?tab=roles|permissions`, `/access/roles/:roleId`
- Keeps OAuth clients within supported create and rotate contracts

- [ ] **Step 1: Write failing interaction tests**

Assert Roles and Permissions render as separate full-width tabular views,
Manage role opens detail, OAuth row actions occupy a fixed Actions column, and
Overview links only to capabilities the current admin can use.

- [ ] **Step 2: Run tests and confirm RED**

```bash
pnpm test -- --run src/App.test.tsx src/pages/RoleDetailPage.test.tsx
```

- [ ] **Step 3: Implement access routes**

Create roles and permissions through Dialog. Manage role permissions on the
detail route with explicit assign and remove actions. Do not add unsupported
edit, disable, or delete behavior.

- [ ] **Step 4: Normalize OAuth clients and Overview**

Keep OAuth creation and rotation in Dialog/AlertDialog and show a new secret
once. Overview remains an unframed actionable summary using real counts and
capability-filtered destinations; do not invent analytics or health metrics.

- [ ] **Step 5: Verify and commit**

```bash
pnpm test -- --run src/App.test.tsx src/pages/RoleDetailPage.test.tsx
git add src
git commit -m "feat: align admin management workflows"
```

### Task 8: End-To-End Verification And Release

**Repositories:** `frontend-platform`, `account-fe`, `admin-fe`

**Files:**
- Modify only defects discovered by verification
- Update package lockfiles when final package metadata differs

**Interfaces:**
- Verifies the approved contract and produces no new behavior

- [ ] **Step 1: Run complete automated verification**

```bash
# frontend-platform
pnpm test -- --run && pnpm lint && pnpm build

# account-fe
pnpm test -- --run && pnpm lint && pnpm build

# admin-fe
pnpm test -- --run && pnpm lint && pnpm build
```

- [ ] **Step 2: Run real browser SSO scenarios**

Verify Account-to-Admin, Admin-to-Account, another registered protected product,
product reload without redirect, global current-device sign-out, invalid state,
expired transaction, and `login_required` without loops.

- [ ] **Step 3: Run visual and accessibility verification**

Cover `375px`, `768px`, `1024px`, and `1440px` in light and Warm Charcoal dark
themes for every Admin list/detail/editor route. Verify no inspector split,
document overflow, wrapped icon/label buttons, clipped menus, card nesting,
missing focus, or contrast below WCAG AA. Run keyboard-only and axe checks.

- [ ] **Step 4: Verify deployment boundaries**

Confirm SPA deep-link fallback serves every detail route, OAuth redirect URIs
remain registered, package version `0.2.1` resolves from the registry, and no
API Gateway or Account API mutation is required.

- [ ] **Step 5: Commit verification-only fixes**

Use one focused commit per affected repository. Exclude generated build output
and unrelated dependency updates.

## Acceptance Matrix

| Requirement | Owning task |
| --- | --- |
| Cross-domain sign-in without shared refresh cookie | Tasks 1-2, 8 |
| Reusable future first-party product protocol | Task 1 |
| Warm light primary foreground | Tasks 1-2 |
| Filled Avatar and camera badge consistency | Tasks 1-2 |
| Button icon and label never wrap internally | Tasks 1, 3 |
| Users full-width list and detail page | Task 4 |
| News, History, Videos list/editor routes | Task 5 |
| Weekly Bulletin list/detail route | Task 6 |
| Roles, Permissions, OAuth workflow consistency | Task 7 |
| Mobile and dark-mode parity | Task 8 |

## Explicit Non-Goals

- No parent-domain refresh cookie.
- No Admin-specific bypass endpoint.
- No BFF or new identity microservice.
- No generic shared business table or schema-form framework.
- No hard-delete UI for users or content.
- No unsupported OAuth client edit/delete controls.
- No API or database migration for this correction.
