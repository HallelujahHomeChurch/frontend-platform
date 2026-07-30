# Account Frontend UI/UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Account a localized, low-density settings product with correct session continuation, clear Personal info/Security/Devices routes, and consistent light/Warm Charcoal presentation.

**Architecture:** Upgrade to shared packages `0.2.0`, remove CSS repairs that belong to shared primitives, and keep account workflows application-owned. Bootstrap through the non-rotating session summary before refresh so anonymous login pages do not produce expected refresh errors.

**Tech Stack:** React 19, TypeScript 6.0.3, Vite 8, React Router 7, shared React Aria UI, Vitest

## Global Constraints

- Repository: `/Users/rayselfs/Projects/hhc/account/account-fe`.
- Pin `@hallelujahhomechurch/account-client`, `preferences`, and `ui` to exact `0.2.0`.
- Keep the existing avatar crop/upload contract and three social providers.
- Account menu contains Sign out only.
- Navigation is Personal info, Security, Devices; mobile uses the shared Drawer.
- Do not expose roles, permissions, activation state, or provider IDs to general users.
- Document title is `HHC 帳戶`, `HHC 帐户`, or `HHC Account`; all routes are `noindex,nofollow`.
- Security contains password, linked sign-in methods, and MFA only.
- Devices use a dedicated route and remain visible after remote sign-out.

---

### Task 1: Upgrade Shared Packages And Normalize The Shell

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `index.html`
- Modify: `src/App.tsx`
- Modify: `src/i18n/messages.ts`
- Modify: `src/index.css`
- Modify: `src/App.test.tsx`

**Interfaces:**
- Consumes: shared packages `0.2.0`
- Produces: localized title/robots metadata and three-route shell

- [ ] **Step 1: Add failing shell tests**

Assert:

```text
locale zh-Hant -> document.title === "HHC 帳戶"
meta[name=robots] -> "noindex,nofollow"
desktop/mobile navigation -> Personal info, Security, Devices
active nav item uses rectangular selected styling
```

- [ ] **Step 2: Verify tests fail**

Run: `pnpm test:run -- src/App.test.tsx`

Expected: FAIL because Devices and localized metadata are missing.

- [ ] **Step 3: Upgrade packages and implement shell metadata**

Pin package versions, install, change the static fallback title, add the robots meta, and set `document.documentElement.lang` plus `document.title` from locale context. Add `/devices` to desktop and Drawer navigation using one shared navigation-data array to avoid duplicated labels.

Delete application CSS that overrides shared Card, AccountMenu, Drawer, and Modal internals. Keep only account layout and business-page styles.

- [ ] **Step 4: Verify shell tests and build**

```bash
pnpm test:run -- src/App.test.tsx
pnpm lint
pnpm build
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml index.html src/App.tsx src/i18n/messages.ts src/index.css src/App.test.tsx
git commit -m "feat: align account shell with platform ui"
```

### Task 2: Correct Account Session Bootstrap

**Files:**
- Modify: `src/lib/api.ts`
- Modify: `src/lib/mock-account-api.ts`
- Modify: `src/auth/auth-context.tsx`
- Modify: `src/auth/auth-context.test.tsx`
- Modify: `src/pages/LoginPage.tsx`
- Modify: `src/pages/LoginPage.test.tsx`

**Interfaces:**
- Produces: `AuthApi.getSession(): Promise<AccountSession>`
- Consumes: `createAccountSessionClient` from `@hallelujahhomechurch/account-client`

- [ ] **Step 1: Add failing lifecycle tests**

Cover these ordered calls:

```text
anonymous /login       -> getSession only; no refresh
authenticated /login   -> getSession, refresh, me, then navigate return_to/profile
protected /profile     -> getSession, refresh, me
failed session summary -> actionable error, no refresh loop
```

Also assert StrictMode or rerender does not issue duplicate bootstrap refreshes.

- [ ] **Step 2: Verify tests fail**

Run:

```bash
pnpm test:run -- src/auth/auth-context.test.tsx src/pages/LoginPage.test.tsx
```

Expected: FAIL because auth routes currently skip restore and protected routes refresh blindly.

- [ ] **Step 3: Implement session-first bootstrap**

Expose `getSession` from real and mock APIs. Replace the `restoreSession` route switch with one bootstrap:

```ts
const session = await api.getSession()
if (!session.authenticated) finishAnonymous()
else {
  const token = await api.refreshAccessToken()
  if (token) await refreshProfile()
}
```

Use a ref-held bootstrap promise so repeated effects share the same in-flight decision. On Login, navigate only after profile restoration and preserve `auth_request_id`/`return_to`.

- [ ] **Step 4: Verify auth tests**

Run:

```bash
pnpm test:run -- src/auth/auth-context.test.tsx src/pages/LoginPage.test.tsx
pnpm test:run
```

Expected: PASS; anonymous login emits no refresh request.

- [ ] **Step 5: Commit**

```bash
git add src/lib/api.ts src/lib/mock-account-api.ts src/auth/auth-context.tsx src/auth/auth-context.test.tsx src/pages/LoginPage.tsx src/pages/LoginPage.test.tsx
git commit -m "fix: restore account sessions before refresh"
```

### Task 3: Refine Personal Info And Dialog Layout

**Files:**
- Modify: `src/pages/ProfilePage.tsx`
- Modify: `src/pages/ProfilePage.test.tsx`
- Modify: `src/components/ProfileAvatarEditor.tsx`
- Modify: `src/components/LanguageSelector.tsx`
- Modify: `src/components/LanguageSelector.test.tsx`
- Modify: `src/index.css`

