import assert from 'node:assert/strict';
import {test} from 'node:test';
import {integrityOf, reconcilePackages, registryClient} from './publish-packages.mjs';

const candidate = (name = 'ui') => ({name: `@hallelujahhomechurch/${name}`, version: '1.1.9', file: `/verified/${name}.tgz`, integrity: integrityOf(name)});
const other = integrityOf('other bytes');

test('partial publication retains exact matches and preflights all packages before writes', async () => {
  const a = candidate(), b = candidate('preferences'), events = [], published = new Set([a.name]);
  const result = await reconcilePackages([a, b], {
    integrity: async c => { events.push(`read:${c.name}`); return published.has(c.name) ? c.integrity : null; },
    publish: async c => { events.push(`write:${c.name}`); published.add(c.name); },
  });
  assert.deepEqual(result, {published: 1, retained: 1});
  assert.deepEqual(events, [`read:${a.name}`, `read:${b.name}`, `write:${b.name}`, `read:${b.name}`]);
});

test('a later mismatch or unknown lookup prevents every publication', async () => {
  for (const failure of ['mismatch', 'unknown']) {
    let writes = 0;
    await assert.rejects(reconcilePackages([candidate(), candidate('preferences')], {
      integrity: async c => { if (c.name.endsWith('/ui')) return null; if (failure === 'unknown') throw new Error('unavailable'); return other; },
      publish: async () => { writes++; },
    }));
    assert.equal(writes, 0);
  }
});

test('ambiguous publication is accepted only after exact integrity readback without replay', async () => {
  for (const observed of [null, other, candidate().integrity]) {
    let reads = 0, writes = 0;
    const run = reconcilePackages([candidate()], {
      integrity: async () => ++reads === 1 ? null : observed,
      publish: async () => { writes++; throw new Error('lost acknowledgement'); },
    });
    if (observed === candidate().integrity) await run;
    else await assert.rejects(run, /not verified/);
    assert.equal(writes, 1);
    assert.equal(reads, 2);
  }
});

test('successful publish without integrity readback still fails closed', async () => {
  await assert.rejects(reconcilePackages([candidate()], {integrity: async () => null, publish: async () => {}}), /not verified/);
});

test('registry adapter distinguishes explicit absent version from auth/network/malformed results', async () => {
  const c = candidate();
  const absent = registryClient(() => ({status: 1, stdout: JSON.stringify({error: {code: 'E404'}})}));
  assert.equal(await absent.integrity(c), null);
  for (const result of [
    {status: 1, stdout: JSON.stringify({error: {code: 'E401'}})},
    {status: 1, stdout: 'private diagnostic'},
    {status: 0, stdout: '{}'},
    {status: 0, stdout: JSON.stringify('sha1-weak')},
    {status: null, signal: 'SIGTERM', stdout: JSON.stringify({error: {code: 'E404'}})},
  ]) await assert.rejects(registryClient(() => result).integrity(c));
});

test('registry commands use the exact version and verified tarball without lifecycle execution', async () => {
  const calls = [], c = candidate();
  const api = registryClient(args => {calls.push(args);return {status: 0, stdout: JSON.stringify(c.integrity)};});
  assert.equal(await api.integrity(c), c.integrity);
  await api.publish(c);
  assert.deepEqual(calls[0].slice(0, 3), ['view', `${c.name}@${c.version}`, 'dist.integrity']);
  assert.deepEqual(calls[1].slice(0, 2), ['publish', c.file]);
  for (const args of calls) assert.equal(args[args.indexOf('--registry') + 1], 'https://npm.pkg.github.com');
  assert.ok(calls[1].includes('--ignore-scripts'));
});

