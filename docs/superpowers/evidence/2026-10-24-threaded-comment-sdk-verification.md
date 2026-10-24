# Threaded recording comment SDK

Tracking: #157. Base: `2e58d00122a753492481a0898b8bd8d769aafdb8`.

The Website client can explicitly request `view: 'threaded'`. Its existing optional query/options object gains no default behavior. Generated comment types add optional structural parent, direct-child/descendant counts and one preview profile. The API producer is tracked in hhc-web-api#336; other OpenAPI differences already present in the client were preserved.

Prepared synchronized workspace version: 1.1.4. All seven manifests follow the repository's existing synchronized-version check; this is not evidence of package publication.

Local macOS validation passed: workspace build, tests, lint, package contracts, pack and packed Vite/Next consumer builds. The Website-client suite includes 122 tests plus eight generator checks. Request serialization checks cover both opt-in branch pagination and unchanged no-view calls. The Web task separately uses the built candidate through a worktree-local symlink; its registry manifest/lock remain unchanged until an actual approved publication can produce the real lock entry.

Required renderer/image/security CI remains independent of these local package checks. No package tag, publication, merge or deployment was performed. API release and approved SDK publication precede pinning/enabling the Web consumer; normal Web CI cannot use the local symlink.
