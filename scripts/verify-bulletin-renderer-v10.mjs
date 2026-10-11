import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile, writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';

const root = resolve(import.meta.dirname, '..'), baseIndex = process.argv.indexOf('--base-ref');
const baseArgs = baseIndex === -1 ? [] : ['--base-ref', process.argv[baseIndex + 1]];
execFileSync(process.execPath, ['scripts/verify-bulletin-renderer-v9.mjs', ...baseArgs], {cwd: root, stdio: 'pipe'});
const artifact = 'packages/ui/src/bulletin-reader/v10/artifact.ts';
const source = ['packages/ui/src/bulletin-reader/v10/BulletinDocumentRenderer.tsx', 'scripts/compose-dense-cover-v10.mjs', 'scripts/measure-bulletin-layout-v10.mjs'];
const files = ['packages/ui/src/bulletin-reader/v9/artifact.ts', 'packages/ui/dist/bulletin-reader/v10/BulletinDocumentRenderer.js', 'scripts/compose-dense-cover-v10.mjs', 'scripts/measure-bulletin-layout-v10.mjs'];
const hash = createHash('sha256');
for (const file of files) hash.update(file).update('\0').update(await readFile(resolve(root, file))).update('\0');
const expected = hash.digest('hex');
const contents = `// Generated from V10 composition and the verified immutable V9 renderer.\nexport const BULLETIN_RENDERER_V10_DIGEST = '${expected}';\n`;
if (process.argv.includes('--write')) await writeFile(resolve(root, artifact), contents);
else assert.equal(await readFile(resolve(root, artifact), 'utf8'), contents, 'Referenced V10 renderer is immutable');
if (baseIndex !== -1) {
  const ref = process.argv[baseIndex + 1];
  assert.match(ref, /^[A-Za-z0-9_./-]+$/);
  if (execFileSync('git', ['ls-tree', '--name-only', ref, artifact], {cwd: root, encoding: 'utf8'}).trim())
    for (const file of [...source, artifact]) assert.deepEqual(await readFile(resolve(root, file)), execFileSync('git', ['show', `${ref}:${file}`], {cwd: root}), `Referenced V10 renderer is immutable: ${file}`);
}
console.log(`Bulletin renderer V10: ${expected}`);
