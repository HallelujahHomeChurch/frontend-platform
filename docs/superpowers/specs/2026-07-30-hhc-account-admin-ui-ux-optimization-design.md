# HHC Account And Admin UI/UX Optimization Design

**Status:** Approved on 2026-07-30

## Purpose

Unify the visual language and interaction quality of `account-fe`, `admin-fe`,
and `hhc-web` without merging their repositories or deployments.

The work must make Account understandable as a low-density settings product,
Admin effective as a high-density management product, and the public website
visually consistent without forcing all three products into the same layout.

## Repository Ownership

- `frontend-platform` owns shared semantic tokens, React Aria primitives,
  preferences helpers, Account session helpers, and generated web API clients.
- `account-fe` owns login, profile, security, device, avatar, and account
  preference experiences.
- `admin-fe` owns account administration, RBAC, OAuth clients, and website
  content management.
- `hhc-web-api` owns CMS content lifecycle contracts, including archive and
  restore transitions.
- `hhc-web` owns the public website, localized legal pages, public account
  control, metadata, and public content presentation.

The applications consume exact published package versions. They do not import
source from another repository.

## Chosen Approach

Use a platform-first incremental redesign.

1. Add the missing CMS archive/restore and public News detail contracts to
   `hhc-web-api`.
2. Correct shared tokens and primitive contracts in `frontend-platform`.
3. Publish `@hallelujahhomechurch/*` version `0.2.0`.
4. Upgrade and optimize Account.
5. Upgrade and optimize Admin.
6. Upgrade and align the public website source.

This avoids three separate Card, Dialog, Menu, and dark-mode implementations.
It also preserves the existing React Aria foundation instead of replacing a
working accessibility layer.

Rejected approaches:

- Per-application CSS patches would be faster initially but preserve the
  current token and spacing drift.
- A new component framework or frontend rewrite would add migration risk
  without solving a missing capability.
- A new monorepo would reverse the approved repository split and deployment
  ownership.

## Design Principles

- Account uses low-density settings rows and dialog-based actions.
- Admin uses tables, filters, inspectors, and dedicated editor routes.
- Public Web remains editorial and image-led.
- Header, sidebar, and main use one canvas. Layout is communicated through
  grid, sticky positioning, and whitespace rather than divider lines or
  different background panels.
- Page titles match navigation labels.
- Descriptions appear only when they help complete a task or recover from an
  error.
- Cards represent real bounded content, not page sections.
- Dialogs use one surface and never contain another decorative Card.
- All destructive or security-sensitive actions name their exact impact.
- Hover, focus, loading, and error states do not shift layout.
- All keyboard interactions, focus restoration, outside click, and Escape
  behavior remain delegated to React Aria.

## Shared Visual System

### Warm Charcoal Dark Theme

The approved dark direction is Warm Charcoal:

| Token | Value |
| --- | --- |
| Canvas | `#171514` |
| Surface | `#211e1c` |
| Raised surface | `#2a2522` |
| Text | `#f3ece7` |
| Muted text | `#b9ada5` |
| Border | `#403832` |
| Primary coral | `#e07b71` |
| Secondary teal | `#67aaa4` |
| Success | `#78ad81` |
| Warning | `#d6a45f` |

The primary foreground is a semantic token, not fixed white. Primary control
background and foreground combinations must meet WCAG AA for their rendered
font size in both light and dark themes.

Shadows are reserved for overlays, menus, and raised transient surfaces.
Dark mode does not use decorative gradients, background blur, glow, or
multiple brown surface variations.

### Spacing And Shape

- Desktop Card content padding: `20px`.
- Mobile Card content padding: `16px`.
- Table containers may opt into flush content; this is explicit rather than
  relying on missing Card padding.
- Default control height: at least `40px`.
- Mobile touch targets: at least `44px`.
- Standard radius: `6px` or `8px`.
- Pills are reserved for status, tags, and true segmented controls.
- Navigation items use compact rectangular selection rather than oversized
  pills.

### Shared Primitive Contracts