**Interfaces:**
- Preserves: existing avatar upload/remove API calls
- Consumes: `Card.Content isFlush`, `Select variant="ghost"`, shared Modal spacing

- [ ] **Step 1: Add failing page tests**

Assert the page contains exactly five settings rows in order: Avatar, Name, Email, Language, Appearance. Assert avatar is circular/clickable, name edit opens one Dialog surface, and locale uses the shared listbox Select.

- [ ] **Step 2: Verify tests fail**

Run:

```bash
pnpm test:run -- src/pages/ProfilePage.test.tsx src/components/LanguageSelector.test.tsx
```

Expected: FAIL for the old locale implementation or duplicated modal classes.

- [ ] **Step 3: Implement the focused layout**

Use one padded Card and responsive settings rows. Keep the large avatar centered within its row, with the existing camera affordance and crop dialog. Remove `.modal-backdrop`, `.modal-container`, `.modal-dialog`, `.modal-form-grid`, and `.modal-actions` spacing repairs from JSX/CSS. Use shared ghost Select for locale.

- [ ] **Step 4: Verify profile and avatar flows**

Run:

```bash
pnpm test:run -- src/pages/ProfilePage.test.tsx src/components/LanguageSelector.test.tsx
pnpm test:run
```

Expected: PASS, including avatar upload/remove and name update.

- [ ] **Step 5: Commit**

```bash
git add src/pages/ProfilePage.tsx src/pages/ProfilePage.test.tsx src/components/ProfileAvatarEditor.tsx src/components/LanguageSelector.tsx src/components/LanguageSelector.test.tsx src/index.css
git commit -m "fix: simplify personal info settings"
```

### Task 4: Rebuild Security As Three Sign-In Settings

**Files:**
- Modify: `src/pages/SecurityPage.tsx`
- Modify: `src/pages/SecurityPage.test.tsx`
- Modify: `src/i18n/messages.ts`
- Modify: `src/index.css`

**Interfaces:**
- Produces: independent linked-account loading/error state
- Produces: explicit AlertDialogs for provider unlink and MFA disable

- [ ] **Step 1: Add failing Security tests**

Cover:

```text
initial render -> no password or MFA input fields
linked-account API failure -> localized error + Retry, not "no accounts"
unlink -> explicit provider-named AlertDialog + pending state
MFA disable -> explicit AlertDialog + pending state
password dialog -> one surface with current/new password
MFA setup -> QR, OTP, backup codes only inside dialog
```

- [ ] **Step 2: Verify tests fail**

Run: `pnpm test:run -- src/pages/SecurityPage.test.tsx`

Expected: FAIL because failed linked-account requests currently become empty data and destructive actions have no confirmation.

- [ ] **Step 3: Implement three settings groups**

Render Password, Linked sign-in methods, and MFA. Remove device state and markup entirely from this page. Track linked-account `{status, data, error}` locally; Retry only that request. Wrap unlink and MFA disable with shared AlertDialog and await server success before mutating local state.

Use Toast for mutation success/failure and field-level errors inside active dialogs.

- [ ] **Step 4: Run Security tests**

Run:

```bash
pnpm test:run -- src/pages/SecurityPage.test.tsx
pnpm test:run
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pages/SecurityPage.tsx src/pages/SecurityPage.test.tsx src/i18n/messages.ts src/index.css
git commit -m "fix: clarify account security workflows"
```

### Task 5: Add The Dedicated Devices Page

**Files:**
- Create: `src/pages/DevicesPage.tsx`
- Create: `src/pages/DevicesPage.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/i18n/messages.ts`
- Modify: `src/index.css`

**Interfaces:**
- Consumes: `AuthApi.listDevices` and `AuthApi.logoutDevice`
- Produces: `/devices`

- [ ] **Step 1: Add failing device workflow tests**

Assert ordering is current, other signed-in, then signed-out by activity. Assert browser/OS, IP, last sign-in, last activity, and status labels render. Remote sign-out keeps the row and changes it to signed out. Current-device sign-out clears auth state only after revocation succeeds.

- [ ] **Step 2: Verify the test fails**

Run: `pnpm test:run -- src/pages/DevicesPage.test.tsx`

Expected: FAIL because the page does not exist.

- [ ] **Step 3: Implement the page**

Move `relativeTime` and device rendering from Security into the new page; keep the helper local to avoid a one-use abstraction. Use one settings Card, explicit sign-out AlertDialog, independent loading/empty/error/retry states, and stable rows.

- [ ] **Step 4: Verify device tests**

Run:

```bash
pnpm test:run -- src/pages/DevicesPage.test.tsx src/App.test.tsx
pnpm test:run
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pages/DevicesPage.tsx src/pages/DevicesPage.test.tsx src/App.tsx src/i18n/messages.ts src/index.css
git commit -m "feat: add account device activity page"
```

### Task 6: Visual, Accessibility, And Production Verification

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

- [ ] **Step 2: Run browser QA with the mock server**

Run `pnpm dev:mock` and verify Login, Personal info, Security, and Devices at `375`, `768`, `1024`, and `1440` px in `zh-Hant`, `zh-Hans`, and `en`, light and Warm Charcoal. Check no horizontal page overflow, Card padding, Drawer keyboard behavior, AccountMenu outside-click/Escape, and one-surface dialogs.

- [ ] **Step 3: Run real auth smoke**

Against local Account API and gateway, verify anonymous Login sends no refresh request, existing session continues, MFA completes, avatar upload works, remote/current device sign-out behaves correctly, and global sign-out returns to Login.
