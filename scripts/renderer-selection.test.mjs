import assert from 'node:assert/strict';
import {test} from 'node:test';
import {affectedCommands, createPlan, digest, smokeCases, universe, validatePlan, verifySmoke} from './renderer-selection.mjs';
import {rendererCommands, shards, verifyResults} from './ci-bulletin-renderer.mjs';

const head = 'a'.repeat(40), base = 'b'.repeat(40);
const change = path => ({status: 'M', regular: true, path});
const plan = (changes, mode = 'ci', extra = {}) => createPlan({mode, base, head, changes, ...extra});

test('unrelated packages smoke all versions, test dependencies select both V6 and V7', () => {
  assert.ok(plan([change('packages/account-client/src/index.ts')]).entries.every(e => e.tier === 'smoke'));
  const selected = plan([change('scripts/measure-bulletin-layout-v6.test.mjs')]);
  assert.deepEqual(selected.entries.filter(e => e.tier === 'full').map(e => e.id), ['host/v6', 'host/v7', 'container/v6', 'container/v7']);
  assert.deepEqual(plan([change('scripts/measure-bulletin-layout-v10.test.mjs')]).entries.filter(e => e.tier === 'full').map(e => e.id), ['host/v10', 'container/v10']);
});

test('shared, unknown, renamed, deleted, symlink, and missing changes select full', () => {
  for (const changes of [undefined, [], [change('pnpm-lock.yaml')], [change('packages/ui/src/bulletin-reader/v9/fixed.ts')],
    [change('new-package/file.ts')], [change('scripts/measure-bulletin-layout.test.mjs')],
    [{...change('README.md'), status: 'D'}], [{...change('README.md'), status: 'R'}], [{...change('README.md'), regular: false}],
    [change('packages/account-client/index.ts'), change('.github/workflows/ci.yml')]]) {
    assert.equal(affectedCommands(changes, 'ci').size, 15);
  }
});

test('release is nine containers and needs matching runtime AND verification evidence', () => {
  assert.equal(universe('release').length, 9);
  const changes = [change('packages/account-client/index.ts')];
  assert.ok(plan(changes, 'release').entries.every(e => e.tier === 'full'));
  const fingerprints = Object.fromEntries(universe('release').map(c => [c.id, {runtime: '1'.repeat(64), verification: '2'.repeat(64)}]));
  const checkpoint = {full: structuredClone(fingerprints)};
  assert.ok(plan(changes, 'release', {fingerprints, checkpoint}).entries.every(e => e.tier === 'smoke'));
  checkpoint.full['container/v10'].verification = '3'.repeat(64);
  assert.deepEqual(plan(changes, 'release', {fingerprints, checkpoint}).entries.filter(e => e.tier === 'full').map(e => e.id), ['container/v10']);
  for (const prior of Object.values(checkpoint.full)) prior.runtime = '4'.repeat(64);
  assert.ok(plan(changes, 'release', {fingerprints, checkpoint}).entries.every(e => e.tier === 'full'));
});

test('closed plan schema rejects arbitrary matrix identities, tiers and stale heads', () => {
  const good = plan([change('README.md')]);
  assert.doesNotThrow(() => validatePlan(good, 'ci', head));
  for (const mutate of [p => { p.entries[0].version = 'v10; touch /tmp/unsafe'; }, p => { p.entries.pop(); },
    p => { p.entries[1] = p.entries[0]; }, p => { p.entries[0].tier = 'skip'; }, p => { p.extra = true; },
    p => { p.entries[0].extra = true; }, p => { p.mode = 'release'; }, p => { p.head = base; }]) {
    const bad = structuredClone(good); mutate(bad); const {digest: _, ...body} = bad; bad.digest = digest(body);
    assert.throws(() => validatePlan(bad, 'ci', head));
  }
});

test('smoke requires every named real case, never zero tests or skipped assets', () => {
  const output = smokeCases.map((name, i) => `ok ${i + 1} - ${name}`).join('\n');
  assert.deepEqual(verifySmoke(output), [...smokeCases].sort());
  for (const text of ['', output.replace('ok 1 -', 'not ok 1 -'), output + '\nok 9 - extra', output.replace(smokeCases[0], smokeCases[0] + ' # SKIP')]) assert.throws(() => verifySmoke(text));
});

test('receipts cannot downgrade full commands or substitute another plan', () => {
  const selection = plan([change('scripts/measure-bulletin-layout-v10.test.mjs')]);
  const identity = {sha: head, runId: '1', runAttempt: '1', mode: 'ci'};
  const needs = {prepare: {result: 'success'}, renderer: {result: 'success'}};
  const results = Object.entries(shards).map(([shard, versions]) => {
    const entries = rendererCommands(shard, 'ci', selection).map(c => selection.entries.find(e => e.id === `${c.runtime}/${c.version}`));
    return {...identity, ...versions, shard, entries, planDigest: selection.digest,
      smoke: Object.fromEntries(entries.filter(e => e.tier === 'smoke').map(e => [e.id, [...smokeCases].sort()]))};
  });
  assert.doesNotThrow(() => verifyResults(needs, results, identity, selection));
  const bad = structuredClone(results); bad[0].entries[0].tier = 'smoke';
  assert.throws(() => verifyResults(needs, bad, identity, selection), /tier coverage/);
  bad[0].planDigest = '0'.repeat(64);
  assert.throws(() => verifyResults(needs, bad, identity, selection), /selection plan/);
});
