import {createPlan, universe} from './renderer-selection.mjs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {existsSync, readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {chmod, mkdir, mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {rendererCommands, rendererMatrix, shards, verifyResults} from './ci-bulletin-renderer.mjs';

const common = 'scripts/measure-bulletin-layout.test.mjs';
const coverage = {
  host: {default: [common], v6: [common, 'scripts/measure-bulletin-layout-v6.test.mjs'], v7: [common, 'scripts/measure-bulletin-layout-v6.test.mjs', 'scripts/measure-bulletin-layout-v7.test.mjs'], v8: [common, 'scripts/measure-bulletin-layout-v8.test.mjs'], v9: [common, 'scripts/measure-bulletin-layout-v9.test.mjs'], v10: [common, 'scripts/measure-bulletin-layout-v10.test.mjs'], v11: [common, 'scripts/measure-bulletin-layout-v11.test.mjs', 'scripts/compose-body-v11.test.mjs']},
  container: {default: [common], v3: [common], v4: [common], v5: [common], v6: [common, 'scripts/measure-bulletin-layout-v6.test.mjs'], v7: [common, 'scripts/measure-bulletin-layout-v6.test.mjs', 'scripts/measure-bulletin-layout-v7.test.mjs'], v8: [common, 'scripts/measure-bulletin-layout-v8.test.mjs'], v9: [common, 'scripts/measure-bulletin-layout-v9.test.mjs'], v10: [common, 'scripts/measure-bulletin-layout-v10.test.mjs'], v11: [common, 'scripts/measure-bulletin-layout-v11.test.mjs', 'scripts/compose-body-v11.test.mjs']},
};

