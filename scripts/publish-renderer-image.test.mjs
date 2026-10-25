import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import {ghcrClient, reconcileImage, validateManifest} from './publish-renderer-image.mjs';

const config = `sha256:${'a'.repeat(64)}`;
const tag = `${'b'.repeat(64)}-${'c'.repeat(40)}`;
const manifest = {schemaVersion: 2, mediaType: 'application/vnd.docker.distribution.manifest.v2+json', config: {digest: config}, layers: [{digest: `sha256:${'d'.repeat(64)}`}]};
const bytes = Buffer.from(JSON.stringify(manifest));
const digest = `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const image = `ghcr.io/hallelujahhomechurch/hhc-bulletin-renderer@${digest}`;
const response = () => new Response(bytes, {headers: {'Docker-Content-Digest': digest}});

test('manifest readback binds registry bytes and config to the verified image', () => {
  assert.equal(validateManifest(bytes, digest, config), image);
  assert.throws(() => validateManifest(bytes, `sha256:${'0'.repeat(64)}`, config), /digest mismatch/);
  assert.throws(() => validateManifest(bytes, digest, `sha256:${'0'.repeat(64)}`), /differs/);
  const index = Buffer.from(JSON.stringify({...manifest, mediaType: 'application/vnd.oci.image.index.v1+json'}));
  assert.throws(() => validateManifest(index, `sha256:${createHash('sha256').update(index).digest('hex')}`, config), /unsupported/);
});

test('matching tag is retained and an absent tag is published exactly once then read back', async () => {
  let writes = 0, reads = 0;
  const publish = async () => { writes++; };
  assert.deepEqual(await reconcileImage({tag, config}, {lookup: async () => image}, publish), {image, retained: true});
  assert.equal(writes, 0);
  assert.deepEqual(await reconcileImage({tag, config}, {lookup: async () => ++reads === 1 ? null : image}, publish), {image, retained: false});
  assert.equal(writes, 1);
  assert.equal(reads, 2);
});

test('unknown or conflicting preflight prevents writes; ambiguous acknowledgement needs exact readback', async () => {
  let writes = 0;
  const publish = async () => {writes++; throw new Error('lost acknowledgement');};
  await assert.rejects(reconcileImage({tag, config}, {lookup: async () => {throw new Error('conflict');}}, publish), /conflict/);
  assert.equal(writes, 0);
  let reads = 0;
  assert.equal((await reconcileImage({tag, config}, {lookup: async () => ++reads === 1 ? null : image}, publish)).image, image);
  assert.equal(writes, 1);
  await assert.rejects(reconcileImage({tag, config}, {lookup: async () => null}, async () => {}), /not verified/);
});

test('registry auth is pinned, no redirects, and only explicit manifest absence permits publication', async () => {
  const requests = [];
  let reply = response;
  const client = ghcrClient({actor: 'actor', token: 'test-token', fetcher: async (url, init) => {
    requests.push({url, init});
    return url.includes('/token?') ? Response.json({token: 'test-bearer'}) : reply();
  }});
  assert.equal(await client.lookup(tag, config), image);
  assert.ok(requests.every(r => r.url.startsWith('https://ghcr.io/') && r.init.redirect === 'error' && r.init.signal));
  assert.equal(requests[1].init.headers.Authorization, 'Bearer test-bearer');
  reply = () => Response.json({errors: [{code: 'MANIFEST_UNKNOWN'}]}, {status: 404});
  assert.equal(await client.lookup(tag, config), null);
  for (const [status, body] of [[401, {}], [503, {}], [404, {}], [404, {errors: [{code: 'DENIED'}]}]]) {
    reply = () => Response.json(body, {status});
    await assert.rejects(client.lookup(tag, config));
  }
  await assert.rejects(client.lookup('other-repository', config));
});

test('release image publisher and checkpoint remain behind verified inputs and use explicit readback', async () => {
  const release = await readFile(new URL('../.github/workflows/release.yml', import.meta.url), 'utf8');
  assert.match(release, /group: frontend-platform-release\n  cancel-in-progress: false/);
  assert.match(release, /needs: \[prepare, verify\]/);
  assert.ok(release.indexOf('Verify and restore the prepared workspace and image') < release.indexOf('run: node scripts/publish-renderer-image.mjs'));
  assert.ok(release.indexOf('run: node scripts/publish-renderer-image.mjs') < release.indexOf('Seal successfully published release evidence'));
  assert.doesNotMatch(release, /RepoDigests/);
});
