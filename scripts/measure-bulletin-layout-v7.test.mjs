import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import {composeBulletinLayout, measureBulletinLayout} from './measure-bulletin-layout-v7.mjs';
import {BULLETIN_RENDERER_V7_DIGEST as digest} from '../packages/ui/dist/bulletin-reader/v7/artifact.js';

const assetsDirectory = process.env.HHC_BULLETIN_TEMPLATE_DIR;
assert.ok(assetsDirectory, 'native acceptance requires real immutable fonts');
const hash = text => createHash('sha256').update(text).digest('hex');

test('Word composition scales explicit inline sizes with the block without changing text or anchors', async () => {
  const assets = JSON.parse(await readFile(new URL('../packages/ui/src/bulletin-reader/v7/template-assets.json', import.meta.url)));
  const style = {fontSize: 13, lineHeight: 16.25, indent: 0, firstLineIndent: 0, spaceBefore: 0, spaceAfter: 0};
  const question = {id: 'question', style, sentences: [
    {id: 'question-1', spans: [{text: '分享神的愛。', fontRole: 'body'}]},
    {id: 'question-2', spans: [{text: '參考經文', fontRole: 'reference', fontSize: 11}, {text: '一起分享。', fontRole: 'emphasis', fontSize: 13}]},
  ]};
  const document = {
    issueId: '00000000-0000-4000-8000-000000000001', series: 'general', contentLocale: 'zh-Hant', schemaVersion: '1', templateVersion: 'v1', sourceAssetChecksum: 'a'.repeat(64), sourcePageCount: 4,
    components: [{id: 'cover', type: 'cover', cover: {welcome: [], worship: [], work: [], wordQuestions: [{id: 'question-item', blocks: [question]}], weeklyVerses: []}}],
    pages: [{id: 'cover-page', width: 595.32, height: 841.92}],
    layoutManifest: {templateVersion: 'v1', rendererVersion: 'v7', rendererArtifactSha256: digest, assets: assets.filter(asset => asset.kind === 'font').map(asset => ({url: asset.url, sha256: asset.sha256, kind: 'font', fontRole: asset.roles[0]})), pages: [{pageId: 'cover-page', fixedSlots: [], slots: [{id: 'question-slot', componentId: 'cover', blockId: 'question', box: {x: .1, y: .3, width: .8, height: .08}, fragments: question.sentences.map(sentence => ({sentenceId: sentence.id, start: 0, end: Array.from(sentence.spans.map(span => span.text).join('')).length}))}]}]},
  };
  const submissionJSON = JSON.stringify({document, canonicalMetadata: {title: '一起分享', issueNumber: 1700, date: '2026-01-01'}});
  const result = await composeBulletinLayout({submissionJSON, expectedContentHash: hash(submissionJSON), assetsDirectory, timeoutMs: 15000});
  const saved = JSON.parse(result.submissionJSON).document;
  const block = saved.components[0].cover.wordQuestions[0].blocks[0];
  assert.equal(block.style.fontSize, 12);
  for (let i = 0; i < question.sentences.length; i++) {
    assert.equal(block.sentences[i].id, question.sentences[i].id);
    question.sentences[i].spans.forEach((span, j) => {
      const next = block.sentences[i].spans[j];
      assert.equal(next.text, span.text);
      assert.equal(next.fontRole, span.fontRole);
      if (span.fontSize == null) assert.equal(next.fontSize, undefined);
      else assert.ok(Math.abs(next.fontSize - span.fontSize * 12 / 13) < .001, 'explicit inline font must preserve relative size');
    });
  }
  assert.deepEqual(saved.layoutManifest.pages[0].slots[0].fragments, document.layoutManifest.pages[0].slots[0].fragments);
  assert.deepEqual(result.measurement.overflow, []);
  assert.equal(question.style.fontSize, 13, 'source is immutable');
});

test('Simplified rare glyph uses pinned Traditional serif fallback without changing its Unicode identity', async () => {
  const assets = JSON.parse(await readFile(new URL('../packages/ui/src/bulletin-reader/v2/template-assets.json', import.meta.url)));
  const traditional = JSON.parse(await readFile(new URL('../packages/ui/src/bulletin-reader/v7/template-assets.json', import.meta.url)));
  assets.push(...traditional.filter(asset => asset.kind === 'font' && asset.roles.some(role => role === 'body' || role === 'emphasis')));
  const style = {fontSize: 13, lineHeight: 18, indent: 0, firstLineIndent: 0, spaceBefore: 0, spaceAfter: 0};
  const block = {id: 'body', style, sentences: [{id: 'body-sentence', spans: [{text: '在𥚃面。', fontRole: 'body'}]}]};
  const document = {
    issueId: '00000000-0000-4000-8000-000000000001', series: 'general', contentLocale: 'zh-Hans', schemaVersion: '1', templateVersion: 'v2', sourceAssetChecksum: 'a'.repeat(64), sourcePageCount: 4,
    components: [{id: 'article', type: 'bodySection', bodySection: {kind: 'sermon', title: {...block, id: 'title', sentences: [{id: 'title-sentence', spans: [{text: '信息', fontRole: 'body'}]}]}, blocks: [block]}}],
    pages: [{id: 'body-page', width: 595.32, height: 841.92}],
    layoutManifest: {templateVersion: 'v2', rendererVersion: 'v7', rendererArtifactSha256: digest, assets: assets.filter(asset => asset.kind === 'font').map(asset => ({url: asset.url, sha256: asset.sha256, kind: 'font', fontRole: asset.roles[0]})), pages: [{pageId: 'body-page', fixedSlots: [], slots: [{id: 'body-slot', componentId: 'article', blockId: 'body', box: {x: .1, y: .1, width: .8, height: .05}, fragments: [{sentenceId: 'body-sentence', start: 0, end: 4}]}]}]},
  };
  const input = () => {
    const submissionJSON = JSON.stringify({document, canonicalMetadata: {title: '信息', issueNumber: 1700, date: '2026-01-01'}});
    return {submissionJSON, expectedContentHash: hash(submissionJSON), assetsDirectory, timeoutMs: 15000};
  };
  const result = await measureBulletinLayout(input());
  assert.deepEqual(result.overflow, []);
  assert.equal(block.sentences[0].spans[0].text, '在𥚃面。');
  block.sentences[0].spans[0].fontRole = 'emphasis';
  const emphasized = await measureBulletinLayout(input());
  assert.deepEqual(emphasized.overflow, []);
  assert.ok(emphasized.fontHashes.includes('49bf74f95fef7d74142848883abe13de0aa8f19e32431abe9fe4cc9d3592448f'));
  assert.ok(!emphasized.fontHashes.includes('9c02738cbfdf263d60baceaf5e97dd1dd39230daf64e98bf91be07a8609fb962'));
  assert.equal(block.sentences[0].spans[0].text, '在𥚃面。');
  block.sentences[0].spans[0].text = '在🫠面。';
  await assert.rejects(measureBulletinLayout(input()), /missing_glyph/);
});
