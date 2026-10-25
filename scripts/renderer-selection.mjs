import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';

export const coverage = {
  host: ['default', 'v6', 'v7', 'v8', 'v9', 'v10'],
  container: ['default', 'v3', 'v4', 'v5', 'v6', 'v7', 'v8', 'v9', 'v10'],
};
export const smokeCases = [
  'worker CLI composes the same anchored document and emits only a JSON result',
  'rejects stale content before any browser or file access',
  'rejects modified or missing fonts rather than measuring fallback glyphs',
];
export const digest = value => createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value)).digest('hex');
const shaPattern = /^[a-f0-9]{40}$/;
const hashPattern = /^[a-f0-9]{64}$/;
const common = 'scripts/measure-bulletin-layout.test.mjs';

export function filesFor(version) {
  assert.ok(coverage.container.includes(version), 'unknown renderer version');
  return [common, ...(version === 'v7' ? ['scripts/measure-bulletin-layout-v6.test.mjs'] : []),
    ...(!['default', 'v3', 'v4', 'v5'].includes(version) ? [`scripts/measure-bulletin-layout-${version}.test.mjs`] : [])];
}

export function universe(mode) {
  assert.ok(['ci', 'release'].includes(mode), 'unknown renderer mode');
  return Object.entries(coverage).filter(([runtime]) => mode === 'ci' || runtime === 'container')
    .flatMap(([runtime, versions]) => versions.map(version => ({id: `${runtime}/${version}`, runtime, version})));
}

// Only known independent packages and human docs are unrelated. New paths fail closed.
const unrelated = path => /^(?:README\.md|LICENSE)$/.test(path)
  || /^packages\/(?:account-client|donation-client|donation-ui|hhc-web-client|operations-client|preferences)\//.test(path)
  || /^docs\/[a-zA-Z0-9_/-]+\.md$/.test(path) && !/(?:fixtures?|contracts?|snapshots?|testdata|obs-capture)/i.test(path);

export function affectedCommands(changes, mode) {
  const commands = universe(mode);
  if (!Array.isArray(changes) || changes.length === 0) return new Set(commands.map(c => c.id));
  const affected = new Set();
  for (const {status, path, regular} of changes) {
    // Deleted/renamed files and symlinks require full verification, including formerly unrelated files.
    if (!['A', 'M'].includes(status) || regular !== true || typeof path !== 'string') return new Set(commands.map(c => c.id));
    const readers = commands.filter(c => filesFor(c.version).includes(path));
    if (readers.length) for (const reader of readers) affected.add(reader.id);
    else if (!unrelated(path)) return new Set(commands.map(c => c.id));
  }
  return affected;
}

export function changedFiles(base, head) {
  assert.match(base, shaPattern, 'invalid base');
  assert.match(head, shaPattern, 'invalid head');
  const git = args => execFileSync('git', ['--literal-pathspecs', ...args], {encoding: 'utf8', maxBuffer: 16 * 1024 * 1024});
  assert.equal(git(['rev-parse', 'HEAD']).trim(), head, 'head is not checked out');
  git(['merge-base', '--is-ancestor', base, head]);
  const fields = git(['diff', '--raw', '--no-abbrev', '--no-renames', '-z', base, head, '--']).split('\0');
  assert.equal(fields.pop(), '');
  assert.equal(fields.length % 2, 0, 'malformed diff');
  return Array.from({length: fields.length / 2}, (_, i) => {
    const match = fields[2 * i].match(/^:(\d{6}) (\d{6}) [a-f0-9]{40} [a-f0-9]{40} ([A-Z])$/);
    assert.ok(match, 'unsupported diff entry');
    return {path: fields[2 * i + 1], status: match[3], regular: match[2] === '100644' && ['100644', '000000'].includes(match[1])};
  });
}

export function createPlan({mode, base, head, changes, forceFull = false, checkpoint, fingerprints}) {
  assert.match(head, shaPattern, 'invalid head');
  const commands = universe(mode);
  const affected = forceFull ? new Set(commands.map(c => c.id)) : affectedCommands(changes, mode);
  const entries = commands.map(command => {
    let reason = affected.has(command.id) ? 'changed-or-unresolved-input' : 'unaffected-dependencies';
    let tier = affected.has(command.id) ? 'full' : 'smoke';
    if (mode === 'release' && tier === 'smoke') {
      const prior = checkpoint?.full?.[command.id];
      const input = fingerprints?.[command.id];
      if (!prior || !input || prior.runtime !== input.runtime || prior.verification !== input.verification) {
        tier = 'full'; reason = 'missing-or-changed-full-evidence';
      }
    }
    return {...command, tier, reason};
  });
  const plan = {schema: 1, mode, base: shaPattern.test(base ?? '') ? base : null, head, entries};
  return {...plan, digest: digest(plan)};
}

export function validatePlan(plan, mode, head) {
  assert.deepEqual(Object.keys(plan).sort(), ['base', 'digest', 'entries', 'head', 'mode', 'schema']);
  assert.equal(plan.schema, 1, 'unsupported plan schema');
  assert.equal(plan.mode, mode, 'plan mode mismatch');
  assert.equal(plan.head, head, 'plan commit mismatch');
  assert.match(plan.head, shaPattern);
  assert.ok(plan.base === null || shaPattern.test(plan.base), 'invalid plan base');
  assert.match(plan.digest, hashPattern);
  const {digest: expected, ...body} = plan;
  assert.equal(digest(body), expected, 'plan digest mismatch');
  assert.ok(Array.isArray(plan.entries));
  const commands = universe(mode);
  assert.equal(plan.entries.length, commands.length, 'plan coverage mismatch');
  for (const [i, entry] of plan.entries.entries()) {
    assert.deepEqual(Object.keys(entry).sort(), ['id', 'reason', 'runtime', 'tier', 'version']);
    const {tier, reason, ...command} = entry;
    assert.deepEqual(command, commands[i], 'unknown, duplicate or reordered command');
    assert.ok(['full', 'smoke'].includes(tier), 'invalid tier');
    assert.ok(['changed-or-unresolved-input', 'unaffected-dependencies', 'missing-or-changed-full-evidence'].includes(reason), 'invalid reason');
  }
  return plan;
}

export function loadPlan(path, mode, head) {
  const bytes = readFileSync(path);
  assert.ok(bytes.length < 32 * 1024, 'oversized renderer plan');
  return validatePlan(JSON.parse(bytes), mode, head);
}

export function verifySmoke(output) {
  const passed = output.split('\n').filter(line => /^ok \d+ - /.test(line) && !line.includes('# SKIP'))
    .map(line => line.replace(/^ok \d+ - /, '').trim());
  assert.deepEqual(passed.sort(), [...smokeCases].sort(), 'smoke case coverage mismatch');
  assert.ok(!/^not ok /m.test(output), 'failed smoke case');
  return passed;
}
