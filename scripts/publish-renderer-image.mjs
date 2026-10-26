import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {appendFile, mkdir, writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const repository = 'hallelujahhomechurch/hhc-bulletin-renderer';
const registryImage = `ghcr.io/${repository}`;
const sha256 = /^sha256:[a-f0-9]{64}$/;
const mediaTypes = ['application/vnd.docker.distribution.manifest.v2+json', 'application/vnd.oci.image.manifest.v1+json'];

export function validateManifest(bytes, headerDigest, expectedConfig) {
  assert.match(headerDigest ?? '', sha256, 'registry manifest digest unavailable');
  assert.equal(`sha256:${createHash('sha256').update(bytes).digest('hex')}`, headerDigest, 'registry manifest digest mismatch');
  const manifest = JSON.parse(bytes);
  assert.equal(manifest.schemaVersion, 2, 'unsupported registry manifest schema');
  assert.ok(mediaTypes.includes(manifest.mediaType), 'unsupported registry manifest type');
  assert.equal(manifest.config?.digest, expectedConfig, 'published renderer differs from verified image');
  assert.ok(Array.isArray(manifest.layers) && manifest.layers.length > 0, 'registry layers missing');
  for (const layer of manifest.layers) assert.match(layer.digest ?? '', sha256, 'invalid registry layer digest');
  return `${registryImage}@${headerDigest}`;
}

export function ghcrClient({actor, token, fetcher = fetch}) {
  let bearer;
  async function request(url, authorization) {
    const response = await fetcher(url, {headers: {Authorization: authorization, Accept: mediaTypes.join(', ')},
      redirect: 'error', signal: AbortSignal.timeout(30_000)});
    return response;
  }
  return {
    async lookup(tag, config) {
      assert.match(tag, /^[a-f0-9]{64}-[a-f0-9]{40}$/);
      assert.match(config, sha256);
      if (!bearer) {
        assert.ok(actor && token, 'registry credentials unavailable');
        const url = `https://ghcr.io/token?service=ghcr.io&scope=repository:${repository}:pull`;
        const response = await request(url, `Basic ${Buffer.from(`${actor}:${token}`).toString('base64')}`);
        assert.equal(response.status, 200, 'registry authentication unavailable');
        const value = await response.json();
        assert.ok(typeof value.token === 'string' && value.token.length > 0, 'registry token unavailable');
        bearer = value.token;
      }
      const response = await request(`https://ghcr.io/v2/${repository}/manifests/${tag}`, `Bearer ${bearer}`);
      if (response.status === 404) {
        const body = await response.json();
        assert.ok(Array.isArray(body.errors) && body.errors.length > 0 && body.errors.every(error => error.code === 'MANIFEST_UNKNOWN'), 'registry absence not confirmed');
        return null;
      }
      assert.equal(response.status, 200, 'registry lookup unavailable');
      const bytes = Buffer.from(await response.arrayBuffer());
      assert.ok(bytes.length <= 1024 * 1024, 'registry manifest exceeds limit');
      return validateManifest(bytes, response.headers.get('Docker-Content-Digest'), config);
    },
  };
}

export async function reconcileImage({tag, config}, registry, publish) {
  const existing = await registry.lookup(tag, config);
  if (existing) return {image: existing, retained: true};
  try { await publish(`${registryImage}:${tag}`); } catch { /* Read back an ambiguous acknowledgement; never replay blindly. */ }
  const image = await registry.lookup(tag, config);
  assert.ok(image, 'renderer publication not verified');
  return {image, retained: false};
}

function docker(args, input) {
  const result = spawnSync('docker', args, {encoding: 'utf8', input, timeout: 300_000, maxBuffer: 1024 * 1024});
  assert.ok(!result.error && !result.signal && result.status === 0, 'renderer registry command failed');
  return result.stdout.trim();
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const {BULLETIN_RENDERER_V11_DIGEST: hash} = await import('../packages/ui/dist/bulletin-reader/v11/artifact.js');
    const head = process.env.GITHUB_SHA;
    assert.match(hash, /^[a-f0-9]{64}$/);
    assert.match(head ?? '', /^[a-f0-9]{40}$/);
    const inspected = JSON.parse(docker(['image', 'inspect', 'hhc-bulletin-renderer:verify']))[0];
    assert.equal(inspected.Os, 'linux');
    assert.equal(inspected.Architecture, 'amd64');
    const config = inspected.Id;
    assert.match(config, sha256);
    const tag = `${hash}-${head}`;
    const result = await reconcileImage({tag, config}, ghcrClient({actor: process.env.GITHUB_ACTOR, token: process.env.GH_TOKEN}), async image => {
      docker(['login', 'ghcr.io', '-u', process.env.GITHUB_ACTOR, '--password-stdin'], process.env.GH_TOKEN);
      docker(['tag', 'hhc-bulletin-renderer:verify', image]);
      docker(['push', image]);
    });
    await mkdir('artifacts/release-evidence', {recursive: true});
    await writeFile('artifacts/release-evidence/image.json', JSON.stringify({schema: 1, head, tag, config, ...result}));
    await appendFile(process.env.GITHUB_ENV, `PUBLISHED_RENDERER_IMAGE=${result.image}\n`);
    console.log(`Renderer image verified (${result.retained ? 'retained' : 'published'}).`);
  } catch {
    // Never print registry response bodies, credentials or child-process details.
    console.error('Renderer image publication could not be verified.');
    process.exitCode = 1;
  }
}
