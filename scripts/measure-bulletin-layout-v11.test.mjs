import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import {composeBulletinLayout} from './measure-bulletin-layout-v11.mjs';
import {BULLETIN_RENDERER_V11_DIGEST as digest} from '../packages/ui/dist/bulletin-reader/v11/artifact.js';

const assetsDirectory = process.env.HHC_BULLETIN_TEMPLATE_DIR;
assert.ok(assetsDirectory, 'native acceptance requires immutable fonts');
const hash = text => createHash('sha256').update(text).digest('hex');
const style = {fontSize: 16, lineHeight: 20, indent: 0, firstLineIndent: 0, spaceBefore: 0, spaceAfter: 0};
async function fixture(questionLength = 40) {
  const assets = JSON.parse(await readFile(new URL('../packages/ui/src/bulletin-reader/v7/template-assets.json', import.meta.url))).filter(a => a.kind === 'font').map(a => ({url: a.url, sha256: a.sha256, kind: 'font', fontRole: a.roles[0]}));
  const block = (id, text, fontRole = 'body') => ({id, style: {...style}, sentences: [{id: `${id}-sentence`, spans: [{text, fontRole}]}]});
  const cover = {welcome: [block('welcome', '歡迎一起分享。')], worship: [], work: [], wordQuestions: Array.from({length: 10}, (_, i) => ({id: `item-${i}`, blocks: [block(`q-${i}`, '分享你的信仰經歷與見證。'.repeat(questionLength / 11))]})), weeklyVerses: [block('verse', '我們起來建造吧。'.repeat(12), 'scripture')]};
  const blocks = [...cover.welcome, ...cover.wordQuestions.flatMap(i => i.blocks), ...cover.weeklyVerses];
  return {canonicalMetadata: {title: '被聖靈充滿必有的三個看見、傳承福音使命', subtitle: '讓我們一同回應呼召、建造教會與家庭', issueNumber: 1742, date: '2026-10-11'}, document: {
    schemaVersion: '1', contentLocale: 'zh-Hant', templateVersion: 'v1', sourcePageCount: 4,
    templateSnapshot: {version: 5, visionMission: '遍地華人興起、福音傳到地極', visionFellowship: '共同生活、愛與成全、恩膏傳承', visionCommitment: '宣教主導、靈恩神學、團隊事奉、門徒訓練'},
    pages: ['cover', 'body', 'hymns', 'back'].map(id => ({id, width: 595.32, height: 841.92})), components: [{id: 'cover-component', type: 'cover', cover}],
    layoutManifest: {templateVersion: 'v1', rendererVersion: 'v11', rendererArtifactSha256: digest, assets, pages: ['cover', 'body', 'hymns', 'back'].map((pageId, i) => ({pageId, slots: i ? [] : blocks.map(b => ({id: `${b.id}-slot`, componentId: 'cover-component', blockId: b.id, box: {x: .1, y: .3, width: .8, height: .05}, fragments: [{sentenceId: b.sentences[0].id, start: 0, end: Array.from(b.sentences[0].spans[0].text).length}]})), fixedSlots: i ? [] : ['title', 'subtitle', 'welcomeLabel', 'wordLabel', 'verseLabel'].map(element => ({id: element, element, style: {...style}, box: {x: .1, y: .2, width: .7, height: .03}}))}))},
  }};
}
const input = source => {const submissionJSON = JSON.stringify(source); return {submissionJSON, expectedContentHash: hash(submissionJSON), assetsDirectory, timeoutMs: 30000};};
test('dense cover fits by measured sizing without losing text, anchors or source pages', async () => {
  const source = await fixture(95), original = structuredClone(source);
  const result = await composeBulletinLayout(input(source)), saved = JSON.parse(result.submissionJSON);
  assert.deepEqual(result.measurement.overflow, []);
  assert.equal(result.measurement.rendererArtifactSha256, digest);
  assert.deepEqual(saved.document.pages, original.document.pages);
  assert.deepEqual(saved.document.templateSnapshot, original.document.templateSnapshot);
  for (const [i, item] of saved.document.components[0].cover.wordQuestions.entries()) {
    assert.deepEqual(item.blocks[0].sentences, original.document.components[0].cover.wordQuestions[i].blocks[0].sentences);
    assert.ok(item.blocks[0].style.fontSize >= 9);
  }
  assert.deepEqual(saved.document.layoutManifest.pages[0].slots.map(s => s.fragments), original.document.layoutManifest.pages[0].slots.map(s => s.fragments));
  const slots = saved.document.layoutManifest.pages[0].fixedSlots;
  assert.ok(slots.find(s => s.element === 'subtitle').box.y > slots.find(s => s.element === 'title').box.y);
  assert.deepEqual(source, original);
});
test('cover too dense at the readable floor still requires review', async () => {
  await assert.rejects(composeBulletinLayout(input(await fixture(600))), /cover_requires_edit/);
});
test('dense sizing never pushes explicit inline glyphs below the 9pt floor', async () => {
  const source = await fixture(95);
  source.document.components[0].cover.wordQuestions[0].blocks[0].sentences[0].spans[0].fontSize = 9;
  await assert.rejects(composeBulletinLayout(input(source)), /cover_requires_edit/);
});
test('fitting cover retains the frozen V9 composition', async () => {
  const source = await fixture(20);
  source.canonicalMetadata.title = '閱讀'; source.canonicalMetadata.subtitle = '';
  const result = await composeBulletinLayout(input(source));
  assert.deepEqual(result.measurement.overflow, []);
  assert.ok(JSON.parse(result.submissionJSON).document.components[0].cover.wordQuestions.every(i => i.blocks[0].style.fontSize >= 12));
});

