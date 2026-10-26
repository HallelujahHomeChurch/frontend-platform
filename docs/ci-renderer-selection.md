# Renderer verification selection

CI retains seven host and ten container commands. Release retains ten container
commands. Every command runs either its original full suite or three named smoke
cases: real CLI composition, stale-content rejection, and missing-asset rejection.
Ten serial shards share the prepared image and workspace, with one container
version per shard and at most one host suite. Container verification uses two
CPUs and the existing 2 GiB memory cap; deployment resource settings are unchanged.
The immutable mutation tests run in a separate required job, while prepare still
checks the actual built renderer against main before packaging. This overlaps
independent validation without removing any test. The extra job and shard setup
costs are included in acceptance against total queue-inclusive time and summed
runner minutes; the first eight-shard V11 run took 16m55s / 71.75 runner-minutes
and did not meet the 15-minute ceiling.
The final `verify` check requires the same-run plan and exact tier receipts.

The first selector deliberately narrows only known independent package changes
and version-specific test changes. Root/UI package release-version-only edits
are compared as JSON; every other metadata change remains a full trigger. V6 tests select V6 and V7. Runtime source,
shared tests, lockfiles, workflows, selector changes, deleted/renamed/symlink
files, unknown paths and unavailable diffs require full verification. Frozen
renderer verification is unchanged. Narrower runtime source mappings need
separate dependency evidence before addition.

Player source edits under `packages/ui/src/player/` may narrow a container command
only when its exact command identity has trusted full evidence with matching
actual image and verification fingerprints. The renderer bundle copies only
`src/bulletin-reader` and `dist/bulletin-reader`, not player source or output;
actual image hashing still detects packaged dependencies, CSS, fonts and assets.
Host commands retain full coverage because release checkpoints contain no host
results. No container receipt is substituted for host evidence. Missing or
malformed evidence, changed runtime/verification inputs, and mixed shared changes
run full; metadata, root exports and unknown paths remain conservative triggers.
This optimization benefits player changes only and does not establish the total
10-minute target or 15-minute ceiling for full renderer changes.

Release additionally requires an unchanged actual read-only image fingerprint
and per-command verification fingerprint from a trusted successful release.
Checkpoint restoration checks workflow/repository/run/attempt identities, archive
digests, coverage and originating full evidence. Missing or expired evidence,
first releases and non-forward targets fall back to full. The publication guard
rejects stale targets; release concurrency serializes the entire channel.
Only successful publication uploads the 90-day evidence artifact. No PR run
can publish this checkpoint or acquire package-write permission.

The image fingerprint is intentionally conservative: all persistent image files,
symlinks and ownership/modes are included. Only the UI package release-version
field is normalized, matching the immutable verifier; dependencies, exports and
all other package metadata remain inputs. Docker-injected mounts and temporary
directories and installation logs are excluded. For Fontconfig v9 LE64 caches, only directory timestamp/checksum header bytes
48–63 are normalized; all remaining bytes stay fingerprinted. The layout follows
[Fontconfig 2.15 FcCache](https://github.com/fontconfig/fontconfig/blob/2.15.0/src/fcint.h).
Unsupported headers fail preparation. Only ldconfig's builder auxiliary
cache is excluded, while `/etc/ld.so.cache`, libraries, fonts and configuration
remain fingerprinted. A native regression rebuilds font caches, verifies stable
fingerprints, and rejects configuration changes and corrupt cache evidence.
This may select more full runs than per-version image
analysis, but does not mistake native-package drift for an unchanged renderer.

Changes to verification wiring also run the shared release-mode runner in PR CI
with a synthetic narrowed plan, on each already-prepared runner after its normal
CI commands finish. Separate plans, receipts and artifact namespaces remain
mandatory; a failed extra command fails its shard and the aggregate gate. This exercises
the default full suite and all other release smoke commands without calling the
publication workflow. Normal CI already runs V10 full for wiring changes; the
release-check lane no longer duplicates its dense-cover suite. Actual releases
retain version-specific full selection. This avoids a second checkout, image restore and runner allocation for the same
inputs. The four immutable-version mutation suites run at concurrency two in
prepare; each owns an independent temporary Git repository and cleanup, with
only shared read-only dependencies. All mutation/removal assertions remain.
The V10 fixture also checks V11 source, compiled renderer and composer mutations.
V11 full verification includes its existing pure body-composition tests in both
host and container modes, and their bytes enter the verification fingerprint.

Set the `RENDERER_FORCE_FULL` repository variable to `true` to disable narrowing;
reverting the selection change restores the previous full matrix. Changing that
variable or publishing a release requires the normal repository authorization.
The selection plan and manifest are included in same-run artifacts for inspection.

Tests: `node --test scripts/renderer-selection.test.mjs scripts/ci-bulletin-renderer.test.mjs`
and `python3 -m unittest discover -s scripts -p test_renderer_checkpoint.py`.
Native full/smoke acceptance still requires the verified template assets and
Chromium/container environment; unit tests do not replace that CI gate.

The published checkpoint carries the producer manifest, bound to the pushed image
digest. Each V1–V11 entry includes dependency paths and an input fingerprint; the
shared map contains content hashes for every source dependency. This first contract
uses a conservative whole-renderer closure for each version. Its version input
fingerprint is the actual runtime fingerprint, so release-version-only metadata
does not invalidate otherwise identical native inputs; raw source hashes remain
available independently for audit. CMS must require an
exact producer commit/image match and successful trusted publication; older or
incomplete manifests require full verification. It does not infer unchanged native
inputs from source hashes: the actual runtime fingerprint remains separate.

Scans use the upstream GHCR database and upstream ECR fallback, with one job-local
DB cache shared by dependency and image scans. The Google pull-through mirror
returned missing-layer HTTP 404 twice during release 40165816057; Trivy does not
fallback on that response. Scanner pin, VEX and High/Critical failure gates stay
unchanged. See [upstream configuration](https://github.com/aquasecurity/trivy/blob/main/docs/guide/configuration/db.md).


### Physical runner setup

Full or unresolved plans retain ten bounded runners. Container-only runners do
not install host Chromium; image-contained Chromium still executes every selected
container command. When a validated plan contains only smoke commands and no
additional PR release check, two runners each execute five original logical
shards serially. Every logical shard still emits its own same-head/attempt receipt;
the aggregate requires all ten exactly once. A failed member stops its group and
cannot supply complete receipts. PR wiring checks retain ten runners because the
release-check plan deliberately includes full verification. Tag releases may group
only a validated all-smoke release plan. No renderer bytes or selected assertions
change. Cold/full and trusted all-smoke timings must be reported separately.