`@hallelujahhomechurch/ui` continues to expose React Aria based primitives.

Required corrections:

- `Card`: predictable Header and Content spacing plus an explicit flush table
  treatment.
- `Button`: semantic primary foreground and stable pending state.
- `AccountMenu`: zero-padding avatar trigger, internal keyboard focus
  treatment, full-width menu items, centered greeting, and consistent action
  hit areas.
- `Modal`: one surface with one header/body/footer spacing system.
- `AlertDialog`: non-dismissable destructive confirmation with explicit
  cancel and confirm actions.
- `Drawer`: existing React Aria behavior with consistent HHC side-sheet
  presentation.
- `Select`: a ghost visual variant for locale controls while preserving
  listbox semantics.
- `Skeleton`, `EmptyState`, `Toast`, and `Pagination`: shared asynchronous
  states with stable dimensions and localized labels.

Generic business tables and editors do not move into the shared package.
Their data model, permissions, and actions remain application-owned.

## Account Experience

### Shell

- Desktop uses a `244px` sidebar, sticky header, and constrained content.
- Mobile uses the existing Drawer.
- The sidebar contains Personal info, Security, and Devices.
- Legal links remain at the bottom.
- The avatar menu contains Sign out only.
- Protected Account chrome never renders before session bootstrap resolves.
- The document title is localized as `HHC 帳戶`, `HHC 帐户`, or
  `HHC Account`.
- Every Account route emits `robots` metadata equivalent to
  `noindex,nofollow`.

### Personal Info

The page title is the localized Personal info navigation label.

Settings rows:

1. Avatar
2. Name
3. Email verification
4. Language
5. Appearance

The existing circular crop, zoom, upload, and remove flow remains. Avatar
selection is not replaced by a URL field.

Email shows verification state only. It does not expose roles, permissions, or
account activation internals.

### Security

Security contains only sign-in methods:

- Password status and Change action
- Linked Google, LINE, and Microsoft sign-in methods
- MFA state and Setup or Manage action

Password, MFA QR, OTP, backup codes, and removal controls only appear inside
their respective dialogs.

Unlink provider and disable MFA require explicit confirmation and pending
states. API failures are shown as failures, not converted into empty data.

### Devices

Devices move to a dedicated route and preserve the stable device/session
contract.

Rows show:

- Browser and operating system
- Current device
- Signed-in or signed-out state
- Last sign-in
- Last activity
- IP address when available

Signing out another device leaves the row visible and changes its state.
Signing out the current device clears local auth state only after server
revocation succeeds.

## Authentication Experience

### Account Login

Public auth routes do not blindly refresh.

When an authorization request reaches Account:

1. Read the non-rotating session summary.
2. Refresh only when an authenticated Account product session is present.
3. Continue the authorization request without rendering login when policy
   permits.
4. Otherwise render password, social login, and MFA as required.

This removes expected refresh errors from unauthenticated login pages.

### Admin Bootstrap

Admin bootstrap remains:

1. Same-origin session summary.
2. Same-origin refresh when a product session exists.
3. OAuth Authorization Code with PKCE when no Admin session exists.

Authorization startup is single-flight. Repeated React effects cannot overwrite
the saved state and PKCE verifier.

An OAuth state mismatch is never accepted. Admin clears the invalid
transaction and may transparently restart authorization once. A second failure
renders one localized recovery action and cannot loop.

### Return Location

The exact Admin pathname, query, and hash are preserved through authorization.

After global sign-out, Admin creates a new authorization request whose return
location is Admin. The revoked central session causes Account login to appear;
successful login returns to Admin instead of Account Profile.

### Loading

An auth decision is required, but a dedicated loading page is not.

- For the first `150ms`, render only the correct theme canvas.
- For a slower local session restore, render a stable shell skeleton.
- For a redirect, navigate without flashing Admin content or a login Card.
- Lazy route boundaries use page-shaped skeletons, not a bare `Loading` label.

## Admin Information Architecture

Sidebar groups:

- Overview
- Website content
  - Latest news
  - Weekly bulletins
  - History
  - Kingdom Joy
