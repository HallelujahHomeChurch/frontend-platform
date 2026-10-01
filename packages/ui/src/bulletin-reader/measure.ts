/** Browser-native geometry collection. Used only by the pinned isolated runner. */
export async function measureRenderedBulletin(root: HTMLElement, fonts: {family: string; weight: number}[], timeoutMs = 5000) {
  const document = root.ownerDocument;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      (async () => {
        for (const font of fonts) {
          const faces = await document.fonts.load(`${font.weight} 16px "${font.family}"`, '中文ABC★');
          if (!faces.length || faces.some(face => face.status !== 'loaded')) throw new Error('missing_font');
        }
        await document.fonts.ready;
        for (const image of root.querySelectorAll('img')) {
          try { await image.decode(); } catch { throw new Error('missing_image'); }
          if (!image.naturalWidth || !image.naturalHeight) throw new Error('missing_image');
        }
        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      })(),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('font_timeout')), timeoutMs); }),
    ]);
  } finally { clearTimeout(timer); }
  const round = (value: number) => Math.round(value * 1000) / 1000;
  const overflow: {pageId: string; slotId: string}[] = [];
  const pages = Array.from(root.querySelectorAll<HTMLElement>('[data-bulletin-page]')).map(page => {
    const pageBox = page.getBoundingClientRect();
    const ink: {slotId: string; box: DOMRect}[] = [];
    const rectangle = (box: DOMRect) => ({x: round((box.x - pageBox.x) * .75), y: round((box.y - pageBox.y) * .75), width: round(box.width * .75), height: round(box.height * .75)});
    const slots = Array.from(page.querySelectorAll<HTMLElement>('[data-slot-id]')).map(slot => {
      const slotBox = slot.getBoundingClientRect();
      const allocatedHeight = parseFloat(slot.style.minHeight) / .75;
      let exceeds = false;
      const sentenceNodes = Array.from(slot.querySelectorAll<HTMLElement>('[data-sentence-id]'));
      const fragments = (sentenceNodes.length ? sentenceNodes : [slot]).map(sentence => {
        const range = document.createRange();
        range.selectNodeContents(sentence);
        const lines = Array.from(range.getClientRects()).filter(box => box.width > 0 && box.height > 0).map(box => {
          if (slot.querySelector('[data-font-role]')) ink.push({slotId: slot.dataset.slotId!, box});
          // One PDF point tolerates font ink overhang; never tolerate another text line.
          if (box.left < slotBox.left - 1.333 || box.right > slotBox.right + 1.333 || box.top < slotBox.top - 1.333 || box.bottom > slotBox.top + allocatedHeight + 1.333 || box.right > pageBox.right + 1.333 || box.bottom > pageBox.bottom + 1.333) exceeds = true;
          return rectangle(box);
        });
        return {sentenceId: sentence.dataset.sentenceId ?? null, start: Number(sentence.dataset.fragmentStart ?? 0), end: Number(sentence.dataset.fragmentEnd ?? Array.from(sentence.textContent ?? '').length), lines};
      });
      const slotId = slot.dataset.slotId!;
      // scrollWidth includes code-owned ornament pseudo-elements. Text ranges
      // above measure actual glyphs against the unchanged source allocation.
      if (exceeds) overflow.push({pageId: page.dataset.bulletinPage!, slotId});
      return {slotId, fixedElement: slot.dataset.fixedElement, box: rectangle(slotBox), fragments};
    });
    // A slot can fit its allocation yet cover a neighbouring slot. Decorations
    // and repeated DOM rectangles within one text slot are not text collisions.
    ink.sort((a, b) => a.box.top - b.box.top);
    const overlapping = new Set<string>();
    for (let i = 0; i < ink.length; i++) {
      const a = ink[i];
      for (let j = i + 1; j < ink.length && ink[j].box.top < a.box.bottom - 1.333; j++) {
        const b = ink[j];
        if (a.slotId !== b.slotId && Math.min(a.box.right, b.box.right) - Math.max(a.box.left, b.box.left) > 1.333) {
          overlapping.add(a.slotId);
          overlapping.add(b.slotId);
        }
      }
    }
    for (const slotId of overlapping) {
      if (!overflow.some(issue => issue.pageId === page.dataset.bulletinPage && issue.slotId === slotId)) overflow.push({pageId: page.dataset.bulletinPage!, slotId});
    }
    return {pageId: page.dataset.bulletinPage!, width: round(pageBox.width * .75), height: round(pageBox.height * .75), slots};
  });
  return {pages, overflow};
}
