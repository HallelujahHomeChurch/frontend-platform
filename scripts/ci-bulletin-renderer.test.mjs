import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {existsSync, readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {chmod, mkdir, mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
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
const identity = {sha, runId: '123', runAttempt: '2', mode: 'ci'};
const results = () => Object.entries(shards).map(([shard, commands]) => ({...identity, shard, ...commands}));

test('the aggregate accepts only successful dependencies and complete same-commit coverage', () => {
  assert.doesNotThrow(() => verifyResults(needs, results(), identity));
  for (const result of ['failure', 'cancelled', 'skipped']) for (const job of Object.keys(needs)) {
    assert.throws(() => verifyResults({...needs, [job]: {result}}, results(), identity), /did not succeed/);
  }
  assert.throws(() => verifyResults({}, results(), identity), /dependencies/);
  assert.throws(() => verifyResults(needs, results().slice(1), identity), /shard coverage/);
  assert.throws(() => verifyResults(needs, [...results(), results()[0]], identity), /shard coverage/);
  const missingVersion = results();
  missingVersion[0].host = missingVersion[0].host.slice(1);
  assert.throws(() => verifyResults(needs, missingVersion, identity), /version coverage/);
  const wrongCommit = results();
  wrongCommit[0].sha = 'b'.repeat(40);
  assert.throws(() => verifyResults(needs, wrongCommit, identity), /commit mismatch/);
});


test('a failed renderer command aborts its shard without recording completed coverage', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'renderer-ci-failure-'));
  try {
    await mkdir(join(directory, 'scripts'));
    await writeFile(join(directory, common), 'process.exit(7);\n');
    const env = {...process.env, GITHUB_SHA: sha, GITHUB_RUN_ID: '123', GITHUB_RUN_ATTEMPT: '2', HHC_BULLETIN_TEMPLATE_DIR: directory};
    delete env.NODE_TEST_CONTEXT;
    const result = spawnSync(process.execPath, [new URL('./ci-bulletin-renderer.mjs', import.meta.url).pathname, 'run', 'balanced-a', 'results'], {
      cwd: directory, encoding: 'utf8', env,
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stdout, /host renderer v10/);
    assert.doesNotMatch(result.stdout, /host renderer default/);
    assert.equal(existsSync(join(directory, 'results')), false);
  } finally {await rm(directory, {recursive: true, force: true});}
});


test('missing verified assets fails before a host suite can skip font checks', () => {
  const env = {...process.env, GITHUB_SHA: sha};
  delete env.NODE_TEST_CONTEXT;
  delete env.HHC_BULLETIN_TEMPLATE_DIR;
  const result = spawnSync(process.execPath, [new URL('./ci-bulletin-renderer.mjs', import.meta.url).pathname, 'run', 'balanced-a', 'results'], {encoding: 'utf8', env});
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /verified template assets are required/);
  assert.equal(result.stdout, '');
});


test('release shards retain exactly all nine original container commands and no host commands', () => {
  const actual = {};
  for (const shard of Object.keys(shards)) for (const command of rendererCommands(shard, 'release')) {
    assert.equal(command.runtime, 'container');
    assert.equal(actual[command.version], undefined, `duplicate ${command.version}`);
    actual[command.version] = command.files;
    assert.deepEqual(command, rendererCommands(shard).find(candidate => candidate.runtime === 'container' && candidate.version === command.version));
  }
  assert.deepEqual(actual, coverage.container);
  assert.throws(() => rendererCommands('balanced-a', 'unknown'), /mode/);
});

