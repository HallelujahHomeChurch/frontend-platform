# Typed bulletin settings client implementation plan

> Execute inline with executing-plans and TDD; one whole-branch review.

**Goal:** Keep canonical V9 documents and the three private settings operations in
the existing Website SDK so Admin does not add a separate fetch/auth convention.
**Architecture:** Synchronize the canonical Website OpenAPI, regenerate existing
types, add three thin no-store SDK methods and public types. Export the existing
V9 snapshot validator so private/offline readers reuse it at their trust boundary.
Restore uses the
existing CAS save with selected historical values; no invented restore endpoint.
**Spec:** Approved adaptive-conversion decisions; settings and snapshots produced
by API192/194/195. Gateway160 provides the existing same-origin boundary.

## Global constraints

- No publication, locale conversion, query credentials or separate auth client.
- Producer and gateway release before Admin consumption; V9 renderer116 must be
  merged before this SDK release. This branch starts latest origin/main739ad33;
  rebase after116, next unused version (expected1.0.59), never reuse a published tag.
- Server validates three text values; SDK preserves text, reports CAS conflicts,
  forwards abort and quotes the current version as If-Match.

## Task 1: Canonical settings contract and real request behavior

Files: packages/hhc-web-client/openapi/hhc-web-api.yaml, src/generated.ts,
src/client.ts, src/template-settings.test.ts; existing UI domain generator.
Consumes: GET/PUT /admin/bulletins/template-settings, GET /revisions, three closed
values and immutable history. Produces: BulletinTemplateText/Settings/Revision,
getBulletinTemplateSettings(signal), saveBulletinTemplateSettings(version,input,
signal), listBulletinTemplateSettingsRevisions(signal).

- [ ] RED: controlled transport observes exact methods/paths, no-store, human token,
  current If-Match, body unchanged, abort and returned current/history. Conflict
  propagates and does not silently retry. Unsafe or nonpositive versions make no call.
- [ ] Sync producer canonical contract mechanically; generate endpoint types/domain.
- [ ] Implement in existing client with standard unwrap and no new dependency.
- [ ] GREEN focused tests; full tests/lint/build/generated/domain checks, seven
  package contracts and packed consumers after rebasing onto renderer116.
- [ ] Commit, one fresh-context whole-branch review, required CI, merge and normal
  tag/package publication. Verify exact versions before Admin consumer update.

## Review focus

Wrong endpoint/CAS/abort forwarding, silent overwrite on412, loss of V9 snapshot
in typed member/editor data, accidental broadcast contract regression, published
version collision. Tests cover request behavior; generated types/packed consumers
cover contract consistency. Real settings writes and 1739–1741 UI acceptance follow
in the scoped Admin/producer delivery, not claimed by SDK tests.
