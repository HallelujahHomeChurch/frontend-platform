import {expect, it} from 'vitest';
import * as UI from '../index.js';

const style = {fontSize: 12, lineHeight: 15, indent: 0, firstLineIndent: 0, spaceBefore: 0, spaceAfter: 0};
function fixture(): UI.BulletinRenderableDocument {
  return {schemaVersion: '1', templateVersion: 'v1', contentLocale: 'zh-Hant', sourcePageCount: 4,
    components: [], pages: ['cover', 'body', 'worship', 'back'].map(id => ({id, width: 600, height: 800})),
    layoutManifest: {templateVersion: 'v1', rendererVersion: 'v8', rendererArtifactSha256: UI.BULLETIN_RENDERER_V8_DIGEST, assets: [],
      pages: ['cover', 'body', 'worship', 'back'].map(pageId => ({pageId,
        slots: [{id: `${pageId}-text`, componentId: pageId, blockId: `${pageId}-block`, style,
          box: {x: .14, y: .3, width: .8, height: .2}, fragments: [{sentenceId: `${pageId}-sentence`, start: 3, end: 9}]}],
        fixedSlots: [{id: `${pageId}-heading`, element: 'title', style, box: {x: .2, y: .1, width: .6, height: .1}},
          {id: `${pageId}-page-number`, element: 'pageNumber', style, box: {x: .88, y: .05, width: .04, height: .02}},
          {id: `${pageId}-background`, element: 'backgroundLogo', style, box: {x: 0, y: 0, width: 1, height: 1}}],
      }))}};
}

it('removes binding offsets on every paper page without reflowing or changing source content', () => {
  const document = fixture(), before = structuredClone(document);
  const presented = UI.bulletinPaperPresentation(document);
  expect(presented.pages.map(page => page.pageId)).toEqual(['cover', 'body', 'worship', 'back']);
  for (const page of presented.pages) {
    expect(page.slots[0].box).toEqual({x: expect.closeTo(.1), y: .3, width: .8, height: .2});
    expect(page.fixedSlots![0].box).toEqual({x: expect.closeTo(.16), y: .1, width: .6, height: .1});
    expect(page.slots[0].fragments).toEqual([{sentenceId: `${page.pageId}-sentence`, start: 3, end: 9}]);
    expect(page.fixedSlots!.slice(1)).toEqual(before.layoutManifest.pages[0].fixedSlots!.slice(1).map(slot => ({...slot, id: `${page.pageId}-${slot.element === 'pageNumber' ? 'page-number' : 'background'}`})));
  }
  expect(document).toEqual(before);
  expect(UI.bulletinPaperPresentation({...document, layoutManifest: presented})).toEqual(presented);
});

it('includes retained titles and frames in the centered bounds', () => {
  const document = fixture();
  document.layoutManifest.pages[0].fixedSlots![0].box = {x: .08, y: .1, width: .9, height: .1};
  const page = UI.bulletinPaperPresentation(document).pages[0];
  expect(page.fixedSlots![0].box.x).toBeCloseTo(.05);
  expect(page.slots[0].box.x).toBeCloseTo(.11);
});

it('leaves blank pages and already centered paper unchanged', () => {
  const document = fixture();
  document.layoutManifest.pages[0].slots = [];
  document.layoutManifest.pages[0].fixedSlots!.shift();
  document.layoutManifest.pages[1].slots[0].box.x = .1;
  const page = UI.bulletinPaperPresentation(document);
  expect(page.pages[0]).toEqual(document.layoutManifest.pages[0]);
  expect(page.pages[1]).toEqual(document.layoutManifest.pages[1]);
});
