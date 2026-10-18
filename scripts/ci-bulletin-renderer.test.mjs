import assert from 'node:assert/strict';
import {test} from 'node:test';
import {spawnSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {mkdir, mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {rendererCommands, shards, verifyResults} from './ci-bulletin-renderer.mjs';

const common = 'scripts/measure-bulletin-layout.test.mjs';
const coverage = {
  host: {default: [common], v6: [common, 'scripts/measure-bulletin-layout-v6.test.mjs'], v7: [common, 'scripts/measure-bulletin-layout-v6.test.mjs', 'scripts/measure-bulletin-layout-v7.test.mjs'], v8: [common, 'scripts/measure-bulletin-layout-v8.test.mjs'], v9: [common, 'scripts/measure-bulletin-layout-v9.test.mjs'], v10: [common, 'scripts/measure-bulletin-layout-v10.test.mjs']},
  container: {default: [common], v3: [common], v4: [common], v5: [common], v6: [common, 'scripts/measure-bulletin-layout-v6.test.mjs'], v7: [common, 'scripts/measure-bulletin-layout-v6.test.mjs', 'scripts/measure-bulletin-layout-v7.test.mjs'], v8: [common, 'scripts/measure-bulletin-layout-v8.test.mjs'], v9: [common, 'scripts/measure-bulletin-layout-v9.test.mjs'], v10: [common, 'scripts/measure-bulletin-layout-v10.test.mjs']},
};

test('the shards retain every original host and container command exactly once', () => {
  const actual = {host: {}, container: {}};
  for (const shard of Object.keys(shards)) for (const command of rendererCommands(shard)) {
    const {runtime, version, files, args, env} = command;
    assert.equal(actual[runtime][version], undefined, `duplicate ${runtime}/${version}`);
    actual[runtime][version] = files;
    const concurrency = version === 'default' || ['v3', 'v4', 'v5'].includes(version) ? [] : ['--test-concurrency=1'];
    const versionEnv = version === 'default' ? {} : {[`HHC_TEST_RENDERER_${version.toUpperCase()}`]: '1'};
    assert.deepEqual(env, versionEnv);
    if (runtime === 'host') assert.deepEqual(args, ['--test', ...concurrency, ...files]);
    else {
      assert.deepEqual(args.slice(0, 13), ['run', '--rm', '--network', 'none', '--read-only', '--memory', '2g', '--cpus', '1', '--tmpfs', '/tmp:rw,noexec,nosuid,size=128m', '-e', 'HHC_BULLETIN_TEMPLATE_DIR=/opt/bulletin-renderer/assets']);
      const tail = args.indexOf('--entrypoint');
      assert.deepEqual(args.slice(tail), ['--entrypoint', 'node', 'hhc-bulletin-renderer:verify', '--test', ...concurrency, ...files.map(file => `/opt/bulletin-renderer/${file}`)]);
      for (const file of [...files, 'scripts/testdata']) assert.ok(args.includes(`type=bind,src=${process.cwd()}/${file},dst=/opt/bulletin-renderer/${file},readonly`));
      for (const [key, value] of Object.entries(versionEnv)) assert.ok(args.includes(`${key}=${value}`));
    }
  }
  assert.deepEqual(actual, coverage);
  assert.throws(() => rendererCommands('unknown'), /unknown renderer shard/);
});

const sha = 'a'.repeat(40);
const needs = {prepare: {result: 'success'}, renderer: {result: 'success'}};
const results = () => Object.entries(shards).map(([shard, commands]) => ({sha, shard, ...commands}));

test('the aggregate accepts only successful dependencies and complete same-commit coverage', () => {
  assert.doesNotThrow(() => verifyResults(needs, results(), sha));
  for (const result of ['failure', 'cancelled', 'skipped']) for (const job of Object.keys(needs)) {
    assert.throws(() => verifyResults({...needs, [job]: {result}}, results(), sha), /did not succeed/);
  }
  assert.throws(() => verifyResults({}, results(), sha), /dependencies/);
  assert.throws(() => verifyResults(needs, results().slice(1), sha), /shard coverage/);
  assert.throws(() => verifyResults(needs, [...results(), results()[0]], sha), /shard coverage/);
  const missingVersion = results();
  missingVersion[0].host = missingVersion[0].host.slice(1);
  assert.throws(() => verifyResults(needs, missingVersion, sha), /version coverage/);
  const wrongCommit = results();
  wrongCommit[0].sha = 'b'.repeat(40);
  assert.throws(() => verifyResults(needs, wrongCommit, sha), /commit mismatch/);
});


test('a failed renderer command aborts its shard without recording completed coverage', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'renderer-ci-failure-'));
  try {
    await mkdir(join(directory, 'scripts'));
    await writeFile(join(directory, common), 'process.exit(7);\n');
    const env = {...process.env, GITHUB_SHA: sha, HHC_BULLETIN_TEMPLATE_DIR: directory};
    delete env.NODE_TEST_CONTEXT;
    const result = spawnSync(process.execPath, [new URL('./ci-bulletin-renderer.mjs', import.meta.url).pathname, 'run', 'legacy', 'results'], {
      cwd: directory, encoding: 'utf8', env,
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stdout, /host renderer default/);
    assert.doesNotMatch(result.stdout, /host renderer v6/);
    assert.equal(existsSync(join(directory, 'results')), false);
  } finally {await rm(directory, {recursive: true, force: true});}
});


test('missing verified assets fails before a host suite can skip font checks', () => {
  const env = {...process.env, GITHUB_SHA: sha};
  delete env.NODE_TEST_CONTEXT;
  delete env.HHC_BULLETIN_TEMPLATE_DIR;
  const result = spawnSync(process.execPath, [new URL('./ci-bulletin-renderer.mjs', import.meta.url).pathname, 'run', 'legacy', 'results'], {encoding: 'utf8', env});
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /verified template assets are required/);
  assert.equal(result.stdout, '');
});
