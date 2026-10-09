import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {constants} from 'node:fs';
import {copyFile, cp, mkdir, readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {basename, dirname, resolve} from 'node:path';

const root=resolve(import.meta.dirname,'..');
const [destination,assetsDirectory]=process.argv.slice(2);
assert.ok(destination && assetsDirectory,'usage: package-bulletin-renderer.mjs NEW_DIRECTORY ASSETS_DIRECTORY');
execFileSync(process.execPath,['scripts/verify-bulletin-renderer.mjs'],{cwd:root,stdio:'pipe'});
execFileSync(process.execPath,['scripts/verify-bulletin-renderer.mjs','--v2'],{cwd:root,stdio:'pipe'});
execFileSync(process.execPath,['scripts/verify-bulletin-renderer-v3.mjs'],{cwd:root,stdio:'pipe'});
execFileSync(process.execPath,['scripts/verify-bulletin-renderer-v4.mjs'],{cwd:root,stdio:'pipe'});
execFileSync(process.execPath,['scripts/verify-bulletin-renderer-v5.mjs'],{cwd:root,stdio:'pipe'});
execFileSync(process.execPath,['scripts/verify-bulletin-renderer-v6.mjs'],{cwd:root,stdio:'pipe'});
execFileSync(process.execPath,['scripts/verify-bulletin-renderer-v7.mjs'],{cwd:root,stdio:'pipe'});
execFileSync(process.execPath,['scripts/verify-bulletin-renderer-v8.mjs'],{cwd:root,stdio:'pipe'});
const require=createRequire(resolve(root,'packages/ui/package.json'));
const manifest=JSON.parse(await readFile(resolve(root,'tools/bulletin-renderer/package.json'),'utf8'));
const workspace=JSON.parse(await readFile(resolve(root,'package.json'),'utf8'));
assert.equal(manifest.dependencies.react,require('react').version);
assert.equal(manifest.dependencies['react-dom'],require('react-dom').version);
assert.equal(manifest.devDependencies.playwright,workspace.devDependencies.playwright);
const allAssets = (await Promise.all(['', 'v2/', 'v7/'].map(async version => JSON.parse(await readFile(resolve(root,`packages/ui/src/bulletin-reader/${version}template-assets.json`),'utf8'))))).flat();
const assets=[...new Map(allAssets.map(asset=>[asset.url,asset])).values()];
for (const url of new Set(assets.map(asset=>asset.licenseUrl).filter(Boolean))) {
  const match=url.match(/-([0-9a-f]{64})\.txt$/);
  assert.ok(match,'unversioned font license');
  assets.push({url,sha256:match[1]});
}
for (const asset of assets) {
  const bytes=await readFile(resolve(assetsDirectory,basename(asset.url)));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.sha256,'modified template asset');
}
const target=resolve(destination);
// Never replace another task's artifact or silently mix two renderer versions.
await mkdir(dirname(target),{recursive:true});
await mkdir(target);
for (const path of ['packages/ui/dist/bulletin-reader','packages/ui/src/bulletin-reader']) {
  await cp(resolve(root,path),resolve(target,path),{recursive:true,force:false,errorOnExist:true,filter:source=>!source.endsWith('.test.tsx')});
}
const files=[
  ['LICENSE','LICENSE'],
  ['tools/bulletin-renderer/package.json','package.json'],
  ['tools/bulletin-renderer/package-lock.json','package-lock.json'],
  ['packages/ui/package.json','packages/ui/package.json'],
  ['scripts/measure-bulletin-layout.mjs','scripts/measure-bulletin-layout.mjs'],
  ['scripts/measure-bulletin-layout-v2.mjs','scripts/measure-bulletin-layout-v2.mjs'],
  ['scripts/measure-bulletin-layout-v3.mjs','scripts/measure-bulletin-layout-v3.mjs'],
  ['scripts/verify-bulletin-renderer-v3.mjs','scripts/verify-bulletin-renderer-v3.mjs'],
  ['scripts/measure-bulletin-layout-v4.mjs','scripts/measure-bulletin-layout-v4.mjs'],
  ['scripts/verify-bulletin-renderer-v4.mjs','scripts/verify-bulletin-renderer-v4.mjs'],
  ['scripts/measure-bulletin-layout-v5.mjs','scripts/measure-bulletin-layout-v5.mjs'],
  ['scripts/verify-bulletin-renderer-v5.mjs','scripts/verify-bulletin-renderer-v5.mjs'],
  ['scripts/measure-bulletin-layout-v6.mjs','scripts/measure-bulletin-layout-v6.mjs'],
  ['scripts/verify-bulletin-renderer-v6.mjs','scripts/verify-bulletin-renderer-v6.mjs'],
  ['scripts/measure-bulletin-layout-v7.mjs','scripts/measure-bulletin-layout-v7.mjs'],
  ['scripts/verify-bulletin-renderer-v7.mjs','scripts/verify-bulletin-renderer-v7.mjs'],
  ['scripts/measure-bulletin-layout-v8.mjs','scripts/measure-bulletin-layout-v8.mjs'],
  ['scripts/verify-bulletin-renderer-v8.mjs','scripts/verify-bulletin-renderer-v8.mjs'],
  ['scripts/verify-bulletin-renderer.mjs','scripts/verify-bulletin-renderer.mjs'],
];
for (const [source,path] of files) {
  await mkdir(dirname(resolve(target,path)),{recursive:true});
  await copyFile(resolve(root,source),resolve(target,path),constants.COPYFILE_EXCL);
}
await mkdir(resolve(target,'assets'));
for (const asset of assets) await copyFile(resolve(assetsDirectory,basename(asset.url)),resolve(target,'assets',basename(asset.url)),constants.COPYFILE_EXCL);
console.log(target);
