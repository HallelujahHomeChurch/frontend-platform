# HHC Frontend Platform

Shared, versioned frontend packages for HHC web applications:

- `@hallelujahhomechurch/ui`
- `@hallelujahhomechurch/preferences`
- `@hallelujahhomechurch/account-client`
- `@hallelujahhomechurch/hhc-web-client`
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

## Unified auth contract 1.0.9

Authenticated sessions carry top-level opaque `permissions: string[]`; an empty
list remains authenticated. Product-neutral AuthN exposes only exact-match plus
wildcard `hasPermission()`. Admin destinations and Operations scoped roles live
in AuthZ modules, with no broad CMS compatibility aliases.
