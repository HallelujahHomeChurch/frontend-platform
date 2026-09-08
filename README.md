# HHC Frontend Platform

Shared, versioned frontend packages for HHC web applications:

- `@hallelujahhomechurch/ui`
- `@hallelujahhomechurch/preferences`
- `@hallelujahhomechurch/account-client`
- `@hallelujahhomechurch/hhc-web-client`

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

## Account contract 0.7.0

Authenticated sessions require `user.permissions: string[]`. `admin_access` is
removed from the SDK type and Boolean-only payloads are rejected. Use
`canAccessAdmin` for console entry and `hasPermission` for exact permission checks.
Upgrade all session consumers before removing legacy fields from Account API.
