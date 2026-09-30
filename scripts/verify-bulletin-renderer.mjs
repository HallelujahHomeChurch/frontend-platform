import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile, writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {createRequire} from 'node:module';

const root = resolve(import.meta.dirname, '..');
const artifact = 'packages/ui/src/bulletin-reader/artifact.ts';
const frozen = [
  'packages/ui/src/bulletin-reader/BulletinDocumentRenderer.tsx',
  'packages/ui/src/bulletin-reader/measure.ts',
  'packages/ui/src/bulletin-reader/paper.css',
  'packages/ui/src/bulletin-reader/template-assets.json',
  'packages/ui/src/bulletin-reader/font-coverage.json',
  'scripts/measure-bulletin-layout.mjs',
];
const files = [
  'packages/ui/dist/bulletin-reader/BulletinDocumentRenderer.js',
  'packages/ui/dist/bulletin-reader/measure.js',
  'packages/ui/dist/bulletin-reader/paper.css',
  ...frozen.slice(3),
];
const digest = createHash('sha256');
for (const file of files) digest.update(file).update('\0').update(await readFile(resolve(root, file))).update('\0');
const workspace = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
const require = createRequire(resolve(root, 'packages/ui/package.json'));
// This file must not depend on workspace/package versions; only renderer runtimes.
digest.update(JSON.stringify({playwright: workspace.devDependencies.playwright, react: require('react').version, reactDOM: require('react-dom').version}));
const expected = digest.digest('hex');
const contents = `// Generated from compiled renderer, measurement code, CSS and fixed assets.\nexport const BULLETIN_RENDERER_V1_DIGEST = '${expected}';\n`;
if (process.argv.includes('--write')) await writeFile(resolve(root, artifact), contents);
else assert.equal(await readFile(resolve(root, artifact), 'utf8'), contents, 'Renderer artifact changed: regenerate only before V1 is referenced; otherwise add V2.');
const baseIndex = process.argv.indexOf('--base-ref');
if (baseIndex !== -1) {
  const ref = process.argv[baseIndex + 1];
  assert.match(ref, /^[A-Za-z0-9_./-]+$/);
  const previous = execFileSync('git', ['ls-tree', '--name-only', ref, artifact], {cwd: root, encoding: 'utf8'}).trim();
  if (previous) {
    for (const file of [...frozen, artifact]) assert.deepEqual(await readFile(resolve(root, file)), execFileSync('git', ['show', `${ref}:${file}`], {cwd: root}), `Referenced V1 renderer is immutable: ${file}`);
  }
}
console.log(`Bulletin renderer V1: ${expected}`);
