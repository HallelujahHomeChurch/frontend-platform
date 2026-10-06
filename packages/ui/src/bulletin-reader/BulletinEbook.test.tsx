import {render, cleanup} from '@testing-library/react';
import {afterEach, expect, it} from 'vitest';
import * as UI from '../index.js';

afterEach(cleanup);
const style = {fontSize: 16, lineHeight: 24, indent: 0, firstLineIndent: 2, spaceBefore: 0, spaceAfter: 0};
const block = (id: string, text = id): UI.BulletinBlock => ({id, style, sentences: [{id: `s-${id}`, spans: [{text, fontRole: 'scripture'}]}]});
function fixture(): UI.BulletinRenderableDocument {
  return {schemaVersion: '1', templateVersion: 'v1', contentLocale: 'zh-Hant', sourcePageCount: 4, pages: [],
    layoutManifest: {templateVersion: 'v1', rendererVersion: 'v1', rendererArtifactSha256: UI.BULLETIN_RENDERER_V1_DIGEST, assets: [], pages: [{pageId: 'p0', slots: [], fixedSlots: ['title', 'issueNumber', 'visionMission', 'pastor', 'masthead'].map(element => ({id: element, element: element as 'title', style, box: {x: 0, y: 0, width: 1, height: .1}}))}]},
    components: [
      {id: 'cover', type: 'cover', cover: {welcome: [block('welcome')], worship: [], work: [], wordQuestions: [], weeklyVerses: [block('verse')]}},
      {id: 'body', type: 'bodySection', bodySection: {kind: 'sermon', title: block('title'), contributors: [{role: 'speaker', name: block('speaker')}], header: {lectureDate: block('date'), contributors: [{role: 'editor', name: block('editor')}]}, blocks: [block('body')]}},
      {id: 'songs', type: 'hymnLyrics', hymnLyrics: {hymns: ['a', 'b'].map(id => ({id, title: block(`song-${id}`), sections: [{id, kind: 'verse', lines: [block(`lyric-${id}`, '𠮷安。')]}]}))}},
      {id: 'back', type: 'backSummary', items: [{id: 'summary', blocks: [block('summary')]}]},
    ]};
}

it('groups all semantic parts into four chapters and resolves hidden anchors without changing source', () => {
  const document = fixture();
  expect(UI.bulletinChapters(document).map(chapter => [chapter.id, chapter.componentIds])).toEqual([['cover', ['cover']], ['body', ['body']], ['worship', ['songs']], ['back', ['back']]]);
  expect(UI.bulletinChapterForAnchor(document, {kind: 'sentence', id: 's-editor'})).toBe('body');
  expect(UI.bulletinChapterForAnchor(document, {kind: 'sentence', id: 'canonical-title'})).toBe('cover');
  expect(UI.bulletinChapterForAnchor(document, {kind: 'component', id: 'songs'})).toBe('worship');
  expect(UI.bulletinChapterForAnchor(document, {kind: 'sentence', id: 'missing'})).toBeUndefined();
  expect(UI.bulletinMobileDetails(document).sentenceIds.has('s-editor')).toBe(true);
  expect(UI.bulletinMobileDetails(document).sentenceIds.has('s-speaker')).toBe(false);
});

it('renders only the requested chapter, hides cover details and uses colon-free headings', () => {
  const {container} = render(<UI.BulletinEbook document={fixture()} chapter="cover" canonicalMetadata={{title: '主題', subtitle: '', date: '2026-09-27', issueNumber: 1740}}/>);
  expect(container.querySelector('[data-fixed-element="pastor"]')).toBeNull();
  expect(container.querySelector('[data-fixed-element="masthead"]')).toBeNull();
  expect(container.querySelector('[data-fixed-element="issueNumber"]')).toHaveTextContent('1740');
  expect(container.querySelector('[data-fixed-element="welcomeLabel"]')).toHaveTextContent(/^一、Welcome$/);
  expect(container.querySelector('[data-sentence-id="s-body"]')).toBeNull();
});

