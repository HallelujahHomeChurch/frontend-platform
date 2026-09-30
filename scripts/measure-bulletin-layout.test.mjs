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
    layoutManifest: {templateVersion: 'v1', rendererVersion: 'v1', rendererArtifactSha256: BULLETIN_RENDERER_V1_DIGEST, assets: assets.filter(asset => asset.kind === 'font').map(asset => ({url: asset.url, sha256: asset.sha256, kind: 'font', fontRole: asset.roles[0]})), pages: [{pageId: 'p', slots: [{id: 'slot', componentId: 'c', blockId: 'b', box: {x: .1, y: .1, width: .8, height: .1}, fragments: [{sentenceId: 's', start: 0, end: Array.from(text).length}]}]}]},
  };
  const submissionJSON = JSON.stringify({document, canonicalMetadata: {title: '原始主題', subtitle: '', issueNumber: 1739, date: '2026-09-20'}});
  return {submissionJSON, expectedContentHash: hash(submissionJSON), assetsDirectory};
}

test('rejects stale content before any browser or file access', async () => {
  await assert.rejects(measureBulletinLayout({...await fixture(), expectedContentHash: '0'.repeat(64)}), /stale_content/);
});
test('canonical metadata belongs to the same content identity as the page text', async () => {
  const input = await fixture();
  const submission = JSON.parse(input.submissionJSON);
  submission.canonicalMetadata.title = '修改後主題';
  await assert.rejects(measureBulletinLayout({...input, submissionJSON: JSON.stringify(submission)}), /stale_content/);
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
test('fixed template labels are measured and can block overflow too', {skip: !assetsDirectory}, async () => {
  const input = await fixture();
  const submission = JSON.parse(input.submissionJSON);
  submission.document.layoutManifest.pages[0].fixedSlots = [{id: 'fixed-vision', element: 'vision', box: {x: .1, y: .3, width: .8, height: .005}, style: {fontSize: 16, lineHeight: 24, indent: 0, firstLineIndent: 0, spaceBefore: 0, spaceAfter: 0}}];
  const submissionJSON = JSON.stringify(submission);
  const result = await measureBulletinLayout({...input, submissionJSON, expectedContentHash: hash(submissionJSON)});
  assert.ok(result.overflow.some(value => value.slotId === 'fixed-vision'));
});
test('fixed graphics must be declared trusted assets and loaded before measurement', {skip: !assetsDirectory}, async () => {
  const input = await fixture();
  const submission = JSON.parse(input.submissionJSON);
  submission.document.layoutManifest.pages[0].fixedSlots = [{id: 'fixed-qr', element: 'websiteQR', box: {x: .1, y: .3, width: .1, height: .07}, style: {fontSize: 16, lineHeight: 24, indent: 0, firstLineIndent: 0, spaceBefore: 0, spaceAfter: 0}}];
  let submissionJSON = JSON.stringify(submission);
  await assert.rejects(measureBulletinLayout({...input, submissionJSON, expectedContentHash: hash(submissionJSON)}), /missing_decoration/);
  const assets = JSON.parse(await readFile(new URL('../packages/ui/src/bulletin-reader/template-assets.json', import.meta.url), 'utf8'));
  const asset = assets.find(asset => asset.url.includes('/qr-website-'));
  submission.document.layoutManifest.assets.push({url: asset.url, sha256: asset.sha256, kind: 'decoration'});
  submissionJSON = JSON.stringify(submission);
  const result = await measureBulletinLayout({...input, submissionJSON, expectedContentHash: hash(submissionJSON)});
  const slot = result.pages[0].slots.find(slot => slot.slotId === 'fixed-qr');
  assert.equal(slot.fixedElement, 'websiteQR');
  assert.ok(slot.box.height > 50);
  assert.deepEqual(result.overflow, []);
});
test('one immutable font asset serves its code-owned role aliases without duplicate URLs', {skip: !assetsDirectory}, async () => {
  const input = await fixture('測試。');
  const submission = JSON.parse(input.submissionJSON);
  submission.document.layoutManifest.assets = submission.document.layoutManifest.assets.filter(asset => !['reference', 'foreignText'].includes(asset.fontRole));
  submission.document.components[0].items[0].blocks[0].sentences[0].spans[0].fontRole = 'reference';
  const submissionJSON = JSON.stringify(submission);
  const result = await measureBulletinLayout({...input, submissionJSON, expectedContentHash: hash(submissionJSON)});
  assert.deepEqual(result.overflow, []);
  assert.equal(new Set(submission.document.layoutManifest.assets.map(asset => asset.url)).size, 3);
});
test('legal substitute fonts use their declared typographic metrics without reducing glyph size', {skip: !assetsDirectory}, async () => {
  const input = await fixture('中文。');
  const submission = JSON.parse(input.submissionJSON);
  const block = submission.document.components[0].items[0].blocks[0];
  block.style = {...block.style, fontSize: 16, lineHeight: 20};
  submission.document.layoutManifest.pages[0].slots[0].box.height = 20 / 841.92;
  for (const role of ['body', 'scripture', 'emphasis']) {
    block.sentences[0].spans[0].fontRole = role;
    const submissionJSON = JSON.stringify(submission);
    const result = await measureBulletinLayout({...input, submissionJSON, expectedContentHash: hash(submissionJSON)});
    assert.deepEqual(result.overflow, [], `${role}: printed-size single line must fit`);
    const line = result.pages[0].slots[0].fragments[0].lines[0];
    assert.ok(Math.abs(line.height - 16) < .8, `${role}: normalised em metrics, not font shrinking (${line.height}pt)`);
    assert.ok(line.width >= 47 && line.width <= 49);
  }
});
test('controlled full-page diagnostics preserve geometry and surface every unresolved overflow', {skip: !assetsDirectory}, async () => {
  for (const [issue, pageCount, blockCount] of [[1739, 12, 495], [1740, 16, 679]]) {
    const submission = JSON.parse(await readFile(new URL(`./testdata/bulletin/${issue}-typography.json`, import.meta.url), 'utf8'));
    submission.document.layoutManifest.rendererArtifactSha256 = BULLETIN_RENDERER_V1_DIGEST;
    const slots = submission.document.layoutManifest.pages.flatMap(page => page.slots);
    assert.equal(slots.length, blockCount);
    for (const component of submission.document.components) {
      const spans = JSON.stringify(component);
      assert.ok(!spans.includes('Undefined') && !spans.includes('DFKai'));
    }
    const visit = value => {
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === 'object') {
        if ('text' in value) assert.match(value.text, /^[測aiW0. ]+$/u);
        Object.values(value).forEach(visit);
      }
    };
    visit(submission.document.components);
    const submissionJSON = JSON.stringify(submission);
    const result = await measureBulletinLayout({submissionJSON, expectedContentHash: hash(submissionJSON), assetsDirectory});
    assert.equal(result.pages.length, pageCount);
    assert.equal(result.pages.flatMap(page => page.slots).length, blockCount);
    // Chromium quantises CSS layout to 1/64px (about .012 PDF point).
    for (const page of result.pages) { assert.ok(Math.abs(page.width - 595.32) < .02); assert.ok(Math.abs(page.height - 841.92) < .02); }
    for (const issue of result.overflow) assert.ok(slots.some(slot => slot.id === issue.slotId));
  }
});
