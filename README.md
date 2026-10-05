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