test('release restores checksum-verified prepared tarballs and keeps publisher behind verification', async () => {
  const {createRequire} = await import('node:module');
  const {readFile} = await import('node:fs/promises');
  const {parse} = createRequire(new URL('../packages/hhc-web-client/package.json', import.meta.url))('yaml');
  const release = parse(await readFile(new URL('../.github/workflows/release.yml', import.meta.url), 'utf8'));
  assert.deepEqual(release.jobs.publish.needs, ['prepare', 'verify']);
  assert.equal(release.jobs.publish.permissions.packages, 'write');
  const prepare = release.jobs.prepare.steps;
  const pack = prepare.findIndex(s => s.run === 'node --test scripts/pack-packages.test.mjs');
  const bundle = prepare.findIndex(s => s.name === 'Bundle immutable inputs for the same-run shards');
  assert.ok(pack >= 0 && pack < bundle);
  assert.match(prepare[bundle].run, /artifacts\/hallelujahhomechurch-\*\.tgz/);
  const publish = release.jobs.publish.steps;
  const restore = publish.findIndex(s => s.name === 'Verify and restore the prepared workspace and image');
  const write = publish.findIndex(s => s.name === 'Publish packages');
  assert.ok(restore >= 0 && restore < write);
  assert.match(publish[restore].run, /python3 scripts\/restore-release-publication.py/);
  assert.equal(publish[restore].env.WORKSPACE_SHA, '${{ needs.prepare.outputs.workspace-sha }}');
  assert.equal(publish[write].run, 'node scripts/publish-packages.mjs');
  assert.ok(prepare.some(s => s.run?.includes('scripts/publish-packages.test.mjs')));
});

test('candidate identity and integrity come from the prepared tarball, with missing or mismatched inputs rejected', async () => {
  const {mkdtemp, mkdir, writeFile, readFile, rm} = await import('node:fs/promises');
  const {tmpdir} = await import('node:os');
  const {join} = await import('node:path');
  const {execFileSync} = await import('node:child_process');
  const {loadCandidates} = await import('./publish-packages.mjs');
  const root = await mkdtemp(join(tmpdir(), 'package-release-'));
  try {
    await mkdir(join(root, 'artifacts'));
    await mkdir(join(root, 'packed/package'), {recursive: true});
    await writeFile(join(root, 'package.json'), JSON.stringify({version: '1.1.9'}));
    const names = ['ui', 'preferences', 'account-client', 'hhc-web-client', 'operations-client', 'donation-client', 'donation-ui'];
    for (const name of names) {
      const manifest = {name: `@hallelujahhomechurch/${name}`, version: '1.1.9', publishConfig: {registry: 'https://npm.pkg.github.com'}};
      await mkdir(join(root, 'packages', name), {recursive: true});
      await writeFile(join(root, 'packages', name, 'package.json'), JSON.stringify(manifest));
      await writeFile(join(root, 'packed/package/package.json'), JSON.stringify(manifest));
      execFileSync('tar', ['-czf', join(root, 'artifacts', `hallelujahhomechurch-${name}-1.1.9.tgz`), '-C', join(root, 'packed'), 'package']);
    }
    const candidates = await loadCandidates(root);
    assert.equal(candidates.length, 7);
    for (const c of candidates) assert.equal(c.integrity, integrityOf(await readFile(c.file)));
    const manifestPath = join(root, 'packages', 'ui', 'package.json');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    await writeFile(manifestPath, JSON.stringify({...manifest, scripts: {prepublishOnly: 'build'}}));
    await assert.rejects(loadCandidates(root), /Publication lifecycle requires explicit review/);
    await writeFile(manifestPath, JSON.stringify(manifest));
    const target = candidates.find(c => c.name.endsWith('/ui'));
    await writeFile(join(root, 'packed/package/package.json'), JSON.stringify({name: target.name, version: '0.0.0'}));
    execFileSync('tar', ['-czf', target.file, '-C', join(root, 'packed'), 'package']);
    await assert.rejects(loadCandidates(root), /packed package version mismatch/);
    await rm(target.file);
    await assert.rejects(loadCandidates(root), /ENOENT/);
  } finally {await rm(root, {recursive: true, force: true});}
});
