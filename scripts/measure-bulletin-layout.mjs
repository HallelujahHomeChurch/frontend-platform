import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {basename, resolve} from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {BulletinDocumentRenderer, bulletinBlocks, requireBulletinRenderer} from '../packages/ui/dist/bulletin-reader/BulletinDocumentRenderer.js';
import {measureRenderedBulletin} from '../packages/ui/dist/bulletin-reader/measure.js';

const require = createRequire(new URL('../packages/ui/package.json', import.meta.url));
const {createElement} = require('react');
const {renderToStaticMarkup} = require('react-dom/server');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const assets = JSON.parse(await readFile(new URL('../packages/ui/src/bulletin-reader/template-assets.json', import.meta.url), 'utf8'));
const css = await readFile(new URL('../packages/ui/dist/bulletin-reader/paper.css', import.meta.url), 'utf8');
const coverage = JSON.parse(await readFile(new URL('../packages/ui/src/bulletin-reader/font-coverage.json', import.meta.url), 'utf8'));
const fontPoints = new Map(assets.filter(asset => asset.kind === 'font').map(asset => [asset.sha256, new Set(coverage[asset.sha256].flatMap(([start, end]) => Array.from({length: end - start + 1}, (_, index) => start + index)))]));

/** Exact bytes are the worker submission identity; user-supplied URLs never execute. */
export async function measureBulletinLayout({documentJSON, expectedContentHash, assetsDirectory, timeoutMs = 10000}) {
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1 || timeoutMs > 60000) throw new Error('invalid_timeout');
  if (typeof documentJSON !== 'string' || Buffer.byteLength(documentJSON) > 8 * 1024 * 1024 || hash(documentJSON) !== expectedContentHash) throw new Error('stale_content');
  const document = JSON.parse(documentJSON);
  requireBulletinRenderer(document.layoutManifest);
  const fonts = assets.filter(asset => asset.kind === 'font');
  for (const font of fonts) {
    for (const role of font.roles) {
      if (!document.layoutManifest.assets.some(asset => asset.fontRole === role && asset.url === font.url && asset.sha256 === font.sha256 && asset.kind === 'font')) throw new Error('missing_font');
    }
  }
  if (document.layoutManifest.assets.some(asset => !assets.some(trusted => trusted.url === asset.url && trusted.sha256 === asset.sha256 && trusted.kind === asset.kind))) throw new Error('untrusted_asset');
  for (const {block} of bulletinBlocks(document)) {
    for (const sentence of block.sentences) {
      for (const span of sentence.spans) {
        const font = fonts.find(font => font.roles.includes(span.fontRole));
        const points = font && fontPoints.get(font.sha256);
        if (!points || Array.from(span.text).some(character => !['\n', '\r', '\t'].includes(character) && !points.has(character.codePointAt(0)))) throw new Error('missing_glyph');
      }
    }
  }
  const bytes = new Map();
  for (const asset of fonts) {
    let data;
    try { data = await readFile(resolve(assetsDirectory ?? '', basename(asset.url))); } catch { throw new Error('missing_asset'); }
    if (hash(data) !== asset.sha256) throw new Error('asset_checksum');
    bytes.set(asset.url, data);
  }
  const html = renderToStaticMarkup(createElement(BulletinDocumentRenderer, {document, mode: 'paper'}));
  const browser = await chromium.launch({headless: true, timeout: timeoutMs});
  let timer;
  try {
    if (browser.version() !== '153.0.8010.12') throw new Error('chromium_version_mismatch');
    const context = await browser.newContext({viewport: {width: 1600, height: 1200}, deviceScaleFactor: 1, locale: 'zh-TW', timezoneId: 'UTC', serviceWorkers: 'block'});
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin !== 'http://bulletin.invalid') return route.abort();
      if (bytes.has(url.pathname)) return route.fulfill({body: bytes.get(url.pathname), contentType: 'font/woff2'});
      if (url.pathname === '/') return route.fulfill({contentType: 'text/html', body: `<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; font-src 'self'"><style>html,body{margin:0;padding:0}${css}</style>${html}`});
      return route.abort();
    });
    const page = await context.newPage();
    await page.goto('http://bulletin.invalid/', {waitUntil: 'load', timeout: timeoutMs});
    // Function source is compiled code-owned code, never document text.
    const measurement = await Promise.race([
      page.evaluate(`(${measureRenderedBulletin.toString()})(document.querySelector('.hhc-bulletin-v1'),${JSON.stringify(fonts.map(({family, weight}) => ({family, weight})))},${Math.min(timeoutMs, 5000)})`),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('measurement_timeout')), timeoutMs); }),
    ]);
    const result = {contentHash: expectedContentHash, rendererArtifactSha256: document.layoutManifest.rendererArtifactSha256, chromiumVersion: browser.version(), fontHashes: fonts.map(font => font.sha256), ...measurement};
    return {...result, layoutValidationHash: hash(JSON.stringify(result))};
  } finally { clearTimeout(timer); await browser.close(); }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [inputPath, assetsDirectory] = process.argv.slice(2);
  const input = JSON.parse(await readFile(inputPath, 'utf8'));
  process.stdout.write(JSON.stringify(await measureBulletinLayout({...input, assetsDirectory})) + '\n');
}
