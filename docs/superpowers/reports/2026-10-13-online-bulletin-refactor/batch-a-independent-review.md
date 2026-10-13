# Independent Platform Batch A review — Tasks 2 and 6

2026-10-13. Reviewer: backend implementation agent, not author of Platform changes. Read-only review of actual worktree based on `3f8dd7576f3f705e6f1ebcaddd8bf17b0af73109`. No changes to Platform checkout.

Reviewed full generator and its new tests, client package scripts and nine existing test locations, root build/test/check scripts, CI and release verifier call sites, complete V1–V10 verifier composition/source and digest closures, package renderer file/asset copy logic, renderer type-only generated imports and changed schema description. Reviewed actual code/callers, not just diff.

## Initial finding and disposition

**Important P1 — new predecessor tamper assertion rejects the correct V1/V2 failure.** The new V10 loop asserted `/immutable/` for each compiled predecessor. Base verifier compiled-digest failures say `Renderer artifact changed: never regenerate a referenced version.`, so a correctly blocked V1/V2 edit could fail the regression assertion and fail CI. Reported directly to author. Author changed only the assertion to `/immutable|Renderer artifact changed/`, preserving required failure and specificity. Re-read final source: resolved in code. Full tamper rerun remains required; review does not stand in for its receipt.

Author independently identified Node `node:test` tests being picked up by Vitest. Re-reviewed `test:run` as Node generator suite then `vitest run src`: all nine existing Vitest test files are under src; no existing suite is excluded. No additional review finding.

## Confirmed boundaries

- V10 forwards `--base-ref` through V9, V8 and V7. V7 directly invokes V1/V2 and V3–V6 with the same base arguments, compensating for V3–V5 not forwarding to their own predecessors. Removing duplicate top-level calls leaves all version byte/source gates reachable. Frozen verifier scripts remain unmodified.
- Packaging still invokes V10 before copying anything, compares runtime versions, checks every asset and license SHA-256, refuses an existing destination, and copies the same renderer/measurement/verifier/assets closure. No packaging payload policy was removed.
- The two generated output changes synchronize only an existing V10 schema description from the owning checked-in SDK OpenAPI. No shape changes or frozen renderer edits; the generated types are imported with `import type`. Packaged byte-manifest comparison must distinguish this expected source/declaration documentation change from immutable executable/rendering closure; author remains responsible for evidence.
- Default generator source is now the SDK OpenAPI snapshot, explicit `--source` remains supported, transitively referenced shared models/enums are included, cyclic references terminate by already-included names, and missing schema references fail closed. Default/explicit `--check` computes expected JSON and TypeScript without any write path; exceptions happen before writes.
- Existing CI already runs `check:bulletin`; new Node tests are included in root recursive `test` through package `test:run`. No new runtime dependency or package publication was added.

## Independent execution

`node --test packages/hhc-web-client/scripts/generate-bulletin-domain.test.mjs`: **8 passed, 0 skipped, 0 failed**. This covers explicit/default read-only success and stale checks, relevant reference shape, missing reference/input, stale JSON/TS, unrelated schemas and cycles. Independent log at `/tmp/platform-domain-independent-review.log` for coordinator to retain.

`node packages/hhc-web-client/scripts/generate-bulletin-domain.mjs --check`: **exit 0**, current checked-in snapshot and both outputs agree.

## Re-review conclusion

Remaining Critical = 0; Important = 0 in reviewed source after P1 correction. No further code change requested. Acceptance remains conditional on candidate full tests/build/lint, completed tamper suite, immutable package manifest parity, required container/browser gates and CI. This is not a release/production-ready verdict and author test claims were not substituted for independent execution.

Not checked: no package publication, live deployment, physical devices, full Platform suites or container/browser suite by this reviewer. Heavy verifier reruns are coordinated by root because of host resource contention.

## Watch-script follow-up review

Independent advisor `/root/admin_advisor` inspected the additional `test: "vitest src"` change: all nine existing client suites are under `src`, avoiding accidental Node test discovery in developer watch mode; `test:run` still explicitly runs Node generator tests then source Vitest tests. C0/I0, no further correction requested. Final serialized all-package test run includes 443 Vitest tests and 8 Node tests, all passing.
