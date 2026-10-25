import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {test} from 'node:test';
import {createPlan, digest} from './renderer-selection.mjs';
import {shards, rendererCommands} from './ci-bulletin-renderer.mjs';

test('published manifest binds all versions and dependency hashes to the actual image', () => {
  const dir = mkdtempSync(join(tmpdir(), 'renderer-seal-'));
  const head = 'a'.repeat(40), hash = 'b'.repeat(64);
  const image = `ghcr.io/hallelujahhomechurch/hhc-bulletin-renderer@sha256:${hash}`;
  const write = (path, value) => writeFileSync(join(dir, path), JSON.stringify(value));
  try {
    for (const path of ['artifacts/renderer-selection', 'renderer-results', 'packages/ui']) mkdirSync(join(dir, path), {recursive: true});
    write('packages/ui/package.json', {name: '@hallelujahhomechurch/ui', version: '1.1.6'});
    const plan = createPlan({mode: 'release', head});
    write('artifacts/renderer-selection/release.json', plan);
    const dependencies = {'scripts/runtime.mjs': hash};
    const source = digest(dependencies);
    const manifest = {producerCommit: head, dependencyPaths: Object.keys(dependencies), dependencyHashes: dependencies, sourceFingerprint: source,
      versions: Object.fromEntries(Array.from({length: 10}, (_, i) => [`v${i+1}`, {dependencyPaths: Object.keys(dependencies), inputFingerprint: source}])),
      fingerprints: Object.fromEntries(plan.entries.map(e => [e.id, {runtime: hash, verification: hash}]))};
    write('artifacts/renderer-selection/manifest.json', manifest);
    for (const [shard, value] of Object.entries(shards)) write(`renderer-results/${shard}.json`, {sha: head, runId: '123', runAttempt: '1', mode: 'release', shard,
      host: [], container: value.container, planDigest: plan.digest,
      entries: rendererCommands(shard, 'release', plan).map(c => plan.entries.find(e => e.id === `${c.runtime}/${c.version}`))});
    const run = () => execFileSync(process.execPath, [new URL('./seal-renderer-checkpoint.mjs', import.meta.url).pathname], {cwd: dir,
      env: {...process.env, GITHUB_SHA: head, GITHUB_RUN_ID: '123', GITHUB_RUN_ATTEMPT: '1', PUBLISHED_RENDERER_IMAGE: image}, stdio: 'pipe'});
    run();
    const sealed = JSON.parse(readFileSync(join(dir, 'artifacts/release-evidence/checkpoint.json')));
    assert.equal(sealed.manifest.publishedImage, image);
    manifest.dependencyHashes['scripts/runtime.mjs'] = 'c'.repeat(64);
    write('artifacts/renderer-selection/manifest.json', manifest);
    assert.throws(run, 'mismatched input hashes must prevent sealing');
  } finally {rmSync(dir, {recursive: true, force: true});}
});
