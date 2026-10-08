import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {test} from 'node:test';

test('isolated renderer bundle preserves exact bytes and refuses existing output', {skip: !process.env.HHC_BULLETIN_TEMPLATE_DIR}, async () => {
  const temporary = await mkdtemp(join(tmpdir(),'hhc-renderer-bundle-'));
  const target = join(temporary,'new-parent','bundle');
  const args = ['scripts/package-bulletin-renderer.mjs',target,resolve(process.env.HHC_BULLETIN_TEMPLATE_DIR)];
  try {
    execFileSync(process.execPath,args,{stdio:'pipe'});
    for (const file of ['packages/ui/dist/bulletin-reader/artifact.js','packages/ui/dist/bulletin-reader/paper.css','scripts/measure-bulletin-layout.mjs','packages/ui/dist/bulletin-reader/v3/artifact.js','scripts/measure-bulletin-layout-v3.mjs','packages/ui/dist/bulletin-reader/v4/artifact.js','scripts/measure-bulletin-layout-v4.mjs','scripts/verify-bulletin-renderer-v4.mjs','packages/ui/dist/bulletin-reader/v5/artifact.js','scripts/measure-bulletin-layout-v5.mjs','scripts/verify-bulletin-renderer-v5.mjs']) {
      assert.deepEqual(await readFile(join(target,file)),await readFile(file));
    }
    const manifest = JSON.parse(await readFile(join(target,'package.json'),'utf8'));
    assert.equal(manifest.dependencies.react,'19.2.7');
    assert.equal(manifest.devDependencies.playwright,'1.63.0');
    const assets=JSON.parse(await readFile('packages/ui/src/bulletin-reader/template-assets.json','utf8'));
    for (const license of new Set(assets.map(asset=>asset.licenseUrl).filter(Boolean))) {
      assert.deepEqual(await readFile(join(target,'assets',license.split('/').at(-1))),await readFile(join(process.env.HHC_BULLETIN_TEMPLATE_DIR,license.split('/').at(-1))));
    }
    assert.throws(()=>execFileSync(process.execPath,args,{stdio:'pipe'}));
    assert.deepEqual(await readFile(join(target,'packages/ui/dist/bulletin-reader/artifact.js')),await readFile('packages/ui/dist/bulletin-reader/artifact.js'));
  } finally {await rm(temporary,{recursive:true,force:true});}
});
