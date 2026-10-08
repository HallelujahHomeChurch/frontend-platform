import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';

const root=resolve(import.meta.dirname,'..');
for(const args of [[],['--v2']])execFileSync(process.execPath,['scripts/verify-bulletin-renderer.mjs',...args],{cwd:root,stdio:'pipe'});
const artifact='packages/ui/src/bulletin-reader/v3/artifact.ts';
const source=['packages/ui/src/bulletin-reader/v3/BulletinDocumentRenderer.tsx','packages/ui/src/bulletin-reader/v3/measure.ts','scripts/measure-bulletin-layout-v3.mjs'];
const files=[...['','v2/'].flatMap(version=>['BulletinDocumentRenderer.js','fixed.js','paper.css'].map(file=>`packages/ui/dist/bulletin-reader/${version}${file}`).concat(['template-assets.json','font-coverage.json','artifact.ts'].map(file=>`packages/ui/src/bulletin-reader/${version}${file}`))),
  'packages/ui/dist/bulletin-reader/v3/BulletinDocumentRenderer.js','packages/ui/dist/bulletin-reader/v3/measure.js','scripts/measure-bulletin-layout-v3.mjs'];
const digest=createHash('sha256');
for(const file of files)digest.update(file).update('\0').update(await readFile(resolve(root,file))).update('\0');
const workspace=JSON.parse(await readFile(resolve(root,'package.json'),'utf8'));
const require=createRequire(resolve(root,'packages/ui/package.json'));
digest.update(JSON.stringify({playwright:workspace.devDependencies.playwright,react:require('react').version,reactDOM:require('react-dom').version}));
const expected=digest.digest('hex');
const contents=`// Generated from compiled renderer, measurement code, CSS and fixed assets.\nexport const BULLETIN_RENDERER_V3_DIGEST = '${expected}';\n`;
if(process.argv.includes('--write'))await writeFile(resolve(root,artifact),contents);
else assert.equal(await readFile(resolve(root,artifact),'utf8'),contents,'Referenced V3 renderer is immutable');
const index=process.argv.indexOf('--base-ref');
if(index!==-1){
  const ref=process.argv[index+1];assert.match(ref,/^[A-Za-z0-9_./-]+$/);
  if(execFileSync('git',['ls-tree','--name-only',ref,artifact],{cwd:root,encoding:'utf8'}).trim())
    for(const file of [...source,artifact])assert.deepEqual(await readFile(resolve(root,file)),execFileSync('git',['show',`${ref}:${file}`],{cwd:root}),`Referenced V3 renderer is immutable: ${file}`);
}
console.log(`Bulletin renderer V3: ${expected}`);
