# Admin Frontend UI/UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Admin into a localized, high-density management console with reliable OAuth continuation, understandable overview data, accessible CRUD workflows, and production-ready website-content editors.

**Architecture:** Upgrade shared packages, keep capability filtering at routes/navigation/actions, and reuse existing server clients. Preserve the proven Users search/pagination implementation. Split complex content editing into list and dedicated editor routes; do not create a generic CRUD or schema-form framework.

**Tech Stack:** React 19, TypeScript 6.0.3, Vite 8, React Router 7, shared React Aria UI, generated HHC Web API client, Vitest

## Global Constraints

- Execute CMS and account-management flows only after Account API, HHC Web API,
  Asset API, Notification API, and Gateway hardening gates pass.
- Repository: `/Users/rayselfs/Projects/hhc/account/admin-fe`.
- Pin all `@hallelujahhomechurch/*` packages to exact `0.2.0`.
- Admin title is `HHC 管理中心`, `HHC 管理中心`, or `HHC Admin`; every route is `noindex,nofollow`.
- All navigation, page, table, status, dialog, error, and action copy supports `zh-Hant`, `zh-Hans`, and `en`.
- Domain identifiers such as role names, permission codes, client IDs, and provider names are not translated.
- No invitation flow, fake dashboard metric, hard delete, or social-provider secret management.
- Users use enable/disable; content uses archive/restore; OAuth clients expose only list/create/rotate.
- Content archive/restore requires released `hhc-web-api` and `hhc-web-client` `0.2.0` contracts.

---

### Task 1: Upgrade Packages, Metadata, And Shared Shell

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `index.html`
- Modify: `src/App.tsx`
- Modify: `src/components/AppLayout.tsx`
- Create: `src/preferences/messages.ts`
- Modify: `src/preferences/locale-context.tsx`
- Modify: `src/index.css`
- Modify: `src/App.test.tsx`

**Interfaces:**
- Produces: typed `AdminMessages`
- Consumes: shared UI `0.2.0`

- [ ] **Step 1: Add failing shell and metadata tests**

Assert each locale sets `document.documentElement.lang`, localized base title, and `meta[name=robots]="noindex,nofollow"`. Assert capability-filtered desktop and Drawer navigation use localized labels and AccountMenu rows have full hit areas.

- [ ] **Step 2: Verify the test fails**

Run: `pnpm test:run -- src/App.test.tsx`

Expected: FAIL because most shell copy and the title are English-only.

- [ ] **Step 3: Add typed messages and upgrade packages**

Define one `messages` object keyed by the existing Locale union and derive `AdminMessages` from its English shape. Move shell and route labels into it. Pin package versions and install.

Replace duplicated nav label literals with message keys while retaining capability metadata. Remove CSS overrides for shared AccountMenu, Drawer, Card, Modal, and Button internals. Apply the approved Warm Charcoal tokens only through shared variables.

- [ ] **Step 4: Verify shell behavior**

```bash
pnpm test:run -- src/App.test.tsx src/preferences/preferences.test.ts
pnpm lint
pnpm build
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml index.html src/App.tsx src/components/AppLayout.tsx src/preferences src/index.css src/App.test.tsx
git commit -m "feat: localize admin shell and metadata"
```

### Task 2: Make Admin Authorization Single-Flight And Return-Safe

