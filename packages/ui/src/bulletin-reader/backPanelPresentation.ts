import type {BulletinLayoutManifest, BulletinRenderableDocument} from './BulletinDocumentRenderer.js';

/** Paper-only frame spacing; canonical text, widths and fragment anchors stay unchanged. */
export function bulletinBackPanelPresentation(document: BulletinRenderableDocument): BulletinLayoutManifest {
  return {...document.layoutManifest, pages: document.layoutManifest.pages.map(layout => {
    const page = document.pages.find(page => page.id === layout.pageId);
    if (!page) return layout;
    const fixed = layout.fixedSlots ?? [];
    const summary = fixed.find(slot => slot.element === 'summaryFrame');
    const summaryIds = new Set(document.components.filter(component => component.type === 'backSummary').map(component => component.id));
    const summaryBoxes = layout.slots.filter(slot => summaryIds.has(slot.componentId)).map(slot => slot.box);
    const groups = (['announcements', 'prayers'] as const).map(type => {
      const ids = new Set(document.components.filter(component => component.type === (type === 'prayers' ? 'victoriesAndPrayers' : type)).map(component => component.id));
      const slots = layout.slots.filter(slot => ids.has(slot.componentId));
      const frame = fixed.find(slot => slot.element === `${type}Frame`);
      const label = fixed.find(slot => slot.element === `${type}Label`);
      if (!frame || !slots.length) return null;
      const boxes = [...slots, ...(label ? [label] : [])].map(slot => slot.box);
      return {slots, frame, label, boxes,
        top: Math.min(...boxes.map(box => box.y)) - 6 / page.height,
        bottom: Math.max(...boxes.map(box => box.y + box.height)) + 6 / page.height,
        shift: 0};
    }).filter(group => group !== null);
    if (!groups.length) return layout;
    const boxes = groups.flatMap(group => group.boxes);
    const left = Math.max(0, Math.min(...boxes.map(box => box.x)) - 6 / page.width);
    const right = Math.min(1, Math.max(...boxes.map(box => box.x + box.width)) + 6 / page.width);
    let bottom = summary ? summary.box.y + summary.box.height : Math.max(0, ...summaryBoxes.map(box => box.y + box.height));
    for (const group of groups) {
      group.shift = Math.max(0, bottom + 12 / page.height - group.top);
      if (group.shift < 1e-10) group.shift = 0;
      bottom = group.bottom + group.shift;
    }
    const fits = bottom <= 1 - 6 / page.height;
    // Dense pages retain vertical geometry, but still get safe horizontal frame clearance.
    if (!fits) for (const group of groups) group.shift = 0;
    return {...layout,
      slots: layout.slots.map(slot => {
        const group = groups.find(group => group.slots.includes(slot));
        return group?.shift ? {...slot, box: {...slot.box, y: slot.box.y + group.shift}} : slot;
      }),
      fixedSlots: fixed.map(slot => {
        const group = groups.find(group => group.frame === slot || group.label === slot);
        if (!group) return slot;
        const box = group.frame === slot
          ? {x: left, y: fits ? group.top + group.shift : slot.box.y, width: right - left, height: fits ? group.bottom - group.top : slot.box.height}
          : {...slot.box, y: slot.box.y + group.shift};
        return (['x', 'y', 'width', 'height'] as const).every(key => Math.abs(box[key] - slot.box[key]) < 1e-10) ? slot : {...slot, box};
      })};
  })};
}
