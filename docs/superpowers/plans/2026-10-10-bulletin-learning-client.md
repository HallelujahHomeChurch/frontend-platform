# Private bulletin learning client

Use the canonical Website API contract and existing authenticated SDK transport.
Expose list/detail/versioned enable-disable only; no public rule projection,
automatic CAS retry or new transport abstraction.

1. RED request/auth/no-store/abort/path/CAS tests; copy canonical OpenAPI and
   mechanically regenerate types, then add three typed methods and exports.
2. Reserve the next shared package version; build/test/lint/package contracts,
   generated/domain checks and packed real consumers.
3. One independent whole-branch review, PR/green CI and normal version-tag release.
   API learning routes must release before Admin enables this capability.
