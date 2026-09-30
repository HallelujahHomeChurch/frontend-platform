import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import {measureBulletinLayout} from './measure-bulletin-layout.mjs';
import {BULLETIN_RENDERER_V1_DIGEST} from '../packages/ui/dist/bulletin-reader/artifact.js';

const assetsDirectory = process.env.HHC_BULLETIN_TEMPLATE_DIR;
const hash = value => createHash('sha256').update(value).digest('hex');
async function fixture(text = '這是一句測試。') {
  const assets = JSON.parse(await readFile(new URL('../packages/ui/src/bulletin-reader/template-assets.json', import.meta.url), 'utf8'));
  const document = {
    issueId: '00000000-0000-4000-8000-000000000001', series: 'general', contentLocale: 'zh-Hant', schemaVersion: '1', templateVersion: 'v1', sourceAssetChecksum: 'a'.repeat(64), sourcePageCount: 4,
    pages: [{id: 'p', width: 595.32, height: 841.92}],
    components: [{id: 'c', type: 'backSummary', items: [{id: 'i', blocks: [{id: 'b', style: {fontSize: 16, lineHeight: 24, indent: 0, firstLineIndent: 0, spaceBefore: 0, spaceAfter: 0}, sentences: [{id: 's', spans: [{text, fontRole: 'body'}]}]}]}]}],
    layoutManifest: {templateVersion: 'v1', rendererVersion: 'v1', rendererArtifactSha256: BULLETIN_RENDERER_V1_DIGEST, assets: assets.filter(asset => asset.kind === 'font').flatMap(asset => asset.roles.map(fontRole => ({url: asset.url, sha256: asset.sha256, kind: 'font', fontRole}))), pages: [{pageId: 'p', slots: [{id: 'slot', componentId: 'c', blockId: 'b', box: {x: .1, y: .1, width: .8, height: .1}, fragments: [{sentenceId: 's', start: 0, end: Array.from(text).length}]}]}]},
  };
  const documentJSON = JSON.stringify(document);
  return {documentJSON, expectedContentHash: hash(documentJSON), assetsDirectory};
}

test('rejects stale content before any browser or file access', async () => {
  await assert.rejects(measureBulletinLayout({...await fixture(), expectedContentHash: '0'.repeat(64)}), /stale_content/);
});
test('rejects unavailable glyphs instead of measuring a platform fallback font', {skip: !assetsDirectory}, async () => {
  await assert.rejects(measureBulletinLayout(await fixture('測試🫠')), /missing_glyph/);
});
test('rejects an unbounded or invalid timeout before starting the browser', async () => {
  for (const timeoutMs of [0, -1, Infinity, NaN]) {
    await assert.rejects(measureBulletinLayout({...await fixture(), timeoutMs}), /invalid_timeout/);
  }
});
test('rejects modified or missing fonts rather than measuring fallback glyphs', {skip: !assetsDirectory}, async () => {
  await assert.rejects(measureBulletinLayout({...await fixture(), assetsDirectory: '/not-a-template'}), /missing_asset/);
});
test('post-font-load measurement is deterministic and reports source slot overflow', {skip: !assetsDirectory}, async () => {
  const input = await fixture();
  const first = await measureBulletinLayout(input);
  const second = await measureBulletinLayout(input);
  assert.deepEqual(first, second);
  assert.equal(first.overflow.length, 0);
  assert.equal(first.contentHash, input.expectedContentHash);
  assert.equal(first.rendererArtifactSha256, BULLETIN_RENDERER_V1_DIGEST);
  assert.equal(first.pages[0].slots[0].fragments[0].sentenceId, 's');
  assert.equal(first.fontHashes.length, 3);
  const long = await measureBulletinLayout(await fixture('文字'.repeat(1500)));
  assert.ok(long.overflow.some(value => value.slotId === 'slot'));
});
