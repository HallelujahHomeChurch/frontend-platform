import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {test} from 'node:test';

test('unrelated package releases retain V1 while mutation and removal fail closed', async () => {
  const root = resolve(import.meta.dirname, '..');
  const fixture = await mkdtemp(join(tmpdir(), 'hhc-renderer-immutability-'));
  try {
    const files = [
      'package.json', 'scripts/verify-bulletin-renderer.mjs', 'scripts/measure-bulletin-layout.mjs',
      'packages/ui/package.json', 'packages/ui/src/bulletin-reader', 'packages/ui/dist/bulletin-reader',
    ];
    for (const file of files) {
      await mkdir(dirname(join(fixture, file)), {recursive: true});
      await cp(join(root, file), join(fixture, file), {recursive: true});
    }
    await symlink(join(root, 'packages/ui/node_modules'), join(fixture, 'packages/ui/node_modules'));
    const git = (...args) => execFileSync('git', args, {cwd: fixture, stdio: 'pipe'});
    git('init', '-q');
    git('add', 'package.json', 'scripts', 'packages/ui/package.json', 'packages/ui/src', 'packages/ui/dist');
    git('-c', 'user.name=Renderer fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'Immutable V1 fixture');
    const verify = () => execFileSync(process.execPath, ['scripts/verify-bulletin-renderer.mjs', '--base-ref', 'HEAD'], {cwd: fixture, stdio: 'pipe'});
    const original = verify();
    for (const file of ['package.json', 'packages/ui/package.json']) {
      const path = join(fixture, file);
      const metadata = JSON.parse(await readFile(path, 'utf8'));
      metadata.version = '99.0.0';
      await writeFile(path, JSON.stringify(metadata));
    }
    assert.deepEqual(verify(), original);
    const css = join(fixture, 'packages/ui/src/bulletin-reader/paper.css');
    const bytes = await readFile(css);
    await writeFile(css, Buffer.concat([bytes, Buffer.from('\n/* mutated */\n')]));
    assert.throws(verify, /Referenced V1 renderer is immutable/);
    await writeFile(css, bytes);
    await rm(css);
    assert.throws(verify, /ENOENT/);
  } finally { await rm(fixture, {recursive: true, force: true}); }
});

test('V6 hashes its fixed-label dependency and preserves every frozen version', async () => {
  const root = resolve(import.meta.dirname, '..');
  const fixture = await mkdtemp(join(tmpdir(), 'hhc-renderer-v6-immutability-'));
  try {
    for (const file of ['package.json', 'scripts', 'packages/ui/package.json', 'packages/ui/src/bulletin-reader', 'packages/ui/dist/bulletin-reader']) {
      await mkdir(dirname(join(fixture, file)), {recursive: true});
      await cp(join(root, file), join(fixture, file), {recursive: true});
    }
    await symlink(join(root, 'packages/ui/node_modules'), join(fixture, 'packages/ui/node_modules'));
    const git = (...args) => execFileSync('git', args, {cwd: fixture, stdio: 'pipe'});
    git('init', '-q');
    git('add', 'package.json', 'scripts', 'packages/ui/package.json', 'packages/ui/src', 'packages/ui/dist');
    git('-c', 'user.name=Renderer fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'Immutable V6 fixture');
    const verify = () => execFileSync(process.execPath, ['scripts/verify-bulletin-renderer-v6.mjs', '--base-ref', 'HEAD'], {cwd: fixture, stdio: 'pipe'});
    const original = verify();
    for (const file of ['package.json', 'packages/ui/package.json']) {
      const path = join(fixture, file);
      const metadata = JSON.parse(await readFile(path, 'utf8'));
      metadata.version = '99.0.0';
      await writeFile(path, JSON.stringify(metadata));
    }
    assert.deepEqual(verify(), original);
    for (const file of ['packages/ui/dist/bulletin-reader/v6/fixed.js', 'packages/ui/src/bulletin-reader/v6/fixed.ts', 'packages/ui/src/bulletin-reader/v3/measure.ts']) {
      const path = join(fixture, file);
      const bytes = await readFile(path);
      await writeFile(path, Buffer.concat([bytes, Buffer.from('\n/* changed */\n')]));
      assert.throws(verify, /immutable/);
      await writeFile(path, bytes);
    }
    await rm(join(fixture, 'packages/ui/dist/bulletin-reader/v6/fixed.js'));
    assert.throws(verify, /ENOENT/);
  } finally {await rm(fixture, {recursive: true, force: true});}
});
