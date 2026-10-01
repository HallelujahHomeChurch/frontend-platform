import {createHash} from 'node:crypto';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {basename, resolve} from 'node:path';

// Public code-owned assets from one immutable producer commit, never document URLs.
const source = 'https://raw.githubusercontent.com/HallelujahHomeChurch/hhc-web/0e072c34ad522b98dc4b68c162412885530f6975/public';
const assets = JSON.parse(await readFile(new URL('../packages/ui/src/bulletin-reader/template-assets.json', import.meta.url), 'utf8'));
for (const url of new Set(assets.map(asset => asset.licenseUrl).filter(Boolean))) {
  const match = url.match(/-([0-9a-f]{64})\.txt$/);
  if (!match) throw new Error('unversioned_font_license');
  assets.push({url, sha256: match[1]});
}
const directory = process.argv[2];
if (!directory) throw new Error('Explicit output directory required');
await mkdir(directory, {recursive: true});
for (const asset of assets) {
  const response = await fetch(source + asset.url, {signal: AbortSignal.timeout(30000)});
  if (!response.ok || Number(response.headers.get('content-length')) > 6 * 1024 * 1024) throw new Error('template_asset_unavailable');
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > 6 * 1024 * 1024 || (asset.sizeBytes !== undefined && bytes.length !== asset.sizeBytes) || createHash('sha256').update(bytes).digest('hex') !== asset.sha256) throw new Error('template_asset_checksum');
  await writeFile(resolve(directory, basename(asset.url)), bytes);
}
console.log('Verified all immutable bulletin template assets.');
