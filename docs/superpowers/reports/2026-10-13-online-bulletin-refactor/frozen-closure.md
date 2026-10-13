# Frozen closure inventory (before edits)

Baseline: `3f8dd7576f3f705e6f1ebcaddd8bf17b0af73109`. Inspected verifier file arrays, source checks, renderer imports and measurement imports before edits. No frozen verifier, measurement, source, stylesheet, asset, font, or historical artifact may change.

Paths below are relative to `packages/ui/{src,dist}/bulletin-reader`; source `.tsx/.ts` correspond to compiled `.js`.

| Version | Direct hash inputs beyond predecessor closures | Base-ref source protection |
| --- | --- | --- |
| V1 | root renderer, measure, fixed, paper CSS; source template-assets/font-coverage JSON; measure-bulletin-layout.mjs | matching renderer/measure/fixed/CSS/JSON/script and artifact.ts |
| V2 | v2 renderer/fixed/CSS/JSON; shared root measure; measure-bulletin-layout-v2.mjs | matching files and v2/artifact.ts |
| V3 | V1/V2 renderer/fixed/CSS/JSON/artifact.ts; v3 renderer/measure; v3 measurement script | v3 renderer/measure/script/artifact.ts |
| V4 | V1/V2 files above; v4 renderer/measure; v3 measure; v4 measurement script | v4 renderer/measure/script/artifact.ts |
| V5 | V1/V2 files above; v5 renderer/measure; v3 measure; v5 measurement script | v5 renderer/measure/script/artifact.ts |
| V6 | V1/V2 files above; v6 renderer/measure/fixed; v3 measure; v6 measurement script | v6 renderer/measure/fixed/script/artifact.ts |
| V7 | V1/V2 files above; v7 renderer/fonts/CSS/JSON; v6 fixed; v3 measure; v7 measurement script | v7 renderer/fonts/CSS/JSON/script/artifact.ts |
| V8 | v7 artifact.ts; v8 renderer; v8 measurement script | v8 renderer/script/artifact.ts |
| V9 | v8 artifact.ts; v9 renderer/fixed; v9 base and wrapper measurement scripts | v9 renderer/fixed/both scripts/artifact.ts |
| V10 | v9 artifact.ts; v10 renderer; compose-dense-cover-v10.mjs and v10 measurement script | v10 renderer/both scripts/artifact.ts |

V1–V7 also hash pinned Playwright and resolved React/ReactDOM runtime versions. Template manifests bind actual fonts, art and license bytes by SHA-256; packaging independently verifies these bytes. V7 fonts include the emphasis face. No dependency versions will change.

Verification graph: V10 → V9 → V8 → V7, forwarding `--base-ref`; V7 directly calls V1, V2, V3, V4, V5, V6 with the base ref; V6 similarly calls its predecessors. V3–V5 also recurse without forwarding, but V7's direct calls preserve every source check. Only duplicate **top-level** calls in CI/release/packaging are removal candidates; the graph itself stays frozen.

Runtime imports: V3–V5 adapt V1/V2; V6 uses root blocks and legacy fixed families; V7 uses v6 fixed and its fonts; V8 adapts V7; V9 uses root blocks, v6 fixed, v7 fonts; V10 adapts V9. Measurement wrappers reuse predecessor scripts; v9-base reuses v3 measure. Runtime additionally consumes the generated `artifact.js` counterparts for V1–V10, copied dist template-assets JSON for legacy fixed helpers, `react/jsx-runtime` and `react-dom/server`. These build outputs/runtime modules belong to the unchanged dependency closure, but are not each independent entries in the historical verifier hash arrays: the existing build from checked source/pinned runtimes and complete package-byte comparison provide their provenance. Do not overstate the verifier as a post-build signature of every copied file. No existing gate is weakened or historical digest rewritten. `generated.ts` is type-only in renderer imports (compiled empty module), while `versions.tsx`, `BulletinEbook.tsx` and package index are not imported by frozen rendering/measurement. Thus later registry changes can be reviewed without rewriting frozen bytes.

Packaging copies the entire reader source/dist trees, all measurement/verifier files and runtime package manifests, plus verified assets/licenses. Task 2 byte comparison must compare the complete original/candidate package manifest, not only V10's digest. Task 6 may synchronize description-only generated source separately; it must not be conflated with Task 2 parity.