**Files:**
- Modify: `src/auth/auth-context.tsx`
- Modify: `src/auth/pkce.ts`
- Modify: `src/auth/pkce.test.ts`
- Create: `src/auth/auth-context.test.tsx`
- Modify: `src/pages/LoginPage.tsx`
- Modify: `src/pages/OAuthCallbackPage.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Preserves: Authorization Code + PKCE
- Produces: one in-flight authorization startup and one bounded automatic state-mismatch retry

- [ ] **Step 1: Add failing auth lifecycle tests**

Cover:

```text
central session + no admin token -> one authorize redirect
repeated effects/signIn calls    -> same in-flight redirect; no state overwrite
pathname+query+hash              -> exact return after callback
first state mismatch             -> clear transaction and restart once
second state mismatch            -> localized recovery action; no loop
global logout                    -> account /login with Admin return target
```

Use injected navigation and in-memory storage; do not require a browser redirect in unit tests.

- [ ] **Step 2: Verify tests fail**

Run:

```bash
pnpm test:run -- src/auth/pkce.test.ts src/auth/auth-context.test.tsx
```

Expected: FAIL because authorization startup is not single-flight and mismatch recovery is manual.

- [ ] **Step 3: Implement bounded transaction handling**

Keep a ref-held `Promise<void> | null` around authorization startup and clear it only when startup fails. Store one retry marker in `sessionStorage` scoped to the callback transaction. On mismatch, clear invalid state and restart once; on the next mismatch, render recovery.

After successful global revocation, clear local Admin state and start a fresh
Admin authorization transaction with the exact current return location:

```ts
const returnTo = currentReturnTo(window.location)
await beginAuthorization(returnTo)
```

The central session is now revoked, so Account renders login for that
authorization request and returns through the existing callback. Do not send a
cross-origin `return_to` directly to Account or invent a second return
parameter.

- [ ] **Step 4: Verify auth tests**

Run:

```bash
pnpm test:run -- src/auth
pnpm test:run
```

Expected: PASS and no redirect loop.

- [ ] **Step 5: Commit**

```bash
git add src/auth src/pages/LoginPage.tsx src/pages/OAuthCallbackPage.tsx src/App.tsx
git commit -m "fix: stabilize admin oauth continuation"
```

### Task 3: Replace The Loading Page With Progressive Bootstrap

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/index.css`
- Modify: `src/App.test.tsx`

**Interfaces:**
- Produces: canvas-only first `150ms`, then shell-shaped skeleton

- [ ] **Step 1: Add failing timer-based tests**

With fake timers assert:

```text
0-149ms bootstrap -> theme canvas, no "Loading admin console"
150ms+ bootstrap  -> header/sidebar/workspace skeleton
redirect decision -> no Admin page flash
lazy route        -> page-shaped skeleton, no bare "Loading"
```

- [ ] **Step 2: Verify tests fail**

Run: `pnpm test:run -- src/App.test.tsx`

Expected: FAIL because the old loading panel and bare Suspense label render.

- [ ] **Step 3: Implement two lightweight skeleton components**

Keep `AuthBootstrapFallback` and `PageFallback` local to `App.tsx`; use shared Skeleton primitives and the existing shell dimensions. Remove the dedicated loading copy and panel CSS.

- [ ] **Step 4: Verify tests**

Run: `pnpm test:run -- src/App.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/index.css src/App.test.tsx
git commit -m "fix: use progressive admin loading states"
```

### Task 4: Build A Real, Partially Resilient Overview

**Files:**
- Modify: `src/pages/DashboardPage.tsx`
- Create: `src/pages/DashboardPage.test.tsx`
- Modify: `src/preferences/messages.ts`
- Modify: `src/index.css`

**Interfaces:**
- Consumes: existing CMS list methods and server `meta.total`
- Produces: capability-filtered attention counts and quick actions

- [ ] **Step 1: Add failing Overview tests**

For each accessible module request Draft, `publish_failed`, and pending statuses through existing status filters. Assert real totals render, inaccessible modules do not request, one failed module shows only its own Retry, and no fabricated activity/health counters appear.

- [ ] **Step 2: Verify the test fails**

Run: `pnpm test:run -- src/pages/DashboardPage.test.tsx`

Expected: FAIL because Overview contains static cards.

- [ ] **Step 3: Implement the Overview**

Use `Promise.allSettled` for independent module summaries. Render:

```text
Needs attention: drafts, failed publications, pending workflows
Quick actions: only routes/actions allowed by current capabilities
```

Retry reruns only the failed module. Preserve successful summaries while retrying.

- [ ] **Step 4: Verify tests**

Run: `pnpm test:run -- src/pages/DashboardPage.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pages/DashboardPage.tsx src/pages/DashboardPage.test.tsx src/preferences/messages.ts src/index.css
git commit -m "feat: show actionable admin overview"
```

### Task 5: Standardize Users, Roles, Permissions, And OAuth Clients

**Files:**
- Modify: `src/pages/UsersPage.tsx`
- Create: `src/pages/UsersPage.test.tsx`
- Modify: `src/pages/AccessPage.tsx`
- Create: `src/pages/AccessPage.test.tsx`
- Modify: `src/pages/OAuthClientsPage.tsx`
- Create: `src/pages/OAuthClientsPage.test.tsx`
- Modify: `src/lib/api.ts`
- Modify: `src/lib/api.test.ts`
- Modify: `src/preferences/messages.ts`
- Modify: `src/index.css`

