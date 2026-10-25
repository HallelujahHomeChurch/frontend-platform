import assert from 'node:assert/strict';
import {mkdir, readFile, readdir, writeFile} from 'node:fs/promises';
import {digest, loadPlan, universe} from './renderer-selection.mjs';
import {verifyResults} from './ci-bulletin-renderer.mjs';

const directory = 'artifacts/renderer-selection';
const head = process.env.GITHUB_SHA;
const publishedImage = process.env.PUBLISHED_RENDERER_IMAGE;
assert.match(publishedImage ?? '', /^ghcr\.io\/hallelujahhomechurch\/hhc-bulletin-renderer@sha256:[a-f0-9]{64}$/);
const imagePublication = JSON.parse(await readFile('artifacts/release-evidence/image.json', 'utf8'));
assert.equal(imagePublication.schema, 1);
assert.equal(imagePublication.head, head);
assert.equal(imagePublication.image, publishedImage);
assert.match(imagePublication.config ?? '', /^sha256:[a-f0-9]{64}$/);
assert.match(imagePublication.tag ?? '', /^[a-f0-9]{64}-[a-f0-9]{40}$/);
assert.ok(imagePublication.tag.endsWith(`-${head}`));
const publishedPackages = {};
for (const name of await readdir('packages')) {
  const pkg = JSON.parse(await readFile(`packages/${name}/package.json`, 'utf8'));
  publishedPackages[pkg.name] = pkg.version;
}
const preparation = JSON.parse(await readFile('artifacts/release-evidence/prepared.json', 'utf8'));
assert.equal(preparation.head, head);
assert.equal(preparation.runId, process.env.GITHUB_RUN_ID);
assert.equal(preparation.publicationAttempt, process.env.GITHUB_RUN_ATTEMPT);
assert.equal(preparation.preparedAttempt, preparation.verifiedAttempt);
assert.ok(Number(preparation.verifiedAttempt) >= 1 && Number(preparation.verifiedAttempt) <= Number(preparation.publicationAttempt));
const identity = {sha: head, runId: process.env.GITHUB_RUN_ID, runAttempt: preparation.verifiedAttempt, mode: 'release'};
const plan = loadPlan(`${directory}/release.json`, 'release', head);
const manifest = JSON.parse(await readFile(`${directory}/manifest.json`, 'utf8'));
assert.equal(manifest.producerCommit, head);
assert.deepEqual(Object.keys(manifest.dependencyHashes).sort(), [...manifest.dependencyPaths].sort());
assert.equal(manifest.sourceFingerprint, digest(manifest.dependencyHashes));
assert.deepEqual(Object.keys(manifest.versions).sort(), Array.from({length: 11}, (_, i) => `v${i + 1}`).sort());
for (const version of Object.values(manifest.versions)) {
  assert.deepEqual(version.dependencyPaths, manifest.dependencyPaths);
  assert.equal(version.inputFingerprint, manifest.runtimeFingerprint);
}
manifest.publishedImage = publishedImage;
const files = await readdir('renderer-results', {recursive: true, withFileTypes: true});
const receipts = await Promise.all(files.filter(f => f.isFile()).map(async f => JSON.parse(await readFile(`${f.parentPath}/${f.name}`, 'utf8'))));
verifyResults({prepare: {result: 'success'}, renderer: {result: 'success'}}, receipts, identity, plan);
let baseline;
try { baseline = JSON.parse(await readFile(`${directory}/baseline.json`, 'utf8')); } catch { /* Full verification needs no previous evidence. */ }
const full = {};
for (const command of universe('release')) {
  const current = manifest.fingerprints[command.id];
  const tier = plan.entries.find(e => e.id === command.id).tier;
  if (tier === 'full') full[command.id] = {...current, head, runId: identity.runId, runAttempt: identity.runAttempt};
  else {
    const prior = baseline?.full[command.id];
    assert.ok(prior && prior.runtime === current.runtime && prior.verification === current.verification, 'invalid inherited full evidence');
    full[command.id] = prior;
  }
}
await mkdir('artifacts/release-evidence', {recursive: true});
await writeFile('artifacts/release-evidence/checkpoint.json', JSON.stringify({schema: 1, head,
  runId: identity.runId, runAttempt: process.env.GITHUB_RUN_ATTEMPT, preparation, publishedImage, imagePublication, publishedPackages, full, manifest, plan, receipts}));
