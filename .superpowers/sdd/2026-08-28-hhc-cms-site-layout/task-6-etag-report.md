# Task 6 ETag/OpenAPI Contract Sync Report

## Result

DONE. Synced the released Site Layout ETag contract from hhc-web-api commit `a8394bd1644ea0793531cdcfe406f2c3ed0e64d7` and regenerated the typed client.

## Contract evidence

- Source: `/Users/rayselfs/Projects/hhc/website/hhc-web-api` commit `a8394bd1644ea0793531cdcfe406f2c3ed0e64d7` (`origin/main`)
- Vendored file: `packages/hhc-web-client/openapi/hhc-web-api.yaml`
- SHA-256: `83958d2d5dc42d8acc35d3106d1357845297b52223c959a00fdefdaceb00476f`
- Includes `If-None-Match`, Site Layout `304`, `ETag`, and `Cache-Control` definitions.

## Changes

- Regenerated `packages/hhc-web-client/src/generated.ts` with the repository's `openapi-typescript` command.
- Bumped workspace and all four publishable package manifests from `0.6.15` to `0.6.16`, as required by `check-package-contracts`.
- `pnpm-lock.yaml` has no package-version importer entries and remained unchanged after `pnpm install --lockfile-only --offline`.
- No client wrapper, API method, or abstraction changes.

## Verification

- `corepack pnpm test` — PASS (4 files, 112 tests)
- `corepack pnpm lint` — PASS
- `corepack pnpm build` — PASS
- `corepack pnpm --filter @hallelujahhomechurch/hhc-web-client check:generated` — PASS
- `corepack pnpm check:packages` — PASS (4 packages)
- `corepack pnpm pack:packages` — PASS (4 tarballs at `0.6.16`)
- `corepack pnpm test:consumers` — PASS (Vite and Next consumer builds)
- `git diff --cached --check` — PASS

## Delivery

- Commit: `fix: sync site layout ETag contract`
- No push, PR, or tag created.
