# Package publication recovery

The release publisher uses the exact tarballs packed from the verified build and
restored through the same-run SHA-256 artifact gate. It does not repack directories.
Before any writes it checks all seven package versions against GitHub Packages:

- Missing version (`npm view` returns explicit E404): eligible for publication.
- Existing matching SHA-512 tarball integrity: retain it without republishing.
- Existing different/missing/unsupported integrity, auth failure, malformed response
  or interrupted lookup: stop; do not overwrite or infer that the version is absent.

After each publication, read the registry integrity again. A lost acknowledgement
is accepted only if the exact candidate is now present. Otherwise stop without an
automatic second publish. Retry through the normal complete release workflow after
resolving the cause; all verification, tag/main and stale-release gates still apply.
An eventual-consistency delay may fail closed and require that normal retry.

A mismatch requires investigation and a new reviewed version when necessary, never
deleting/replacing an immutable version. No special permission or ad hoc publish
command is introduced. Package versions remain coordinated with the workspace.

This reconciles partial **package** publication, including a later renderer-image or
checkpoint failure leaving matching packages behind. It does not add image-tag
integrity reconciliation or guarantee checkpoint upload recovery; those remain
separate release-boundary work. Tests use an injected registry adapter and local
fixture tarballs; successful tests do not prove live registry publication.

Protocol: [npm view](https://docs.npmjs.com/cli/v11/commands/npm-view/) supports exact
version JSON field reads; [npm publish](https://docs.npmjs.com/cli/v11/commands/npm-publish/)
accepts tarballs, refuses an existing name/version, and records SHA-512 integrity.

Packing retains pnpm file selection and workspace/catalog resolution, canonicalizes dependency-map key order only (preserving conditional export order), then verifies the repacked file inventory, executable modes and every file digest (manifest compared semantically). All seven tarballs must reproduce identical SHA512 on a second pack. Previously published versions made with nondeterministic manifest ordering may correctly fail this exact integrity check; issue a new version through the normal release path rather than replacing an immutable version.
