# Frontend Platform UI 0.2.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish one accessible Warm Charcoal design-system release that Account, Admin, and Web can consume without application CSS repairing shared primitives.

**Architecture:** Keep the current React Aria packages and correct their public contracts in place. Shared code owns tokens, spacing, focus, overlays, and generic async states; application-specific tables, editors, routes, translations, and API calls remain outside the package.

**Tech Stack:** React 19, TypeScript 6.0.3, React Aria Components, Vitest, Storybook 10, pnpm

## Global Constraints

- Generate API clients only from contracts published after the API hardening
  and HHC Web API content-contract gates pass.
- Repository: `/Users/rayselfs/Projects/hhc/frontend-platform`.
- Publish exact package version `0.2.0`; consumers pin the exact version.
- Do not add a component framework, monorepo app, business table, editor, router, or fetch logic.
- Approved dark tokens are canvas `#171514`, surface `#211e1c`, raised `#2a2522`, text `#f3ece7`, muted `#b9ada5`, border `#403832`, coral `#e07b71`, teal `#67aaa4`, success `#78ad81`, warning `#d6a45f`.
- Desktop Card padding is `20px`; mobile Card padding is `16px`; flush content is opt-in.
- Primary foreground/background combinations must pass WCAG AA.
- Menu, Select, Dialog, AlertDialog, and Drawer retain React Aria keyboard, outside-click, Escape, and focus restoration behavior.

---

### Task 1: Correct Semantic Tokens And Card Spacing

**Files:**
- Modify: `packages/ui/src/layout.tsx`
- Modify: `packages/ui/src/styles.css`
- Modify: `packages/ui/src/primitives.test.tsx`
- Modify: `packages/ui/src/primitives.stories.tsx`

**Interfaces:**
- Produces: `Card.Content` prop `isFlush?: boolean`
- Produces: semantic `--hhc-primary-foreground`

- [ ] **Step 1: Add failing Card tests**

Render regular and flush content:

```tsx
<Card><Card.Content>Regular</Card.Content></Card>
<Card><Card.Content isFlush>Table</Card.Content></Card>
```

Assert only the second has `hhc-card__content--flush`. Add a story showing both variants in light and dark themes.

- [ ] **Step 2: Verify the test fails**

Run: `pnpm --filter @hallelujahhomechurch/ui test:run`

Expected: FAIL because `isFlush` is not defined.

- [ ] **Step 3: Implement the Card contract and tokens**

Add a focused `CardContentProps` type, map `isFlush` to a class, and avoid forwarding it to the DOM. Apply one surface, border, and radius to `.hhc-card`; apply header/content spacing exactly once. Replace fixed white primary text with `var(--hhc-primary-foreground)` and update dark tokens to the approved values.

- [ ] **Step 4: Verify tokens and spacing**

Run:

```bash
pnpm --filter @hallelujahhomechurch/ui test:run
pnpm --filter @hallelujahhomechurch/ui build-storybook
```

