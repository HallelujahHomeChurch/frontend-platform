import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
const version = process.env.HHC_TEST_RENDERER_V7 === '1' ? 'v7' : 'v6';
const {composeBulletinLayout, measureBulletinLayout} = await import(`./measure-bulletin-layout-${version}.mjs`);
const artifact = await import(`../packages/ui/dist/bulletin-reader/${version}/artifact.js`);
const digest = artifact[`BULLETIN_RENDERER_${version.toUpperCase()}_DIGEST`];

const assetsDirectory = process.env.HHC_BULLETIN_TEMPLATE_DIR;
assert.ok(assetsDirectory, 'native V6 acceptance requires real immutable fonts');
const hash = value => createHash('sha256').update(value).digest('hex');
const labels = ['historicalVision', 'historicalGoals', 'historicalActions', 'historicalCommitment'];
const style = {fontSize: 12, lineHeight: 15, indent: 0, firstLineIndent: 0, spaceBefore: 0, spaceAfter: 0};
async function fixture(width, height, locale = 'zh-Hant') {
  const assets = JSON.parse(await readFile(new URL(`../packages/ui/src/bulletin-reader/${locale === 'zh-Hans' ? 'v2/' : version === 'v7' ? 'v7/' : ''}template-assets.json`, import.meta.url)));
  if (locale === 'zh-Hans' && version === 'v7') {
    const traditional = JSON.parse(await readFile(new URL('../packages/ui/src/bulletin-reader/v7/template-assets.json', import.meta.url)));
    assets.push(...traditional.filter(asset => asset.kind === 'font' && asset.roles.some(role => role === 'body' || role === 'emphasis')));
  }
  const slots = [];
  const block = (id, text, fontRole = 'body') => {
    slots.push({id: `slot-${id}`, componentId: 'cover', blockId: id, box: {x: .1, y: .3, width: .8, height: .03}, fragments: [{sentenceId: `s-${id}`, start: 0, end: Array.from(text).length}]});
    return {id, style: {...style}, sentences: [{id: `s-${id}`, spans: [{text, fontRole}]}]};
  };
  const cover = {welcome: [block('welcome', '歡迎一同敬拜。')], worship: [1, 2, 3].map(n => ({id: `song-${n}`, blocks: [block(`song-${n}`, `${n}.共同敬拜`)]})), work: [1, 2, 3].map(n => ({id: `work-${n}`, blocks: [block(`work-${n}`, `${n}.共同生活、愛與成全。`)]})), wordQuestions: [1, 2, 3, 4, 5, 6].map(n => ({id: `question-${n}`, blocks: [block(`question-${n}`, `${n}.分享神的愛。`)]})), weeklyVerses: [block('verse', '耶和華是我的牧者，我必不致缺乏。', 'scripture')]};
  const fixed = (element, x, y, fontSize = 12, width = .5) => ({id: `fixed-${element}`, element, style: {...style, fontSize, lineHeight: fontSize * 1.25}, box: {x, y, width, height: fontSize * 1.25 / height}});
  const document = {issueId: '00000000-0000-4000-8000-000000000001', series: 'general', contentLocale: locale, schemaVersion: '1', templateVersion: locale === 'zh-Hans' ? 'v2' : 'v1', sourceAssetChecksum: 'a'.repeat(64), sourcePageCount: 4, components: [{id: 'cover', type: 'cover', cover}], pages: [{id: 'cover-page', width, height}], layoutManifest: {templateVersion: locale === 'zh-Hans' ? 'v2' : 'v1', rendererVersion: version, rendererArtifactSha256: digest, assets: assets.filter(a => a.kind === 'font').map(a => ({url: a.url, sha256: a.sha256, kind: 'font', fontRole: a.roles[0]})), pages: [{pageId: 'cover-page', slots, fixedSlots: [fixed('masthead', .35, .06, 20, .59), fixed('date', .096, .17), fixed('issueNumber', .23, .17), fixed('pastor', .096, .208, 10, .28), fixed('titleLabel', .077, .245, 12, .15), fixed('title', .23, .245, 14, .45), fixed('subtitle', .67, .245, 12, .25), ...labels.map((element, i) => fixed(element, .422 + i * .0336, .1465 + i * .019, 9.6, .92 - (.422 + i * .0336))), ...['welcomeLabel', 'worshipLabel', 'workLabel', 'wordLabel', 'verseLabel'].map(element => fixed(element, .07, .28))]}]}};
  return {document, canonicalMetadata: {title: '永恆的呼召', subtitle: '～一起建造', issueNumber: 1732, date: '2026-07-26'}};
}
const input = submission => {
  const submissionJSON = JSON.stringify(submission);
  return {submissionJSON, expectedContentHash: hash(submissionJSON), assetsDirectory, timeoutMs: 15000};
};

