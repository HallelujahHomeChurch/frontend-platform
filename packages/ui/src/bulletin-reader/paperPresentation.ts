import type {BulletinLayoutManifest, BulletinRenderableDocument} from './BulletinDocumentRenderer.js';
import {bulletinBackPanelPresentation} from './backPanelPresentation.js';

/** Presentation-only translation keeps frozen renderer proofs and source-page breaks intact. */
export function bulletinPaperPresentation(document: BulletinRenderableDocument): BulletinLayoutManifest {
  const manifest = bulletinBackPanelPresentation(document);
  return {...manifest, pages: manifest.pages.map(page => {
    const retainedFixed = (page.fixedSlots ?? []).filter(slot => slot.element !== 'pageNumber' && slot.element !== 'backgroundLogo');
    const boxes = [...page.slots, ...retainedFixed].map(slot => slot.box);
    if (!boxes.length) return page;
    const left = Math.min(...boxes.map(box => box.x));
    const right = Math.max(...boxes.map(box => box.x + box.width));
    const shift = (1 - left - right) / 2;
    if (Math.abs(shift) < 1e-10) return page;
    return {...page,
      slots: page.slots.map(slot => ({...slot, box: {...slot.box, x: slot.box.x + shift}})),
      fixedSlots: page.fixedSlots?.map(slot => retainedFixed.includes(slot) ? {...slot, box: {...slot.box, x: slot.box.x + shift}} : slot),
    };
  })};
}
