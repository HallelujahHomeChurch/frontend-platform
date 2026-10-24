import {cleanup, render, screen} from '@testing-library/react';
import {afterEach, expect, it} from 'vitest';
import {BulletinDocumentRenderer, BulletinEbook, BULLETIN_RENDERER_V11_DIGEST, type BulletinRenderableDocument} from '../../index.js';
import {bulletinIllustrationURL} from './illustrations.js';

afterEach(cleanup);
const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j2uoAAAAASUVORK5CYII=';
function fixture(): BulletinRenderableDocument {
  const picture = {id: 'image', componentId: 'body', pageId: 'page', afterBlockId: 'paragraph', box: {x: .1, y: .3, width: .4, height: .2}, alt: '原稿插圖', sha256: 'a'.repeat(64), sizeBytes: 64, png};
  const block = (id: string) => ({id, style: {fontSize: 14, lineHeight: 20, indent: 0, firstLineIndent: 0, spaceBefore: 0, spaceAfter: 0}, sentences: [{id: `${id}-sentence`, spans: [{text: '正文', fontRole: 'body' as const}]}]});
  return {schemaVersion: '1', templateVersion: 'v1', templateSnapshot: {version: 1, visionMission: '使命', visionFellowship: '同行', visionCommitment: '回應'}, contentLocale: 'zh-Hant', sourcePageCount: 4, pages: [{id: 'page', width: 600, height: 800}], layoutManifest: {templateVersion: 'v1', rendererVersion: 'v11', rendererArtifactSha256: BULLETIN_RENDERER_V11_DIGEST, assets: [], pages: [{pageId: 'page', slots: [{id: 'slot', componentId: 'body', blockId: 'paragraph', box: {x: .1, y: .1, width: .8, height: .1}, fragments: [{sentenceId: 'paragraph-sentence', start: 0, end: 2}]}]}]}, components: [{id: 'body', type: 'bodySection', bodySection: {kind: 'sermon', title: block('title'), blocks: [block('paragraph')]}, illustrations: [picture]}]};
}

it('renders the same sanitized illustration on its paper page and after its ebook paragraph', () => {
  const document = fixture(), original = structuredClone(document);
  const {container, rerender} = render(<BulletinDocumentRenderer document={document} mode="paper"/>);
  expect(screen.getByAltText('原稿插圖').closest('[data-bulletin-page]')).toHaveAttribute('data-bulletin-page', 'page');
  expect(screen.getByAltText('原稿插圖')).toHaveAttribute('src', `data:image/png;base64,${png}`);
  rerender(<BulletinEbook document={document} chapter="body"/>);
  expect(screen.getByAltText('原稿插圖').closest('figure')?.previousElementSibling).toHaveAttribute('data-block-id', 'paragraph');
  expect(container.querySelectorAll('img')).toHaveLength(1);
  expect(document).toEqual(original);
});

it('rejects external, active or oversized picture payloads', () => {
  const picture = fixture().components[0].illustrations![0];
  for (const value of ['', 'https://private.example/image', 'data:image/svg+xml;base64,PHN2Zz4=', 'iVBORw0KGgo' + 'A'.repeat(2796204)]) expect(bulletinIllustrationURL({...picture, png: value})).toBeUndefined();
});

it('keeps authoring available when an owned picture cannot be hydrated', () => {
  const document = fixture(); delete document.components[0].illustrations![0].png;
  const {rerender} = render(<BulletinDocumentRenderer document={document} mode="paper"/>);
  expect(screen.getByRole('img', {name: '原稿插圖'})).toHaveAttribute('data-illustration-unavailable');
  rerender(<BulletinEbook document={document} chapter="body"/>);
  expect(screen.getByRole('img', {name: '原稿插圖'})).toHaveAttribute('data-illustration-unavailable');
});
