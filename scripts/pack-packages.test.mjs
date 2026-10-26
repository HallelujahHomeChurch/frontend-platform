import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdir, readdir, mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
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
    const version = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8')).version;
    const files = (await readdir(resolve(root, 'artifacts'))).filter(name => name.startsWith('hallelujahhomechurch-') && name.endsWith(`-${version}.tgz`)).sort();
    assert.equal(files.length, 7);
    const digests = async () => Promise.all(files.map(async file => createHash('sha512').update(await readFile(resolve(root, 'artifacts', file))).digest('hex')));
    const before = await digests();
    execFileSync(process.execPath,['scripts/pack-packages.mjs'],{cwd:root,stdio:'pipe'});
    assert.deepEqual(await digests(), before, 'all seven packages must reproduce exact registry integrity');
  } finally {await rm(directory,{recursive:true,force:true});}
});
