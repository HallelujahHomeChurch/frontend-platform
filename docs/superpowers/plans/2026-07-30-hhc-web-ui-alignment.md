# HHC Web UI Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align the public website with the shared light/Warm Charcoal system, preserve its editorial character, and add real News destinations and deterministic homepage projections.

**Architecture:** Keep Next.js and public-page components application-owned. Consume platform `0.2.0` for tokens, preferences, account control, and API clients; use server-rendered published projections from `hhc-web-api`. This plan changes source only and does not deploy the website.

**Tech Stack:** Next.js 16, React 19, TypeScript 6.0.3, next-intl, shared React Aria UI, Vitest

## Global Constraints

- Repository: `/Users/rayselfs/Projects/hhc/hhc-web`.
- Pin all shared packages to exact `0.2.0`.
- Keep editorial typography, images, and public content rhythm.
- Use Warm Charcoal semantic tokens; no dark gradients, glow, blur, or multiple brown panel shades.
- Header Account menu remains session-summary based and does not refresh tokens.
- Production canonical origin is `https://www.alive.org.tw`.
- Latest News detail uses `GET /api/news/{slug}`; never search a bounded list.
- Homepage uses `/api/home` and renders at most three eligible videos.
- Do not deploy `hhc-web` as part of this plan.

---

### Task 1: Upgrade Packages And Consolidate Theme Tokens

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `src/app/globals.css`
- Modify: `src/app/layout.test.tsx`
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Consumes: shared packages `0.2.0`
- Preserves: before-paint `hhc_theme` and locale-cookie behavior

- [ ] **Step 1: Add failing layout/token tests**

Assert the root imports shared styles, before-paint bootstrap sets `data-theme`, and app-specific aliases resolve to semantic shared variables instead of redefining a second dark palette.

- [ ] **Step 2: Verify tests fail**

Run: `pnpm test:run -- src/app/layout.test.tsx`

Expected: FAIL for duplicated dark token values or missing platform version.

- [ ] **Step 3: Upgrade and simplify theme CSS**

Pin package versions and install. Keep only web-specific semantic aliases and editorial tokens in `globals.css`. Remove dark-only decorative gradients, glows, and hardcoded light surfaces. Use the approved shared canvas/surface/text/border/coral/teal variables.

- [ ] **Step 4: Verify layout and build**

```bash
pnpm test:run -- src/app/layout.test.tsx
pnpm lint
pnpm build
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml src/app/globals.css src/app/layout.tsx src/app/layout.test.tsx
git commit -m "feat: align public theme with platform ui"
```

### Task 2: Align Header, Account Control, Drawer, And Footer

**Files:**
- Modify: `src/components/layout/SiteHeader.tsx`
- Modify: `src/components/layout/SiteHeader.test.tsx`
- Modify: `src/components/layout/AccountControl.tsx`
- Modify: `src/components/layout/AccountControl.test.tsx`
- Modify: `src/components/layout/SiteFooter.tsx`
- Modify: `src/components/layout/SiteFooter.test.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- Preserves: passive SSO attempt and non-rotating session summary
- Consumes: shared AccountMenu and Drawer behavior

- [ ] **Step 1: Add failing interaction tests**

Assert:

```text
anonymous -> one Sign in control
authenticated -> avatar, Manage account, Sign out
menu outside click/Escape -> closes and restores internal avatar focus
mobile Drawer -> keyboard accessible and closes after navigation
footer -> localized "Privacy / Terms" equivalent
```

- [ ] **Step 2: Verify tests fail**

Run:

```bash
pnpm test:run -- src/components/layout/SiteHeader.test.tsx src/components/layout/AccountControl.test.tsx src/components/layout/SiteFooter.test.tsx
```

Expected: interaction or styling-contract assertions FAIL before shared `0.2.0` cleanup.

- [ ] **Step 3: Apply shared behavior without flattening the website**

Remove header divider/blur and use the same opaque canvas with whitespace and sticky positioning. Keep public navigation editorial. Use shared AccountMenu unchanged; keep Account management as the extra row. Ensure the mobile menu trigger and avatar remain separate 44px targets.

- [ ] **Step 4: Verify layout component tests**

Run:

```bash
pnpm test:run -- src/components/layout
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/layout src/app/globals.css
git commit -m "fix: align public shell interactions"
```

### Task 3: Correct Production Metadata And Discoverability

**Files:**
- Modify: `src/lib/site.ts`
- Modify: `src/lib/seo.ts`
- Modify: `src/lib/seo.test.ts`
- Modify: `src/app/robots.ts`
- Modify: `src/app/sitemap.ts`
- Modify: `src/app/opengraph-image.tsx`

**Interfaces:**
- Produces canonical origin `https://www.alive.org.tw`

- [ ] **Step 1: Add failing SEO tests**

Assert canonical, hreflang, Open Graph, robots sitemap URL, and sitemap entries all use `www.alive.org.tw`, never `example.com`.

- [ ] **Step 2: Verify tests fail**

Run: `pnpm test:run -- src/lib/seo.test.ts`

Expected: FAIL because `siteConfig.url` is currently `https://example.com`.

- [ ] **Step 3: Correct metadata at the shared source**

