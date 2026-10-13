import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {test} from 'node:test';

const root = resolve(import.meta.dirname, '../..');
const script = 'hhc-web-client/scripts/generate-bulletin-domain.mjs';
const source = 'hhc-web-client/openapi/hhc-web-api.yaml';
const contract = 'ui/openapi/online-bulletin.json';
const output = 'ui/src/bulletin-reader/generated.ts';
const api = {openapi: '3.0.3', info: {title: 'Test', version: '1'}, paths: {}, components: {schemas: {
  OnlineBulletinDocument: {type: 'object', properties: {locale: {$ref: '#/components/schemas/SharedLocale'}, child: {$ref: '#/components/schemas/SharedModel'}}},
  SharedLocale: {type: 'string', enum: ['zh-Hant', 'zh-Hans']},
  SharedModel: {type: 'object', properties: {self: {$ref: '#/components/schemas/SharedModel'}}},
  Unrelated: {type: 'string'},
}}};

async function fixture(t) {
  const dir = await mkdtemp(join(tmpdir(), 'bulletin-domain-'));
  t.after(() => rm(dir, {recursive: true, force: true}));
  for (const path of [script, source, contract, output]) await mkdir(dirname(join(dir, path)), {recursive: true});
  await cp(join(root, script), join(dir, script));
  await symlink(join(root, 'hhc-web-client/node_modules'), join(dir, 'hhc-web-client/node_modules'));
  await writeFile(join(dir, source), JSON.stringify(api));
  const run = (...args) => spawnSync(process.execPath, [join(dir, script), ...args], {encoding: 'utf8'});
  assert.equal(run('--source', join(dir, source)).status, 0);
  return {dir, run};
}

async function bytes(dir) {
  return Promise.all([source, contract, output].map(path => readFile(join(dir, path)).catch(error => error.code)));
}

for (const explicit of [false, true]) test(`check is non-writing with ${explicit ? 'explicit' : 'default'} source`, async t => {
  const {dir, run} = await fixture(t);
  const args = explicit ? ['--source', join(dir, source), '--check'] : ['--check'];
  const before = await bytes(dir);
  assert.equal(run(...args).status, 0);
  assert.deepEqual(await bytes(dir), before);
  const changed = structuredClone(api);
  changed.components.schemas.OnlineBulletinDocument.description = 'Canonical description changed';
  await writeFile(join(dir, source), JSON.stringify(changed));
  const drifted = await bytes(dir);
  assert.notEqual(run(...args).status, 0);
  assert.deepEqual(await bytes(dir), drifted);
});

for (const change of ['relevant-shape', 'missing-reference', 'missing-input', 'stale-json', 'stale-types']) test(`fails closed: ${change}`, async t => {
  const {dir, run} = await fixture(t);
  const changed = structuredClone(api);
  if (change === 'relevant-shape') changed.components.schemas.SharedLocale.enum.push('en');
  if (change === 'missing-reference') delete changed.components.schemas.SharedLocale;
  await writeFile(join(dir, source), JSON.stringify(changed));
  if (change === 'missing-input') await rm(join(dir, source));
  if (change === 'stale-json') await writeFile(join(dir, contract), '{}\n');
  if (change === 'stale-types') await writeFile(join(dir, output), '// stale\n');
  const before = await bytes(dir);
  assert.notEqual(run('--check').status, 0);
  assert.deepEqual(await bytes(dir), before);
});

test('unrelated schema does not drift; shared enums and recursive references remain complete', async t => {
  const {dir, run} = await fixture(t);
  const changed = structuredClone(api);
  changed.components.schemas.Unrelated.description = 'Not bulletin data';
  await writeFile(join(dir, source), JSON.stringify(changed));
  assert.equal(run('--check').status, 0);
  const domain = JSON.parse(await readFile(join(dir, contract), 'utf8'));
  assert.deepEqual(Object.keys(domain.components.schemas).sort(), ['OnlineBulletinDocument', 'SharedLocale', 'SharedModel']);
  assert.deepEqual(domain.components.schemas.SharedLocale, api.components.schemas.SharedLocale);
  assert.deepEqual(domain.components.schemas.SharedModel, api.components.schemas.SharedModel);
});