**Interfaces:**
- Preserves: current Users debounce, AbortController, request sequence, URL search params, and server pagination
- Produces: permission removal UI through the existing API client contract

- [ ] **Step 1: Add failing management-flow tests**

Users:

```text
previous rows remain during search/page refresh
detail loading is independent
enable/disable and role removal use explicit AlertDialog
final-admin rejection remains visible and unchanged locally
```

Access:

```text
create role/permission uses Dialog
assign and remove permission are explicit actions
immutable API errors remain visible
```

OAuth:

```text
create uses Dialog
rotate uses AlertDialog
new secret appears once with Copy
no edit/disable/delete controls
```

- [ ] **Step 2: Verify tests fail**

Run:

```bash
pnpm test:run -- src/pages/UsersPage.test.tsx src/pages/AccessPage.test.tsx src/pages/OAuthClientsPage.test.tsx
```

Expected: at least removal, dialogs, localized copy, or stable-loading assertions FAIL.

- [ ] **Step 3: Implement app-owned management patterns**

Use semantic Table, a row action Menu, server metadata Pagination, EmptyState, Toast, and explicit confirmation. Do not introduce a generic CRUD component. Keep each page's request and mutation logic in that page.

- [ ] **Step 4: Verify API and page tests**

Run:

```bash
pnpm test:run -- src/lib/api.test.ts src/pages/UsersPage.test.tsx src/pages/AccessPage.test.tsx src/pages/OAuthClientsPage.test.tsx
pnpm test:run
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pages/UsersPage.tsx src/pages/UsersPage.test.tsx src/pages/AccessPage.tsx src/pages/AccessPage.test.tsx src/pages/OAuthClientsPage.tsx src/pages/OAuthClientsPage.test.tsx src/lib/api.ts src/lib/api.test.ts src/preferences/messages.ts src/index.css
git commit -m "fix: standardize admin management flows"
```

### Task 6: Split Content Lists From Dedicated Editors

**Files:**
- Create: `src/pages/content/ContentListPage.tsx`
- Create: `src/pages/content/ContentListPage.test.tsx`
- Create: `src/pages/content/ContentEditorPage.tsx`
- Create: `src/pages/content/ContentEditorPage.test.tsx`
- Create: `src/pages/content/ContentEditorFields.tsx`
- Delete: `src/pages/content/ContentModulePage.tsx`
- Modify: `src/App.tsx`
- Modify: `src/lib/cms-api.ts`
- Modify: `src/lib/cms-api.test.ts`
- Modify: `src/lib/mock-cms-api.ts`
- Modify: `src/preferences/messages.ts`
- Modify: `src/index.css`

**Interfaces:**
- Produces routes:
  - `/content/:module`
  - `/content/:module/new`
  - `/content/:module/:contentId`
- Consumes generated archive/restore methods from platform `0.2.0`

- [ ] **Step 1: Add failing list tests**

Assert search, status, sort, page, and page-size live in URL search params; requests abort on replacement; latest request wins; server `meta.total` drives pagination; previous rows remain during refresh; row buttons/links are keyboard accessible.

- [ ] **Step 2: Add failing editor tests**

Assert:

```text
new/edit are dedicated routes
locale tabs retain typed module fields
Save Draft prevents double submit
Preview uses current local draft without publishing
dirty browser/route navigation asks before leaving
409/412 offers Reload server version
revision dialog has loading/empty/error
archive/restore uses explicit AlertDialog and If-Match
```

- [ ] **Step 3: Verify tests fail**

Run:

```bash
pnpm test:run -- src/pages/content/ContentListPage.test.tsx src/pages/content/ContentEditorPage.test.tsx
```

Expected: FAIL because the current combined inspector/editor lacks these route and lifecycle states.

- [ ] **Step 4: Implement the list route**

Keep request sequencing local. Render a high-density table, localized filters, row action Menu, EmptyState, retryable error, and server Pagination. Create navigates to `/new`; rows navigate to the content ID.

- [ ] **Step 5: Implement typed editor routes**

Use one `ContentEditorFields` switch for News, History, and Videos; do not build a schema engine. Track the last saved normalized draft and derive dirty state by comparison. Use React Router `useBlocker` plus `beforeunload` only while dirty.

