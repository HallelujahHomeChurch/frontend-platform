import {mkdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync, readdirSync, lstatSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';

// Only dependency-map ordering is irrelevant. In particular, conditional
// exports are ordered contracts and must never be recursively sorted.
const canonical = manifest => {
  const result = {...manifest};
  for (const field of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
    if (result[field]) result[field] = Object.fromEntries(Object.entries(result[field]).sort(([a], [b]) => a.localeCompare(b, 'en')));
  }
  return result;
};

// Repacking must preserve pnpm's selected files, executable bits and all bytes
// except semantically identical package JSON. Reject unexpected link entries.
function snapshot(directory, prefix = '') {
  return readdirSync(directory).sort().flatMap(name => {
    const path = resolve(directory, name);
    const relative = `${prefix}${name}`;
    const stat = lstatSync(path);
    if (stat.isDirectory()) return snapshot(path, `${relative}/`);
    assert.ok(stat.isFile(), `Unsupported package entry: ${relative}`);
    const bytes = relative === 'package.json'
      ? JSON.stringify(canonical(JSON.parse(readFileSync(path, 'utf8')))) : readFileSync(path);
    return [{path: relative, mode: stat.mode & 0o777, digest: createHash('sha256').update(bytes).digest('hex')}];
  });
}

const root = resolve(import.meta.dirname, '..');
const artifacts = resolve(root, 'artifacts');
const packages = ['preferences', 'account-client', 'hhc-web-client', 'operations-client', 'ui', 'donation-client', 'donation-ui'];

mkdirSync(artifacts, {recursive: true});

for (const name of packages) {
  const result = spawnSync(
    'corepack',
    ['pnpm', '--dir', resolve(root, 'packages', name), 'pack', '--pack-destination', artifacts],
    {stdio: 'inherit'}
  );
  if (result.status !== 0) process.exit(result.status ?? 1);
  // pnpm resolves workspace dependencies asynchronously, so their serialized
  // key order can differ between identical builds. Canonicalize only JSON key
  // order after pnpm has selected files and resolved publish-time dependencies.
  const version = JSON.parse(readFileSync(resolve(root, 'packages', name, 'package.json'), 'utf8')).version;
  const file = resolve(artifacts, `hallelujahhomechurch-${name}-${version}.tgz`);
  const temporary = mkdtempSync(resolve(tmpdir(), 'hhc-package-'));
  try {
    const extracted = spawnSync('tar', ['-xzf', file, '-C', temporary], {stdio: 'inherit'});
    if (extracted.status !== 0) throw new Error(`Cannot extract package ${name}`);
    const original = snapshot(resolve(temporary, 'package'));
    const manifest = resolve(temporary, 'package/package.json');
    writeFileSync(manifest, `${JSON.stringify(canonical(JSON.parse(readFileSync(manifest, 'utf8'))), null, 2)}\n`);
    const packed = spawnSync('npm', ['pack', '--ignore-scripts', '--pack-destination', artifacts],
      {cwd: resolve(temporary, 'package'), stdio: 'inherit'});
    if (packed.status !== 0) throw new Error(`Cannot normalize package ${name}`);
    const verification = resolve(temporary, 'verification');
    mkdirSync(verification);
    const restored = spawnSync('tar', ['-xzf', file, '-C', verification], {stdio: 'inherit'});
    if (restored.status !== 0) throw new Error(`Cannot verify package ${name}`);
    assert.deepEqual(snapshot(resolve(verification, 'package')), original, `Repacking changed package ${name}`);
  } finally { rmSync(temporary, {recursive: true, force: true}); }

}
