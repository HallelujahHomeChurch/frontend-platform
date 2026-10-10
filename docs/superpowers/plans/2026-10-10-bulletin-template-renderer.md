# V9 immutable church-value rendering

Approved adaptive weekly-reader decisions govern. Execute inline; preserve every
frozen V1–V8 executable, digest, font and source-page boundary.

## Scope and release order

- API owns versioned three-field settings and freezes them in extraction jobs.
  V9 requires the immutable `templateSnapshot` on the document; it never fetches
  current settings or converts language in a browser. Hans snapshots arrive already
  converted by the existing server OpenCC pipeline.
- This branch provides the new renderer, snapshot-aware ebook header, exact native
  font measurement/composition and immutable bundle/CLI support. Existing layout,
  annotations, body fonts, publication and authorization remain unchanged.
- The optional document field and producer validation/hash/merge/worker propagation
  belong to the matching API follow-up. Generated contracts must match that canonical
  producer before this branch is released. Deploy V9-capable reader consumers before
  enabling V9 extraction; keep V1–V8 historical support and old-job null behavior.

## Task 1 — snapshot resolver and renderer

1. Tests first: distinct immutable snapshots render their own three values in both
   paper and ebook; Hant/Hans fixed labels match content locale, not website locale.
   Missing, unknown-key, unsafe/multiline/unbounded snapshots fail closed for V9.
2. Add only a V9 fixed-text resolver. Values come from the snapshot; labels remain
   code-owned. Reuse pinned V7 body/kai font families, CSS and graphics.
3. Preserve frozen renderers. A separate V9 paper renderer is necessary because V7's
   closed fixed-text resolution cannot be altered without changing old manifests.
   Do not introduce a generic plugin or mutable global resolver to bypass this.
4. Register V9 version dispatch and ebook resolver; optional old documents retain
   their old fixed values. No body/header UI redesign in this slice.

## Task 2 — actual measurement and composition

1. Retain the frozen V7/V8 sources. V9 measurement uses the same bounded pinned
   Chromium/fonts with the snapshot-aware resolver, not a later DOM/CSS overlay.
2. Preserve V8 single-line titles/headings, adjacent date/issue, 12pt floor and
   exact source-page membership. Measure changed values before fitting; an unsafe
   overlong value produces a located review problem, never silent content loss.
3. Bind every new compiled source/resolver/measurement/composition to a V9 digest,
   alongside the verified V8 artifact for reused code/assets/dependencies.
4. Package new scripts and CLI dispatch without removing earlier versions. Test
   immutable old digests, real measured snapshot changes and malformed input.

## Task 3 — integration and delivery

- Update generated canonical types only from the API producer, not hand edits.
- Full tests/lint/build/package-contract/packed-consumer tests; immutable old-version
  verification and actual renderer package/image/measurement checks.
- One independent whole-branch review; focused fixes with RED/GREEN, no repeated review.
- PR with required green CI, approved normal merge/version-tag package/image release;
  exact reader consumer pins/CI/releases before the API's V9 producer activation.
- This slice does not claim administrator form, correction learning, pre1739 retirement
  or formal1739–1741 conversion/member/device acceptance complete.