Change only `siteConfig.url`; keep all helpers consuming it. Keep public pages indexable. Do not add Account/Admin routes to the public sitemap.

- [ ] **Step 4: Verify SEO and build**

```bash
pnpm test:run -- src/lib/seo.test.ts src/app/page.test.ts
pnpm build
```

Expected: PASS with no `example.com` in generated metadata.

- [ ] **Step 5: Commit**

```bash
git add src/lib/site.ts src/lib/seo.ts src/lib/seo.test.ts src/app/robots.ts src/app/sitemap.ts src/app/opengraph-image.tsx
git commit -m "fix: use production website metadata"
```

### Task 4: Consume The Homepage Projection

**Files:**
- Create: `src/features/home/api.ts`
- Create: `src/features/home/api.test.ts`
- Modify: `src/features/news/api.ts`
- Modify: `src/features/videos/api.ts`
- Modify: `src/app/[locale]/page.tsx`
- Modify: `src/app/[locale]/page.test.ts`
- Modify: `src/components/home/VideoSection.tsx`
- Modify: `src/components/home/NewsSection.tsx`

**Interfaces:**
- Consumes: `HhcWebClient.getHome(locale)`
- Produces: `getHomeContent(locale): Promise<{news: NewsItem[]; videos: VideoItem[]}>`

- [ ] **Step 1: Add failing projection tests**

Assert one `/home` call maps News and Videos, preserves stable URLs, and truncates videos defensively to three. Assert Home no longer separately calls `/news` and `/videos`. Assert the Latest News header links to `/{locale}/news`.

- [ ] **Step 2: Verify tests fail**

Run:

```bash
pnpm test:run -- src/features/home/api.test.ts 'src/app/[locale]/page.test.ts'
```

Expected: FAIL because Home currently performs two list calls and the News link is `#`.

- [ ] **Step 3: Implement the thin home adapter**

Export focused `mapNewsItem` and `mapVideoItem` functions from existing feature APIs, then map the generated `/home` response in `features/home/api.ts`. In the page, make one request and render `videos.slice(0, 3)`.

- [ ] **Step 4: Verify homepage tests**

Run:

```bash
pnpm test:run -- src/features/home/api.test.ts 'src/app/[locale]/page.test.ts' src/components/home
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/home src/features/news/api.ts src/features/videos/api.ts 'src/app/[locale]/page.tsx' 'src/app/[locale]/page.test.ts' src/components/home
git commit -m "feat: consume published homepage projection"
```

### Task 5: Add Real Latest News List And Detail Routes

**Files:**
- Create: `src/app/[locale]/news/page.tsx`
- Create: `src/app/[locale]/news/page.test.tsx`
- Create: `src/app/[locale]/news/[slug]/page.tsx`
- Create: `src/app/[locale]/news/[slug]/page.test.tsx`
- Modify: `src/features/news/api.ts`
- Modify: `src/features/news/api.test.ts`
- Modify: `src/i18n/locales/zh-Hant.json`
- Modify: `src/i18n/locales/zh-Hans.json`
- Modify: `src/i18n/locales/en.json`
- Modify: `src/app/sitemap.ts`
- Modify: `src/app/globals.css`

**Interfaces:**
- Consumes: `HhcWebClient.getNewsBySlug(locale, slug)`
- Produces: localized `/[locale]/news` and `/[locale]/news/[slug]`

- [ ] **Step 1: Add failing API and route tests**

Cover:

```text
list -> published News cards link to localized detail URLs
detail -> fetches exact slug endpoint
404 API response -> notFound()
metadata -> localized title/summary/canonical/hreflang
body -> title, display date, cover+alt, structured text
```

- [ ] **Step 2: Verify tests fail**

Run:

```bash
pnpm test:run -- src/features/news/api.test.ts 'src/app/[locale]/news'
```

Expected: FAIL because routes and `getNewsBySlug` adapter do not exist.

- [ ] **Step 3: Implement list and detail pages**

The list may use the existing published News list. The detail must call the slug endpoint directly. Render server content with existing typography and semantic elements; do not use `dangerouslySetInnerHTML` unless the API contract explicitly changes from plain structured text.

- [ ] **Step 4: Include published News in sitemap**

Use the published News list to add localized detail URLs. If the API is unavailable while generating sitemap, keep static routes and do not inject mock URLs.

- [ ] **Step 5: Verify routes and production build**

```bash
pnpm test:run -- src/features/news/api.test.ts 'src/app/[locale]/news'
pnpm build
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add 'src/app/[locale]/news' src/features/news src/i18n/locales src/app/sitemap.ts src/app/globals.css
git commit -m "feat: add published news routes"
```

### Task 6: Full Visual And Accessibility Verification

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

- [ ] **Step 2: Run browser QA**

Verify Home, About, Literature Ministry, News list/detail, Privacy, and Terms at `375`, `768`, `1024`, and `1440` px in three locales and both themes. Check menu/Drawer keyboard behavior, readable Warm Charcoal contrast, image visibility, no overlap, and no horizontal overflow.

- [ ] **Step 3: Confirm release boundary**

Record build and screenshot evidence, but do not deploy or change API Gateway routing in this plan.
