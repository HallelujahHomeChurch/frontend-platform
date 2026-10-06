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
node scripts/verify-bulletin-renderer.mjs
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
