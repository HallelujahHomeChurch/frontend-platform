# Independent release preparation and Task 7b preflight review

2026-10-13. Read-only review. Authority for this batch: only Platform PR #121 merge/package release, then a new standalone Web Task 7b PR with CI. No other PR merge, deployment, feature gate, production data or infrastructure operation is approved by this review.

## Release-only diff

Reviewed actual uncommitted diff on Platform candidate `2255c89` plus repository AGENTS/README, package-contract checker, pack script and complete release workflow. Exactly eight manifest changes: workspace root and all seven packages move `1.0.62` → `1.0.63`. No other fields, dependency ranges, lockfile, workflow, renderer source, measurement script, CSS, font, asset or historical digest changes.

Package set: account-client, donation-client, donation-ui, hhc-web-client, operations-client, preferences and ui. `check-package-contracts.mjs` requires all seven publishable versions to equal root; a UI-only producer version bump would violate existing policy. Root stays private. Existing `workspace:*` inter-package references are resolved by pnpm packing/publishing; no hand-written local path or forecast consumer dependency is needed.

Release workflow is tag-triggered, checks `v` + root version and HEAD ancestry in origin/main, then runs existing build/tests/lint/contracts/security and isolated-renderer gates. It publishes the seven packages to GitHub Packages and the existing renderer image to an immutable `rendererHash-GITHUB_SHA` GHCR tag. It contains no Azure deployment, GitOps pin, application rollout, feature activation or production resource mutation. Publishing the new commit's image does not activate it in a backend.

**Release preparation code findings: Critical 0 / Important 0 / Minor 0.** Manifest-only bump is appropriate. Final version-commit PR CI and actual release/registry/image receipts remain mandatory; earlier green CI on `2255c89` is not proof for the final version commit. Verify all seven registry versions/integrities and image digest after workflow completion, since the existing sequential publish loop can be partially completed if a later step fails. Do not treat partial package publication as a successful release.

## Task 7b independence from unmerged Web #209

Inspected actual Web `origin/main` (`b4cf650` at review), not the older dirty primary checkout. Primary checkout was left unchanged. Task 7b can be a standalone branch/worktree from freshly fetched latest origin/main and does not require merging or cherry-picking #209.

- `api.ts`: replace only snapshot V9/V10 and V7-family font predicates with capability metadata. Keep requireBulletinRenderer and readBulletinTemplateSnapshot, account/edition/revision/receipt checks, exact asset URL/digest/kind allowlists and layout validation intact.
- `offline-store.ts`: replace only stageOfflineSave's V7-family predicate in the Hans 40 MiB versus other 32 MiB limit. #209 modifies listOfflineSaves projection in a separate region; the tasks share a file but neither depends on the other's return type. Preserve all stage/read/expiry/clock/transaction semantics and original list shape on this main-based Task 7b branch.
- `paper-lines.ts`: replace only the composer-owned cover spacing version selector, preserving geometry, style restore and text/anchors. Its sole product caller is WeeklyReader; PaperViewport provides a verified `data-reader-renderer` attribute. Existing tests also use absent attributes and expect legacy spacing; retain the missing-attribute fallback (for example resolve absent version as v1). Keep V1–V7 manual spacing and V8–V10 untouched composer spacing explicit in table tests.
- Dependency default: pin only `@hallelujahhomechurch/ui` to the actually released `1.0.63`. Web already intentionally mixes shared-package versions and UI has no hhc-web-client peer dependency. No forced SDK/Account/Operations bump is needed for this capability API. Install from registry after successful producer release; capture registry integrity, exact lock resolution and frozen install.

The static capability getter is not an authorization or artifact validator. Callers must not remove the existing frozen digest/template check because capabilities are available for a version name.

## Candidate verification gates

Run api/offline-store/paper-lines targeted suites on the finished candidate, retaining existing V1–V10 supported locale coverage, invalid/extra/missing snapshots, unknown versions, altered digest/assets and 32/40 MiB oversize rejection without overwriting prior saves. Add only missing table cases needed to establish exact predicate equivalence and missing DOM attribute behavior. Run full Web required CI: tests and immutable-asset check, lint, build, static budgets, release-policy script, image build and dependency/image scans. No failing check may be bypassed.

Browser validation should reuse the bounded real-IDB baseline→candidate→baseline fixture, now with **distinct actual installed packages**: baseline UI1.0.61 and candidate registry UI1.0.63. Preserve a single profile/tab/origin, full Date clock, receipts/epoch/original mutation IDs and recovery/return records. Render V1–V10 supported fixtures and compare text/anchors/style attributes; explicitly cover the V7 Hans fallback and V9/V10 snapshot families. Run a real DOM paper-lines spacing/restoration check for V1–V10, including the missing-attribute fallback. Existing Task 4 memory results do not need to be rerun to claim a new listing change, since this standalone branch does not contain that change.

Important fixture precondition: the old scratch entry symlinked temp root node_modules from the runner's cwd, and its baseline archive reused candidate dependencies. That was valid for the previous same-package refactor comparison but would invalidate this package-upgrade test. Baseline and candidate source node_modules and the temp entry node_modules must resolve to their own locked dependency installation. Read back loaded UI version/source identity per phase; do not let a1.0.63 baseline mask compatibility problems. Root has identified this fix and will provide the revised harness for independent inspection before execution.

Even successful synthetic source-entry switching is not full deployed Next artifact/SW update, authenticated API transport/backend dedupe, all recovery UI decisions or physical Safari/Android/PWA acceptance. Preserve those limitations in PR evidence.

**Preflight verdict: proceed with the authorized Platform release flow once final CI passes; implement Task 7b independently on main only after actual package release.** No open architecture/code finding blocks that scope. This report is not final Task 7b code review, completed release proof or permission to merge/deploy Web.

Not checked: remote final-version CI, actual publication/integrity/image digest, Task 7b candidate code and new browser execution were not available at this review.
Risk: mixing baseline/candidate dependency installations can falsely pass the package compatibility gate; actual release and loaded-version evidence must remain separate from source approval.
