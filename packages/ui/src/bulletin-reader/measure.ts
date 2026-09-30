/** Browser-native geometry collection. Used only by the pinned isolated runner. */
export async function measureRenderedBulletin(root: HTMLElement, fonts: {family: string; weight: number}[], timeoutMs = 5000) {
  const document = root.ownerDocument;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      (async () => {
        for (const font of fonts) {
          const faces = await document.fonts.load(`${font.weight} 16px "${font.family}"`, '中文ABC');
          if (!faces.length || faces.some(face => face.status !== 'loaded')) throw new Error('missing_font');
        }
        await document.fonts.ready;
        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      })(),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('font_timeout')), timeoutMs); }),
    ]);
  } finally { clearTimeout(timer); }
  const round = (value: number) => Math.round(value * 1000) / 1000;
  const overflow: {pageId: string; slotId: string}[] = [];
  const pages = Array.from(root.querySelectorAll<HTMLElement>('[data-bulletin-page]')).map(page => {
    const pageBox = page.getBoundingClientRect();
    const rectangle = (box: DOMRect) => ({x: round((box.x - pageBox.x) * .75), y: round((box.y - pageBox.y) * .75), width: round(box.width * .75), height: round(box.height * .75)});
    const slots = Array.from(page.querySelectorAll<HTMLElement>('[data-slot-id]')).map(slot => {
      const slotBox = slot.getBoundingClientRect();
      const allocatedHeight = parseFloat(slot.style.minHeight) / .75;
      let exceeds = false;
      const fragments = Array.from(slot.querySelectorAll<HTMLElement>('[data-sentence-id]')).map(sentence => {
        const range = document.createRange();
        range.selectNodeContents(sentence);
        const lines = Array.from(range.getClientRects()).filter(box => box.width > 0 && box.height > 0).map(box => {
          // One PDF point tolerates font ink overhang; never tolerate another text line.
          if (box.left < slotBox.left - 1.333 || box.right > slotBox.right + 1.333 || box.top < slotBox.top - 1.333 || box.bottom > slotBox.top + allocatedHeight + 1.333 || box.right > pageBox.right + 1.333 || box.bottom > pageBox.bottom + 1.333) exceeds = true;
          return rectangle(box);
        });
        return {sentenceId: sentence.dataset.sentenceId!, start: Number(sentence.dataset.fragmentStart), end: Number(sentence.dataset.fragmentEnd), lines};
      });
      const slotId = slot.dataset.slotId!;
      if (exceeds || slot.scrollWidth > slot.clientWidth + 1) overflow.push({pageId: page.dataset.bulletinPage!, slotId});
      return {slotId, box: rectangle(slotBox), fragments};
    });
    return {pageId: page.dataset.bulletinPage!, width: round(pageBox.width * .75), height: round(pageBox.height * .75), slots};
  });
  return {pages, overflow};
}
