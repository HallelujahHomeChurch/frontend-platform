import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {execFileSync, spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {test} from 'node:test';
const v5=process.env.HHC_TEST_RENDERER_V5==='1';
const v4=v5||process.env.HHC_TEST_RENDERER_V4==='1';
const v3=v4||process.env.HHC_TEST_RENDERER_V3==='1';
const script=v5?'scripts/measure-bulletin-layout-v5.mjs':v4?'scripts/measure-bulletin-layout-v4.mjs':v3?'scripts/measure-bulletin-layout-v3.mjs':'scripts/measure-bulletin-layout.mjs';
const layoutRunner=await import(`../${script}`);
const {measureBulletinLayout}=layoutRunner;
const {BULLETIN_RENDERER_V1_DIGEST:legacyDigest}=await import('../packages/ui/dist/bulletin-reader/artifact.js');
const {BULLETIN_RENDERER_V3_DIGEST:thirdDigest}=await import('../packages/ui/dist/bulletin-reader/v3/artifact.js');
const newDigest=v5?(await import('../packages/ui/dist/bulletin-reader/v5/artifact.js')).BULLETIN_RENDERER_V5_DIGEST:v4?(await import('../packages/ui/dist/bulletin-reader/v4/artifact.js')).BULLETIN_RENDERER_V4_DIGEST:thirdDigest;
const BULLETIN_RENDERER_V1_DIGEST=v3?newDigest:legacyDigest;

const assetsDirectory = process.env.HHC_BULLETIN_TEMPLATE_DIR;
const hash = value => createHash('sha256').update(value).digest('hex');
async function fixture(text = '這是一句測試。') {
  const assets = JSON.parse(await readFile(new URL('../packages/ui/src/bulletin-reader/template-assets.json', import.meta.url), 'utf8'));
  const document = {
    issueId: '00000000-0000-4000-8000-000000000001', series: 'general', contentLocale: 'zh-Hant', schemaVersion: '1', templateVersion: 'v1', sourceAssetChecksum: 'a'.repeat(64), sourcePageCount: 4,
    pages: [{id: 'p', width: 595.32, height: 841.92}],
    components: [{id: 'c', type: 'backSummary', items: [{id: 'i', blocks: [{id: 'b', style: {fontSize: 16, lineHeight: 24, indent: 0, firstLineIndent: 0, spaceBefore: 0, spaceAfter: 0}, sentences: [{id: 's', spans: [{text, fontRole: 'body'}]}]}]}]}],
    layoutManifest: {templateVersion: 'v1', rendererVersion: v5?'v5':v4?'v4':v3?'v3':'v1', rendererArtifactSha256: BULLETIN_RENDERER_V1_DIGEST, assets: assets.filter(asset => asset.kind === 'font').map(asset => ({url: asset.url, sha256: asset.sha256, kind: 'font', fontRole: asset.roles[0]})), pages: [{pageId: 'p', slots: [{id: 'slot', componentId: 'c', blockId: 'b', box: {x: .1, y: .1, width: .8, height: .1}, fragments: [{sentenceId: 's', start: 0, end: Array.from(text).length}]}]}]},
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
    const result = JSON.parse(execFileSync(process.execPath, [script, '--compose', path, assetsDirectory], {encoding: 'utf8', maxBuffer: 16 * 1024 * 1024}));
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
      const result = spawnSync(process.execPath, [script, '--compose', path, '/private-assets'], {encoding: 'utf8'});
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

test('hanging whitespace does not reject fitting ink, but visible overflow still fails', {skip: !assetsDirectory||!v3}, async () => {
  const input=await fixture('測試 ');
  const submission=JSON.parse(input.submissionJSON);
  const block=submission.document.components[0].items[0].blocks[0];
  block.style={...block.style,fontSize:14,lineHeight:18};
  submission.document.layoutManifest.pages[0].slots[0].box.width=28/submission.document.pages[0].width;
  const submissionJSON=JSON.stringify(submission);
  const result=await measureBulletinLayout({...input,submissionJSON,expectedContentHash:hash(submissionJSON)});
  assert.deepEqual(result.overflow,[]);
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
    submission.document.layoutManifest.rendererVersion = v5?'v5':v4?'v4':v3?'v3':'v1';
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

test('body composition reclaims excessive gaps without adding pages or changing text', {skip: !assetsDirectory}, async () => {
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
  assert.deepEqual(result.document.pages, submission.document.pages);
  assert.equal(result.document.sourcePageCount, 4);
  assert.deepEqual(result.document.components, submission.document.components);
  assert.deepEqual(result.document.layoutManifest.pages.flatMap(page => page.slots.map(slot => slot.fragments)), submission.document.layoutManifest.pages.flatMap(page => page.slots.map(slot => slot.fragments)));
  assert.deepEqual(composed.measurement.overflow, []);
  assert.equal(composed.measurement.contentHash, hash(composed.submissionJSON));
  assert.notEqual(composed.measurement.contentHash, hash(submissionJSON));
  const repeat = await layoutRunner.composeBulletinBodyLayout({...input, submissionJSON, expectedContentHash: hash(submissionJSON)});
  assert.deepEqual(composed, repeat);
});

test('oversized text fails closed instead of adding source pages', {skip: !assetsDirectory}, async () => {
  await assert.rejects(layoutRunner.composeBulletinBodyLayout(await fixture('禱告。'.repeat(600))), /page_requires_edit/);
});

test('dense Letter lyrics use safe bottom whitespace without shrinking below 12pt or adding pages', {skip: !assetsDirectory || !v4}, async () => {
  const input=await fixture('詩歌');
  const submission=JSON.parse(input.submissionJSON), d=submission.document;
  d.pages=[{id:'p',width:612,height:792}];
  const blocks=Array.from({length:45},(_,i)=>({id:`b${i}`,style:{fontSize:12,lineHeight:14,align:'left'},sentences:[{id:`s${i}`,spans:[{text:'測試歌詞',fontRole:'body'}]}]}));
  d.components=[{id:'c',type:'hymnLyrics',hymnLyrics:{hymns:[{id:'h',title:blocks[0],sections:[{id:'verse',kind:'verse',lines:blocks.slice(1)}]}]}}];
  d.layoutManifest.pages=[{pageId:'p',slots:blocks.map((block,i)=>({id:`slot${i}`,componentId:'c',blockId:block.id,box:{x:.55,y:(107.5+14*i+(i>=15?13:0)+(i>=29?13:0))/792,width:.4,height:12/792},fragments:[{sentenceId:`s${i}`,start:0,end:4}]}))}];
  const submissionJSON=JSON.stringify(submission);
  const result=await layoutRunner.composeBulletinBodyLayout({...input,submissionJSON,expectedContentHash:hash(submissionJSON)});
  const composed=JSON.parse(result.submissionJSON).document;
  assert.equal(composed.pages.length,1);
  assert.deepEqual(result.measurement.overflow,[]);
  assert.ok(result.measurement.pages[0].slots.every(s=>s.box.y+s.box.height<=768.1));
  assert.ok(composed.components[0].hymnLyrics.hymns[0].sections[0].lines.every(b=>b.style.fontSize>=12));
  assert.deepEqual(composed.layoutManifest.pages[0].slots.map(s=>s.fragments),d.layoutManifest.pages[0].slots.map(s=>s.fragments));
});

test('complete dense cover retains verse text and readable size within a 24pt bottom margin', {skip: !assetsDirectory || !v5}, async () => {
  const input=await fixture();
  const submission=JSON.parse(input.submissionJSON),d=submission.document,layout=d.layoutManifest.pages[0];
  const make=(id,text)=>({id,style:{fontSize:12,lineHeight:15,indent:0,firstLineIndent:0,spaceBefore:0,spaceAfter:0},sentences:[{id:`s-${id}`,spans:[{text,fontRole:'scripture'}]}]});
  const question=make('question','測'.repeat(42*34)),verse=make('verse','經文'.repeat(40));
  d.components=[{id:'c',type:'cover',cover:{welcome:[],worship:[],work:[],wordQuestions:[{id:'q',blocks:[question]}],weeklyVerses:[verse]}}];
  layout.slots=[question,verse].map(b=>({id:`slot-${b.id}`,componentId:'c',blockId:b.id,box:{x:.1,y:.3,width:.8,height:.03},fragments:[{sentenceId:`s-${b.id}`,start:0,end:b.sentences[0].spans[0].text.length}]}));
  layout.fixedSlots=['wordLabel','verseLabel'].map(element=>({id:`fixed-${element}`,element,style:{fontSize:12,lineHeight:15},box:{x:.1,y:.1,width:.8,height:.03}}));
  const submissionJSON=JSON.stringify(submission);
  const result=await layoutRunner.composeBulletinLayout({...input,submissionJSON,expectedContentHash:hash(submissionJSON)});
  const saved=JSON.parse(result.submissionJSON).document;
  assert.equal(saved.pages.length,1);
  assert.deepEqual(result.measurement.overflow,[]);
  assert.deepEqual(saved.components[0].cover.weeklyVerses[0].sentences,verse.sentences);
  assert.ok(saved.components[0].cover.weeklyVerses[0].style.fontSize>=12);
  assert.ok(result.measurement.pages[0].slots.every(s=>s.box.y+s.box.height<=841.92-24+.1));
});

test('an oversized cover rejects composition instead of silently adding another cover page', {skip: !assetsDirectory}, async () => {
  const input=await fixture('文字。'.repeat(600));
  const submission=JSON.parse(input.submissionJSON);
  const block=submission.document.components[0].items[0].blocks[0];
  block.style.letterSpacing=0;
  submission.document.components=[{id:'c',type:'cover',cover:{welcome:[block],worship:[],work:[],wordQuestions:[],weeklyVerses:[]}}];
  const submissionJSON=JSON.stringify(submission);
  await assert.rejects(layoutRunner.composeBulletinLayout({...input,submissionJSON,expectedContentHash:hash(submissionJSON)}), /cover_requires_edit/);
});

test('cover keeps its compact rows and aligned work on one page, ending at the full-width verse', {skip: !assetsDirectory}, async () => {
  const input = await fixture();
  const submission = JSON.parse(input.submissionJSON);
  const {document} = submission;
  const layout = document.layoutManifest.pages[0];
  const style = {...document.components[0].items[0].blocks[0].style, fontSize:13, lineHeight:19};
  layout.slots = [];
  const block = (id, text) => {
    layout.slots.push({id:`slot-${id}`,componentId:'c',blockId:id,box:{x:.1,y:.3,width:.8,height:.03},fragments:[{sentenceId:`s-${id}`,start:0,end:Array.from(text).length}]});
    return {id,style:{...style},sentences:[{id:`s-${id}`,spans:[{text,fontRole:'body'}]}]};
  };
  const work = [1,2,3].map(n => ({id:`work-${n}`,blocks:[block(`work-${n}`, `${n}.凡事求告耶和華神，領受上頭來的智慧、啟示和能力，勝過仇敵一切的詭計。`)]}));
  const cover = {
    welcome:[block('welcome','在這一波風浪中家教會眾肢體同心合意、倚靠聖靈、各盡其職，必迎來一股屬靈極大的復興!')],
    worship:['➊靠著神/58','➋詩篇廿三篇/新','➌從心合一/106','➍全部攏是祢/新','➎一人不能完成大使命/273'].map((text,n)=>({id:`song-${n}`,blocks:[block(`song-${n}`,text)]})),
    work,
    wordQuestions:Array.from({length:10},(_,n)=>({id:`question-${n}`,blocks:[block(`question-${n}`,`${n+1}.分享與禱告，領受上頭來的智慧。`.repeat(4))]})),
    weeklyVerses:[block('verse','耶和華是我的牧者，我必不致缺乏。'.repeat(10))],
  };
  document.components = [{id:'c',type:'cover',cover}];
  layout.fixedSlots = ['titleLabel','title','subtitle','welcomeLabel','worshipLabel','workLabel','wordLabel','verseLabel','contact','scanHint'].map(element=>({id:`fixed-${element}`,element,style:{...style},box:{x:.1,y:.1,width:.8,height:.03}}));
  submission.canonicalMetadata.title = '詩篇廿三篇、洗革拉戰役';
  submission.canonicalMetadata.subtitle = '～被聖靈充滿必有的三個看見';
  const submissionJSON = JSON.stringify(submission);
  const result = await layoutRunner.composeBulletinLayout({...input,submissionJSON,expectedContentHash:hash(submissionJSON)});
  const saved = JSON.parse(result.submissionJSON).document;
  assert.equal(saved.pages.length,1);
  assert.deepEqual(result.measurement.overflow,[]);
  assert.deepEqual(saved.components[0].cover.welcome[0].sentences,cover.welcome[0].sentences);
  const measured = result.measurement.pages[0].slots;
  assert.ok(!measured.some(slot=>['contact','scanHint'].includes(slot.fixedElement)));
  const lines = id => measured.find(slot=>slot.slotId===id).fragments.flatMap(fragment=>fragment.lines);
  for (const id of ['fixed-title','fixed-subtitle','fixed-welcomeLabel','fixed-worshipLabel','fixed-workLabel','slot-welcome',...work.map(item=>`slot-${item.id}`),...cover.worship.map(item=>`slot-${item.id}`)]) {
    const rects = lines(id);
    assert.ok(Math.max(...rects.map(r=>r.y))-Math.min(...rects.map(r=>r.y)) < 1, `${id} must stay on one line`);
  }
  const songRows = cover.worship.map(item=>measured.find(slot=>slot.slotId===`slot-${item.id}`).box.y);
  assert.equal(new Set(songRows).size,1);
  const workEdges = work.map(item=>Math.max(...lines(`slot-${item.id}`).map(r=>r.x+r.width)));
  assert.ok(Math.max(...workEdges)-Math.min(...workEdges)<1);
  const verse = measured.find(slot=>slot.slotId==='slot-verse');
  const label = measured.find(slot=>slot.fixedElement==='verseLabel');
  assert.ok(verse.box.y > label.box.y+label.box.height);
  assert.ok(verse.box.width > 490);
});

test('staggered columns retain their independent source-page flow', {skip: !assetsDirectory}, async () => {
  const input=await fixture('歌詞。'.repeat(130));
  const submission=JSON.parse(input.submissionJSON);
  const block=submission.document.components[0].items[0].blocks[0];
  const second=structuredClone(block);
  second.id='second';second.sentences[0].id='second-sentence';
  submission.document.components[0].items[0].blocks.push(second);
  const layout=submission.document.layoutManifest.pages[0];
  layout.slots[0].box={x:.05,y:.1,width:.44,height:.02};
  layout.slots.push({...structuredClone(layout.slots[0]),id:'second-slot',blockId:second.id,box:{x:.51,y:.105,width:.44,height:.02},fragments:[{sentenceId:'second-sentence',start:0,end:390}]});
  const submissionJSON=JSON.stringify(submission);
  const result=await layoutRunner.composeBulletinBodyLayout({...input,submissionJSON,expectedContentHash:hash(submissionJSON)});
  const saved=JSON.parse(result.submissionJSON).document;
  assert.deepEqual(saved.pages,submission.document.pages);
  assert.deepEqual(saved.components,submission.document.components);
  assert.deepEqual(saved.layoutManifest.pages[0].slots.map(slot=>slot.fragments),layout.slots.map(slot=>slot.fragments));
  assert.deepEqual(result.measurement.overflow,[]);
  assert.ok(Math.abs(saved.layoutManifest.pages[0].slots[0].box.y-saved.layoutManifest.pages[0].slots[1].box.y)<.01);
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
  assert.ok(result.document.components[0].cover.wordQuestions[0].blocks[0].style.fontSize >= 12);
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
