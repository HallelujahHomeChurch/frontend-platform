const overlaps = (a, b) => Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > .001;


// Keep source-page illustrations as obstacles; text may move within its page.
export function placeIllustrations(source, composed) {
  for (const page of composed.layoutManifest.pages) {
    const original = source.layoutManifest.pages.find(value => value.pageId === page.pageId);
    const dimensions = composed.pages.find(value => value.id === page.pageId);
    const pictures = composed.components.flatMap(component => component.illustrations ?? []).filter(picture => picture.pageId === page.pageId);
    if (!pictures.length) continue;
    const placed = [];
    for (const slot of [...page.slots].sort((a, b) => a.box.y - b.box.y || a.box.x - b.box.x)) {
      const previous = original.slots.find(value => value.id === slot.id);
      if (!previous) throw new Error('page_requires_edit');
      let top = slot.box.y;
      for (const picture of pictures.filter(picture => overlaps(picture.box, slot.box))) {
        if (previous.box.y >= picture.box.y + picture.box.height - .001) top = Math.max(top, picture.box.y + picture.box.height + 4 / dimensions.height);
      }
      for (const earlier of placed.filter(value => overlaps(value.box, slot.box))) top = Math.max(top, earlier.box.y + earlier.box.height + 3 / dimensions.height);
      slot.box.y = top;
      if (top + slot.box.height > 1 - 24 / dimensions.height) throw new Error('page_requires_edit');
      placed.push(slot);
    }
  }
}

// A small bounded expansion improves ordinary dense body pages. Sparse and
// special pages keep natural whitespace; this is not an acceptance tolerance.
export function balanceBodyBottom(document) {
  const body = new Set(document.components.filter(component => component.type === 'bodySection').map(component => component.id));
  for (const [index, page] of document.layoutManifest.pages.entries()) {
    if (index === 0 || index === document.layoutManifest.pages.length - 1 || page.slots.length < 4 || page.slots.some(slot => !body.has(slot.componentId)) || document.components.some(component => component.illustrations?.some(picture => picture.pageId === page.pageId))) continue;
    const height = document.pages.find(value => value.id === page.pageId).height;
    const top = Math.min(...page.slots.map(slot => slot.box.y));
    const bottom = Math.max(...page.slots.map(slot => slot.box.y + slot.box.height));
    const target = 1 - 32 / height;
    if (bottom - top < .65 || bottom >= target) continue;
    const spread = Math.min(target - bottom, 24 / height);
    const shift = y => spread * (y - top) / (bottom - top);
    for (const component of document.components.filter(component => body.has(component.id))) {
      const title = page.slots.find(slot => slot.componentId === component.id && slot.blockId === component.bodySection?.title.id);
      const separator = page.fixedSlots?.find(slot => slot.id === `fixed-${component.id}-speakerSeparator`);
      if (title && separator) separator.box.y += shift(title.box.y);
    }
    for (const slot of page.slots) slot.box.y += shift(slot.box.y);
  }
}

export function illustrationOverflow(document, measured) {
  const overflow = [];
  for (const picture of document.components.flatMap(component => component.illustrations ?? [])) {
    const page = document.pages.find(value => value.id === picture.pageId);
    const layout = document.layoutManifest.pages.find(value => value.pageId === picture.pageId);
    if (!page || !layout || !layout.slots.some(slot => slot.componentId === picture.componentId)) throw new Error('invalid_illustration');
    const box = {x: picture.box.x * page.width, y: picture.box.y * page.height, width: picture.box.width * page.width, height: picture.box.height * page.height};
    const ink = measured.pages.find(value => value.pageId === page.id)?.slots.flatMap(slot => slot.fragments.flatMap(fragment => fragment.lines)) ?? [];
    if (ink.some(line => overlaps(box, line) && Math.min(box.y + box.height, line.y + line.height) - Math.max(box.y, line.y) > .5)) overflow.push({pageId: page.id, illustrationId: picture.id, reason: 'illustration_text_overlap'});
    for (const other of document.components.flatMap(component => component.illustrations ?? []).filter(other => other.pageId === picture.pageId && other.id < picture.id)) {
      if (overlaps(other.box, picture.box) && Math.min(other.box.y + other.box.height, picture.box.y + picture.box.height) > Math.max(other.box.y, picture.box.y)) overflow.push({pageId: page.id, illustrationId: picture.id, reason: 'illustration_overlap'});
    }
  }
  return overflow;
}
