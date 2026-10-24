import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile, writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';

const root = resolve(import.meta.dirname, '..'), baseIndex = process.argv.indexOf('--base-ref');
const baseArgs = baseIndex === -1 ? [] : ['--base-ref', process.argv[baseIndex + 1]];
execFileSync(process.execPath, ['scripts/verify-bulletin-renderer-v10.mjs', ...baseArgs], {cwd: root, stdio: 'pipe'});
const artifact = 'packages/ui/src/bulletin-reader/v11/artifact.ts';
const source = ['packages/ui/src/bulletin-reader/v11/BulletinDocumentRenderer.tsx', 'packages/ui/src/bulletin-reader/v11/illustrations.ts', 'scripts/compose-body-v11.mjs', 'scripts/measure-bulletin-layout-v11.mjs'];
const files = ['packages/ui/src/bulletin-reader/v10/artifact.ts', 'packages/ui/dist/bulletin-reader/v11/BulletinDocumentRenderer.js', 'packages/ui/dist/bulletin-reader/v11/illustrations.js', ...source.slice(2)];
const hash = createHash('sha256');
for (const file of files) hash.update(file).update('\0').update(await readFile(resolve(root, file))).update('\0');
const expected = hash.digest('hex');
const contents = `// Generated from V11 source-linked composition and the verified immutable V10 renderer.\nexport const BULLETIN_RENDERER_V11_DIGEST = '${expected}';\n`;
if (process.argv.includes('--write')) await writeFile(resolve(root, artifact), contents);
else assert.equal(await readFile(resolve(root, artifact), 'utf8'), contents, 'Referenced V11 renderer is immutable');
if (baseIndex !== -1) {
  const ref = process.argv[baseIndex + 1];
  assert.match(ref, /^[A-Za-z0-9_./-]+$/);
  if (execFileSync('git', ['ls-tree', '--name-only', ref, artifact], {cwd: root, encoding: 'utf8'}).trim())
    for (const file of [...source, artifact]) assert.deepEqual(await readFile(resolve(root, file)), execFileSync('git', ['show', `${ref}:${file}`], {cwd: root}), `Referenced V11 renderer is immutable: ${file}`);
}
console.log(`Bulletin renderer V11: ${expected}`);
