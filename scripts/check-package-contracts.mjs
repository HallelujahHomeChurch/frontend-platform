import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

const packageRoot = new URL('../packages/', import.meta.url)
const rootManifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
const packageDirs = (await readdir(packageRoot, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort()

assert.equal(packageDirs.length, 7, 'expected seven frontend packages')

for (const directory of packageDirs) {
  const manifestPath = new URL(`${directory}/package.json`, packageRoot)
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))

  assert.match(manifest.name, /^@hallelujahhomechurch\//, `${directory}: invalid package scope`)
  assert.equal(manifest.version, rootManifest.version, `${directory}: version must match workspace`)
  assert.notEqual(manifest.private, true, `${directory}: package must be publishable`)
  assert.ok(manifest.files?.includes('dist'), `${directory}: dist must be published`)
  assert.equal(
    manifest.publishConfig?.registry,
    'https://npm.pkg.github.com',
    `${directory}: invalid publish registry`,
  )

  const targets = collectExportTargets(manifest.exports)
  assert.ok(targets.length > 0, `${directory}: exports are required`)
  for (const target of targets) {
    assert.ok(target.startsWith('./dist/'), `${directory}: export must target dist: ${target}`)
  }
}

const accountManifest = JSON.parse(await readFile(new URL('account-client/package.json', packageRoot), 'utf8'))
assert.equal(accountManifest.license, 'MIT', 'account-client must ship under MIT')
assert.equal(accountManifest.dependencies, undefined, 'account-client must remain runtime dependency-free')
assert.ok(accountManifest.exports?.['./admin-access'], 'Admin AuthZ must use an explicit subpath')
assert.equal(accountManifest.exports?.['.']?.adminAccess, undefined, 'package root must remain product-neutral')
await readFile(new URL('account-client/LICENSE', packageRoot), 'utf8')

for (const file of ['index.ts', 'session-client.ts', 'browser-runtime.ts', 'oauth.ts', 'conformance.ts']) {
  const source = await readFile(new URL(`account-client/src/${file}`, packageRoot), 'utf8')
  assert.doesNotMatch(source, /admin-access|operations-client/, `${file}: AuthN must not import domain AuthZ`)
}

const adminAccess = await readFile(new URL('account-client/src/admin-access.ts', packageRoot), 'utf8')
assert.doesNotMatch(adminAccess, /cms:(?:read|write|publish)(?!:)/, 'Admin AuthZ must not accept broad CMS permissions')

const websiteOpenAPI = await readFile(new URL('hhc-web-client/openapi/hhc-web-api.yaml', packageRoot), 'utf8')
assert.doesNotMatch(websiteOpenAPI, /cms:(?:read|write|publish)(?!:)/, 'Website contract must not accept broad CMS permissions')
assert.doesNotMatch(websiteOpenAPI, /\/admin\/operations|\/priv\/meeting-occurrences|^  \/meetings:/m, 'Website contract must not retain Operations routes')


function collectExportTargets(value) {
  if (typeof value === 'string') return [value]
  if (!value || typeof value !== 'object') return []
  return Object.values(value).flatMap(collectExportTargets)
}


const operationsSpec = await readFile(new URL('operations-client/openapi/operations-api.yaml', packageRoot), 'utf8');
for (const action of ['archive', 'restore']) {
  const block = operationsSpec.split(`  /api/operations/manage/org-units/{unitId}/${action}:`)[1].split('\n  /')[0];
  assert.match(block, /deprecated: true/);
  assert.match(block, /'404':/);
  assert.doesNotMatch(block, /'200':/);
  assert.ok(operationsSpec.includes(`${action}: { type: boolean, deprecated: true, enum: [false] }`));
}
assert.ok(operationsSpec.includes('description: Ignored; managed folders and children are always active-only.'));
assert.ok(operationsSpec.includes('IncludeArchived: { name: includeArchived, in: query, schema: { type: boolean, default: false } }'));

console.log(`Package contracts pass (${packageDirs.length} packages checked).`)

const notificationSpec = await readFile(new URL('account-client/openapi/notification-api.yaml', packageRoot), 'utf8');
for (const route of ['/api/notifications/me:', '/api/notifications/me/summary:', '/api/notifications/me/{id}/read:', '/api/notifications/me/read-all:']) {
  assert.ok(notificationSpec.includes(route), `Notification owned contract missing ${route}`);
}
const accountIndex = await readFile(new URL('account-client/src/index.ts', packageRoot), 'utf8');
assert.match(accountIndex, /export \* from '\.\/inbox\.js'/);
const uiIndex = await readFile(new URL('ui/src/index.ts', packageRoot), 'utf8');
assert.match(uiIndex, /export \* from '\.\/notifications\.js'/);
assert.ok(accountManifest.files.includes('openapi'), 'Account package must include owned Notification contract');

// Group business routes stay fixed in the Operations owner, alongside existing Inbox exports.
for (const route of ['/api/operations/me/org-units:', '/api/operations/me/org-join-requests:', '/api/operations/me/org-join-requests/{id}:', '/api/operations/me/org-join-requests/{id}/cancel:', '/api/operations/manage/org-join-requests:', '/api/operations/manage/org-join-requests/{id}:', '/api/operations/manage/org-join-requests/{id}/approve:', '/api/operations/manage/org-join-requests/{id}/reject:']) {
  assert.ok(operationsSpec.includes(route), `Operations owned contract missing ${route}`);
}
const operationsSource = await readFile(new URL('operations-client/src/client.ts', packageRoot), 'utf8');
for (const method of ['listOrgUnitDirectory', 'listOwnOrgJoinRequests', 'listReviewableOrgJoinRequests', 'createOrgJoinRequest', 'getOwnOrgJoinRequest', 'getReviewableOrgJoinRequest', 'cancelOrgJoinRequest', 'approveOrgJoinRequest', 'rejectOrgJoinRequest']) {
  assert.ok(operationsSource.includes(`async ${method}(`), `Operations typed method missing ${method}`);
}
assert.ok(operationsSpec.includes('reviewJoinRequests:'), 'Managed folder keeps additive review entry action');