test('restored source illustration reserves its page region and following body text', async () => {
  const source = await fixture(20);
  const block = (id, text) => ({id, style: {...style}, sentences: [{id: `${id}-sentence`, spans: [{text, fontRole: 'body'}]}]});
  const title = block('body-title', '信息'), before = block('before', '原稿上方正文。'), after = block('after', '圖片之後繼續閱讀。');
  const picture = {id: 'a'.repeat(64), componentId: 'body', pageId: 'body', afterBlockId: 'before', box: {x: .1, y: .35, width: .4, height: .15}, alt: '來源插圖', assetId: '00000000-0000-4000-8000-000000000001', sha256: 'b'.repeat(64), sizeBytes: 100};
  source.document.components.push({id: 'body', type: 'bodySection', bodySection: {kind: 'sermon', title, blocks: [before, after]}, illustrations: [picture]});
  source.document.layoutManifest.pages[1].slots = [title, before, after].map((block, i) => ({id: block.id, componentId: 'body', blockId: block.id, box: {x: .1, y: [.1, .2, .55][i], width: .8, height: .03}, fragments: [{sentenceId: block.sentences[0].id, start: 0, end: Array.from(block.sentences[0].spans[0].text).length}]}));
  const result = await composeBulletinLayout(input(source));
  const document = JSON.parse(result.submissionJSON).document;
  assert.deepEqual(document.pages, source.document.pages);
  assert.deepEqual(document.components[1].illustrations, [picture]);
  assert.deepEqual(result.measurement.overflow, []);
  assert.ok(document.layoutManifest.pages[1].slots.find(slot => slot.id === 'after').box.y >= .5);
  const invalid = structuredClone(source);
  invalid.document.components[1].illustrations[0].box = {x: .1, y: .1, width: .8, height: .8};
  await assert.rejects(composeBulletinLayout(input(invalid)), /page_requires_edit/);
});

test('summary preserves the widened converter frame through native composition', async () => {
  const source = await fixture(20);
  const block = {id: 'summary-text', style: {...style, fontSize: 11, lineHeight: 14.52, align: 'justify', firstLineIndent: 2}, sentences: [{id: 'summary-sentence', spans: [{text: '摘要內容完整保留，版面在同一頁重新排版。'.repeat(12), fontRole: 'body'}]}]};
  source.document.components.push({id: 'summary', type: 'backSummary', items: [{id: 'summary-item', blocks: [block]}]});
  source.document.layoutManifest.pages[3].slots = [{id: 'summary-slot', componentId: 'summary', blockId: block.id, box: {x: .185, y: .054, width: .715, height: .17}, fragments: [{sentenceId: 'summary-sentence', start: 0, end: Array.from(block.sentences[0].spans[0].text).length}]}];
  source.document.layoutManifest.pages[3].fixedSlots = [
    {id: 'summary-frame', element: 'summaryFrame', style: {...style, fontSize: 6, lineHeight: 6}, box: {x: .128, y: .045, width: .839, height: .191}},
    {id: 'announcements-frame', element: 'announcementsFrame', style: {...style}, box: {x: .031, y: .5, width: .936, height: .1}},
  ];
  const result = await composeBulletinLayout(input(source));
  const document = JSON.parse(result.submissionJSON).document, layout = document.layoutManifest.pages[3];
  assert.ok(layout.fixedSlots.find(slot => slot.element === 'summaryFrame').box.width > .8, 'summary frame is narrower than the available page region');
  assert.equal(layout.fixedSlots.find(slot => slot.element === 'summaryFrame').box.width, .839);
  assert.equal(layout.slots[0].box.width, .715);
  assert.deepEqual(document.components[1].items, source.document.components[1].items);
  assert.deepEqual(document.pages, source.document.pages);
  assert.deepEqual(result.measurement.overflow, []);
});
