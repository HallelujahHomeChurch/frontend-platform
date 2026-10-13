# Candidate verification and delivery gates

Producer PR: https://github.com/HallelujahHomeChurch/frontend-platform/pull/121. Task source commits: e81d596 (Task 2), a3eca06 (Task 6), 92f731a (Task 7a). Follow-up changes only scope the developer Vitest watch caller consistently and retain receipts. Independent Batch A and Task 7a reviews: no remaining Critical/Important.

Local toolchain: Node 24.21.0, pnpm 10.12.1, Playwright 1.63.0 with Chromium 153.0.8010.12 enforced by frozen measurement scripts, checksum-verified pinned actual fonts/art/licenses. CI runs its own Node 22 and pinned Linux image; local and remote receipts are separate. Host memory contention prompted serialized final checks rather than weakening assertions/timeouts.

Final checks (all exit 0):

- Frozen install, complete `pnpm build` and `pnpm pretest`.
- `pnpm -r --workspace-concurrency=1 --if-present test:run`: **443 Vitest tests in 37 files + 8 Node generator tests**, no failures/skips. Same package test scripts as root test, serialized only to bound host load.
- Complete lint; `check:generated` for Website/Donation/Operations clients; non-writing `check:bulletin`; package contracts.
- `pack:packages`, then existing packed Vite and Next.js consumer builds including additive getter/type. Temp file dependencies were confined to disposable smoke projects. No registry publication or formal consumer dependency/lock change.
- Final `verify-bulletin-renderer-v10.mjs --base-ref origin/main`; full verifier regression **5 passed, 0 skipped**. Task 2's complete original/candidate 205-file package manifest is byte-identical. Final bundle comparison after Task 6/7a: 196 of 205 files remain identical; exactly 9 expected non-frozen source/compiler/declaration-map outputs differ (recorded with hashes in `receipts/final-package-delta.json`), no added files. All historical renderer/measurement/CSS/font/asset/digest bytes remain equal.
- Packaging regression, final renderer bundle and unchanged pinned Dockerfile image build. Image is local `hhc-bulletin-renderer:refactor-final-20261013`, never published.
- Recursive producer/SDK contract equality: **55 schemas** (54 bulletin/reader/template roots plus shared reference), exact descriptions and definitions; no producer contract edits.

Native measurement matrix, all zero failures:

| Invocation | Pass | Skip |
| --- | ---: | ---: |
| Default V1 | 34 | 3 |
| V6 common + V6 | 48 | 0 |
| V7 common + V6 + V7 | 51 | 0 |
| V8 common + V8 | 44 | 0 |
| V9 common + V9 | 42 | 0 |
| V10 common + V10 | 41 | 0 |

The default's three skips are explicitly version-inapplicable hanging-whitespace/dense-body/dense-cover cases; those cases execute in later-version matrices. No missing fonts/browser are hidden as skips.

Local constrained container scope is legacy V1 and latest V10: network none, read-only root, 2 GiB, 1 CPU, bounded noexec/nosuid tmpfs, non-root image. The full existing V1/V3–V10 Linux container matrix remains in required CI unchanged; it is not replaced by this smaller local subset. Local V1: **34 pass, 3 version-conditional skips, exit 0**. Local V10: **41 pass, 0 skipped, exit 0**. Both ran on the final packaged candidate; complete logs and exit statuses are retained. Required exact-head remote CI remains pending at this evidence commit and must turn green before this PR is considered CI-verified; its authoritative result is linked from PR checks. No failed check is bypassed.

Remaining delivery boundaries: no merge, tag, package publish, release, deploy, feature-gate or production-data changes. **Task 7b is pending a separately authorized actual producer package release** before a formal dependency pin/releasable Web consumer PR. Packed smoke does not satisfy that gate. Physical iPad/iPhone/Android/PWA, live backend/member/production acceptance and release artifacts remain unverified/unperformed for this PR; do not describe this as production readiness. Retain this unmerged worktree.
