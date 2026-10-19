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
node scripts/verify-bulletin-renderer-v9.mjs
node scripts/verify-bulletin-renderer-v10.mjs
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

V10 keeps V1–V9 rendering immutable and adds a dense-cover fallback only when the
V9 composition cannot fit. Long canonical title/subtitle use separate rows;
Word questions and the weekly verse use measured sizing down to 9pt, while
source text, anchors and PDF page correspondence remain intact. Missing glyphs,
untrusted assets and content that cannot fit at that floor still fail closed.
Deploy V10-capable web/admin consumers before enabling the producer. Native
verification uses `HHC_TEST_RENDERER_V10=1` and the V10 measurement suite.

CI builds the packages and isolated renderer image once, then verifies three
renderer shards with at most three concurrent runners. The host commands retain
default/V6–V10 coverage; the container commands retain default/V3–V10 coverage.
The same-run workspace/image artifacts expire after one day and must pass SHA-256
verification before use. The required `verify` check accepts only successful jobs
and complete, same-commit, same-run and same-attempt shard receipts. Package release uses the
same shard runner for its nine container validations, then publishes only after
its independent dependency/image scans, tag checks and aggregate gate succeed.
Only the publisher can write packages, and it restores the checksum-verified
packages and image built by preparation. Rerun all jobs after a failure: artifacts
are scoped to the run attempt, so rerunning only failed jobs fails closed.

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

`bulletinPaperPresentation(document)` applies back-panel spacing and centers the
retained content on every paper page, without a binding margin. It translates
text, headings and frames together; widths, vertical coordinates, fragments,
source pages, page numbers and background art remain unchanged. Website paper,
thumbnails and Admin desktop/iPad previews use this same presentation. Original
PDF comparison and mobile reflow retain their existing behavior.

`bulletinBackPanelPresentation(document)` returns paper-only frame geometry for
Website and Admin previews. It spaces announcement/prayer panels after either a
framed or unframed summary without changing text widths, anchors, or source pages.
An unframed summary receives its own solid border around that page's text and
label, excluding the vertical sidebar tagline. Repeated presentation is stable.
When vertical spacing cannot fit, it retains original vertical geometry while
still aligning horizontal frame padding. Stored manifests and frozen V1–V8
renderers remain unchanged; mobile reflow does not use this helper.

V8 reuses the immutable V7 fonts and renderer with measured normal-tracking
canonical titles, single-line boxed headings/speakers and adjacent cover
date/issue fields. It never substitutes source text or adds source pages to fit.
Use the V7 assets and CSS with the V8 digest; deploy V8-capable consumers before
enabling the producer. Verify with `node scripts/verify-bulletin-renderer-v8.mjs`;
native acceptance uses `HHC_TEST_RENDERER_V8=1`. V1–V7 remain immutable.

V9 resolves the three church values from the immutable `templateSnapshot` in
each document, not from current website settings. Traditional and Simplified
documents carry their own server-converted values; the browser does not convert
them. V9 reuses verified V7 fonts/assets/CSS and V8 page composition, while measuring
the snapshot text itself. Invalid snapshots fail closed; text that cannot fit
within the bounded single-line church-value slots reports the affected page and
slot instead of clipping or adding pages. Body text retains its 12pt floor.
Deploy V9-capable readers before enabling V9 extraction. Verify with
`node scripts/verify-bulletin-renderer-v9.mjs --base-ref origin/main`; native
regression uses `HHC_TEST_RENDERER_V9=1`. V1–V8 remain immutable.

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

## Live thumbnail client

`LiveCoverScope` separates persistent defaults from a `{recordingId, captureId}`
event. Use `get/setLiveCoverSettings` for revision-fenced explicit saves;
`uploadLiveCover` and `getLiveCoverUpload` prepare a fixed image before selecting
it. `getLiveCoverContent` and `getMemberLiveCover` return authenticated private
Blobs with cancellation and no redirects. Consumers must validate image type/size,
revoke object URLs and discard them on account/scope/authorization changes.
No private image URL belongs in persistent storage or an image optimizer.

Publish the reviewed shared client through the existing version/tag workflow
before pinning Admin and Website registry lockfiles. Local packed builds do not
prove a package release or production acceptance. C1 and OBS wire contracts remain
unchanged.

## Broadcast event stream keys

The K1 client adds `getBroadcastStreamKey`, `setBroadcastStreamKey`, and
`bindBroadcastStreamKey` independently of B1 views and capabilities. Reads return
configuration metadata only. Management and binding send the secret in the JSON
body with OAuth authorization, disable caching, and reject redirects. Keep the
same secret, operation key, and expected revision when retrying an uncertain save;
these methods never retry a mutation or fall back to unkeyed binding themselves.
Publish the coordinated 1.0.64 package before consumers pin that registry version.

## Reusable broadcast source

