import {createHash} from 'node:crypto';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {basename, resolve} from 'node:path';

// Public code-owned assets from one immutable producer commit, never document URLs.
const source = 'https://raw.githubusercontent.com/HallelujahHomeChurch/hhc-web/8051753f0b73945080fa3d3d2cca7cd1bcbbcc06/public';
const assets = JSON.parse(await readFile(new URL('../packages/ui/src/bulletin-reader/template-assets.json', import.meta.url), 'utf8'));
const directory = process.argv[2];
if (!directory) throw new Error('Explicit output directory required');
await mkdir(directory, {recursive: true});
for (const asset of assets.filter(asset => asset.kind === 'font')) {
  const response = await fetch(source + asset.url, {signal: AbortSignal.timeout(30000)});
  if (!response.ok || Number(response.headers.get('content-length')) > 6 * 1024 * 1024) throw new Error('template_asset_unavailable');
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length !== asset.sizeBytes || createHash('sha256').update(bytes).digest('hex') !== asset.sha256) throw new Error('template_asset_checksum');
  await writeFile(resolve(directory, basename(asset.url)), bytes);
}
console.log('Verified all immutable bulletin fonts.');
