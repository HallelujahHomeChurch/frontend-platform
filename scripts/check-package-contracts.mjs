import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

const packageRoot = new URL('../packages/', import.meta.url)
const rootManifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
const packageDirs = (await readdir(packageRoot, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort()

assert.equal(packageDirs.length, 4, 'expected four frontend packages')

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

console.log(`Package contracts pass (${packageDirs.length} packages checked).`)

function collectExportTargets(value) {
  if (typeof value === 'string') return [value]
  if (!value || typeof value !== 'object') return []
  return Object.values(value).flatMap(collectExportTargets)
}
