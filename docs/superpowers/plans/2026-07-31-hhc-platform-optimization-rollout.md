# HHC Platform Optimization Rollout Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Execute the approved API and frontend optimization plans in dependency order, with each repository independently reviewable, deployable, and rollback-safe.

**Architecture:** API security and data-path correctness are deployment gates, not a shared codebase. After backend contracts are stable, publish the shared frontend package, then update Account, Admin, and public Web consumers without merging repositories or deployments.

**Tech Stack:** Go services, PostgreSQL, Redis, Azure Blob/Service Bus/Key Vault/ACA, Nginx gateway, React/TypeScript frontends

## Global Constraints

- Every task commit belongs to the repository that owns the behavior.
- A roadmap checkbox, unit suite, or successful image build is not deployment proof.
- No service advances until implementation, repository verification, pipeline verification, deployment, and live smoke pass.
- Production mutations require inventory/dry run, exact change preview, rollback, and explicit approval.
- `hhc-web` source may be optimized but is not deployed in the Account/Admin rollout.
- API candidate indexes require query-direction evidence; candidate removals require live usage evidence.

---

### Stage 1: Edge And Shared Infrastructure Blockers

**Plans:**
- `2026-07-31-api-gateway-security-hardening.md`
- Tasks 1, 2, and 4 of `2026-07-31-asset-api-production-hardening.md`
- Tasks 1, 2, 4, and 5 of `2026-07-31-notification-api-production-hardening.md`

- [ ] Remove query-string leakage and unknown-`kid` amplification.
- [ ] Reject oversize Blob uploads before streaming and allow Account CORS.
- [ ] Add Asset and Notification database pool budgets.
- [ ] Make notification key rotation and secret scope deployment-safe.
- [ ] Run repository gates; do not deploy yet.

**Exit gate:** No confirmed P1 security, secret, upload-abuse, or connection-budget defect remains.

### Stage 2: Data Paths, Indexes, Retry, And Retention

**Plans:**
- `2026-07-31-account-api-production-hardening.md`
- Remaining tasks in `2026-07-31-asset-api-production-hardening.md`
- Remaining tasks in `2026-07-31-notification-api-production-hardening.md`
- `2026-07-31-hhc-web-api-production-hardening.md`

- [ ] Remove Account registration race and bound Redis/RBAC work.
- [ ] Add only confirmed Account and Notification indexes.
- [ ] Remove CMS and Bulletin N+1 queries and enforce SQL limits.
- [ ] Make derivatives retryable and purged states terminal.
- [ ] Add explicit service retention and conditional public download behavior.
- [ ] Capture representative query plans and concurrency evidence.

**Exit gate:** All APIs pass real PostgreSQL/Redis/dependency integration tests and documented query plans.

### Stage 3: CMS Contract Completion

**Plan:** `2026-07-30-hhc-web-api-content-archive.md`

- [ ] Implement archive/restore, server content query, and published News detail.
- [ ] Reconcile the plan with revision pagination introduced by Stage 2.
- [ ] Publish the exact OpenAPI artifact only after full HHC Web API gate passes.

**Exit gate:** Generated client input is immutable and contract tests cover all Admin content workflows.

### Stage 4: Shared Frontend Platform

**Plan:** `2026-07-30-frontend-platform-ui-v0-2.md`

- [ ] Complete tokens, Card/Menu/Dialog/async-state contracts.
- [ ] Regenerate CMS client from the approved Stage 3 artifact.
- [ ] Pack and consumer-test all packages.
- [ ] Publish immutable `0.2.0`.

**Exit gate:** Vite and Next packed-consumer tests, Storybook accessibility, light/dark, and three-locale checks pass.

### Stage 5: Account And Admin Products

**Plans:**
- `2026-07-30-account-fe-ui-ux.md`
- `2026-07-30-admin-fe-ui-ux.md`

- [ ] Upgrade Account, including localized `HHC Account` document title, session bootstrap, Personal info, Security, and Devices.
- [ ] Upgrade Admin auth continuation, progressive shell, i18n, management tables, and CMS editors.
- [ ] Run a real Account-to-Admin OAuth smoke against hardened APIs and gateway.

**Exit gate:** Account/Admin repository, browser, accessibility, OAuth, and rollback checks pass.

### Stage 6: Deploy Account And Admin Service Group

**Files:**
- Service-owned pipeline and infrastructure files only

- [ ] Inventory Azure resources, image tags, secrets, migrations, DNS, certificates, ACA revisions, alerts, and rollback revisions.
- [ ] Preview exact Bicep/pipeline/runtime changes and obtain production approval.
- [ ] Deploy in dependency order: Notification, Asset, Account, HHC Web API, Gateway, Account FE, Admin FE.
- [ ] Run host-based health, auth, upload, notification, CMS read/write, global logout, and rollback smoke.

**Exit gate:** Live smoke evidence exists for every service and no migration or deployment is pending.

### Stage 7: Public Web Source Alignment

**Plan:** `2026-07-30-hhc-web-ui-alignment.md`

- [ ] Align source, metadata, News navigation, and homepage projections.
- [ ] Verify build and screenshots.
- [ ] Do not deploy until separately approved.

### Final Evidence Record

- [ ] Record per-repository commit, image digest, migration version, pipeline run, ACA revision, smoke result, query-plan artifact, and rollback target.
- [ ] Update the platform roadmap only from this evidence; do not infer completion from plan checkboxes.
