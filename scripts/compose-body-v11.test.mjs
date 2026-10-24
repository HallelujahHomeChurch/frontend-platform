import assert from 'node:assert/strict';
import {test} from 'node:test';
import {balanceBodyBottom, illustrationOverflow, placeIllustrations} from './compose-body-v11.mjs';

const box = (y, height = .04, x = .1) => ({x, y, width: .3, height});
const fixture = () => ({pages: ['cover', 'body', 'back'].map(id => ({id, width: 600, height: 800})), components: [{id: 'body', type: 'bodySection'}], layoutManifest: {pages: ['cover', 'body', 'back'].map(pageId => ({pageId, slots: [0, 1, 2, 3].map((i) => ({id: `${pageId}-${i}`, componentId: 'body', box: box(.1 + i * .23)}))}))}});

test('only ordinary dense body pages receive bounded extra whitespace', () => {
  const document = fixture(), before = structuredClone(document);
  balanceBodyBottom(document);
  assert.deepEqual(document.layoutManifest.pages[0], before.layoutManifest.pages[0]);
  assert.deepEqual(document.layoutManifest.pages[2], before.layoutManifest.pages[2]);
  const bottom = document.layoutManifest.pages[1].slots.at(-1).box.y;
  assert.ok(bottom > before.layoutManifest.pages[1].slots.at(-1).box.y && bottom - before.layoutManifest.pages[1].slots.at(-1).box.y <= 36 / 800 + 1e-10);
  const sparse = fixture(); sparse.layoutManifest.pages[1].slots.forEach(slot => slot.box.y /= 2);
  const original = structuredClone(sparse); balanceBodyBottom(sparse); assert.deepEqual(sparse, original);
});

test('source pictures keep their page and push only horizontally overlapping following text', () => {
  const source = fixture();
  source.components[0].illustrations = [{id: 'image', componentId: 'body', pageId: 'body', box: box(.3, .2)}];
  const composed = structuredClone(source);
  source.layoutManifest.pages[1].slots = [source.layoutManifest.pages[1].slots[2], {...source.layoutManifest.pages[1].slots[3], box: box(.6, .04, .6)}];
  composed.layoutManifest.pages[1].slots = structuredClone(source.layoutManifest.pages[1].slots);
  composed.layoutManifest.pages[1].slots[0].box.y = .35;
  composed.layoutManifest.pages[1].slots[1].box.y = .35;
  placeIllustrations(source, composed);
  assert.equal(composed.layoutManifest.pages[1].slots[0].box.y, .505);
  assert.equal(composed.layoutManifest.pages[1].slots[1].box.y, .35);
  assert.deepEqual(composed.pages, source.pages);
  composed.components[0].illustrations[0].box.y = .94;
  source.layoutManifest.pages[1].slots[0].box.y = 1.15;
  assert.throws(() => placeIllustrations(source, composed), /page_requires_edit/);
});

test('native ink overlap remains a hard failure even inside valid line boxes', () => {
  const document = fixture();
  document.components[0].illustrations = [{id: 'image', componentId: 'body', pageId: 'body', box: box(.3, .2)}];
  const measured = {pages: [{pageId: 'body', slots: [{fragments: [{lines: [{x: 65, y: 260, width: 100, height: 20}]}]}]}]};
  assert.equal(illustrationOverflow(document, measured)[0].reason, 'illustration_text_overlap');
  measured.pages[0].slots[0].fragments[0].lines[0].x = 400;
  assert.deepEqual(illustrationOverflow(document, measured), []);
});

test('body-bottom spacing keeps a section heading and its speaker separator together',()=>{
 const document=fixture(),page=document.layoutManifest.pages[1];
 document.components[0].bodySection={title:{id:'heading'}};
 page.slots[2].blockId='heading';
 page.fixedSlots=[{id:'fixed-body-speakerSeparator',element:'speakerSeparator',box:box(page.slots[2].box.y)}];
 const before=structuredClone(page);
 balanceBodyBottom(document);
 assert.ok(page.slots[2].box.y>before.slots[2].box.y);
 assert.equal(page.fixedSlots[0].box.y-before.fixedSlots[0].box.y,page.slots[2].box.y-before.slots[2].box.y);
});

test('distributes modest paragraph gaps toward a shared bottom instead of adding the same fixed distance to every page',()=>{
 const first=fixture(),second=fixture();
 for(const [document,last] of [[first,.84],[second,.90]])document.layoutManifest.pages[1].slots=Array.from({length:8},(_,i)=>({id:`slot-${i}`,componentId:'body',box:box(.1+i*(last-.1)/7)}));
 balanceBodyBottom(first);balanceBodyBottom(second);
 assert.ok(Math.abs(first.layoutManifest.pages[1].slots.at(-1).box.y-second.layoutManifest.pages[1].slots.at(-1).box.y)<1e-10);
});

test('single-row columns retain finite geometry without invented vertical gaps',()=>{
 const document=fixture();
 document.layoutManifest.pages[1].slots.forEach((slot,i)=>{slot.box={x:.05+i*.24,y:.1,width:.2,height:.7};});
 const before=structuredClone(document);
 balanceBodyBottom(document);
 assert.deepEqual(document,before);
});
