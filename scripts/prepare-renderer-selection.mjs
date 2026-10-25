import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {appendFile, mkdir, readFile, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {changedFiles, createPlan, digest, filesFor, universe} from './renderer-selection.mjs';

const git = args => execFileSync('git', args, {encoding: 'utf8', maxBuffer: 32 * 1024 * 1024}).trim();
const head = git(['rev-parse', 'HEAD']);
assert.equal(head, process.env.GITHUB_SHA, 'selection must use tested commit');
const directory = 'artifacts/renderer-selection';
await mkdir(directory, {recursive: true});
const tracked = git(['ls-files', '-z']).split('\0').filter(Boolean).sort();
// Conservative runtime closure: all packaged renderer code, assets and dependencies.
const runtimePaths = tracked.filter(path => path.startsWith('packages/ui/src/bulletin-reader/')
  || /^scripts\/(?:measure-bulletin-layout|compose-dense-cover|verify-bulletin-renderer)/.test(path) && !path.endsWith('.test.mjs')
  || path.startsWith('tools/bulletin-renderer/') || ['pnpm-lock.yaml', 'pnpm-workspace.yaml', 'package.json', 'packages/ui/package.json', 'packages/ui/tsconfig.json', 'scripts/package-bulletin-renderer.mjs'].includes(path));
const hashPaths = async paths => digest(await Promise.all(paths.sort().map(async path => [path, digest(await readFile(path))])));
const dependencyHashes = Object.fromEntries(await Promise.all(runtimePaths.map(async path => [path, digest(await readFile(path))])));
const sourceFingerprint = digest(dependencyHashes);
const runtime = execFileSync('docker', ['run', '--rm', '--network', 'none', '--read-only', '--user', '0',
  '--mount', `type=bind,src=${resolve('scripts/renderer-runtime-fingerprint.mjs')},dst=/tmp/fingerprint.mjs,readonly`,
  '--entrypoint', 'node', 'hhc-bulletin-renderer:verify', '/tmp/fingerprint.mjs'], {encoding: 'utf8', maxBuffer: 1024}).trim();
assert.match(runtime, /^[a-f0-9]{64}$/, 'invalid runtime fingerprint');
const commonVerification = tracked.filter(path => path.startsWith('scripts/testdata/') || /^scripts\/(?:renderer-selection|ci-bulletin-renderer|renderer-runtime-fingerprint|prepare-renderer-selection|renderer-checkpoint|seal-renderer-checkpoint)/.test(path) || path.startsWith('.github/workflows/'));
const fingerprints = {};
for (const command of universe('ci')) fingerprints[command.id] = {runtime,
  verification: await hashPaths([...new Set([...commonVerification, ...filesFor(command.version)])])};
let checkpoint;
try { checkpoint = JSON.parse(await readFile('artifacts/renderer-checkpoint/checkpoint.json', 'utf8')); } catch { /* No trusted baseline means full release verification. */ }
for (const mode of ['ci', 'release']) {
  const base = mode === 'release' ? checkpoint?.head : process.env.BASE_SHA;
  let changes;
  try { changes = changedFiles(base, head); } catch { /* An unavailable/unsupported diff selects full. */ }
  const plan = createPlan({mode, base, head, changes, checkpoint, fingerprints, forceFull: process.env.RENDERER_FORCE_FULL === 'true'});
  await writeFile(`${directory}/${mode}.json`, JSON.stringify(plan));
}
await writeFile(`${directory}/manifest.json`, JSON.stringify({schema: 1, producerCommit: head, sourceFingerprint, runtimeFingerprint: runtime,
  dependencyPaths: runtimePaths, dependencyHashes, versions: Object.fromEntries(Array.from({length: 10}, (_, i) => [`v${i + 1}`, {dependencyPaths: runtimePaths, inputFingerprint: sourceFingerprint}])), fingerprints}));
if (checkpoint) await writeFile(`${directory}/baseline.json`, JSON.stringify(checkpoint));

// Exercise real release-mode execution in PRs without publication or trusted checkpoint writes.
if (process.env.GITHUB_EVENT_NAME === 'pull_request') {
  const synthetic = {full: fingerprints};
  const check = createPlan({mode: 'release', base: head, head,
    changes: [{status: 'M', regular: true, path: 'scripts/measure-bulletin-layout-v10.test.mjs'}],
    checkpoint: synthetic, fingerprints});
  await writeFile(`${directory}/release-check.json`, JSON.stringify(check));
}

let checkRelease = true;
try {
  checkRelease = changedFiles(process.env.BASE_SHA, head).some(({path}) => path.startsWith('.github/') || /renderer-selection|renderer-checkpoint|ci-bulletin-renderer|renderer-runtime/.test(path));
} catch { /* Missing diff requires the verification lane. */ }
if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `verify-release=${checkRelease}\n`);
