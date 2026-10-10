import {expect, it} from 'vitest';
import * as UI from '../index.js';

const style = {fontSize: 12, lineHeight: 15, indent: 0, firstLineIndent: 0, spaceBefore: 0, spaceAfter: 0};
function fixture(): UI.BulletinRenderableDocument {
  return {schemaVersion: '1', templateVersion: 'v1', contentLocale: 'zh-Hant', sourcePageCount: 1,
    pages: [{id: 'back', width: 600, height: 800}],
    components: ['backSummary', 'announcements', 'victoriesAndPrayers'].map(type => ({id: type, type: type as 'backSummary', items: []})),
    layoutManifest: {templateVersion: 'v1', rendererVersion: 'v8', rendererArtifactSha256: UI.BULLETIN_RENDERER_V8_DIGEST, assets: [], pages: [{pageId: 'back',
      slots: ['backSummary', 'announcements', 'victoriesAndPrayers'].map((id, index) => ({id, componentId: id, blockId: id, style, fragments: [], box: {x: .1, y: .1 + index * .2, width: .8, height: .2}})),
      fixedSlots: ['announcementsFrame', 'prayersFrame'].map((element, index) => ({id: element, element: element as 'announcementsFrame', style, box: {x: .1, y: .3 + index * .2, width: .8, height: .2}})),
    }]}};
}
const present = UI.bulletinBackPanelPresentation;

it('creates a solid-summary decoration around this page text, excluding the sidebar', () => {
  const document = fixture();
  document.layoutManifest.pages[0].fixedSlots!.push({id: 'tagline', element: 'summarySidebarTagline', style, box: {x: .01, y: .1, width: .04, height: .2}});
  const page = present(document).pages[0];
  const frame = page.fixedSlots!.find(slot => slot.element === 'summaryFrame');
  expect(frame).toBeDefined();
  expect(frame!.box.x).toBeCloseTo(.09);
  expect(frame!.box.y).toBeCloseTo(.0925);
  expect(frame!.box.width).toBeCloseTo(.82);
  expect(frame!.box.height).toBeCloseTo(.215);
  expect(frame!.style.spaceBefore).toBe(0);
  expect(frame!.style.indent).toBe(0);
  expect(page.fixedSlots!.find(slot => slot.id === 'tagline')).toEqual(document.layoutManifest.pages[0].fixedSlots![2]);
});

it('frames summary-only pages without requiring announcements or prayers', () => {
  const document = fixture();
  document.layoutManifest.pages[0].slots = document.layoutManifest.pages[0].slots.slice(0, 1);
  document.layoutManifest.pages[0].fixedSlots = [];
  expect(present(document).pages[0].fixedSlots).toHaveLength(1);
  const layout = present(document);
  expect(present({...document, layoutManifest: layout})).toEqual(layout);
});

it('separates unframed summary from aligned panels without mutating content or source geometry', () => {
  const document = fixture(); const original = structuredClone(document);
  const layout = present(document);
  const page = layout.pages[0];
  expect(page.fixedSlots![0].box.x).toBeCloseTo(.09);
  expect(page.fixedSlots![0].box.width).toBeCloseTo(.82);
  expect(page.fixedSlots![0].box.y).toBeCloseTo(.3225);
  expect(page.fixedSlots![1].box.y).toBeCloseTo(.5525);
  expect(page.slots[1].box.y).toBeCloseTo(.33);
  expect(page.slots[1].box.width).toBe(.8);
  expect(document).toEqual(original);
  expect(present({...document, layoutManifest: layout})).toEqual(layout);
});

it('keeps horizontal frame clearance when a dense page cannot accept vertical spacing', () => {
  const document = fixture();
  document.layoutManifest.pages[0].slots[2].box.height = .5;
  const page = present(document).pages[0];
  expect(page.slots).toEqual(document.layoutManifest.pages[0].slots);
  expect(page.fixedSlots![1].box.x).toBeCloseTo(.09);
  expect(page.fixedSlots![1].box.width).toBeCloseTo(.82);
  const summary = page.fixedSlots!.find(slot => slot.element === 'summaryFrame')!;
  expect(summary.box.y + summary.box.height).toBeLessThanOrEqual(page.slots[1].box.y);
});

it('keeps a near-threshold dense fallback stable when presented repeatedly', () => {
  const document = fixture();
  document.layoutManifest.pages[0].slots[2].box.height = .432;
  const layout = present(document);
  expect(layout.pages[0].slots).toEqual(document.layoutManifest.pages[0].slots);
  expect(present({...document, layoutManifest: layout})).toEqual(layout);
});

it('uses a summary frame when present and never takes summary bounds from another page', () => {
  const document = fixture();
  document.layoutManifest.pages[0].fixedSlots!.push({id: 'summaryFrame', element: 'summaryFrame', style, box: {x: .2, y: .1, width: .6, height: .25}});
  expect(present(document).pages[0].fixedSlots![0].box.y).toBeCloseTo(.365);
  document.layoutManifest.pages[0].fixedSlots!.pop();
  document.layoutManifest.pages[0].slots.shift();
  document.layoutManifest.pages.push({pageId: 'other', slots: [{id: 'summary', componentId: 'backSummary', blockId: 'summary', style, fragments: [], box: {x: .1, y: .8, width: .8, height: .2}}]});
  expect(present(document).pages[0].fixedSlots![0].box.y).toBeCloseTo(.2925);
});
