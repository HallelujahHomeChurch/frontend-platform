import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdir, mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {test} from 'node:test';

test('package packing preserves independent renderer artifacts', async () => {
  const root=resolve(import.meta.dirname,'..');
  await mkdir(resolve(root,'artifacts'),{recursive:true});
  const directory=await mkdtemp(resolve(root,'artifacts/renderer-preservation-'));
  const marker=resolve(directory,'verified-asset');
  try {
    await writeFile(marker,'renderer bytes');
    execFileSync(process.execPath,['scripts/pack-packages.mjs'],{cwd:root,stdio:'pipe'});
    assert.equal(await readFile(marker,'utf8'),'renderer bytes');
  } finally {await rm(directory,{recursive:true,force:true});}
});