for (const [width, height] of [[595.32, 841.92], [612, 792]]) {
  for (const locale of ['zh-Hant', 'zh-Hans']) test(`complete ${width} ${locale} historical cover retains rows, scripture and source anchors`, async () => {
    const source = await fixture(width, height, locale);
    const original = structuredClone(source);
    const result = await composeBulletinLayout(input(source));
    const saved = JSON.parse(result.submissionJSON).document;
    assert.equal(saved.pages.length, 1);
    assert.deepEqual(saved.components.map(c => c.cover.weeklyVerses[0].sentences), source.document.components.map(c => c.cover.weeklyVerses[0].sentences));
    assert.deepEqual(saved.layoutManifest.pages[0].slots.map(s => [s.id, s.fragments]), source.document.layoutManifest.pages[0].slots.map(s => [s.id, s.fragments]));
    assert.deepEqual(result.measurement.overflow, []);
    const rows = saved.layoutManifest.pages[0].fixedSlots.filter(s => labels.includes(s.element));
    assert.deepEqual(rows.map(s => s.element), labels);
    assert.deepEqual(rows.map(s => [s.box.x, s.box.y]), original.document.layoutManifest.pages[0].fixedSlots.filter(s => labels.includes(s.element)).map(s => [s.box.x, s.box.y]));
    assert.ok(result.measurement.pages[0].slots.every(s => s.box.y + s.box.height <= height - 24 + .1));
    assert.ok(saved.components[0].cover.weeklyVerses.every(b => b.style.fontSize >= 12 && b.sentences.every(s => s.spans.every(span => span.fontRole === 'scripture'))));
    assert.deepEqual(source, original);
  });
}

test('historical ink overlap is rejected rather than omitted from measurement', async () => {
  const source = await fixture(595.32, 841.92);
  const rows = source.document.layoutManifest.pages[0].fixedSlots.filter(s => labels.includes(s.element));
  rows[1].box = {...rows[0].box};
  const measured = await measureBulletinLayout(input(source));
  for (const row of rows.slice(0, 2)) assert.ok(measured.overflow.some(value => value.slotId === row.id));
});

test('historical source allocations gain readable line height without moving the staircase', async () => {
  const source = await fixture(595.32, 841.92);
  const rows = source.document.layoutManifest.pages[0].fixedSlots.filter(s => labels.includes(s.element));
  for (const row of rows) row.box.height = 5 / 841.92;
  const result = await composeBulletinLayout(input(source));
  assert.deepEqual(result.measurement.overflow, []);
  assert.deepEqual(JSON.parse(result.submissionJSON).document.layoutManifest.pages[0].fixedSlots.filter(s => labels.includes(s.element)).map(s => [s.box.x, s.box.y]), rows.map(s => [s.box.x, s.box.y]));
});