Expected: PASS; Storybook shows padded regular Cards and edge-to-edge flush tables.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/layout.tsx packages/ui/src/styles.css packages/ui/src/primitives.test.tsx packages/ui/src/primitives.stories.tsx
git commit -m "fix: define card spacing and theme tokens"
```

### Task 2: Normalize Menu, Account Menu, And Locale Select

**Files:**
- Modify: `packages/ui/src/controls.tsx`
- Modify: `packages/ui/src/overlays.tsx`
- Modify: `packages/ui/src/styles.css`
- Modify: `packages/ui/src/primitives.test.tsx`
- Modify: `packages/ui/src/primitives.stories.tsx`

**Interfaces:**
- Produces: `SelectProps.variant?: 'default' | 'ghost'`
- Preserves: `AccountMenuProps`

- [ ] **Step 1: Add failing interaction and class tests**

Cover:

```tsx
<Select variant="ghost" label="Language" items={items} />
```

Assert the trigger receives `hhc-select__trigger--ghost`. Open `AccountMenu`, click the blank area at the right side of each menu row, and assert the action or link is activated. Close via outside click and Escape and assert focus returns to the 40px avatar trigger without an outer ring.

- [ ] **Step 2: Verify tests fail**

Run: `pnpm --filter @hallelujahhomechurch/ui test:run`

Expected: FAIL for the missing Select variant or incomplete row hit area.

- [ ] **Step 3: Implement the minimal presentation fixes**

Make menu items full-width grid/flex rows, keep the greeting centered, style link and action items identically, and keep the avatar trigger `40×40`, zero padding, borderless, and transparent. Focus-visible uses the avatar's internal 2px coral inset only. Add the ghost Select class without changing listbox semantics.

- [ ] **Step 4: Run UI tests and Storybook**

Run:

```bash
pnpm --filter @hallelujahhomechurch/ui test:run
pnpm --filter @hallelujahhomechurch/ui build-storybook
```

Expected: PASS in light/dark and all three label lengths.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/controls.tsx packages/ui/src/overlays.tsx packages/ui/src/styles.css packages/ui/src/primitives.test.tsx packages/ui/src/primitives.stories.tsx
git commit -m "fix: normalize shared menu interactions"
```

### Task 3: Make Dialog And AlertDialog One-Surface Workflows

**Files:**
- Modify: `packages/ui/src/layout.tsx`
- Modify: `packages/ui/src/overlays.tsx`
- Modify: `packages/ui/src/styles.css`
- Modify: `packages/ui/src/primitives.test.tsx`
- Modify: `packages/ui/src/primitives.stories.tsx`

**Interfaces:**
- Produces: `AlertDialogProps.onConfirm: () => void | Promise<void>`
- Produces: pending confirm behavior that closes only after success

- [ ] **Step 1: Add failing tests**

Use a deferred promise to prove:

```text
confirm clicked -> dialog remains open and buttons disabled
promise resolves -> dialog closes and focus returns
promise rejects -> dialog remains open for app-owned error rendering
```

Also render the controlled `Modal` and assert header, body, and footer each contribute spacing once.

- [ ] **Step 2: Verify tests fail**

Run: `pnpm --filter @hallelujahhomechurch/ui test:run`

Expected: FAIL because AlertDialog currently closes before asynchronous confirmation completes.

- [ ] **Step 3: Implement pending confirmation**

Track pending state inside `AlertDialog`, await `onConfirm`, close only on success, and always clear pending. Remove `slot="close"` from the confirm action. Keep AlertDialog non-dismissable; keep normal Dialog dismissable.

Consolidate modal spacing in shared CSS. Applications should not need `.modal-container`, `.modal-dialog`, `.modal-form-grid`, or `.modal-actions` padding overrides.

- [ ] **Step 4: Verify overlays**

Run:

```bash
pnpm --filter @hallelujahhomechurch/ui test:run
pnpm --filter @hallelujahhomechurch/ui build-storybook
```

