# Independent Task 7a review

Date: 2026-10-13. Reviewed current uncommitted Task 7a diff in isolated frontend-platform worktree, including versions.test.tsx, actual connected renderer validators and dispatch, complete Ebook implementation, exports and packed consumer caller. Read local AGENTS/README and frozen-closure inventory plus verifier inputs/imports. No product edits.

What this change does: A static V1–V10 registry owns existing capability predicates and selects the existing immutable renderer/validator. Ebook reads that metadata while retaining its content, snapshot, font and markup implementations.

Critical: 0. Important: 0. Minor: 0. Source review passes.

Evidence:
- The table preserves snapshot V9/V10, fonts V7–V10, historical text V6–V8, snapshot text V9/V10, and composer-owned cover spacing V8–V10. Frozen capability objects prevent caller mutation.
- Object.hasOwn rejects unknown and inherited property names. Existing V1 fallback rejected unknown manifests through its validator; the new entry lookup preserves update_required rejection rather than granting an unknown version.
- requireBulletinRenderer delegates to the same version-specific functions; paper dispatch preserves props and manifest override. Tests compare paper markup against direct immutable renderers and verify template/digest rejection across versions.
- Ebook still validates first, parses the same immutable snapshot, uses the same historical/snapshot/legacy text functions and v7 font resolver. Canonical anchors, scalar fragment ends, hidden-details logic and inline font normalization are unchanged. Added supported-version/locale tests cover anchors, canonical text, source nonmutation and font families; existing tests remain.
- New getter and type are exported through the actual package entry. Packed consumer smoke imports both without changing formal consumer dependencies.
- versions.tsx, BulletinEbook.tsx and index.ts are not imported by frozen renderer/measurement modules and are absent from frozen verifier source/hash input lists. No frozen source, CSS, asset, font, digest or measurement script was modified by Task 7a.

Disposition: no source fixes required. This independent review does not mark pending whole-package build/test, final packed consumers, container/native gates or required PR CI as passed. Task 7b formal dependency pin remains blocked on an authorized producer package release; this review authorizes no publication.

Not checked: no heavy test rerun, final CI, registry release, real consumer browser or device acceptance in this review.
Risk: local source review is narrower than full candidate validation; retain the release dependency gate.