test('release gate rejects missing, duplicate, wrong-mode, stale-run and wrong-version receipts', () => {
  const releaseIdentity = {...identity, mode: 'release'};
  const receipts = () => results().map(result => ({...result, mode: 'release', host: []}));
  assert.doesNotThrow(() => verifyResults(needs, receipts(), releaseIdentity));
  for (const result of ['failure', 'cancelled', 'skipped']) for (const job of Object.keys(needs)) {
    assert.throws(() => verifyResults({...needs, [job]: {result}}, receipts(), releaseIdentity), /did not succeed/);
  }
  assert.throws(() => verifyResults(needs, receipts().slice(1), releaseIdentity), /shard coverage/);
  assert.throws(() => verifyResults(needs, [...receipts(), receipts()[0]], releaseIdentity), /shard coverage/);
  for (const [key, value] of Object.entries({sha: 'b'.repeat(40), runId: '122', runAttempt: '1', mode: 'ci'})) {
    const wrong = receipts();
    wrong[0][key] = value;
    assert.throws(() => verifyResults(needs, wrong, releaseIdentity), /mismatch/);
  }
  for (const [key, value] of [['container', ['default']], ['host', ['default']]]) {
    const wrong = receipts();
    wrong[0][key] = value;
    assert.throws(() => verifyResults(needs, wrong, releaseIdentity), /version coverage/);
  }
  assert.throws(() => verifyResults(needs, receipts(), {...releaseIdentity, runId: ''}), /run/);
});


test('CI and release use the same non-publishing shard runner and release cannot bypass verification', () => {
  const {parse} = createRequire(new URL('../packages/hhc-web-client/package.json', import.meta.url))('yaml');
  const workflow = name => parse(readFileSync(new URL(`../.github/workflows/${name}.yml`, import.meta.url), 'utf8'));
  const ci = workflow('ci');
  const release = workflow('release');
  const runner = workflow('renderer');
  assert.deepEqual(release.on, {push: {tags: ['v*']}});
  for (const [mode, caller] of [['ci', ci], ['release', release]]) {
    assert.deepEqual(caller.permissions, {contents: 'read', actions: 'read'});
    assert.equal(caller.jobs.renderer.uses, './.github/workflows/renderer.yml');
    assert.equal(caller.jobs.renderer.with.mode, mode);
    assert.deepEqual(caller.jobs.renderer.needs, mode === 'ci' ? ['agent_docs', 'prepare'] : 'prepare');
    assert.deepEqual(caller.jobs.verify.needs, mode === 'ci' ? ['agent_docs', 'prepare', 'renderer', 'release-verification'] : ['prepare', 'renderer']);
    assert.equal(caller.jobs.verify.if, '${{ always() }}');
    assert.equal(caller.jobs.renderer.secrets, undefined);
    const receiptsDownload = caller.jobs.verify.steps.find(step => step.uses?.startsWith('actions/download-artifact@'));
    assert.ok(![true, 'true'].includes(receiptsDownload.with['merge-multiple']), 'receipt artifacts must not overwrite one another');
    for (const [name, job] of Object.entries(caller.jobs)) {
      if (name !== 'publish') assert.notEqual(job.permissions?.packages, 'write');
    }
  }
  assert.deepEqual(release.jobs.publish.needs, ['prepare', 'verify']);
  assert.equal(release.jobs.publish.if, undefined);
  assert.deepEqual(release.jobs.publish.permissions, {contents: 'read', packages: 'write', actions: 'read'});
  assert.deepEqual(runner.permissions, {contents: 'read'});
  assert.equal(runner.on.workflow_call.secrets, undefined);
  assert.equal(runner.jobs.renderer.strategy['fail-fast'], false);
  assert.equal(runner.jobs.renderer.strategy['max-parallel'], 3);
  assert.equal(runner.jobs.renderer.permissions?.packages, undefined);
});