test('outlined Letter historical labels retain their verified 8pt source size', async () => {
  const source = await fixture(612, 792);
  for (const slot of source.document.layoutManifest.pages[0].fixedSlots.filter(s => labels.includes(s.element))) {
    slot.style.fontSize = 8;
    slot.style.lineHeight = 12;
  }
  const result = await composeBulletinLayout(input(source));
  assert.deepEqual(result.measurement.overflow, []);
  assert.ok(JSON.parse(result.submissionJSON).document.layoutManifest.pages[0].fixedSlots.filter(s => labels.includes(s.element)).every(s => s.style.fontSize === 8));
});

test('native V1 and V2 still compose their unchanged non-historical covers', async () => {
  for (const locale of ['zh-Hant', 'zh-Hans']) {
    const source = await fixture(595.32, 841.92, locale);
    const version = locale === 'zh-Hans' ? 'v2' : 'v1';
    const legacy = await import(`./measure-bulletin-layout${version === 'v2' ? '-v2' : ''}.mjs`);
    const artifact = await import(`../packages/ui/dist/bulletin-reader/${version === 'v2' ? 'v2/' : ''}artifact.js`);
    source.document.layoutManifest.rendererVersion = version;
    const legacyAssets = JSON.parse(await readFile(new URL(`../packages/ui/src/bulletin-reader/${version === 'v2' ? 'v2/' : ''}template-assets.json`, import.meta.url)));
    source.document.layoutManifest.assets = legacyAssets.filter(a => a.kind === 'font').map(a => ({url: a.url, sha256: a.sha256, kind: 'font', fontRole: a.roles[0]}));
    source.document.layoutManifest.rendererArtifactSha256 = artifact[`BULLETIN_RENDERER_${version.toUpperCase()}_DIGEST`];
    source.document.layoutManifest.pages[0].fixedSlots = source.document.layoutManifest.pages[0].fixedSlots.filter(s => !labels.includes(s.element));
    const result = await legacy.composeBulletinLayout(input(source));
    assert.deepEqual(result.measurement.overflow, []);
    assert.equal(JSON.parse(result.submissionJSON).document.pages.length, 1);
  }
});

test('mixed inline scripture sizes retain their scalar anchors through cover composition', async () => {
  const source = await fixture(595.32, 841.92);
  const verse = source.document.components[0].cover.weeklyVerses[0];
  verse.sentences[0].spans = [{text: '耶和華', fontRole: 'scripture', fontSize: 14}, {text: '是我的牧者。', fontRole: 'scripture', fontSize: 12}];
  source.document.layoutManifest.pages[0].slots.find(s => s.blockId === verse.id).fragments[0].end = 9;
  const result = await composeBulletinLayout(input(source));
  assert.deepEqual(result.measurement.overflow, []);
  assert.deepEqual(JSON.parse(result.submissionJSON).document.components[0].cover.weeklyVerses[0].sentences, verse.sentences);
});

test('unknown glyphs and oversized canonical/cover text fail without dropping content', async () => {
  const source = await fixture(595.32, 841.92);
  source.canonicalMetadata.title = '主題🫠';
  await assert.rejects(composeBulletinLayout(input(source)), /missing_glyph/);
  source.canonicalMetadata.title = '長標題'.repeat(100);
  await assert.rejects(composeBulletinLayout(input(source)), /cover_requires_edit/);
  source.canonicalMetadata.title = '主題';
  source.canonicalMetadata.subtitle = '長副標'.repeat(100);
  await assert.rejects(composeBulletinLayout(input(source)), /cover_requires_edit/);
});

test('V6 and legacy runtimes never accept each other or altered artifacts', async () => {
  const source = await fixture(595.32, 841.92);
  source.document.layoutManifest.rendererArtifactSha256 = '0'.repeat(64);
  await assert.rejects(measureBulletinLayout(input(source)), /update_required/);
  source.document.layoutManifest.rendererArtifactSha256 = digest;
  source.document.layoutManifest.rendererVersion = 'v5';
  await assert.rejects(measureBulletinLayout(input(source)), /update_required/);
});
