import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import {composeBulletinLayout, measureBulletinLayout} from './measure-bulletin-layout-v8.mjs';
import {BULLETIN_RENDERER_V8_DIGEST as digest} from '../packages/ui/dist/bulletin-reader/v8/artifact.js';

const assetsDirectory = process.env.HHC_BULLETIN_TEMPLATE_DIR;
assert.ok(assetsDirectory, 'native acceptance requires real immutable fonts');
const assets = JSON.parse(await readFile(new URL('../packages/ui/src/bulletin-reader/v7/template-assets.json', import.meta.url)));
const hash = value => createHash('sha256').update(value).digest('hex');
const style = {fontSize: 13, lineHeight: 16.25, letterSpacing: 0, indent: 0, firstLineIndent: 0, spaceBefore: 0, spaceAfter: 0};
const block = (id, text) => ({id, style: {...style}, sentences: [{id: `${id}-sentence`, spans: [{text, fontRole: 'body'}]}]});
const slot = (block, x, y, width) => ({id: `${block.id}-slot`, componentId: 'article', blockId: block.id, box: {x, y, width, height: .025}, fragments: [{sentenceId: block.sentences[0].id, start: 0, end: Array.from(block.sentences[0].spans[0].text).length}]});
function fixture() {
  const title = block('heading', '一同領受新的生命');
  const speaker = block('speaker', '牧師');
  const body = block('body', '一起閱讀正文內容。');
  const welcome = block('welcome', '歡迎一起閱讀。');
  return {
    canonicalMetadata: {title: '第一個主題名稱、第二個主題名', issueNumber: 1700, date: '2026-01-01'},
    document: {
      issueId: '00000000-0000-4000-8000-000000000001', series: 'general', contentLocale: 'zh-Hant', schemaVersion: '1', templateVersion: 'v1', sourceAssetChecksum: 'a'.repeat(64), sourcePageCount: 2,
      components: [{id: 'cover', type: 'cover', cover: {welcome: [welcome], worship: [], work: [], wordQuestions: [], weeklyVerses: []}}, {id: 'article', type: 'bodySection', bodySection: {kind: 'sermon', title, contributors: [{role: 'speaker', name: speaker}], blocks: [body]}}],
      pages: [{id: 'cover-page', width: 612, height: 792}, {id: 'body-page', width: 612, height: 792}],
      layoutManifest: {templateVersion: 'v1', rendererVersion: 'v8', rendererArtifactSha256: digest, assets: assets.filter(a => a.kind === 'font').map(a => ({url: a.url, sha256: a.sha256, kind: 'font', fontRole: a.roles[0]})), pages: [
        {pageId: 'cover-page', slots: [{...slot(welcome, .1, .3, .8), componentId: 'cover'}], fixedSlots: ['date', 'issueNumber'].map((element, index) => ({id: element, element, box: {x: .1 + index * .2, y: .2, width: .15, height: .03}, style: {...style}}))},
        {pageId: 'body-page', slots: [slot(title, .1476, .25, .1507), slot(speaker, .3204, .25, .0538), slot(body, .1476, .29, .8)], fixedSlots: [
          {id: 'canonical-title', element: 'title', box: {x: .1698, y: .045, width: .6708, height: .1004}, style: {...style, fontSize: 39.744, lineHeight: 79.488, letterSpacing: -.313054}},
          {id: 'separator', element: 'speakerSeparator', box: {x: .299, y: .25, width: .0215, height: .025}, style: {...style}},
        ]},
      ]},
    },
  };
}
async function compose(source) {
  const original = structuredClone(source);
  const submissionJSON = JSON.stringify(source);
  const result = await composeBulletinLayout({submissionJSON, expectedContentHash: hash(submissionJSON), assetsDirectory, timeoutMs: 15000});
  assert.deepEqual(source, original, 'source must remain immutable');
  assert.deepEqual(result.measurement.overflow, []);
  const saved = JSON.parse(result.submissionJSON);
  assert.deepEqual(saved.canonicalMetadata, source.canonicalMetadata);
  assert.deepEqual(saved.document.pages, source.document.pages);
  const anchors = document => document.layoutManifest.pages.map(p => Object.fromEntries(p.slots.map(s => [s.id, s.fragments])));
  assert.deepEqual(anchors(saved.document), anchors(source.document));
  return {...result, saved};
}
test('canonical body title fits at normal tracking rather than overlapping adjacent glyphs', async () => {
  const {saved} = await compose(fixture());
  const title = saved.document.layoutManifest.pages[1].fixedSlots.find(s => s.element === 'title');
  assert.equal(title.style.letterSpacing, 0);
  assert.ok(title.style.fontSize >= 12);
});
test('boxed section title and speaker fit on one line without changing sentence anchors', async () => {
  const {measurement} = await compose(fixture());
  const slots = measurement.pages[1].slots;
  const title = slots.find(s => s.slotId === 'heading-slot');
  const lines = title.fragments.flatMap(f => f.lines);
  assert.ok(Math.max(...lines.map(l => l.y + l.height)) - Math.min(...lines.map(l => l.y)) <= 17.25, 'heading must occupy one text line');
  const speaker = slots.find(s => s.slotId === 'speaker-slot');
  assert.ok(Math.abs(title.box.y - speaker.box.y) < 1, 'speaker shares heading row');
  assert.ok(speaker.box.x > title.box.x + title.box.width, 'speaker follows the title box');
});
test('cover issue number follows measured date with one compact space', async () => {
  const {measurement} = await compose(fixture());
  const slots = measurement.pages[0].slots;
  const date = slots.find(s => s.slotId === 'date');
  const issue = slots.find(s => s.slotId === 'issueNumber');
  const end = Math.max(...date.fragments.flatMap(f => f.lines.map(l => l.x + l.width)));
  assert.ok(issue.box.x - end >= 2 && issue.box.x - end <= 6, `date gap ${issue.box.x - end}`);
});
test('neighboring column headings keep their own separator on the speaker row', async () => {
  const source = fixture();
  const page = source.document.layoutManifest.pages[1];
  const first = source.document.components[1];
  first.bodySection.title.sentences[0].spans[0].text = '左欄主題';
  page.slots = [slot(first.bodySection.title, .1, .25, .13), slot(first.bodySection.contributors[0].name, .27, .25, .07), slot(first.bodySection.blocks[0], .1, .29, .35)];
  page.fixedSlots.find(s => s.id === 'separator').box.x = .24;
  const title = block('right-heading', '右欄主題');
  const speaker = block('right-speaker', '講員');
  const body = block('right-body', '另一欄的正文內容。');
  source.document.components.push({id: 'right-article', type: 'bodySection', bodySection: {kind: 'sermon', title, contributors: [{role: 'speaker', name: speaker}], blocks: [body]}});
  page.slots.push(...[slot(title, .55, .25, .13), slot(speaker, .72, .25, .07), slot(body, .55, .29, .35)].map(s => ({...s, componentId: 'right-article'})));
  page.fixedSlots.push({id: 'right-separator', element: 'speakerSeparator', box: {x: .69, y: .25, width: .0215, height: .025}, style: {...style}});
  const {measurement} = await compose(source);
  const measured = new Map(measurement.pages[1].slots.map(s => [s.slotId, s]));
  for (const [heading, separator, name] of [['heading-slot', 'separator', 'speaker-slot'], ['right-heading-slot', 'right-separator', 'right-speaker-slot']]) {
    assert.ok(Math.abs(measured.get(heading).box.y - measured.get(separator).box.y) < 1, 'separator shares its heading row');
    assert.ok(measured.get(separator).box.x > measured.get(heading).box.x + measured.get(heading).box.width);
    assert.ok(measured.get(separator).box.x + measured.get(separator).box.width < measured.get(name).box.x);
  }
});
test('unfit title remains a located layout failure instead of shrinking below the reading floor', async () => {
  const source = fixture();
  source.canonicalMetadata.title = '需要人工調整的過長標題'.repeat(12);
  const original = structuredClone(source);
  const submissionJSON = JSON.stringify(source);
  await assert.rejects(composeBulletinLayout({submissionJSON, expectedContentHash: hash(submissionJSON), assetsDirectory, timeoutMs: 15000}), error => {
    assert.equal(error.message, 'page_requires_edit');
    assert.equal(error.cause?.pageId, 'body-page');
    assert.equal(error.cause?.slotId, 'canonical-title');
    return true;
  });
  assert.deepEqual(source, original);
});
test('hard breaks in a section heading require a located edit instead of silently fitting two lines', async () => {
  const source = fixture();
  const title = source.document.components[1].bodySection.title;
  title.sentences[0].spans[0].text = '第一行\n第二行';
  source.document.layoutManifest.pages[1].slots[0].fragments[0].end = 7;
  const submissionJSON = JSON.stringify(source);
  await assert.rejects(composeBulletinLayout({submissionJSON, expectedContentHash: hash(submissionJSON), assetsDirectory, timeoutMs: 15000}), error => {
    assert.equal(error.message, 'page_requires_edit');
    assert.equal(error.cause?.pageId, 'body-page');
    assert.equal(error.cause?.slotId, 'heading-slot');
    return true;
  });
});
test('V8 measurement binds the original identity and rejects stale or forged versions', async () => {
  const source = fixture();
  const submissionJSON = JSON.stringify(source);
  const input = {submissionJSON, expectedContentHash: hash(submissionJSON), assetsDirectory, timeoutMs: 15000};
  const measured = await measureBulletinLayout(input);
  assert.equal(measured.contentHash, input.expectedContentHash);
  assert.equal(measured.rendererArtifactSha256, digest);
  const {layoutValidationHash, ...identity} = measured;
  assert.equal(layoutValidationHash, hash(JSON.stringify(identity)));
  await assert.rejects(measureBulletinLayout({...input, expectedContentHash: '0'.repeat(64)}), /stale_content/);
  source.document.layoutManifest.rendererArtifactSha256 = '0'.repeat(64);
  const forged = JSON.stringify(source);
  await assert.rejects(measureBulletinLayout({...input, submissionJSON: forged, expectedContentHash: hash(forged)}), /update_required/);
});