- Account and access
  - Users
  - Roles and permissions
  - OAuth clients

Navigation entries remain capability-filtered. Unimplemented destinations are
not displayed.

All navigation, page, table, status, dialog, error, and action strings support
`zh-Hant`, `zh-Hans`, and `en`. Domain identifiers such as permission codes,
role names, client IDs, and provider names remain unchanged.

`<html lang>` and the document title follow the shared locale cookie and active
route. The base title is localized as `HHC 管理中心`, `HHC 管理中心`, or
`HHC Admin`. Every Admin route emits `robots` metadata equivalent to
`noindex,nofollow`.

## Admin Overview

The current static cards are removed.

Overview answers two questions:

1. What content needs attention?
2. What can this administrator do next?

It uses existing list metadata and status filters to show real draft,
publication failure, and pending counts for modules the user can access.
Quick actions are capability-filtered.

Overview does not invent activity, health, revenue, or usage metrics. A failed
module request degrades only that module and provides Retry.

## Admin Management Pattern

All list pages use:

- Localized page title
- One primary Create action when creation is supported
- URL-backed server-supported query state
- Semantic table with horizontal overflow on narrow viewports
- Stable loading rows while retaining previous successful data
- Empty state with a relevant next action
- Recoverable error state
- Row action menu
- Server metadata for pagination

Desktop may use a detail inspector for quick management. Mobile uses a
dedicated detail view rather than compressing an inspector beside a table.

Mutation results use Toast. Field validation appears at the related field.
Double submission is prevented through pending controls.

Users and typed content lists support URL-backed search, filters, sort, page,
and page size. Weekly Bulletins use status, page, page size, and their natural
issue-date order; they do not add a text search that has no useful domain
target.

### Users

- Preserve the existing debounce, AbortController, request sequencing, URL
  filters, and server-total pagination.
- Support enable and disable, not hard delete.
- Assign and remove roles like other role operations.
- Prevent removal or disablement of the final active administrator.
- Show detail-loading state independently of table loading.

No user invitation workflow is added.

### Roles And Permissions

- List roles and permissions.
- Create roles and permissions through dialogs.
- Select a role to inspect its effective permissions.
- Assign and remove permissions through explicit actions.
- Preserve immutable role or permission behavior when enforced by the API.

### OAuth Clients

- List and create registered clients.
- Rotate a secret through an AlertDialog.
- Show a newly issued secret once with an explicit copy action.
- Do not show edit, disable, or delete controls until Account API contracts
  support them.
- Social provider client IDs and secrets remain deployment configuration and
  are not managed here.

## CMS Experience

### List And Editor Shape

Latest News, History, and Kingdom Joy use:

- Data table list route
- Dedicated create and edit routes
- Localized content tabs
- Explicit Save Draft
- Preview
- Publish and Unpublish
- Revision history
- Archive when the API contract exists

Complex editors do not open inside a narrow inspector or general-purpose
Dialog.

Their list contract is:

```http
GET /api/admin/content/{module}?q={query}&status={status}&sort={field}&direction={asc|desc}&page={page}&pageSize={size}
```

Search matches localized titles through parameterized SQL. Sort fields are a
module-aware allowlist: `updatedAt` for all modules, `displayDate` for News,
and `sortOrder` for History. Unsupported combinations return `400`.

Weekly Bulletins retain a list and inspector because one issue manages three
bounded PDF variants.

### Module Editors

Latest News:

- Localized title, summary, body, and image alt text
- Display date and featured state
- Cover image preview, scan status, and processing status

History:

- Localized date label and content
- Explicit sort order

Kingdom Joy:

- YouTube video ID
- Localized title
- Home eligibility

Weekly Bulletins:

- Issue date
- One PDF per supported locale
- Upload, scan, processing, publish, and unpublish state

### Editing Safety

- Dirty editors block accidental route and browser navigation.
- Revision dialogs distinguish loading, empty, and error states.
- Version conflicts never overwrite newer content. `409` or `412` prompts the
  user to reload the server version.
