import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdir, readFile, readdir, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

// Balance complete suites by measured CI time; keep the same three runners.
export const shards = {
  'balanced-a': {host: ['v10', 'default'], container: ['v7', 'v6', 'v3']},
  'balanced-b': {host: ['v8', 'v6'], container: ['v10', 'v5', 'v4']},
  'balanced-c': {host: ['v7', 'v9'], container: ['v8', 'v9', 'default']},
};

export function rendererCommands(shard, mode = 'ci') {
  assert.ok(['ci', 'release'].includes(mode), 'unknown renderer mode');
  assert.ok(Object.hasOwn(shards, shard), 'unknown renderer shard');
  return Object.entries(shards[shard]).filter(([runtime]) => mode === 'ci' || runtime === 'container').flatMap(([runtime, versions]) => versions.map(version => {
    const files = ['scripts/measure-bulletin-layout.test.mjs'];
    if (version === 'v7') files.push('scripts/measure-bulletin-layout-v6.test.mjs');
    const modern = !['default', 'v3', 'v4', 'v5'].includes(version);
    if (modern) files.push(`scripts/measure-bulletin-layout-${version}.test.mjs`);
    const env = version === 'default' ? {} : {[`HHC_TEST_RENDERER_${version.toUpperCase()}`]: '1'};
    const testArgs = ['--test', ...(modern ? ['--test-concurrency=1'] : [])];
    const args = runtime === 'host' ? [...testArgs, ...files] : [
      'run', '--rm', '--network', 'none', '--read-only', '--memory', '2g', '--cpus', '1',
      '--tmpfs', '/tmp:rw,noexec,nosuid,size=128m',
      '-e', 'HHC_BULLETIN_TEMPLATE_DIR=/opt/bulletin-renderer/assets',
      ...Object.entries(env).flatMap(([key, value]) => ['-e', `${key}=${value}`]),
      ...[...files, 'scripts/testdata'].flatMap(file => ['--mount', `type=bind,src=${process.cwd()}/${file},dst=/opt/bulletin-renderer/${file},readonly`]),
      '--entrypoint', 'node', 'hhc-bulletin-renderer:verify', ...testArgs,
      ...files.map(file => `/opt/bulletin-renderer/${file}`),
    ];
    return {runtime, version, files, args, env};
  }));
}

function verifyIdentity({sha, runId, runAttempt, mode}) {
  assert.match(sha ?? '', /^[a-f0-9]{40}$/, 'missing renderer commit');
  assert.match(runId ?? '', /^[1-9][0-9]*$/, 'missing renderer run');
  assert.match(runAttempt ?? '', /^[1-9][0-9]*$/, 'missing renderer run attempt');
  assert.ok(['ci', 'release'].includes(mode), 'unknown renderer mode');
}

export function verifyResults(needs, results, identity) {
  verifyIdentity(identity);
  assert.deepEqual(Object.keys(needs).sort(), ['prepare', 'renderer'], 'unexpected CI dependencies');
  for (const [job, {result}] of Object.entries(needs)) assert.equal(result, 'success', `${job} did not succeed: ${result}`);
  assert.deepEqual(results.map(result => result.shard).sort(), Object.keys(shards).sort(), 'incomplete or duplicate shard coverage');
  for (const result of results) {
    assert.equal(result.sha, identity.sha, 'renderer commit mismatch');
    for (const key of ['runId', 'runAttempt', 'mode']) assert.equal(result[key], identity[key], `renderer ${key} mismatch`);
    const {host, container} = shards[result.shard];
    assert.deepEqual({host: result.host, container: result.container}, {host: identity.mode === 'release' ? [] : host, container}, `renderer version coverage mismatch: ${result.shard}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [action, shardOrDirectory, resultsDirectory, runMode = 'ci'] = process.argv.slice(2);
  const mode = action === 'verify-results' ? resultsDirectory ?? 'ci' : runMode;
  const identity = {sha: process.env.GITHUB_SHA, runId: process.env.GITHUB_RUN_ID, runAttempt: process.env.GITHUB_RUN_ATTEMPT, mode};
  if (action === 'matrix') console.log(JSON.stringify({shard: Object.keys(shards)}));
  else if (action === 'run') {
    assert.ok(resultsDirectory, 'results directory is required');
    assert.ok(process.env.HHC_BULLETIN_TEMPLATE_DIR, 'verified template assets are required');
    verifyIdentity(identity);
    const env = {...process.env};
    for (let version = 3; version <= 10; version++) delete env[`HHC_TEST_RENDERER_V${version}`];
    for (const {runtime, version, args, env: versionEnv} of rendererCommands(shardOrDirectory, mode)) {
      console.log(`::group::${runtime} renderer ${version}`);
      execFileSync(runtime === 'host' ? process.execPath : 'docker', args, {stdio: 'inherit', env: {...env, ...versionEnv}});
      console.log('::endgroup::');
    }
    await mkdir(resultsDirectory, {recursive: true});
    await writeFile(resolve(resultsDirectory, `${shardOrDirectory}.json`), JSON.stringify({...identity, shard: shardOrDirectory, ...shards[shardOrDirectory], ...(mode === 'release' ? {host: []} : {})}));
  } else if (action === 'verify-results') {
    const files = await readdir(shardOrDirectory, {recursive: true, withFileTypes: true});
    const results = await Promise.all(files.filter(file => file.isFile()).map(async file => JSON.parse(await readFile(resolve(file.parentPath, file.name), 'utf8'))));
    verifyResults(JSON.parse(process.env.CI_NEEDS), results, identity);
  } else throw new Error('usage: ci-bulletin-renderer.mjs matrix | run SHARD RESULTS_DIRECTORY [ci|release] | verify-results RESULTS_DIRECTORY [ci|release]');
}
