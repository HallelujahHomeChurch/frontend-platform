# Repository Instructions

## Delivery Policy

- Treat `main` as the production branch. Do not commit or push directly to `main`.
- Create a focused branch for every task and submit changes through a pull request.
- CI must pass before merge. Do not bypass, ignore, or merge around a failing required check.
- Keep changes small and reviewable, and use squash merge unless the repository explicitly requires another strategy.
- For deployable applications and services, a merge to `main` is the release boundary: build an immutable artifact, deploy it through CI/CD, then verify health and the production route.
- Never deploy an unmerged local commit or replace the CI/CD path with an ad hoc production command.
- If deployment fails, preserve the last healthy revision, report the failure, and use the repository rollback path.

## Architecture and local verification

- This is a pnpm workspace of versioned frontend libraries, not an HTTP service.
  `packages/ui` owns shared UI and immutable bulletin rendering;
  `packages/preferences` owns preferences; `packages/{account,hhc-web,operations}-client`
  own typed service contracts. Donation packages remain a separate domain;
  follow the README's Donation source gate before publishing or enabling consumers.
- `tools/bulletin-renderer` packages the isolated renderer image. Preserve frozen
  renderer versions, canonical content/anchors and digest-pinned assets. Changes
  to contracts or rendering require coordinated consumer compatibility; do not
  replace published manifests or enable a producer before its readers support it.
- Use Node and pnpm versions from `package.json` (Node >=22, pnpm 10.12.1).
  Install with `corepack pnpm install --frozen-lockfile`; there is no root `dev`
  server or database. Registry access for consumers/publishing is distinct from
  this workspace's install; do not infer credential availability or print tokens.
- Run `corepack pnpm test`, `lint`, `build`, `check:packages`, `pack:packages`
  and `test:consumers`. The last five names are pnpm scripts too. These package
  checks do not replace the renderer image, asset and renderer shard CI gates.
- Start with [README.md](README.md), [package.json](package.json),
  [pnpm-workspace.yaml](pnpm-workspace.yaml), and
  [.github/workflows/ci.yml](.github/workflows/ci.yml). Follow the README's
  version-specific renderer commands and required assets for a renderer change;
  report source inspection, local tests and native/CI acceptance separately.

## Multi-repository Codex tasks

- First read the checked-out `hhc-planning/AGENTS.md` and
  `hhc-planning/docs/cloud-environments.md` at the planning revision recorded in
  the task. Sibling repositories do not inherit those instructions automatically.
- This repository owns its setup and verification: read its README, runtime
  manifests and CI before choosing commands. Report missing dependencies or
  unverified Linux startup instead of claiming a successful run.
- Preserve unrelated edits and active writer ownership. Use an isolated task
  branch and follow the task's explicit review, merge and deployment authorization.
- Pure human documentation uses lightweight validation. Source, workflow, runtime
  configuration, executable skills and mixed changes retain full verification.
  Record read-only inspection, test execution, CI and live acceptance separately.

If no sibling planning checkout exists, use the [single-repository fallback](https://github.com/HallelujahHomeChurch/hhc-planning/blob/73ee1af2a1ff828d72421a73626f45ff4ce04a6f/docs/cloud-environments.md#single-repository-checkout)
to read the same entry documents through authorized GitHub access at the task’s
immutable planning revision. Record that revision; report the exact inaccessible
target/error without expanding permissions or copying private text here.
