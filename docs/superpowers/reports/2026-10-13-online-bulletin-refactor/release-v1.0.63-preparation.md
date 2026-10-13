# v1.0.63 release preparation

User follow-up authorizes Platform PR #121 merge/package release and later Task 7b PR/CI only. Other application PRs, production deployments, feature gates and data remain outside this authorization. Root agent owns merge/tag after final-head required CI and independent review; this preparation publishes nothing.

## Scope

Root and all seven package manifests move together from 1.0.62 to 1.0.63. No runtime source, dependencies, lockfile, workflow or frozen renderer/measurement/CSS/fonts/assets/digests change in this follow-up. Workspace dependencies remain `workspace:*` and packing resolves them to the coordinated version.

Existing release workflow publishes `@hallelujahhomechurch/{ui,preferences,account-client,hhc-web-client,operations-client,donation-client,donation-ui}` and pushes `ghcr.io/hallelujahhomechurch/hhc-bulletin-renderer:<V10-renderer-hash>-<release-commit-SHA>`. Its main ancestry/tag-version checks, full verification, package and image vulnerability scans remain intact. This creates artifacts; no deployment or infrastructure/data/feature-gate mutation occurs. The Donation packages are included by the existing coordinated policy; publication is not bank integration or production acceptance.

## Verified before commit

- Remote `v1.0.62` exists; `git ls-remote --tags origin refs/tags/v1.0.63` returns no tag.
- Authenticated paginated GitHub Packages versions API reports 1.0.63 absent for all seven packages. Credentials were not printed or persisted. Recheck immediately before creating the release tag to avoid a concurrent collision.
- `PATH=/tmp/bulletin-platform-bin:$PATH corepack pnpm check:packages`: exit 0.
- `corepack pnpm pack:packages`: exit 0, all seven 1.0.63 tarballs produced.
- `corepack pnpm test:consumers`: exit 0; existing Vite and Next consumers build against 1.0.63 tarballs, including renderer capabilities export. See corresponding receipts logs.

Previous final-head CI run 38375583074 belongs to 2255c89 and is not acceptance of this version follow-up. The new pushed head must pass all existing required CI without bypass before merge. PR checks provide the live final-head result; release workflow success and subsequent registry artifact/digest inspection are separate gates. Task 7b formal dependencies may only use actually published 1.0.63 artifacts. Physical/live production acceptance is not claimed.
