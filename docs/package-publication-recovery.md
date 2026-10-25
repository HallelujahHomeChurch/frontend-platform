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

Package reconciliation handles a later renderer-image or checkpoint failure leaving
matching packages behind. Image reconciliation and its limits are described below.
Tests use injected registry adapters and local fixture tarballs; successful tests
do not prove live registry publication.

Protocol: [npm view](https://docs.npmjs.com/cli/v11/commands/npm-view/) supports exact
version JSON field reads; [npm publish](https://docs.npmjs.com/cli/v11/commands/npm-publish/)
accepts tarballs, refuses an existing name/version, and records SHA-512 integrity.

Packing retains pnpm file selection and workspace/catalog resolution, canonicalizes dependency-map key order only (preserving conditional export order), then verifies the repacked file inventory, executable modes and every file digest (manifest compared semantically). All seven tarballs must reproduce identical SHA512 on a second pack. Previously published versions made with nondeterministic manifest ordering may correctly fail this exact integrity check; issue a new version through the normal release path rather than replacing an immutable version.

Renderer publication now uses the same fail-closed sequence. The fixed GHCR
repository/tag is looked up through its authenticated manifest endpoint; only a
404 with `MANIFEST_UNKNOWN` permits a push. A matching tag is retained only when
the response bytes match `Docker-Content-Digest` and its config digest equals the
loaded, same-run verified Linux/amd64 image ID. Indexes and other unsupported
formats stop the release. A push (including an ambiguous acknowledgement) is
followed by the same readback. The checkpoint records that explicit image proof,
not the first entry in the Docker daemon's repository-digest list.

The existing release concurrency group serializes authorized publishers. The
registry does not provide compare-and-swap for mutable tags; independent writers
must not publish to these release tags. A rebuilt image with a different config
cannot silently replace the prior image even when source SHA matches. Preserve
the failed release evidence and use a new reviewed version if reproducible inputs
cannot be recovered. This change does not authorize a registry write or prove a
live retry; local tests use injected responses only.

Registry contract: [OCI Distribution manifest retrieval](https://github.com/opencontainers/distribution-spec/blob/main/spec.md)
and [Distribution token authentication](https://distribution.github.io/distribution/spec/auth/token/).


For a publish/image/seal/checkpoint-upload failure, use GitHub's failed-job rerun
within the existing one-day input retention. The successful prepare and verify
jobs retain their exact artifact IDs, ZIP digests, content digests and original
attempt. The publisher validates the same repository, release workflow, run and
commit before restoring those artifacts; there is no search for another run's
inputs. One small receipt bundle preserves the original verification attempt.
Checkpoint publication records the current attempt separately, so old checks
are never presented as newly executed. Expired/missing artifacts or mixed
preparation/verification attempts stop before registry access. Full-workflow
reruns rebuild and may legitimately conflict with an existing immutable image.

Recovery requires `preparedAttempt == verifiedAttempt`. It covers a failed publication job after both input preparation and all renderer verification succeeded. Rerunning only failed verification shards with retained preparation is not this path; use a complete workflow rerun before publication when verification must run again. The seal still requires exact full command coverage for the original verified attempt.
