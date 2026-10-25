import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile, readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';

const registry = 'https://npm.pkg.github.com';
const integrityPattern = /^sha512-[A-Za-z0-9+/]{86}==$/;
export const integrityOf = bytes => `sha512-${createHash('sha512').update(bytes).digest('base64')}`;

function run(args) {
  return spawnSync('npm', args, {encoding: 'utf8', timeout: 45_000, maxBuffer: 1024 * 1024});
}

export function registryClient(execute = run) {
  return {
    async integrity(candidate) {
      const result = execute(['view', `${candidate.name}@${candidate.version}`, 'dist.integrity', '--json', '--registry', registry,
        '--prefer-online', '--fetch-retries=0', '--fetch-timeout=30000']);
      let value;
      try { value = JSON.parse(result.stdout); } catch { throw new Error('package registry response unavailable'); }
      if (result.error || result.signal) throw new Error('package registry lookup interrupted');
      if (result.status !== 0) {
        if (value?.error?.code === 'E404') return null;
        throw new Error('package registry lookup failed');
      }
      assert.equal(typeof value, 'string', 'package registry integrity missing');
      assert.match(value, integrityPattern, 'package registry integrity unsupported');
      return value;
    },
    async publish(candidate) {
      const result = execute(['publish', candidate.file, '--registry', registry, '--access', 'public', '--ignore-scripts', '--json',
        '--fetch-retries=0', '--fetch-timeout=30000']);
      if (result.error || result.signal || result.status !== 0) throw new Error('package publication acknowledgement unavailable');
    },
  };
}

export async function reconcilePackages(candidates, registryApi) {
  assert.ok(candidates.length > 0, 'package candidates missing');
  assert.equal(new Set(candidates.map(c => c.name)).size, candidates.length, 'duplicate package candidate');
  const missing = [];
  // Complete the preflight before any publication: a later conflict must not
  // create an avoidable partial release of earlier candidates.
  for (const candidate of candidates) {
    assert.match(candidate.name, /^@hallelujahhomechurch\/[a-z][a-z0-9-]*$/);
    assert.match(candidate.version, /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/);
    assert.match(candidate.integrity, integrityPattern);
    const existing = await registryApi.integrity(candidate);
    if (existing === null) missing.push(candidate);
    else assert.equal(existing, candidate.integrity, `published package differs: ${candidate.name}`);
  }
  for (const candidate of missing) {
    let publishError;
    try { await registryApi.publish(candidate); } catch (error) { publishError = error; }
    // A failed acknowledgement may follow a successful registry write. Never
    // replay it blindly; only the exact verified tarball makes that state safe.
    const published = await registryApi.integrity(candidate);
    if (published !== candidate.integrity) {
      throw new Error(`package publication not verified: ${candidate.name}`, {cause: publishError});
    }
  }
  return {published: missing.length, retained: candidates.length - missing.length};
}

export async function loadCandidates(root) {
  const version = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8')).version;
  const directories = (await readdir(resolve(root, 'packages'), {withFileTypes: true})).filter(d => d.isDirectory()).map(d => d.name).sort();
  const candidates = [];
  for (const directory of directories) {
    const manifest = JSON.parse(await readFile(resolve(root, 'packages', directory, 'package.json'), 'utf8'));
    assert.equal(manifest.version, version, 'package version differs from release');
    for (const hook of ['prepublishOnly', 'prepublish', 'prepack', 'prepare', 'publish', 'postpublish', 'postpack']) {
      assert.equal(manifest.scripts?.[hook], undefined, `Publication lifecycle requires explicit review: ${hook}`);
    }
    assert.equal(manifest.publishConfig?.registry, registry, 'unexpected package registry');
    assert.equal(manifest.name, `@hallelujahhomechurch/${directory}`, 'unexpected package name');
    const file = resolve(root, 'artifacts', `hallelujahhomechurch-${directory}-${version}.tgz`);
    const bytes = await readFile(file);
    const packed = spawnSync('tar', ['-xOf', file, 'package/package.json'], {encoding: 'utf8', maxBuffer: 1024 * 1024});
    assert.equal(packed.status, 0, 'package tarball manifest unavailable');
    const identity = JSON.parse(packed.stdout);
    assert.equal(identity.name, manifest.name, 'packed package name mismatch');
    assert.equal(identity.version, version, 'packed package version mismatch');
    assert.equal(identity.publishConfig?.registry, registry, 'packed package registry mismatch');
    candidates.push({name: manifest.name, version, file, integrity: integrityOf(bytes)});
  }
  assert.equal(candidates.length, 7, 'expected seven release packages');
  return candidates;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const result = await reconcilePackages(await loadCandidates(resolve(import.meta.dirname, '..')), registryClient());
    console.log(`Package publication verified: ${result.published} published, ${result.retained} identical versions retained.`);
  } catch (error) {
    // npm diagnostics may contain registry/account information; do not echo them.
    console.error(error.message);
    process.exitCode = 1;
  }
}