Preview opens a normal Dialog with the local draft's localized title/body/media. Archive is offered only when not public or pending. Restore is offered only for `archived`.

- [ ] **Step 6: Verify CMS client and editor tests**

Run:

```bash
pnpm test:run -- src/lib/cms-api.test.ts src/pages/content/ContentListPage.test.tsx src/pages/content/ContentEditorPage.test.tsx
pnpm test:run
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx src/pages/content src/lib/cms-api.ts src/lib/cms-api.test.ts src/lib/mock-cms-api.ts src/preferences/messages.ts src/index.css
git commit -m "feat: add dedicated content workspaces"
```

### Task 7: Complete News, History, And Video Editor Details

**Files:**
- Modify: `src/pages/content/ContentEditorPage.tsx`
- Modify: `src/pages/content/ContentEditorFields.tsx`
- Modify: `src/pages/content/ContentEditorPage.test.tsx`
- Modify: `src/preferences/messages.ts`
- Modify: `src/index.css`

**Interfaces:**
- Preserves: existing upload session, scan polling, publish/unpublish, and revision APIs

- [ ] **Step 1: Add failing module-specific tests**

News: localized title/summary/body/alt, display date, featured, stable cover preview, scan/processing status, publish disabled until ready.

History: localized date label/content and positive sort order.

Video: validated 11-character YouTube ID, localized title, home eligibility, thumbnail preview.

- [ ] **Step 2: Verify tests fail**

Run: `pnpm test:run -- src/pages/content/ContentEditorPage.test.tsx`

Expected: FAIL for cover/thumbnail preview or validation details.

- [ ] **Step 3: Implement module-specific presentation**

Use existing native date/number/file inputs and existing API validation. Display stable asset URLs from API responses; never display Azure/SAS details. Poll only while scan or processing is pending and stop on unmount/terminal state.

- [ ] **Step 4: Verify tests**

Run: `pnpm test:run -- src/pages/content/ContentEditorPage.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pages/content/ContentEditorPage.tsx src/pages/content/ContentEditorFields.tsx src/pages/content/ContentEditorPage.test.tsx src/preferences/messages.ts src/index.css
git commit -m "fix: complete typed content editors"
```

### Task 8: Refine Weekly Bulletin Workflow

**Files:**
- Modify: `src/pages/CmsPage.tsx`
- Create: `src/pages/CmsPage.test.tsx`
- Modify: `src/preferences/messages.ts`
- Modify: `src/index.css`

**Interfaces:**
- Preserves: issue list + inspector and three locale PDF workflow

- [ ] **Step 1: Add failing bulletin tests**

Cover issue creation, three localized PDF slots, upload validation, scan/processing states, publish/unpublish, previous-row retention, server Pagination, explicit confirmation, and partial locale failure.

- [ ] **Step 2: Verify tests fail**

Run: `pnpm test:run -- src/pages/CmsPage.test.tsx`

Expected: FAIL for localization, stable async state, or confirmation behavior.

- [ ] **Step 3: Apply the shared management pattern**

Keep the bounded inspector rather than forcing a dedicated editor. Use semantic list/table controls, status badges, retry for only the failed locale request, and one clear primary action per state.

- [ ] **Step 4: Verify tests**

Run: `pnpm test:run -- src/pages/CmsPage.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pages/CmsPage.tsx src/pages/CmsPage.test.tsx src/preferences/messages.ts src/index.css
git commit -m "fix: clarify bulletin management workflow"
```

### Task 9: Full Verification

**Files:**
- Modify only when verification exposes a defect

- [ ] **Step 1: Run the repository gate**

```bash
pnpm test:run
pnpm lint
pnpm build
git diff --check
```

Expected: PASS.

- [ ] **Step 2: Run deterministic browser QA**

Use mock mode and verify `375`, `768`, `1024`, and `1440` px in all three locales and both themes. Check Drawer, AccountMenu, all tables, dialogs, error/retry, content dirty guard, revisions, archive/restore, and no horizontal page overflow.

- [ ] **Step 3: Run real Account-to-Admin smoke**

Verify:

```text
already signed in centrally -> Admin opens without visible login/profile detour
fresh login -> returns to exact Admin route
global logout -> revoked session, then Admin login returns to Admin
OAuth state mismatch -> one transparent retry, then bounded recovery
CMS draft/publish/unpublish/archive/restore -> correct server versions
```
