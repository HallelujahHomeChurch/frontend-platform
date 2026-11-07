import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile, mkdtemp, mkdir, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {test} from 'node:test';
import {ghcrClient, reconcileImage, validateManifest, verifiedImageConfig} from './publish-renderer-image.mjs';

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

test('registry readback resolves one verified linux amd64 image inside an attested OCI index', async () => {
  const descriptor = {mediaType: manifest.mediaType, digest, size: bytes.length, platform: {os: 'linux', architecture: 'amd64'}};
  const index = {schemaVersion: 2, mediaType: 'application/vnd.oci.image.index.v1+json', manifests: [descriptor,
    {...descriptor, platform: {os: 'unknown', architecture: 'unknown'}, annotations: {'vnd.docker.reference.type': 'attestation-manifest'}}]};
  const requests = [];
  let value = index, child = response;
  const client = ghcrClient({actor: 'actor', token: 'test-token', fetcher: async (url, init) => {
    requests.push({url, init});
    if (url.includes('/token?')) return Response.json({token: 'test-bearer'});
    if (url.endsWith(`/${digest}`)) return child();
    const body = Buffer.from(JSON.stringify(value));
    return new Response(body, {headers: {'Docker-Content-Digest': `sha256:${createHash('sha256').update(body).digest('hex')}`}});
  }});
  assert.equal(await client.lookup(tag, config), image);
  assert.ok(requests.at(-1).url.endsWith(`/manifests/${digest}`));
  assert.ok(requests.every(r => r.init.redirect === 'error' && r.url.startsWith('https://ghcr.io/')));
  for (const manifests of [[], [descriptor, descriptor], [{...descriptor, platform: {os: 'linux', architecture: 'arm64'}}], [{...descriptor, digest: '../other'}], [{...descriptor, size: bytes.length + 1}]]) {
    value = {...index, manifests};
    await assert.rejects(client.lookup(tag, config));
  }
  value = index;
  child = () => new Response(bytes, {headers: {'Docker-Content-Digest': `sha256:${'0'.repeat(64)}`}});
  await assert.rejects(client.lookup(tag, config));
  child = response;
  await assert.rejects(client.lookup(tag, `sha256:${'0'.repeat(64)}`), /differs/);
});

// Docker's containerd store reports an index/manifest ID, not the config digest.
test('verified archive config remains the identity when inspect returns an index ID', async t => {
  const root = await mkdtemp(join(tmpdir(), 'renderer-config-'));
  t.after(() => rm(root, {recursive: true, force: true}));
  const content = Buffer.from(JSON.stringify({os: 'linux', architecture: 'amd64', rootfs: {type: 'layers', diff_ids: []}}));
  const hash = createHash('sha256').update(content).digest('hex');
  await mkdir(join(root, 'blobs/sha256'), {recursive: true});
  await writeFile(join(root, 'blobs/sha256', hash), content);
  await writeFile(join(root, 'manifest.json'), JSON.stringify([{Config: `blobs/sha256/${hash}`, RepoTags: ['hhc-bulletin-renderer:verify'], Layers: []}]));
  const archive = join(root, 'image.tar');
  execFileSync('tar', ['-cf', archive, '-C', root, 'manifest.json', 'blobs']);
  for (const Id of [config, `sha256:${hash}`]) {
    assert.equal(verifiedImageConfig({Os: 'linux', Architecture: 'amd64', Id}, archive), `sha256:${hash}`);
  }
});

test('archive identity rejects ambiguous tags, wrong platform and corrupt config bytes', async t => {
  const root = await mkdtemp(join(tmpdir(), 'renderer-config-invalid-'));
  t.after(() => rm(root, {recursive: true, force: true}));
  const inspected = {Os: 'linux', Architecture: 'amd64', Id: config};
  const content = Buffer.from(JSON.stringify({os: 'linux', architecture: 'amd64'}));
  const hash = createHash('sha256').update(content).digest('hex');
  const file = `${hash}.json`;
  const entry = {Config: file, RepoTags: ['hhc-bulletin-renderer:verify'], Layers: []};
  const archive = join(root, 'image.tar');
  async function pack(entries, bytes = content) {
    await writeFile(join(root, file), bytes);
    await writeFile(join(root, 'manifest.json'), JSON.stringify(entries));
    execFileSync('tar', ['-cf', archive, '-C', root, 'manifest.json', file]);
  }
  await pack([entry]);
  assert.equal(verifiedImageConfig(inspected, archive), `sha256:${hash}`);
  assert.throws(() => verifiedImageConfig({...inspected, Architecture: 'arm64'}, archive));
  for (const entries of [[], [entry, entry], [{...entry, RepoTags: ['other:verify']}], [{...entry, Config: '../secret'}]]) {
    await pack(entries);
    assert.throws(() => verifiedImageConfig(inspected, archive));
  }
  await pack([entry], Buffer.from('corrupt'));
  assert.throws(() => verifiedImageConfig(inspected, archive), /digest mismatch/);
  assert.throws(() => verifiedImageConfig(inspected, join(root, 'missing.tar')), /unavailable/);
});
