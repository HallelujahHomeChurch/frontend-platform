import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

const packageRoot = new URL('../packages/', import.meta.url)
const rootManifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
const packageDirs = (await readdir(packageRoot, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort()

assert.equal(packageDirs.length, 5, 'expected five frontend packages')

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

console.log(`Package contracts pass (${packageDirs.length} packages checked).`)

function collectExportTargets(value) {
  if (typeof value === 'string') return [value]
  if (!value || typeof value !== 'object') return []
  return Object.values(value).flatMap(collectExportTargets)
}
