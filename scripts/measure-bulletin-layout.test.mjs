import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {execFileSync, spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {test} from 'node:test';
import {measureBulletinLayout} from './measure-bulletin-layout.mjs';
import * as layoutRunner from './measure-bulletin-layout.mjs';
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

test('worker CLI composes the same anchored document and emits only a JSON result', {skip: !assetsDirectory}, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'hhc-layout-cli-'));
  try {
    const input = await fixture();
    const path = join(directory, 'input.json');
    await writeFile(path, JSON.stringify(input), {mode: 0o600});
    const result = JSON.parse(execFileSync(process.execPath, ['scripts/measure-bulletin-layout.mjs', '--compose', path, assetsDirectory], {encoding: 'utf8', maxBuffer: 16 * 1024 * 1024}));
    assert.deepEqual(JSON.parse(result.submissionJSON).document.components, JSON.parse(input.submissionJSON).document.components);
    assert.equal(hash(result.submissionJSON), result.expectedContentHash);
    assert.equal(result.measurement.contentHash, result.expectedContentHash);
    assert.deepEqual(result.measurement.overflow, []);
  } finally {await rm(directory, {recursive: true, force: true});}
});

test('worker CLI rejects oversized or malformed requests without exposing input or paths', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'hhc-layout-cli-'));
  try {
    const path = join(directory, 'private-member-content.json');
    for (const input of ['private-member-content', ' '.repeat(16 * 1024 * 1024 + 1)]) {
      await writeFile(path, input, {mode: 0o600});
      const result = spawnSync(process.execPath, ['scripts/measure-bulletin-layout.mjs', '--compose', path, '/private-assets'], {encoding: 'utf8'});
      assert.equal(result.status, 1);
      assert.equal(result.stdout, '');
      assert.equal(result.stderr, 'layout_runner_failed\n');
    }
  } finally {await rm(directory, {recursive: true, force: true});}
});

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
test('verified hymn stars use their immutable symbol font and Unicode scalar anchors', {skip: !assetsDirectory}, async () => {
  const input = await fixture('★\u{1f7cb}');
  const submission = JSON.parse(input.submissionJSON);
  submission.document.components[0].items[0].blocks[0].sentences[0].spans[0].fontRole = 'symbol';
  const submissionJSON = JSON.stringify(submission);
  const result = await measureBulletinLayout({...input, submissionJSON, expectedContentHash: hash(submissionJSON)});
  assert.deepEqual(result.overflow, []);
  assert.equal(result.pages[0].slots[0].fragments[0].end, 2);
  assert.ok(result.fontHashes.includes('89ed6ff28006ceddbfb893fc2812b5868c5b691341c48959a092b25f33ec5bdd'));
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
  assert.equal(first.fontHashes.length, 4);
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
test('individually fitting text slots still block publication when their glyphs overlap', {skip: !assetsDirectory}, async () => {
  const input = await fixture();
  const submission = JSON.parse(input.submissionJSON);
  const block = submission.document.components[0].items[0].blocks[0];
  const next = structuredClone(block);
  next.id = 'next-block';
  next.sentences[0].id = 'next-sentence';
  submission.document.components[0].items[0].blocks.push(next);
  const slot = submission.document.layoutManifest.pages[0].slots[0];
  submission.document.layoutManifest.pages[0].slots.push({...structuredClone(slot), id: 'next-slot', blockId: next.id, fragments: [{sentenceId: 'next-sentence', start: 0, end: 7}]});
  let submissionJSON = JSON.stringify(submission);
  const overlapping = await measureBulletinLayout({...input, submissionJSON, expectedContentHash: hash(submissionJSON)});
  assert.deepEqual(new Set(overlapping.overflow.map(value => value.slotId)), new Set(['slot', 'next-slot']));
  submission.document.layoutManifest.pages[0].slots[1].box.y = .3;
  submissionJSON = JSON.stringify(submission);
  const separated = await measureBulletinLayout({...input, submissionJSON, expectedContentHash: hash(submissionJSON)});
  assert.deepEqual(separated.overflow, []);
});
test('template ornament bounds do not masquerade as text overflow', {skip: !assetsDirectory}, async () => {
  const input = await fixture();
  const submission = JSON.parse(input.submissionJSON);
  const slot = {id: 'native-title-label', element: 'titleLabel', box: {x: 45.84/595.32, y: 205.97/841.92, width: 84.24/595.32, height: 14.04/841.92}, style: {fontSize: 14, lineHeight: 14.04, indent: 0, firstLineIndent: 0, spaceBefore: 0, spaceAfter: 0}};
  submission.document.layoutManifest.pages[0].fixedSlots = [slot];
  let submissionJSON = JSON.stringify(submission);
  const fitted = await measureBulletinLayout({...input, submissionJSON, expectedContentHash: hash(submissionJSON)});
  assert.deepEqual(fitted.overflow, [], JSON.stringify(fitted.pages[0].slots.find(value => value.slotId === slot.id)));
  // A real extra line still blocks; only the non-text pseudo-element is excluded.
  slot.box.width /= 2;
  submissionJSON = JSON.stringify(submission);
  const wrapped = await measureBulletinLayout({...input, submissionJSON, expectedContentHash: hash(submissionJSON)});
  assert.ok(wrapped.overflow.some(value => value.slotId === slot.id));
});
test('native cover masthead preserves the reference word gap at printed size', {skip: !assetsDirectory}, async () => {
  const input = await fixture();
  const submission = JSON.parse(input.submissionJSON);
  submission.document.layoutManifest.pages[0].fixedSlots = [{id: 'native-masthead', element: 'masthead', box: {x: 218.25/595.32, y: 44/841.92, width: 246.12/595.32, height: 36/841.92}, style: {fontSize: 28, lineHeight: 36, letterSpacing: -.135, indent: 0, firstLineIndent: 0, spaceBefore: 0, spaceAfter: 0}}];
  const submissionJSON = JSON.stringify(submission);
  const result = await measureBulletinLayout({...input, submissionJSON, expectedContentHash: hash(submissionJSON)});
  const slot = result.pages[0].slots.find(slot => slot.slotId === 'native-masthead');
  const width = Math.max(...slot.fragments.flatMap(fragment => fragment.lines.map(line => line.width)));
  assert.ok(width >= 244 && width <= 247, `masthead word gap changed (${width}pt)`);
  assert.deepEqual(result.overflow, []);
});
test('body issue and contributor captions use legal glyphs and never become editable sentence anchors', {skip: !assetsDirectory}, async () => {
  const input = await fixture();
  const submission = JSON.parse(input.submissionJSON);
  submission.document.sourcePageCount = 12;
  submission.document.layoutManifest.pages[0].fixedSlots = [
    {id: 'date-marker', element: 'lectureDateMarker', box: {x: 68.064/595.32, y: 234.17696/841.92, width: 11.04/595.32, height: 14/841.92}},
    {id: 'issue-summary', element: 'bodyIssueSummary', box: {x: 203.69/595.32, y: 234.17696/841.92, width: 74/595.32, height: 14/841.92}},
    {id: 'body-speaker', element: 'bodySpeakerLabel', box: {x: 68.064/595.32, y: 254.21696/841.92, width: 29.04/595.32, height: 14/841.92}},
  ].map(slot => ({...slot, style: {fontSize: 11, lineHeight: 11.04, letterSpacing: slot.element === 'bodySpeakerLabel' ? -.43 : 0, indent: 0, firstLineIndent: 0, spaceBefore: 0, spaceAfter: 0}}));
  const submissionJSON = JSON.stringify(submission);
  const result = await measureBulletinLayout({...input, submissionJSON, expectedContentHash: hash(submissionJSON)});
  assert.deepEqual(result.overflow, []);
  for (const slot of result.pages[0].slots.filter(slot => slot.fixedElement)) assert.ok(slot.fragments.every(fragment => fragment.sentenceId === null));
});
test('native body canonical art retains transformed sentence bounds without covering metadata', {skip: !assetsDirectory}, async () => {
  for (const source of [
    {title: '永恆的命定和呼召', subtitle: '～我們起來建造吧!', issueNumber: 1740, date: '2026-09-27', shadows: [{x: .1026, y: .09022, width: .60502, height: .0625}, {x: .51401, y: .20909, width: .38107, height: .03627}]},
    {title: '詩篇廿三篇、洗革拉戰役', subtitle: '～被聖靈充滿必有的三個看見', issueNumber: 1739, date: '2026-09-20', shadows: [{x: .10421286, y: .08452109, width: .66186253, height: .06178734}, {x: .40858698, y: .21536607, width: .4927434, height: .03370748}]},
  ]) {
  const input = await fixture();
  const submission = JSON.parse(input.submissionJSON);
  const {shadows, ...metadata} = source;
  submission.canonicalMetadata = metadata;
  submission.document.pages.push({id: 'body', width: 595.32, height: 841.92});
  const slots = [
    {element: 'title', shadow: shadows[0]},
    {element: 'subtitle', shadow: shadows[1]},
  ].map(({element, shadow}) => {
    const size = shadow.height * 841.92 * .8;
    const shift = size * .35 / 595.32;
    const text = Array.from(submission.canonicalMetadata[element]);
    const units = text.reduce((sum, character) => sum + (/\p{Script=Han}/u.test(character) || character.codePointAt(0) >= 0x3000 && character.codePointAt(0) <= 0xffef ? 1 : .5), 0);
    const tracking = ((shadow.width-shift)*595.32 - 1 - size*units) / (text.length*size);
    return {id: `body-${element}`, element, box: {x: shadow.x + shift, y: shadow.y - size/841.92, width: shadow.width - shift, height: size*2/841.92}, style: {fontSize: size, lineHeight: size*2, letterSpacing: tracking, indent: 0, firstLineIndent: 0, spaceBefore: 0, spaceAfter: 0}};
  });
  slots.push({id:'body-issue-summary',element:'bodyIssueSummary',box:{x:.3,y:.3,width:.2,height:.02},style:{fontSize:11,lineHeight:14,indent:0,firstLineIndent:0,spaceBefore:0,spaceAfter:0}});
  submission.document.layoutManifest.pages.push({pageId: 'body', slots: [], fixedSlots: slots});
  const submissionJSON = JSON.stringify(submission);
  const result = await measureBulletinLayout({...input, submissionJSON, expectedContentHash: hash(submissionJSON)});
  assert.deepEqual(result.overflow, [], JSON.stringify(result.pages[1]));
  const title = result.pages[1].slots.find(slot => slot.fixedElement === 'title');
  assert.equal(title.fragments[0].sentenceId, 'canonical-title');
  assert.ok(title.fragments[0].lines.every(line => line.height > 80 && line.y + line.height < 160));
  }
});
test('fixed back sidebar uses vertical native glyphs at the source column positions', {skip: !assetsDirectory}, async () => {
  const input = await fixture();
  const submission = JSON.parse(input.submissionJSON);
  // Summary body starts to the right of the two vertical sidebar columns.
  submission.document.layoutManifest.pages[0].slots[0].box.x = .2;
  submission.document.layoutManifest.pages[0].slots[0].box.width = .7;
  submission.document.layoutManifest.pages[0].fixedSlots = [
    {id: 'sidebar-title', element: 'summarySidebarTitle', box: {x: 53.28/595.32, y: 77.077/841.92, width: 11.04/595.32, height: 54.24/841.92}},
    {id: 'sidebar-tagline', element: 'summarySidebarTagline', box: {x: 40.2/595.32, y: 50.077/841.92, width: 11.04/595.32, height: 108.24/841.92}},
  ].map(slot => ({...slot, style: {fontSize: 11, lineHeight: 11, letterSpacing: 10.8/11-1, indent: 0, firstLineIndent: 0, spaceBefore: 0, spaceAfter: 0}}));
  const submissionJSON = JSON.stringify(submission);
  const result = await measureBulletinLayout({...input, submissionJSON, expectedContentHash: hash(submissionJSON)});
  assert.deepEqual(result.overflow, []);
  const slot = result.pages[0].slots.find(slot => slot.slotId === 'sidebar-tagline');
  const bounds = slot.fragments.flatMap(fragment => fragment.lines);
  assert.ok(bounds.every(box => box.width < 12 && box.height > 100));
  assert.ok(slot.fragments.every(fragment => fragment.sentenceId === null));
});
test('source back frames remain behind text and outside sentence anchors in both originals', {skip: !assetsDirectory}, async () => {
  for (const boxes of [
    [[75.75,11.25,486.4,174], [12.75,207.75,560.8,161.3], [18.75,370.5,559.45,90.15]],
    [[75.75,11.25,486.4,187.2], [12.75,215.35,560.8,171.55], [18.75,390.6,559.45,71.75]],
  ]) {
    const input = await fixture();
    const submission = JSON.parse(input.submissionJSON);
    submission.document.layoutManifest.pages[0].fixedSlots = boxes.map(([x,y,width,height], index) => ({id: `frame-${index}`, element: ['summaryFrame', 'announcementsFrame', 'prayersFrame'][index], box: {x:x/595.32,y:y/841.92,width:width/595.32,height:height/841.92}, style: {fontSize:6,lineHeight:6,indent:0,firstLineIndent:0,spaceBefore:0,spaceAfter:0}}));
    const submissionJSON = JSON.stringify(submission);
    const result = await measureBulletinLayout({...input, submissionJSON, expectedContentHash: hash(submissionJSON)});
    assert.deepEqual(result.overflow, []);
    assert.ok(result.pages[0].slots.filter(slot => slot.fixedElement).every(slot => slot.fragments.every(fragment => fragment.sentenceId === null)));
    assert.equal(result.pages[0].slots.find(slot => slot.slotId === 'slot').fragments[0].sentenceId, 's');
  }
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
  assert.equal(new Set(submission.document.layoutManifest.assets.map(asset => asset.url)).size, 4);
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
    submission.document.layoutManifest.assets = JSON.parse((await fixture()).submissionJSON).document.layoutManifest.assets;
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

test('mixed inline source sizes are measured at their declared PDF-point proportion', {skip: !assetsDirectory}, async () => {
  const input = await fixture('中文。');
  const submission = JSON.parse(input.submissionJSON);
  submission.document.components[0].items[0].blocks[0].sentences[0].spans[0].fontSize = 12;
  const submissionJSON = JSON.stringify(submission);
  const result = await measureBulletinLayout({...input, submissionJSON, expectedContentHash: hash(submissionJSON)});
  assert.deepEqual(result.overflow, []);
  const lines = result.pages[0].slots[0].fragments[0].lines;
  assert.ok(lines.some(line => Math.abs(line.height - 12) < .8 && line.width >= 35 && line.width <= 37), 'source 12pt must not inherit 16pt');
});

test('body composition grows paragraphs and adds pages without changing sentence anchors or font sizes', {skip: !assetsDirectory}, async () => {
  const input = await fixture('信息');
  const submission = JSON.parse(input.submissionJSON);
  const title = submission.document.components[0].items[0].blocks[0];
  const paragraph = (id, text) => ({id, style: {...title.style}, sentences: [{id: `${id}-sentence`, spans: [{text, fontRole: 'scripture'}]}]});
  const body = [paragraph('first', '經文'.repeat(100)), paragraph('second', '正文。'), paragraph('last', '禱告'.repeat(40)), paragraph('ending', '結語。')];
  submission.document.components = [{id: 'c', type: 'bodySection', bodySection: {kind: 'sermon', title, blocks: body}}];
  const original = submission.document.layoutManifest.pages[0].slots[0];
  submission.document.layoutManifest.pages[0].fixedSlots = [{id:'page-number',element:'pageNumber',box:{x:.88,y:.05,width:.005,height:.04},style:{...title.style,indent:0,firstLineIndent:0}}];
  original.box.height = 24 / 841.92;
  submission.document.layoutManifest.pages[0].slots.push(...body.map((block, index) => ({id: `slot-${block.id}`, componentId: 'c', blockId: block.id, box: {x: .1, y: [110, 134, 740, 770][index] / 841.92, width: .8, height: 24 / 841.92}, fragments: [{sentenceId: block.sentences[0].id, start: 0, end: Array.from(block.sentences[0].spans[0].text).length}]})));
  const submissionJSON = JSON.stringify(submission);
  assert.equal(typeof layoutRunner.composeBulletinBodyLayout, 'function');
  const composed = await layoutRunner.composeBulletinBodyLayout({...input, submissionJSON, expectedContentHash: hash(submissionJSON)});
  const result = JSON.parse(composed.submissionJSON);
  assert.equal(result.document.pages.length, 2);
  assert.equal(result.document.sourcePageCount, 4);
  assert.deepEqual(result.document.components, submission.document.components);
  assert.deepEqual(result.document.layoutManifest.pages.flatMap(page => page.slots.map(slot => slot.fragments)), submission.document.layoutManifest.pages.flatMap(page => page.slots.map(slot => slot.fragments)));
  assert.deepEqual(composed.measurement.overflow, []);
  assert.equal(composed.measurement.contentHash, hash(composed.submissionJSON));
  assert.notEqual(composed.measurement.contentHash, hash(submissionJSON));
  const repeat = await layoutRunner.composeBulletinBodyLayout({...input, submissionJSON, expectedContentHash: hash(submissionJSON)});
  assert.deepEqual(composed, repeat);
});

test('cover composition retains every sentence while separating its variable-length sections', {skip: !assetsDirectory}, async () => {
  const input = await fixture('歡迎一起敬拜。');
  const submission = JSON.parse(input.submissionJSON);
  const welcome = submission.document.components[0].items[0].blocks[0];
  const question = {id: 'question', style: {...welcome.style}, sentences: [{id: 'question-sentence', spans: [{text: '分享與禱告。'.repeat(18), fontRole: 'body'}]}]};
  submission.document.components = [{id: 'c', type: 'cover', cover: {welcome: [welcome], worship: [], work: [], wordQuestions: [{id: 'q', blocks: [question]}], weeklyVerses: []}}];
  const layout = submission.document.layoutManifest.pages[0];
  layout.slots.push({id: 'question-slot', componentId: 'c', blockId: question.id, box: {...layout.slots[0].box}, fragments: [{sentenceId: 'question-sentence', start: 0, end: 108}]});
  layout.fixedSlots = ['welcomeLabel','wordLabel','title','subtitle','date','issueNumber'].map(element => ({id: `fixed-${element}`, element, style: {...welcome.style}, box: {x: .1, y: .1, width: .05, height: .02}}));
  const submissionJSON = JSON.stringify(submission);
  assert.equal(typeof layoutRunner.composeBulletinLayout, 'function');
  const composed = await layoutRunner.composeBulletinLayout({...input, submissionJSON, expectedContentHash: hash(submissionJSON)});
  const result = JSON.parse(composed.submissionJSON);
  assert.deepEqual(composed.measurement.overflow, []);
  assert.deepEqual(result.document.components[0].cover.welcome[0].sentences, welcome.sentences);
  assert.deepEqual(result.document.components[0].cover.wordQuestions[0].blocks[0].sentences, question.sentences);
  assert.equal(result.document.components[0].cover.wordQuestions[0].blocks[0].style.fontSize, 16);
  assert.equal(result.document.layoutManifest.pages.flatMap(page => page.slots).length, 2);
});

test('composition keeps the lecture date clear of its fixed marker', {skip: !assetsDirectory}, async () => {
  const input = await fixture('Sep.13.2026');
  const submission = JSON.parse(input.submissionJSON);
  const date = submission.document.components[0].items[0].blocks[0];
  const title = {id:'heading',style:{...date.style},sentences:[{id:'heading-sentence',spans:[{text:'信息',fontRole:'emphasis'}]}]};
  submission.document.components = [{id:'c',type:'bodySection',bodySection:{kind:'sermon',header:{lectureDate:date,contributors:[]},title,blocks:[]}}];
  const page = submission.document.layoutManifest.pages[0];
  page.fixedSlots = [{id:'date-marker',element:'lectureDateMarker',box:{x:.095,y:.1,width:.03,height:.04},style:{...date.style}}];
  page.slots.push({id:'heading-slot',blockId:'heading',componentId:'c',box:{x:.1,y:.3,width:.8,height:.04},fragments:[{sentenceId:'heading-sentence',start:0,end:2}]});
  const submissionJSON = JSON.stringify(submission);
  const result = await layoutRunner.composeBulletinLayout({...input,submissionJSON,expectedContentHash:hash(submissionJSON)});
  assert.deepEqual(result.measurement.overflow,[]);
});

test('body contributor captions use readable tracking and reserve space before names', {skip: !assetsDirectory}, async () => {
  const input = await fixture('講員姓名');
  const submission = JSON.parse(input.submissionJSON);
  const name = submission.document.components[0].items[0].blocks[0];
  const title = {id:'title',style:{...name.style},sentences:[]};
  const date = {id:'date',style:{...name.style},sentences:[]};
  submission.document.components = [{id:'c',type:'bodySection',bodySection:{kind:'sermon',title,blocks:[],header:{lectureDate:date,contributors:[{role:'speaker',name}]}}}];
  const page = submission.document.layoutManifest.pages[0];
  page.fixedSlots = [{id:'caption',element:'bodySpeakerLabel',box:{x:.05,y:.1,width:.05,height:.04},style:{...name.style,letterSpacing:-.4}}];
  const submissionJSON = JSON.stringify(submission);
  const result = await layoutRunner.composeBulletinBodyLayout({...input,submissionJSON,expectedContentHash:hash(submissionJSON)});
  const layout = JSON.parse(result.submissionJSON).document.layoutManifest.pages[0];
  assert.equal(layout.fixedSlots[0].style.letterSpacing,0);
  assert.ok(layout.slots[0].box.x >= layout.fixedSlots[0].box.x+layout.fixedSlots[0].box.width);
  assert.deepEqual(result.measurement.overflow,[]);
});

test('retained back panels grow around their text without importing excluded table regions', {skip: !assetsDirectory}, async () => {
  const input = await fixture('摘要'.repeat(100));
  const submission = JSON.parse(input.submissionJSON);
  const block = submission.document.components[0].items[0].blocks[0];
  const second = {id:'ending',style:{...block.style},sentences:[{id:'ending-sentence',spans:[{text:'代禱。',fontRole:'body'}]}]};
  submission.document.components[0].items[0].blocks.push(second);
  const layout = submission.document.layoutManifest.pages[0];
  layout.slots[0].box.height = .03;
  layout.slots.push({id:'ending-slot',componentId:'c',blockId:second.id,box:{x:.1,y:.13,width:.8,height:.03},fragments:[{sentenceId:'ending-sentence',start:0,end:3}]});
  layout.fixedSlots = [{id:'frame',element:'summaryFrame',box:{x:.08,y:.08,width:.84,height:.1},style:{...block.style}}];
  const submissionJSON = JSON.stringify(submission);
  const result = await layoutRunner.composeBulletinLayout({...input,submissionJSON,expectedContentHash:hash(submissionJSON)});
  assert.deepEqual(result.measurement.overflow,[]);
  const page = JSON.parse(result.submissionJSON).document.layoutManifest.pages[0];
  const frame = page.fixedSlots.find(slot=>slot.element==='summaryFrame');
  assert.ok(frame.box.y <= page.slots[0].box.y);
  assert.ok(frame.box.y+frame.box.height >= page.slots[1].box.y+page.slots[1].box.height);
  assert.deepEqual(JSON.parse(result.submissionJSON).document.components,submission.document.components);
});

test('composition keeps normal glyph spacing and distinct text lines for compressed source paragraphs', {skip: !assetsDirectory}, async () => {
  const input = await fixture('經文'.repeat(70));
  const submission = JSON.parse(input.submissionJSON);
  const block = submission.document.components[0].items[0].blocks[0];
  block.style.letterSpacing = -.4;
  block.style.lineHeight = 8;
  const submissionJSON = JSON.stringify(submission);
  const raw = await measureBulletinLayout({...input,submissionJSON,expectedContentHash:hash(submissionJSON)});
  assert.ok(raw.overflow.some(slot=>slot.slotId==='slot'), 'overlapping lines inside one paragraph must also block publication');
  const result = await layoutRunner.composeBulletinLayout({...input,submissionJSON,expectedContentHash:hash(submissionJSON)});
  const lines = result.measurement.pages[0].slots.find(slot=>slot.slotId==='slot').fragments[0].lines;
  const tops = [...new Set(lines.map(line=>line.y))].sort((a,b)=>a-b);
  assert.ok(tops.length >= 4, 'normal-size glyphs must wrap rather than squeeze into two lines');
  assert.ok(tops.slice(1).every((top,index)=>top-tops[index]>=16), 'line spacing must contain the 16pt glyphs');
  assert.equal(JSON.parse(result.submissionJSON).document.components[0].items[0].blocks[0].style.fontSize,16);
});

test('overlapping mixed-size lines are rejected even when all ink stays inside one slot', {skip: !assetsDirectory}, async () => {
  const input = await fixture('先。\n經文。\n經文。');
  const submission = JSON.parse(input.submissionJSON);
  const block = submission.document.components[0].items[0].blocks[0];
  block.style.fontSize = 8;
  block.style.lineHeight = 12;
  block.sentences[0].spans = [{text:'先。\n',fontRole:'body'},{text:'經文。\n經文。',fontRole:'body',fontSize:24}];
  const submissionJSON = JSON.stringify(submission);
  const result = await measureBulletinLayout({...input,submissionJSON,expectedContentHash:hash(submissionJSON)});
  assert.ok(result.overflow.some(slot=>slot.slotId==='slot'));
});

test('body captions move with expanded preceding rows', {skip: !assetsDirectory}, async () => {
  const input = await fixture('正文'.repeat(40));
  const submission = JSON.parse(input.submissionJSON);
  const component = submission.document.components[0];
  component.type = 'bodySection';
  component.bodySection = {kind:'sermon',title:component.items[0].blocks[0],blocks:[]};
  delete component.items;
  const page = submission.document.layoutManifest.pages[0];
  page.slots[0].box.height = .02;
  page.fixedSlots = [{id:'caption',element:'editorLabel',box:{x:.1,y:.14,width:.2,height:.04},style:{...component.bodySection.title.style}}];
  const submissionJSON = JSON.stringify(submission);
  const result = await layoutRunner.composeBulletinBodyLayout({...input,submissionJSON,expectedContentHash:hash(submissionJSON)});
  assert.deepEqual(result.measurement.overflow,[]);
});