- Upload completion is not reported as publish-ready until security scanning
  and processing succeed.
- Publish and Unpublish state remains visible while asynchronous workflows run.
- Public URLs never expose Azure Blob or SAS details.

Hard delete is not part of the UI. `hhc-web-api` adds version-checked archive
and restore transitions:

- `POST /api/admin/content/{module}/{contentId}/archive`
- `POST /api/admin/content/{module}/{contentId}/restore`

Both require `cms:write` and `If-Match`. Archive rejects currently published or
publishing content; restore moves archived content to Draft. Both transitions
create the same revision and actor evidence as existing lifecycle operations.

## Public Website Alignment

The public website consumes the same semantic dark tokens but keeps its
editorial typography, images, and content rhythm.

Source changes include:

- Warm Charcoal dark surfaces without decorative dark gradients
- Shared Account menu behavior
- Shared locale and theme cookie behavior
- Correct production canonical domain
- Real Latest News list and detail destinations
- Exactly three eligible homepage videos

The Latest News detail route consumes a dedicated published projection:

- `GET /api/news/{slug}?locale={locale}`

`hhc-web-api` returns only published content, responds `404` for unknown or
unpublished slugs, and applies the same public cache policy as the news list.
The public website does not fetch a bounded list and search it for a detail
page.

The public website is not deployed as part of the Account and Admin rollout.
Its source changes remain independently releasable.

## Error Handling

- Errors use localized, actionable text and `role="alert"` when immediate.
- Empty data and failed data are distinct states.
- Previous successful list data remains visible during refresh.
- Retry repeats only the failed request.
- Security and publication errors do not claim success after partial work.
- Global sign-out keeps authenticated UI state when server revocation fails.
- OAuth retry is bounded to prevent redirect loops.

## Testing

### Shared Platform

- Primitive interaction tests for Menu, Drawer, Modal, AlertDialog, Select,
  Card, and AccountMenu
- Focus restoration, outside click, Escape, full-row action, and pending state
- Storybook light/dark and three-locale states
- Storybook accessibility checks
- Packed Vite and Next consumer tests

### Account

- Existing session continuation
- Unauthenticated login without refresh
- Profile and avatar flows
- Security error, retry, confirmation, and pending states
- Device current and remote sign-out
- Localized title and route labels

### Admin

- Single-flight authorization and bounded state mismatch recovery
- Exact return location across login and logout
- Full navigation and page i18n
- Overview partial failure
- Table loading, search race, pagination, empty, and error states
- User, RBAC, OAuth client, Bulletin, News, History, and Video workflows
- Dirty editor, revision loading, version conflict, and publish confirmation

### Browser Verification

- Mock E2E for deterministic application flows
- Real Account to Admin OAuth smoke test
- Keyboard-only navigation
- `375px`, `768px`, `1024px`, and `1440px`
- Light and Warm Charcoal dark themes
- `zh-Hant`, `zh-Hans`, and `en`
- No layout overlap or horizontal page overflow

Each repository must pass its existing unit tests, lint, and production build.
`frontend-platform` also passes package packing and consumer smoke tests.

## Release And Commit Boundaries

1. `hhc-web-api`: version-checked content archive/restore and public News
   detail contracts.
2. `frontend-platform`: shared tokens and primitive contracts; publish
   immutable `0.2.0`.
3. `account-fe`: package upgrade, Account UX, and Account auth lifecycle.
4. `admin-fe`: package upgrade, Admin auth, shell, i18n, management pages, and
   CMS workspaces.
5. `hhc-web`: package upgrade, dark-theme alignment, metadata, and public
   content navigation.

Each independently reviewable task receives its own commit. A repository does
not advance to deployment until tests, build, browser verification, and
rollback instructions pass.

## Out Of Scope

- Replacing React Aria
- Re-merging repositories
- User invitation workflow
- Hard deleting users or content
- Managing social provider secrets in Admin
- Changing seed admin lifecycle
- New analytics or fabricated dashboard metrics
- Deploying `hhc-web` during the Account and Admin rollout
