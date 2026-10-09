# HHC Frontend Platform

Shared, versioned frontend packages for HHC web applications:

- `@hallelujahhomechurch/ui`
- `@hallelujahhomechurch/preferences`
- `@hallelujahhomechurch/account-client`
- `@hallelujahhomechurch/hhc-web-client`
- `@hallelujahhomechurch/donation-client`
- `@hallelujahhomechurch/donation-ui`
- `@hallelujahhomechurch/operations-client`

Packages are published to GitHub Packages from version tags.

## Isolated bulletin renderer

The bulletin worker uses the same compiled renderer, CSS, fixed assets and legal
fonts as the UI. Build a new, checksum-verified bundle after `pnpm build`:

```sh
node scripts/verify-bulletin-renderer-v7.mjs
node scripts/package-bulletin-renderer.mjs artifacts/bulletin-renderer /path/to/verified/assets
docker build -f tools/bulletin-renderer/Dockerfile -t hhc-bulletin-renderer:verify artifacts/bulletin-renderer
```

The image runs as a non-root user. Its CLI accepts an input JSON file and the
bundled assets directory (`/opt/bulletin-renderer/assets`); `--compose` additionally
produces a saved layout. Input contains the exact `submissionJSON`, its SHA-256
`expectedContentHash`, and bounded `timeoutMs`. Output is JSON only; failures emit
one non-content-bearing error code. Run without network, with a read-only root,
bounded writable `/tmp`, memory/CPU limits and an external process deadline.

The release workflow verifies the tag belongs to `main`, tests/scans the image,
and publishes a tag containing both renderer hash and commit. Consumers must pin
the registry's immutable image digest, not a mutable tag. An artifact mismatch
must block use; an image build or local test does not freeze or publish V1.

V3 retains the immutable V1/V2 paper templates and fonts, and improves draft
composition and visible-glyph measurement. Previously published manifests retain
their original renderer. Re-extract an older failing draft to propose a V3
candidate through the existing comparison flow; do not rewrite published data.

V4 retains V3's measurement and the frozen paper templates. Dense body/lyrics
pages may use bottom whitespace down to a 24pt margin, without adding source
pages or reducing the 12pt composition floor. Line-by-line lyrics use a 1.2
minimum leading and cap source gaps at 6pt; prose retains 1.25 and 12pt gaps.
V1–V3 manifests remain supported.
Deploy V4-capable readers before producing V4 drafts.

## License

The source and published packages are publicly visible but remain all rights
reserved. See [LICENSE](LICENSE).

## Development

```sh
corepack pnpm install
corepack pnpm test
corepack pnpm lint
corepack pnpm build
corepack pnpm pack:packages
corepack pnpm test:consumers
```

Consumers install exact package versions from GitHub Packages. Local development
requires a GitHub token with `read:packages`; GitHub Actions uses its repository
`GITHUB_TOKEN`.

## Unified auth and Operations contract 1.0.10

Authenticated sessions carry top-level opaque `permissions: string[]`; an empty
list remains authenticated. Product-neutral AuthN exposes only exact-match plus
wildcard `hasPermission()`. Admin destinations and Operations scoped roles live
in AuthZ modules, with no broad CMS compatibility aliases.

The Operations contract uses stable Account-bound members, one active church,
multiple family/small-group/fellowship affiliations, scoped responsibilities,
and direct bulletin entitlements. Qualification and validity-window fields are
not part of the contract.
# Bulletin ebook presentation

V8 reuses the immutable V7 fonts and renderer with measured normal-tracking
canonical titles, single-line boxed headings/speakers and adjacent cover
date/issue fields. It never substitutes source text or adds source pages to fit.
Use the V7 assets and CSS with the V8 digest; deploy V8-capable consumers before
enabling the producer. Verify with `node scripts/verify-bulletin-renderer-v8.mjs`;
native acceptance uses `HHC_TEST_RENDERER_V8=1`. V1–V7 remain immutable.

Renderer V5 keeps V1–V4 immutable and uses a 24pt cover bottom margin so complete
weekly verses fit without truncation, smaller type, or an extra cover page.
Install 1.0.43 in both readers before enabling the V5 extractor producer.
Verify with `node scripts/verify-bulletin-renderer-v5.mjs`; the native regression
suite uses `HHC_TEST_RENDERER_V5=1`.

V6 adds the verified historical four-row cover header in Traditional and
Simplified Chinese, including the distinct Gospel-goals wording. Native and
outlined historical covers retain their source staircase and page dimensions;
substitute fonts receive a full line allocation. V1–V5 source and artifacts
remain immutable. Deploy the coordinated 1.0.48 Admin and Website packages
before enabling the V6 producer. Verify with
`node scripts/verify-bulletin-renderer-v6.mjs --base-ref origin/main`; native
acceptance uses real verified assets and `HHC_TEST_RENDERER_V6=1`.

