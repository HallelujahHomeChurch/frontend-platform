# Task 7a — static renderer capabilities (producer only)

Task 2/6 independently reviewed with no remaining Critical/Important, coordinator authorized continuation. No package release, dependency version change, consumer pin, merge or deployment.

The prior `frozen-closure.md` traces runtime imports and confirms `versions.tsx`, `BulletinEbook.tsx` and package index are outside frozen digest closure. Changed only those modules and their tests. Each static entry binds existing frozen Renderer + validator and four immutable metadata fields. Unknown names (including prototype property names) fail with existing `update_required`; frozen validator still owns exact template/digest rules. Public require/render signatures remain unchanged. New getter and interface are additive exports.

| Versions | Snapshot | Font | Fixed text | Composer cover spacing |
| --- | --- | --- | --- | --- |
| V1–V5 | no | legacy | legacy | no |
| V6 | no | legacy | historical | no |
| V7 | no | v7 | historical | no |
| V8 | no | v7 | historical | yes |
| V9–V10 | yes | v7 | snapshot | yes |

Ebook reads metadata for its prior version-list predicates and continues to call the same frozen helpers. It retains locale/snapshot validation, canonical text and sentence IDs, Unicode offsets, font-role policy, controlled selection markup, hidden production details and rendering tree.

Targeted candidate: versions + ebook suites **46 passed**, including V1–V10 table, valid Hant/Hans combinations, frozen direct-paper markup equality, invalid digest/template, unknown names, readonly metadata, ebook canonical anchors/snapshot/locale roles and existing ebook regressions. Initial new fixture wrongly expected body role from a scripture fixture and a Hant body font override; corrected test fixture to explicit body/emphasis and expectations to existing frozen font policy. No production change was needed for those test failures.

Remaining gates: independent Task 7a review, full final package/UI tests/lint/build, frozen verifier and byte closure check, packed Vite/Next consumer checks. Local packed artifacts are validation only; Task 7b formal consumer dependency pin waits for a separately authorized actual producer package release. No nonexistent version or local path enters production manifests/locks.

Independent review completed C0/I0/M0 (`task7a-independent-review.md`); final complete source/package gates and native measurement receipts are consolidated in `verification.md`. No package release gate was crossed.
