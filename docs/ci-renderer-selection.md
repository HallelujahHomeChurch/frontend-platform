# Renderer verification selection

CI retains six host and nine container commands. Release retains nine container
commands. Every command runs either its original full suite or three named smoke
cases: real CLI composition, stale-content rejection, and missing-asset rejection.
The final `verify` check requires the same-run plan and exact tier receipts.

The first selector deliberately narrows only known independent package changes
and version-specific test changes. Root/UI package release-version-only edits
are compared as JSON; every other metadata change remains a full trigger. V6 tests select V6 and V7. Runtime source,
shared tests, lockfiles, workflows, selector changes, deleted/renamed/symlink
files, unknown paths and unavailable diffs require full verification. Frozen
renderer verification is unchanged. Narrower runtime source mappings need
separate dependency evidence before addition.

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
with a synthetic narrowed plan, after normal CI shards finish. This exercises
real V10 acceptance and all other release smoke commands without calling the
publication workflow. Its receipts have a separate artifact namespace.

Set the `RENDERER_FORCE_FULL` repository variable to `true` to disable narrowing;
reverting the selection change restores the previous full matrix. Changing that
variable or publishing a release requires the normal repository authorization.
The selection plan and manifest are included in same-run artifacts for inspection.

Tests: `node --test scripts/renderer-selection.test.mjs scripts/ci-bulletin-renderer.test.mjs`
and `python3 -m unittest discover -s scripts -p test_renderer_checkpoint.py`.
Native full/smoke acceptance still requires the verified template assets and
Chromium/container environment; unit tests do not replace that CI gate.
