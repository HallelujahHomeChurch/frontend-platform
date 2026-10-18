import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdir, readFile, readdir, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

export const shards = {
  legacy: {host: ['default', 'v6'], container: ['default', 'v3', 'v4', 'v5']},
  'v7-v8': {host: ['v7', 'v8'], container: ['v6', 'v7', 'v8']},
  'v9-v10': {host: ['v9', 'v10'], container: ['v9', 'v10']},
};

export function rendererCommands(shard) {
  assert.ok(Object.hasOwn(shards, shard), 'unknown renderer shard');
  return Object.entries(shards[shard]).flatMap(([runtime, versions]) => versions.map(version => {
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

export function verifyResults(needs, results, sha) {
  assert.deepEqual(Object.keys(needs).sort(), ['prepare', 'renderer'], 'unexpected CI dependencies');
  for (const [job, {result}] of Object.entries(needs)) assert.equal(result, 'success', `${job} did not succeed: ${result}`);
  assert.deepEqual(results.map(result => result.shard).sort(), Object.keys(shards).sort(), 'incomplete or duplicate shard coverage');
  for (const {sha: commit, shard, host, container} of results) {
    assert.equal(commit, sha, 'renderer commit mismatch');
    assert.deepEqual({host, container}, shards[shard], `renderer version coverage mismatch: ${shard}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [action, shardOrDirectory, resultsDirectory] = process.argv.slice(2);
  if (action === 'matrix') console.log(JSON.stringify({shard: Object.keys(shards)}));
  else if (action === 'run') {
    assert.ok(resultsDirectory, 'results directory is required');
    assert.ok(process.env.HHC_BULLETIN_TEMPLATE_DIR, 'verified template assets are required');
    const env = {...process.env};
    for (let version = 3; version <= 10; version++) delete env[`HHC_TEST_RENDERER_V${version}`];
    for (const {runtime, version, args, env: versionEnv} of rendererCommands(shardOrDirectory)) {
      console.log(`::group::${runtime} renderer ${version}`);
      execFileSync(runtime === 'host' ? process.execPath : 'docker', args, {stdio: 'inherit', env: {...env, ...versionEnv}});
      console.log('::endgroup::');
    }
    assert.match(process.env.GITHUB_SHA ?? '', /^[a-f0-9]{40}$/, 'missing renderer commit');
    await mkdir(resultsDirectory, {recursive: true});
    await writeFile(resolve(resultsDirectory, `${shardOrDirectory}.json`), JSON.stringify({sha: process.env.GITHUB_SHA, shard: shardOrDirectory, ...shards[shardOrDirectory]}));
  } else if (action === 'verify-results') {
    const files = await readdir(shardOrDirectory);
    const results = await Promise.all(files.map(async file => JSON.parse(await readFile(resolve(shardOrDirectory, file), 'utf8'))));
    verifyResults(JSON.parse(process.env.CI_NEEDS), results, process.env.GITHUB_SHA);
  } else throw new Error('usage: ci-bulletin-renderer.mjs matrix | run SHARD RESULTS_DIRECTORY | verify-results RESULTS_DIRECTORY');
}