it('preserves article speaker next to boxed title and reveals production details on demand', () => {
  const document = fixture(); const original = JSON.stringify(document);
  const {container, rerender} = render(<UI.BulletinEbook document={document} chapter="body"/>);
  expect(container.querySelector('.hhc-ebook-body-heading')).toHaveTextContent('title～ speaker');
  expect(container.querySelector('.hhc-ebook-body-heading [data-block-id="title"]')).toBeTruthy();
  expect(container.querySelector('[data-sentence-id="s-editor"]')).toBeNull();
  expect(container.querySelector('.hhc-bulletin-mobile-header')).toBeNull();
  rerender(<UI.BulletinEbook document={document} chapter="body" showDetails/>);
  expect(container.querySelector('[data-sentence-id="s-editor"]')).toHaveTextContent('editor');
  expect(JSON.stringify(document)).toBe(original);
});

it('separates songs while retaining Unicode offsets and scripture font roles for annotations', () => {
  const {container} = render(<UI.BulletinEbook document={fixture()} chapter="worship"/>);
  expect(container.querySelectorAll('.hhc-ebook-song')).toHaveLength(2);
  expect(container.querySelector('[data-sentence-id="s-lyric-a"]')).toHaveAttribute('data-fragment-end', '3');
  expect(container.querySelector('[data-sentence-id="s-lyric-a"] [data-font-role="scripture"]')).toHaveTextContent('𠮷安。');
});

it('scales mixed font sizes relative to their block rather than the paper point size', () => {
  const document = fixture();
  const body = document.components.find(component => component.type === 'bodySection')!;
  body.bodySection.blocks[0].style.fontSize = 20;
  body.bodySection.blocks[0].sentences[0].spans[0].fontSize = 20;
  const {container} = render(<UI.BulletinEbook document={document} chapter="body"/>);
  expect(container.querySelector('[data-sentence-id="s-body"] [data-font-role]')).toHaveStyle({fontSize: '1em'});
});

it('normalizes weekly verse roles and removes mobile announcement emphasis without mutating source', () => {
  const document = fixture();
  const cover = document.components[0];
  if (cover.type !== 'cover') throw new Error('fixture');
  cover.cover.weeklyVerses[0].sentences[0].spans = [{text: '經文', fontRole: 'body'}, {text: '重點', fontRole: 'emphasis'}];
  for (const type of ['backSummary', 'announcements', 'victoriesAndPrayers'] as const) {
    const value = block(type);
    value.sentences[0].spans = [{text: '重點𠮷', fontRole: 'emphasis'}];
    document.components.push({id: type, type, items: [{id: type, blocks: [value]}]});
  }
  const original = JSON.stringify(document);
  const {container, rerender} = render(<UI.BulletinEbook document={document} chapter="cover" canonicalMetadata={{title: '主題', subtitle: '', date: '2026-09-27', issueNumber: 1740}}/>);
  expect(container.querySelector('[data-sentence-id="s-verse"] [data-font-role="scripture"]')).toHaveTextContent('經文');
  expect(container.querySelector('[data-sentence-id="s-verse"] [data-font-role="emphasis"]')).toHaveTextContent('重點');
  rerender(<UI.BulletinEbook document={document} chapter="back"/>);
  expect(container.querySelector('[data-sentence-id="s-backSummary"] [data-font-role="emphasis"]')).toHaveTextContent('重點𠮷');
  for (const id of ['announcements', 'victoriesAndPrayers']) {
    expect(container.querySelector(`[data-sentence-id="s-${id}"] [data-font-role="body"]`)).toHaveTextContent('重點𠮷');
    expect(container.querySelector(`[data-sentence-id="s-${id}"]`)).toHaveAttribute('data-fragment-end', '3');
  }
  expect(JSON.stringify(document)).toBe(original);
});