test('release execution records receipts only after every container command succeeds', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'renderer-release-'));
  try {
    const docker = join(directory, 'docker');
    await writeFile(docker, `#!${process.execPath}
import {appendFileSync} from 'node:fs';
appendFileSync(process.env.COMMAND_LOG, JSON.stringify(process.argv.slice(2)) + '\\n');
if (process.env.FAIL_RENDERER === '1') process.exit(7);
`);
    await chmod(docker, 0o755);
    const env = {...process.env, PATH: `${directory}:${process.env.PATH}`, COMMAND_LOG: join(directory, 'commands'), GITHUB_SHA: sha, GITHUB_RUN_ID: '123', GITHUB_RUN_ATTEMPT: '2', HHC_BULLETIN_TEMPLATE_DIR: directory};
    delete env.NODE_TEST_CONTEXT;
    const script = new URL('./ci-bulletin-renderer.mjs', import.meta.url).pathname;
    const failed = spawnSync(process.execPath, [script, 'run', 'balanced-b', 'results', 'release'], {cwd: directory, encoding: 'utf8', env: {...env, FAIL_RENDERER: '1'}});
    assert.notEqual(failed.status, 0);
    assert.match(failed.stdout, /container renderer v10/);
    assert.doesNotMatch(failed.stdout, /container renderer v5/);
    assert.equal(existsSync(join(directory, 'results')), false);
    await rm(env.COMMAND_LOG);
    for (const shard of Object.keys(shards)) {
      const completed = spawnSync(process.execPath, [script, 'run', shard, join('results', shard), 'release'], {cwd: directory, encoding: 'utf8', env});
      assert.equal(completed.status, 0, completed.stderr);
    }
    const commands = (await readFile(env.COMMAND_LOG, 'utf8')).trim().split('\n').map(line => JSON.parse(line));
    assert.equal(commands.length, 9);
    const gate = spawnSync(process.execPath, [script, 'verify-results', 'results', 'release'], {cwd: directory, encoding: 'utf8', env: {...env, CI_NEEDS: JSON.stringify(needs)}});
    assert.equal(gate.status, 0, gate.stderr);
    await mkdir(join(directory, 'results', 'duplicate-artifact'));
    await writeFile(join(directory, 'results', 'duplicate-artifact', 'balanced-a.json'), await readFile(join(directory, 'results', 'balanced-a', 'balanced-a.json')));
    const duplicate = spawnSync(process.execPath, [script, 'verify-results', 'results', 'release'], {cwd: directory, encoding: 'utf8', env: {...env, CI_NEEDS: JSON.stringify(needs)}});
    assert.notEqual(duplicate.status, 0);
    assert.match(duplicate.stderr, /duplicate shard coverage/);
  } finally {await rm(directory, {recursive: true, force: true});}
});

test('both shard and publisher restore reject either corrupted tar before extracting or loading', async () => {
  const {parse} = createRequire(new URL('../packages/hhc-web-client/package.json', import.meta.url))('yaml');
  const workflows = ['renderer', 'release'].map(name => parse(readFileSync(new URL(`../.github/workflows/${name}.yml`, import.meta.url), 'utf8')));
  for (const [index, workflow] of workflows.entries()) for (const corrupted of ['workspace', 'image']) {
    const directory = await mkdtemp(join(tmpdir(), 'renderer-restore-'));
    try {
      const inputs = join(directory, 'renderer-inputs');
      await mkdir(inputs);
      const workspace = join(inputs, 'renderer-workspace.tar');
      const image = join(inputs, 'renderer-image.tar');
      await writeFile(workspace, 'unextracted workspace');
      await writeFile(image, 'unloaded image');
      const digest = file => createHash('sha256').update(readFileSync(file)).digest('hex');
      if (process.platform === 'darwin') {
        await writeFile(join(directory, 'sha256sum'), '#!/bin/sh\nexec shasum -a 256 "$@"\n');
        await chmod(join(directory, 'sha256sum'), 0o755);
      }
      const marker = join(directory, 'extracted-or-loaded');
      for (const command of ['tar', 'docker']) {
        await writeFile(join(directory, command), '#!/bin/sh\ntouch "$RESTORE_MARKER"\nexit 1\n');
        await chmod(join(directory, command), 0o755);
      }
      const env = {...process.env, PATH: `${directory}:${process.env.PATH}`, RUNNER_TEMP: directory, WORKSPACE_SHA: digest(workspace), IMAGE_SHA: digest(image), RESTORE_MARKER: marker};
      await writeFile(corrupted === 'workspace' ? workspace : image, 'corrupted');
      const job = index === 0 ? workflow.jobs.renderer : workflow.jobs.publish;
      const restore = job.steps.find(step => step.name === 'Verify and restore the prepared workspace and image');
      const result = spawnSync('bash', ['-e', '-o', 'pipefail', '-c', restore.run], {cwd: directory, encoding: 'utf8', env});
      assert.notEqual(result.status, 0);
      assert.match(result.stdout + result.stderr, /FAILED/);
      assert.equal(existsSync(marker), false, 'restore reached extraction or image loading');
    } finally {await rm(directory, {recursive: true, force: true});}
  }
});