V7 preserves explicit inline-size proportions when composing Word questions.
Simplified body text may use the existing pinned Traditional serif faces for
rare glyphs absent from the Simplified faces, without substituting characters.
Paper and ebook use the same fallback; unknown glyphs still block conversion.
The V7 Traditional emphasis face is the reader's already-published true-bold
Noto Serif TC, not the legacy WenKai face. Import `bulletin-paper-v7.css` after
the existing paper styles and use `BULLETIN_RENDERER_V7_ASSETS` for this profile.
V1–V6 remain immutable. Deploy V7-capable consumers, including their exact
asset allowlists, before enabling the V7 producer.

`BulletinEbook` renders a single semantic chapter (`cover`, `body`, `worship`,
`back`) from the same canonical document as the paper reader. Import
`@hallelujahhomechurch/ui/bulletin-paper.css` for the existing licensed fonts
and `@hallelujahhomechurch/ui/bulletin-ebook.css` for reflow-only styling.
It does not alter the digest-pinned paper renderer or stored source geometry.

Hosts own navigation, authorization, watermarking, and progress. Use
`bulletinChapters` / `bulletinChapterForAnchor` for chapter membership and
`bulletinMobileDetails` for the shared default-hidden production metadata policy.
Search and annotation indexes must use the full canonical document, not visible
chapters. Reveal details when targeting a hidden sentence; original sentence IDs
and Unicode-scalar offsets remain unchanged.

## Donation Sandbox source gate

The Donation packages use the local delivery 1A Donation API contract, not an
accepted or deployed bank integration. They retain the workspace version for
local packing only; neither Donation package has been published. Before consumer
release, release the canonical API contract and bump the coordinated workspace
version through the existing tag/publish workflow. Consumers must use an actually
published exact version; local tarball overrides are development evidence only.

`createSandboxDonationClient` fixes routes to Admin Sandbox and receives existing
Account runtime token/401-refresh functions. `DonationForm` accepts a typed
transport and optional actor-keyed session-storage key, allowing later Website
reuse without adding donation logic to generic UI. No recurring choices or
card-entry fields are exposed. Minor units are validated as integers; one stable
intent is locked and retried. Pending metadata contains only a key, amount and
creation time. Expiry/corruption replaces these fields with only `{blocked:true}`
and fails closed rather than creating another payment. A bounded mounted timer
also expires the metadata; startup/submit checks handle suspended browser timers.
A correlated create/retry order response clears it. The Admin
permission catalog includes the explicit `donations:sandbox:test` destination;
other staff grants do not imply this capability.

## Returning-visitor navigation

`createNavigationPresentation` stores allowlisted navigation IDs separately from
verified auth and access. Pass the store to `createBrowserAccountAuthRuntime`,
subscribe to its display snapshot, and capture each authorization source's writer
before starting its request. Only successful verification renews that source's
seven-day TTL; unavailable responses must not call the writer. Never use the
presentation snapshot for route guards, data requests, or mutations.

Snapshots contain a subject ID for comparison, source timestamps, and navigation
IDs only. Names, avatars, credentials, and private content remain live-only.
Storage invalidation fences late writes across same-origin tabs. Cross-origin
account changes still require background verification; the shared SSO hint is
not identity proof. `runtime.signOut()` pauses auth work while global logout is
pending and invalidates stale session and callback completions.

## Church statement dismissal

Release v1.0.47 adds Website client `getStatementDismissal`/`dismissStatement`
and optional async token refresh for these idempotent requests. The preferences
package exports `statementRefKey`, `readAnonymousStatementDismissal` and
`writeAnonymousStatementDismissal`. Anonymous storage matches statement ID and
published version; the shared cookie only bridges WWW/Account in one browser.
No day or expiration timestamp participates in the display decision. Publish the
reviewed version before updating consumer registry lockfiles.

## Expandable header search

`ExpandableSearchField` keeps its existing inline and header-overlay behavior.
Optional `closeLabel` adds a back button that closes without submitting or
clearing the draft and returns focus to the search trigger. `onExpandedChange`
reports open/close transitions so a consumer can reserve navigation space or
pause scroll-driven header hiding. Header height, opaque background, breakpoints,
and search routing belong to the consuming application. IME confirmation does
not submit a query. `allowEmptySubmit` optionally forwards an empty submission so
a consumer can clear an active URL query; its default preserves existing consumers.
No query provider or results UI is included.

The Website client accepts optional `q` in `listMemberRecordingsPage` and
`listMemberLivestreams({q, signal})`. The existing live-list AbortSignal call remains
compatible. Only the two member search GET paths are synchronized with the canonical
CMS search contract; unrelated domains retain their existing package contract.
Release CMS and Gateway producers before enabling consumer search.