Expected: PASS for keyboard, Escape rules, pending state, and focus restoration.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/layout.tsx packages/ui/src/overlays.tsx packages/ui/src/styles.css packages/ui/src/primitives.test.tsx packages/ui/src/primitives.stories.tsx
git commit -m "fix: unify dialog action behavior"
```

### Task 4: Complete Generic Async-State Primitives

**Files:**
- Modify: `packages/ui/src/data.tsx`
- Modify: `packages/ui/src/styles.css`
- Modify: `packages/ui/src/primitives.test.tsx`
- Modify: `packages/ui/src/primitives.stories.tsx`

**Interfaces:**
- Produces: `SkeletonProps` with `className?: string`
- Produces: localized `PaginationProps.labels` including an optional `navigation`

- [ ] **Step 1: Add failing accessibility tests**

Verify callers can label the pagination nav in Chinese and can size a Skeleton through a class without wrapping it:

```tsx
<Pagination labels={{navigation: '分頁', previous: '上一頁', next: '下一頁'}} />
<Skeleton className="table-row-skeleton" label="正在載入" />
```

- [ ] **Step 2: Verify tests fail**

Run: `pnpm --filter @hallelujahhomechurch/ui test:run`

Expected: FAIL for missing props.

- [ ] **Step 3: Add only the required props**

Do not create a generic async-state state machine. Forward `className` on Skeleton and use `labels.navigation ?? 'Pagination'` for the nav label.

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @hallelujahhomechurch/ui test:run`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/data.tsx packages/ui/src/styles.css packages/ui/src/primitives.test.tsx packages/ui/src/primitives.stories.tsx
git commit -m "fix: localize shared async states"
```

### Task 5: Regenerate The CMS Client With Archive Operations

**Files:**
- Modify: `packages/hhc-web-client/openapi/hhc-web-api.yaml`
- Modify: `packages/hhc-web-client/src/generated.ts`
- Modify: `packages/hhc-web-client/src/client.ts`
- Modify: `packages/hhc-web-client/src/client.test.ts`

**Interfaces:**
- Consumes: approved `hhc-web-api/openapi.yaml` containing `archiveContent` and `restoreArchivedContent`
- Produces: typed client methods `archiveContent(module, id, version)` and `restoreArchivedContent(module, id, version)`
- Produces: typed public `getHome(locale)` wrapper over the existing `/home` projection
- Produces: typed public `getNewsBySlug(locale, slug)` wrapper
- Extends: `listContent` params with `query`, `sort`, and `direction`

- [ ] **Step 1: Copy the approved API contract**

Copy the exact released `hhc-web-api/openapi.yaml` into `packages/hhc-web-client/openapi/hhc-web-api.yaml`. Do not hand-edit generated types.

- [ ] **Step 2: Regenerate and observe the wrapper test fail**

Run:

```bash
pnpm --filter @hallelujahhomechurch/hhc-web-client generate
pnpm --filter @hallelujahhomechurch/hhc-web-client test:run
```

Expected: generated types succeed; new wrapper tests fail until methods are exposed.

- [ ] **Step 3: Add the two thin client methods**

Use the existing authenticated request helper and send `If-Match: "\"${version}\""`. Return the generated `ContentItem` type and preserve current error mapping. Forward typed `query`, `sort`, and `direction` through `listContent`. Add `getHome(locale)` as a direct unwrap of `GET /home`; do not compose it from `/news` and `/videos` in the client. Add `getNewsBySlug(locale, slug)` as a direct unwrap of `GET /news/{slug}`.

- [ ] **Step 4: Verify generated drift and tests**

Run:

```bash
pnpm --filter @hallelujahhomechurch/hhc-web-client check:generated
pnpm --filter @hallelujahhomechurch/hhc-web-client test:run
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/hhc-web-client
git commit -m "feat: expose content archive client"
```

### Task 6: Version, Pack, And Consumer-Test 0.2.0

**Files:**
- Modify: `package.json`
- Modify: `packages/ui/package.json`
- Modify: `packages/preferences/package.json`
- Modify: `packages/account-client/package.json`
- Modify: `packages/hhc-web-client/package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Produces immutable package version `0.2.0`

- [ ] **Step 1: Set all package versions to `0.2.0`**

Keep TypeScript at `6.0.3` and existing dependency major versions. Run `pnpm install --lockfile-only` to update lockfile metadata.

- [ ] **Step 2: Run the full platform gate**

```bash
pnpm test
pnpm lint
pnpm build
pnpm check:packages
pnpm pack:packages
pnpm test:consumers
pnpm --filter @hallelujahhomechurch/ui build-storybook
git diff --check
```

Expected: all commands PASS; packed Vite and Next consumers resolve only package exports.

- [ ] **Step 3: Commit the release metadata**

```bash
git add package.json packages/*/package.json pnpm-lock.yaml
git commit -m "chore: prepare frontend platform 0.2.0"
```

- [ ] **Step 4: Publish only after review**

After release approval, push tag `v0.2.0`; `.github/workflows/release.yml`
verifies, builds, and publishes all four packages:

```bash
git tag v0.2.0
git push origin v0.2.0
```

Verify the release workflow succeeds and all four package versions are visible
before upgrading any application. Do not overwrite an existing `0.2.0`.
