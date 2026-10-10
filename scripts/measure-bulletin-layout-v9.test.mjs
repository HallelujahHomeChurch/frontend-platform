import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import {measureBulletinLayout, composeBulletinLayout} from './measure-bulletin-layout-v9.mjs';
import {BULLETIN_RENDERER_V9_DIGEST as digest} from '../packages/ui/dist/bulletin-reader/v9/artifact.js';

const assetsDirectory = process.env.HHC_BULLETIN_TEMPLATE_DIR;
assert.ok(assetsDirectory, 'native acceptance requires immutable fonts');
const hash = text => createHash('sha256').update(text).digest('hex');
async function fixture(locale = 'zh-Hant') {
  const paths = locale === 'zh-Hans' ? ['v2/', 'v7/'] : ['v7/'];
  const profiles = (await Promise.all(paths.map(path => readFile(new URL(`../packages/ui/src/bulletin-reader/${path}template-assets.json`, import.meta.url)).then(JSON.parse)))).flat();
  const assets = [...new Map(profiles.filter(a => a.kind === 'font').map(a => [a.url, {url: a.url, sha256: a.sha256, kind: 'font', fontRole: a.roles[0]}])).values()];
  const style = {fontSize: 10, lineHeight: 14, indent: 0, firstLineIndent: 0, spaceBefore: 0, spaceAfter: 0};
  return {canonicalMetadata: {title: '閱讀', issueNumber: 1741, date: '2026-10-04'}, document: {
    schemaVersion: '1', contentLocale: locale, templateVersion: locale === 'zh-Hans' ? 'v2' : 'v1', sourcePageCount: 4,
    templateSnapshot: {version: 5, visionMission: locale === 'zh-Hans' ? '遍地华人兴起、福音传到地极' : '遍地華人興起、福音傳到地極', visionFellowship: locale === 'zh-Hans' ? '共同生活、爱与成全、恩膏传承' : '共同生活、愛與成全、恩膏傳承', visionCommitment: locale === 'zh-Hans' ? '宣教主导、灵恩神学、团队事奉、门徒训练' : '宣教主導、靈恩神學、團隊事奉、門徒訓練'},
    pages: ['cover', 'body', 'hymns', 'back'].map(id => ({id, width: 595.32, height: 841.92})), components: [],
    layoutManifest: {templateVersion: locale === 'zh-Hans' ? 'v2' : 'v1', rendererVersion: 'v9', rendererArtifactSha256: digest, assets, pages: ['cover', 'body', 'hymns', 'back'].map((pageId, i) => ({pageId, slots: [], fixedSlots: i ? [] : ['visionMission', 'visionFellowship', 'visionCommitment'].map((element, j) => ({id: element, element, style: {...style}, box: {x: .42, y: .15 + j * .022, width: .5, height: .025}}))}))},
  }};
}
const input = source => { const submissionJSON = JSON.stringify(source); return {submissionJSON, expectedContentHash: hash(submissionJSON), assetsDirectory, timeoutMs: 15000}; };
for (const locale of ['zh-Hant', 'zh-Hans']) test(`V9 measures ${locale} snapshot text and keeps source immutable`, async () => {
  const source = await fixture(locale);
  const original = structuredClone(source);
  const before = await measureBulletinLayout(input(source));
  source.document.templateSnapshot.visionMission = locale === 'zh-Hans' ? '同心' : '合一';
  const after = await measureBulletinLayout(input(source));
  assert.deepEqual(before.overflow, []);
  assert.deepEqual(after.overflow, []);
  assert.notEqual(before.contentHash, after.contentHash);
  const width = value => value.pages[0].slots.find(s => s.slotId === 'visionMission').fragments.flatMap(f => f.lines).reduce((sum, line) => sum + line.width, 0);
  assert.ok(width(before) > width(after), 'measurement must use saved values, not fixed legacy text');
  original.document.templateSnapshot.visionMission = source.document.templateSnapshot.visionMission;
  assert.deepEqual(source, original);
});
test('V9 cover composition retains settings version and source-page identity', async () => {
  const source = await fixture();
  const original = structuredClone(source);
  const result = await composeBulletinLayout(input(source));
  const saved = JSON.parse(result.submissionJSON);
  assert.deepEqual(saved.document.templateSnapshot, original.document.templateSnapshot);
  assert.deepEqual(saved.document.pages, original.document.pages);
  assert.deepEqual(source, original);
  assert.deepEqual(result.measurement.overflow, []);
});
test('overlong church value yields a located failure, never unreadable text', async () => {
  const source = await fixture();
  source.document.templateSnapshot.visionMission = '需要人工確認'.repeat(10);
  await assert.rejects(composeBulletinLayout(input(source)), error => error.message === 'page_requires_edit' && error.cause?.pageId === 'cover' && error.cause?.slotId === 'visionMission');
});
test('missing snapshot is rejected before rendering', async () => {
  const source = await fixture();
  delete source.document.templateSnapshot;
  await assert.rejects(measureBulletinLayout(input(source)), /invalid_template_snapshot/);
});