K2 adds `getBroadcastSource`, `setBroadcastSourceStreamKey`,
`setBroadcastSourceTarget`, `resolveBroadcastSource`, and `bindBroadcastSource`.
The singleton source keeps one credential across explicitly prepared events.
Source and event revisions remain separate; preparing an event may require
refreshing its revision. `inputBusy` describes input occupancy; `canRotate`
controls credential reset. No method guesses a target, retries a mutation, or
falls back to K1/B1. Retry an uncertain bind with the exact original input and
operation key, without resolving a newer target. Secrets use JSON bodies only;
transport disables caching and redirects. Existing K1 and B1 types stay unchanged.
Publish coordinated 1.0.65 before consumers pin its registry version.

## Email correction client

The Account client exports `createAccountDataRequestsClient` and the typed flat
Email correction catalog, reauthentication, application and Admin contracts.
Use an existing application request adapter, honoring its `auth: false`,
`csrf: false`, `retry: false` and `credentials: 'omit'` options for the public
body-only verification POST. `createAccountSessionClient().dataRequests` reuses
its existing request/CSRF transport and configured fetcher. Protected Gateway
routes still require the application's current bearer-token adapter.

Keep proof, target and nonce in memory. After an uncertain submission, query
`submission` with the original nonce; never create a replacement intent or
silently retry with new input. Only true 401 uses the host's existing auth
recovery; factor rejection and temporary unavailability preserve the draft.
Responses retain server version, time and allowed actions. Errors normalize
feature `errorCode` and middleware `error_code`, retaining status, request ID,
server time and original `Retry-After`. Public verification needs no login or
CSRF bootstrap. Successful submission schedules durable notification effects;
it does not establish mailbox delivery.

The `data-requests` Admin destination (`/data-requests`) requires existing `*`
and follows all existing destinations. Navigation presentation remains separate
from live authorization. Publish coordinated 1.0.70 after the Account contract
and Gateway route releases are accepted, before consumers pin that version.

## Completed live recording metadata

Version 1.0.71 adds optional `isBroadcast` and `broadcastStartedAt` to recording
metadata. Broadcast origin persists after publication. Start time describes the
platform's verified public-live transition, not encoder start or scheduled time;
missing historical evidence remains absent. K4/B1/C1 ingest contracts are unchanged.

## Bulletin review and navigation 1.0.72

Adds optional job `resultRevision` (omitted means old producer; null means no
result), fixed-area review locations, source-verified header speaker start IDs
in the redacted member projection, and superseded learning evidence revisions.
The cover settings write method remains for source compatibility but is
deprecated: new producers return 410. Remove the Admin settings editor before
releasing that producer. Consumers continue to tolerate older optional fields.
Frozen renderer versions, assets and hashes are unchanged.

## Shared media player

Import `HlsPlayer` and player types from `@hallelujahhomechurch/ui/player`, and
load `@hallelujahhomechurch/ui/player.css` once in the host. The isolated entry
works in React/Vite and Next.js without routing or utility-CSS dependencies.
The host supplies an already-authorized playback URL, translated labels and
video ref; it owns session refresh and access failures. `onNavigate` optionally
integrates client routing, while ordinary links preserve native navigation.
Member hosts must continue supplying their session watermark. Staff previews
may omit it and set `muted` for autoplay. Use `controls={false}` and
`initialQuality="480p"` for passive list previews: these retain the same live
reserve, authenticated engine and watermark without controls or automatic focus.
The host owns hover activation, single-preview ownership and disposal.

Live timelines reuse the VOD sprite appearance and authenticated relative
`previews/index.vtt` route. Index refreshes occur at most once per five seconds
while hovering or scrubbing; only cues inside the current playable window are
shown. Index parsing is bounded to twelve hours, 25,920 cues and 2 MiB;
individual sprites retain the 1 MiB limit. Missing or denied previews fall back
to time only. Session/capture and
live-to-VOD changes discard the old index and private in-memory images.

Live playback targets 90 seconds behind the lesser of native seekable and the
backend verified end. The timeline ends at that target; its right endpoint and
the Live button both resume normal-speed following while playing; a paused
right-end seek preserves pause and speed. The Live button explicitly resumes.
Fresh automatic entry waits for 90 verified, seekable seconds before positioning
and playing once. Restored bookmarks and ended recordings bypass this wait;
explicit Play or a DVR seek preserves the viewer's choice when more media arrives.
The live indicator tolerates
20 seconds of segment-update jitter, but excludes DVR, pause, non-1x playback and
loading. Automatic recovery uses that same tolerance and moves forward only. `live.ended` exposes the complete
verified tail after ending; an interrupted stream must leave it false. The
90-second holdback adds client buffering; end-to-end delay still depends on
ingest and publication latency. Media validation, credentialed requests, private
preview caching, native HLS and quality-switch bookmark/frame protection remain
in the shared player.

Publish the coordinated package version through the existing tag workflow
before consumers pin its registry version; packed candidates are local evidence.

## Reader bookmark contract candidate

The Website client exports `BulletinReaderBookmark` and four typed bookmark
mutations through the existing private state/mutation methods. Bookmark CAS is
required for rename/delete/reanchor and forbidden on create. `state.bookmarks`
remains optional for older producers and offline snapshots; absence means the
capability is unavailable. Deploy the compatible Website API producer first,
then merge/publish this SDK and pin the actual published version in consumers.
Local packed consumer builds do not establish registry publication or real-device
cross-account/cross-device acceptance. This change does not publish a package.