test('the shards retain every original host and container command exactly once', () => {
  const actual = {host: {}, container: {}};
  for (const shard of Object.values(shards)) {
    assert.ok(shard.host.length <= 1, 'do not serialize multiple host suites');
    assert.equal(shard.container.length, 1, 'one container keeps release shards balanced and nonempty');
  }
  for (const shard of Object.keys(shards)) for (const command of rendererCommands(shard)) {
    const {runtime, version, files, args, env} = command;
    assert.equal(actual[runtime][version], undefined, `duplicate ${runtime}/${version}`);
    actual[runtime][version] = files;
    const concurrency = version === 'default' || ['v3', 'v4', 'v5'].includes(version) ? [] : ['--test-concurrency=1'];
    const versionEnv = version === 'default' ? {} : {[`HHC_TEST_RENDERER_${version.toUpperCase()}`]: '1'};
    assert.deepEqual(env, versionEnv);
    if (runtime === 'host') assert.deepEqual(args, ['--test', ...concurrency, ...files]);
    else {
      assert.deepEqual(args.slice(0, 13), ['run', '--rm', '--network', 'none', '--read-only', '--memory', '2g', '--cpus', '2', '--tmpfs', '/tmp:rw,noexec,nosuid,size=128m', '-e', 'HHC_BULLETIN_TEMPLATE_DIR=/opt/bulletin-renderer/assets']);
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
    assert.doesNotMatch(result.stdout, /container renderer v4/);
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


test('release shards retain exactly all original and V11 container commands and no host commands', () => {
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


test('immutable mutation validation remains required for code and skipped only for proven docs', () => {
  const {parse} = createRequire(new URL('../packages/hhc-web-client/package.json', import.meta.url))('yaml');
  const ci = parse(readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8'));
  assert.deepEqual(ci.jobs.immutable.needs, ['agent_docs', 'prepare']);
  assert.equal(ci.jobs.immutable.steps.filter(step => step.run?.includes('pnpm build')).length, 0);
  assert.equal(ci.jobs.prepare.steps.filter(step => step.run === 'corepack pnpm build').length, 1);
  assert.equal(ci.jobs.prepare.steps.filter(step => step.run === 'node --test scripts/verify-bulletin-renderer.test.mjs').length, 1);
  const steps = ci.jobs.prepare.steps;
  const build = steps.findIndex(step => step.run === 'corepack pnpm build');
  const mutation = steps.findIndex(step => step.run === 'node --test scripts/verify-bulletin-renderer.test.mjs');
  const bundle = steps.findIndex(step => step.id === 'bundle');
  assert.ok(build < mutation && mutation < bundle);
  assert.equal(steps[mutation].if, undefined);
  assert.equal(steps[mutation]['continue-on-error'], undefined);
  assert.match(ci.jobs.immutable.if, /always\(\)/);
  const prepareGate = ci.jobs.immutable.steps[0].run;
  for (const result of ['success', 'failure', 'cancelled', 'skipped', '']) {
    const check = spawnSync('bash', ['-e', '-c', prepareGate], {env: {...process.env, PREPARE_RESULT: result}});
    assert.equal(check.status === 0, result === 'success');
  }
  assert.ok(ci.jobs.prepare.steps.some(step => step.run?.includes('node scripts/verify-bulletin-renderer-v11.mjs --base-ref origin/main')));
  const gate = ci.jobs.verify.steps.find(step => step.name === 'Require a proven classification').run;
  const execute = (docs, immutable, classification = 'success') => {
    const values = {'needs.agent_docs.result': classification, 'needs.agent_docs.outputs.docs_only': docs,
      'needs.immutable.result': immutable, 'needs.prepare.result': docs === 'true' ? 'skipped' : 'success',
      'needs.renderer.result': docs === 'true' ? 'skipped' : 'success'};
    const run = gate.replace(/\$\{\{ (.*?) \}\}/g, (_, key) => values[key] ?? '');
    return spawnSync('bash', ['-e', '-c', run]).status;
  };
  assert.equal(execute('false', 'success'), 0);
  for (const result of ['failure', 'cancelled', 'skipped', '']) assert.notEqual(execute('false', result), 0);
  assert.equal(execute('true', 'skipped'), 0);
  assert.notEqual(execute('true', 'success'), 0);
  assert.notEqual(execute('true', 'skipped', 'failure'), 0);
});


test('CI and release use the same non-publishing shard runner and release cannot bypass verification', () => {
  const {parse} = createRequire(new URL('../packages/hhc-web-client/package.json', import.meta.url))('yaml');
  const workflow = name => parse(readFileSync(new URL(`../.github/workflows/${name}.yml`, import.meta.url), 'utf8'));
  const ci = workflow('ci');
  const release = workflow('release');
  const runner = workflow('renderer');
  for (const job of ['prepare', 'renderer']) assert.match(ci.jobs[job].if, /!cancelled\(\)/, 'superseded PRs must stop expensive jobs');
  assert.deepEqual(release.on, {push: {tags: ['v*']}});
  for (const [mode, caller] of [['ci', ci], ['release', release]]) {
    assert.deepEqual(caller.permissions, {contents: 'read', actions: 'read'});
    assert.equal(caller.jobs.renderer.uses, './.github/workflows/renderer.yml');
    assert.equal(caller.jobs.renderer.with.mode, mode);
    assert.deepEqual(caller.jobs.renderer.needs, mode === 'ci' ? ['agent_docs', 'prepare'] : 'prepare');
    assert.deepEqual(caller.jobs.verify.needs, mode === 'ci' ? ['agent_docs', 'immutable', 'prepare', 'renderer'] : ['prepare', 'renderer']);
    assert.equal(caller.jobs.verify.if, '${{ always() }}');
    assert.equal(caller.jobs.renderer.secrets, undefined);
    const receiptsDownload = caller.jobs.verify.steps.find(step => step.uses?.startsWith('actions/download-artifact@'));
    assert.ok(![true, 'true'].includes(receiptsDownload.with['merge-multiple']), 'receipt artifacts must not overwrite one another');
    for (const [name, job] of Object.entries(caller.jobs)) {
      if (name !== 'publish') assert.notEqual(job.permissions?.packages, 'write');
    }
  }
  assert.equal(ci.jobs['release-verification'], undefined, 'release checks must reuse prepared runners');
  assert.equal(ci.jobs.renderer.with['verify-release'], "${{ github.event_name == 'pull_request' && needs.prepare.outputs.verify-release == 'true' }}");
  assert.equal(release.jobs.renderer.with['verify-release'], undefined);
  const extra = runner.jobs.renderer.steps.find(step => step.name === 'Verify release mode on the same prepared shard');
  assert.equal(extra.if, "inputs.mode == 'ci' && inputs.verify-release");
  assert.equal(extra.env.RENDERER_PLAN, 'artifacts/renderer-selection/release-check.json');
  assert.match(extra.run, /release-results release/);
  const extraUpload = runner.jobs.renderer.steps.find(step => step.with?.name?.startsWith('renderer-result-release-check-'));
  assert.equal(extraUpload.if, extra.if);
  assert.equal(extraUpload.with.path, 'release-results/*.json');
  assert.equal(extraUpload.with['if-no-files-found'], 'error');
  const extraGate = ci.jobs.verify.steps.find(step => step.name === 'Require actual release-mode verification without publication');
  assert.equal(extraGate.env.RENDERER_PLAN, extra.env.RENDERER_PLAN);
  assert.match(extraGate.env.CI_NEEDS, /toJSON\(needs.renderer\)/);
  assert.match(extraGate.run, /verify-results release-results release$/);
  assert.deepEqual(release.jobs.publish.needs, ['prepare', 'verify']);
  assert.equal(release.jobs.publish.if, undefined);
  assert.deepEqual(release.jobs.publish.permissions, {contents: 'read', packages: 'write', actions: 'read'});
  assert.deepEqual(runner.permissions, {contents: 'read'});
  assert.equal(runner.on.workflow_call.secrets, undefined);
  assert.equal(runner.jobs.renderer.strategy['fail-fast'], false);
  assert.equal(runner.jobs.renderer.strategy['max-parallel'], 10);
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
    assert.doesNotMatch(failed.stdout, /container renderer v9/);
    assert.equal(existsSync(join(directory, 'results')), false);
    await rm(env.COMMAND_LOG);
    for (const shard of Object.keys(shards)) {
      const completed = spawnSync(process.execPath, [script, 'run', shard, join('results', shard), 'release'], {cwd: directory, encoding: 'utf8', env});
      assert.equal(completed.status, 0, completed.stderr);
    }
    const commands = (await readFile(env.COMMAND_LOG, 'utf8')).trim().split('\n').map(line => JSON.parse(line));
    assert.equal(commands.length, 10);
    const gate = spawnSync(process.execPath, [script, 'verify-results', 'results', 'release'], {cwd: directory, encoding: 'utf8', env: {...env, CI_NEEDS: JSON.stringify(needs), RENDERER_VERIFIED_RECEIPTS: 'verified-receipts.json'}});
    assert.equal(gate.status, 0, gate.stderr);
    const bundle = JSON.parse(await readFile(join(directory, 'verified-receipts.json'), 'utf8'));
    assert.equal(bundle.receipts.length, 10);
    assert.equal(bundle.runAttempt, env.GITHUB_RUN_ATTEMPT);
    await rm(join(directory, 'verified-receipts.json'));
    await mkdir(join(directory, 'results', 'duplicate-artifact'));
    await writeFile(join(directory, 'results', 'duplicate-artifact', 'balanced-a.json'), await readFile(join(directory, 'results', 'balanced-a', 'balanced-a.json')));
    const duplicate = spawnSync(process.execPath, [script, 'verify-results', 'results', 'release'], {cwd: directory, encoding: 'utf8', env: {...env, CI_NEEDS: JSON.stringify(needs), RENDERER_VERIFIED_RECEIPTS: 'verified-receipts.json'}});
    assert.notEqual(duplicate.status, 0);
    assert.match(duplicate.stderr, /duplicate shard coverage/);
    assert.equal(existsSync(join(directory, 'verified-receipts.json')), false, 'failed coverage must never authorize publication');
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
      // The network/ZIP provenance layer is exercised by test_restore_release_publication.py.
      // Here its downloaded files are the fixture, and the actual post-download
      // content gate must still stop both tar extraction and Docker loading.
      const contentGate = restore.run.replace('python3 scripts/restore-release-publication.py', ':');
      const result = spawnSync('bash', ['-e', '-o', 'pipefail', '-c', contentGate], {cwd: directory, encoding: 'utf8', env});
      assert.notEqual(result.status, 0);
      assert.match(result.stdout + result.stderr, /FAILED/);
      assert.equal(existsSync(marker), false, 'restore reached extraction or image loading');
    } finally {await rm(directory, {recursive: true, force: true});}
  }
});


test('physical smoke grouping preserves all logical commands and browser requirements', () => {
  const fingerprint = {runtime: 'a'.repeat(64), verification: 'b'.repeat(64)};
  for (const mode of ['ci', 'release']) {
    const fingerprints = Object.fromEntries(universe(mode).map(entry => [entry.id, fingerprint]));
    const plan = createPlan({mode, head: sha, base: sha,
      changes: [{status: 'M', regular: true, path: 'README.md'}], checkpoint: {full: fingerprints}, fingerprints});
    assert.ok(plan.entries.every(entry => entry.tier === 'smoke'));
    const compact = rendererMatrix(mode, plan);
    assert.equal(compact.include.length, 2);
    const members = compact.include.flatMap(group => group.members.split(' '));
    assert.deepEqual(members, Object.keys(shards));
    assert.deepEqual(members.flatMap(name => rendererCommands(name, mode, plan)),
      Object.keys(shards).flatMap(name => rendererCommands(name, mode, plan)));
    assert.ok(compact.include.every(group => group.host === (mode === 'ci')));
    // Wiring verification contains a full release command: never consolidate it.
    assert.equal(rendererMatrix(mode, plan, true).include.length, 10);
    const full = createPlan({mode, head: sha, base: sha, changes: undefined});
    assert.equal(rendererMatrix(mode, full).include.length, 10);
    assert.equal(rendererMatrix(mode).include.length, 10);
    const malformed = structuredClone(plan); malformed.entries.pop();
    assert.throws(() => rendererMatrix(mode, malformed));
    const duplicate = structuredClone(plan); duplicate.entries[1] = duplicate.entries[0];
    assert.throws(() => rendererMatrix(mode, duplicate));
  }
  const matrix = rendererMatrix().include;
  assert.deepEqual(matrix.filter(group => !group.host).map(group => group.shard), ['balanced-c', 'balanced-d', 'balanced-h']);
});

test('browser setup follows scheduled host work and both callers pass verified plans', () => {
  const {parse} = createRequire(new URL('../packages/hhc-web-client/package.json', import.meta.url))('yaml');
  const workflow = name => parse(readFileSync(new URL(`../.github/workflows/${name}.yml`, import.meta.url), 'utf8'));
  const runner = workflow('renderer');
  const install = runner.jobs.renderer.steps.find(step => step.run?.includes('playwright install'));
  assert.equal(install.if, "inputs.mode == 'ci' && matrix.host");
  assert.equal(runner.jobs.renderer['runs-on'], 'ubuntu-24.04');
  assert.equal(install.run, 'corepack pnpm exec playwright install --only-shell chromium');
  for (const mode of ['ci', 'release']) {
    const bundle = workflow(mode).jobs.prepare.steps.find(step => step.id === 'bundle');
    assert.equal(bundle.env.RENDERER_MODE, mode);
    assert.equal(bundle.env.RENDERER_PLAN, `artifacts/renderer-selection/${mode}.json`);
  }
  assert.match(workflow('ci').jobs.prepare.steps.find(step => step.id === 'bundle').env.VERIFY_RELEASE, /steps.selection.outputs.verify-release/);
});


test('a grouped runner stops at its failed member; missing receipts remain rejected', () => {
  const {parse} = createRequire(new URL('../packages/hhc-web-client/package.json', import.meta.url))('yaml');
  const runner = parse(readFileSync(new URL('../.github/workflows/renderer.yml', import.meta.url), 'utf8'));
  for (const name of ['Measure with pinned Chromium and verified producer fonts', 'Verify release mode on the same prepared shard']) {
    const step = runner.jobs.renderer.steps.find(step => step.name === name);
    const run = step.run.replace(/node scripts\/ci-bulletin-renderer.mjs run[^\n]+/, 'printf "%s\\n" "$shard"; test "$shard" != balanced-b');
    const result = spawnSync('bash', ['-e', '-c', run], {encoding: 'utf8', env: {...process.env, RENDERER_SHARDS: 'balanced-a balanced-b balanced-c'}});
    assert.notEqual(result.status, 0);
    assert.deepEqual(result.stdout.trim().split('\n'), ['balanced-a', 'balanced-b']);
  }
  assert.throws(() => verifyResults(needs, results().slice(0, 1), identity), /shard coverage/);
  assert.throws(() => verifyResults(needs, [...results(), results()[0]], identity), /shard coverage/);
});
