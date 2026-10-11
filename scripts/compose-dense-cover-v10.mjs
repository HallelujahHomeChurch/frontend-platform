import {createHash} from 'node:crypto';
import {bulletinBlocks} from '../packages/ui/dist/bulletin-reader/v9/BulletinDocumentRenderer.js';
const hash = value => createHash('sha256').update(value).digest('hex');

/** The cover uses a fixed semantic grid; only measured text determines row height. */
export async function composeDenseCover(input, measureBulletinLayout, composeBulletinBodyLayout, coverSize = 12) {
  // Validate the original identity/assets before preparing any derived layout.
  await measureBulletinLayout(input);
  const submission = JSON.parse(input.submissionJSON);
  const {document} = submission;
  const component = document.components.find(component => component.type === 'cover');
  if (!component) return composeBulletinBodyLayout(input);
  const coverLayouts = document.layoutManifest.pages.filter(page => page.slots.some(slot => slot.componentId === component.id));
  if (!coverLayouts.length || coverLayouts.some(page => page.slots.some(slot => slot.componentId !== component.id))) throw new Error('invalid_cover_layout');
  const layout = coverLayouts[0];
  const page = document.pages.find(page => page.id === layout.pageId);
  const removed = new Set(coverLayouts.slice(1).map(page => page.pageId));
  document.pages = document.pages.filter(page => !removed.has(page.id));
  document.layoutManifest.pages = document.layoutManifest.pages.filter(page => !removed.has(page.pageId));
  layout.slots = coverLayouts.flatMap(page => page.slots);
  const footerElements = new Set(['pageNumber','contact','websiteQR','youtubeQR','streamQR','websiteQRLabel','youtubeQRLabel','streamQRLabel','scanHint','footerRule','topRule']);
  layout.fixedSlots = coverLayouts.flatMap(page => page.fixedSlots ?? []).filter(slot => !footerElements.has(slot.element));
  const fixed = new Map(layout.fixedSlots.map(slot => [slot.element, slot]));
  const blocks = new Map(bulletinBlocks(document).map(({block}) => [block.id, block]));
  const box = (slot, x, y, width) => {
    const style = slot.element ? slot.style : blocks.get(slot.blockId).style;
    style.letterSpacing = 0;
    style.lineHeight = style.fontSize * 1.25;
    slot.box = {x: x/page.width, y: y/page.height, width: width/page.width, height: style.lineHeight/page.height};
    return slot;
  };
  for (const slot of layout.fixedSlots) {
    if (['historicalVision', 'historicalGoals', 'historicalGospelGoals', 'historicalActions', 'historicalCommitment'].includes(slot.element)) {
      // Retain the source staircase; substitute fonts need a full line allocation.
      slot.style.letterSpacing = 0;
      slot.style.lineHeight = slot.style.fontSize * 1.25;
      slot.box = {...slot.box, height: slot.style.lineHeight / page.height};
    }
  }
  for (const [element, x, y, width] of [
    ['date',58,156,115], ['issueNumber',180,156,90], ['pastor',58,178,220],
    ['titleLabel',46,210,84],
  ]) { if (fixed.has(element)) box(fixed.get(element), x, y, width); }
  const masthead = fixed.get('masthead');
  if (masthead) box(masthead,masthead.box.x*page.width,masthead.box.y*page.height,page.width*(1-masthead.box.x)-40);
  const rows = [];
  const flowed = new Set();
  const row = (entries, gap = 5) => {
    if (!entries.length) return;
    const groups=[], occurrences=new Map();
    for(const entry of entries) {
      const id=entry.slot.blockId;
      const index=id ? occurrences.get(id) ?? 0 : 0;
      (groups[index]??=[]).push(entry);
      if(id) occurrences.set(id,index+1);
    }
    for(const group of groups) rows.push({entries:group,gap});
    for (const {slot} of entries) if (slot.element) flowed.add(slot.id);
  };
  const slotsFor = block => layout.slots.filter(slot => slot.blockId === block.id);
  const textEntries = (block, x, width) => slotsFor(block).map(slot => ({slot: box(slot, x, 239, width), offset: 0}));
  const label = name => {
    if (!fixed.has(name)) return [];
    const slot = fixed.get(name);
    slot.style.fontSize = name === 'verseLabel' ? 12 : 11;
    return [{slot:box(slot,40,239,84),offset:0}];
  };
  const items = list => list.flatMap(item => [...(item.title ? [item.title] : []), ...item.blocks]);
  const singleLines = [];
  const singleLine = (slots, x, y, width, minimum = 9) => {
    if (!slots.length) return [];
    for (const slot of slots) {
      const style = slot.element ? slot.style : blocks.get(slot.blockId).style;
      Object.assign(style,{align:'left',indent:0,firstLineIndent:0,spaceBefore:0,spaceAfter:0});
      box(slot,x,y,10000);
    }
    singleLines.push({slots,x,y,width,minimum});
    return slots.map(slot=>({slot,offset:0}));
  };
  const cover = component.cover;
  const resizeBlock = (block, size) => {
    const ratio = size / block.style.fontSize;
    for (const sentence of block.sentences) for (const span of sentence.spans) if (span.fontSize != null) {
      const scaled = span.fontSize * ratio;
      if (scaled < 9) throw new Error('cover_requires_edit');
      span.fontSize = scaled;
    }
    block.style.fontSize = size;
  };
  for (const [name,y] of [['title',207],['subtitle',226]]) if(fixed.has(name)) singleLine([fixed.get(name)],145,y,page.width-185,12);
  const list = (name, list) => list.forEach((block,index)=>row([...(index===0?label(name):[]),...singleLine(slotsFor(block),126,239,page.width-166)]));
  list('welcomeLabel',cover.welcome);
  row([...label('worshipLabel'),...singleLine(items(cover.worship).flatMap(slotsFor),126,239,page.width-166)]);
  const workRowsStart = singleLines.length;
  list('workLabel',items(cover.work));
  const workRows = singleLines.slice(workRowsStart);
  if (cover.wordQuestions.length) row(label('wordLabel'), 7);
  for (const block of items(cover.wordQuestions)) {
    const size = Math.min(block.style.fontSize,coverSize);
    resizeBlock(block, size);
    row(textEntries(block,40,page.width-80),3);
  }
  if (cover.weeklyVerses.length) row(label('verseLabel'),10);
  for (const block of cover.weeklyVerses) {
    resizeBlock(block, Math.min(block.style.fontSize, coverSize));
    row(textEntries(block,40,page.width-80),7);
  }
  const naturalJSON = JSON.stringify(submission);
  const natural = await measureBulletinLayout({...input,submissionJSON:naturalJSON,expectedContentHash:hash(naturalJSON)});
  const naturalSlots = new Map(natural.pages.find(value=>value.pageId===page.id).slots.map(slot=>[slot.slotId,slot]));
  for (const group of singleLines) {
    group.widths = group.slots.map(slot=>{
      const measured = naturalSlots.get(slot.id);
      const lines = measured.fragments.flatMap(fragment=>fragment.lines);
      return Math.max(0,...lines.map(line=>line.x+line.width-measured.box.x));
    });
    group.scale = Math.min(1,(group.width-6*(group.slots.length-1)-2*group.slots.length)/group.widths.reduce((sum,width)=>sum+width,0));
  }
  // Equal-length Work lines retain a common size and native justification, never padding text.
  const workScale = Math.min(1,...workRows.map(group=>group.scale));
  for (const group of singleLines) {
    const scale = workRows.includes(group) ? workScale : group.scale;
    let x = group.x;
    for (const [index,slot] of group.slots.entries()) {
      const block = blocks.get(slot.blockId);
      const style = slot.element ? slot.style : block.style;
      const size = Math.floor(style.fontSize*scale*100)/100;
      if (size < group.minimum) throw new Error('cover_requires_edit');
      if (block) resizeBlock(block, size);
      else style.fontSize = size;
      const width = group.slots.length === 1 ? group.width : group.widths[index]*scale+2;
      box(slot,x,group.y,width);
      if (workRows.includes(group)) style.align = 'justify';
      x += width+6;
    }
  }
  const stagedJSON = JSON.stringify(submission);
  const staged = await measureBulletinLayout({...input, submissionJSON: stagedJSON, expectedContentHash: hash(stagedJSON)});
  const measured = new Map(staged.pages.find(value => value.pageId === page.id).slots.map(slot => [slot.slotId,slot]));
  for (const group of singleLines) for (const slot of group.slots) {
    const lines = measured.get(slot.id).fragments.flatMap(fragment=>fragment.lines);
    if (Math.max(...lines.map(line=>line.y+line.height))-Math.min(...lines.map(line=>line.y)) > (slot.element?slot.style:blocks.get(slot.blockId).style).lineHeight+1) throw new Error('cover_requires_edit');
  }
  layout.slots = [];
  layout.fixedSlots = layout.fixedSlots.filter(slot => !flowed.has(slot.id));
  const measuredRows = rows.map(({entries,gap}) => {
    const heights = entries.map(({slot}) => {
      const value = measured.get(slot.id);
      return Math.max(value.box.height,...value.fragments.flatMap(fragment => fragment.lines.map(line => line.y+line.height-value.box.y)));
    });
    const height = Math.max(...entries.map((entry,index) => entry.offset+heights[index]));
    return {entries,gap,heights,height};
  });
  const headingBottom = Math.max(234, ...['title','subtitle'].flatMap(name => fixed.has(name) ? [(fixed.get(name).box.y + fixed.get(name).box.height) * page.height + 6] : []));
  let cursor = headingBottom;
  const contentHeight = measuredRows.reduce((sum,row)=>sum+row.height,0);
  const gapHeight = measuredRows.reduce((sum,row)=>sum+row.gap,0);
  const gapScale = gapHeight ? Math.min(1,(page.height-24-cursor-contentHeight)/gapHeight) : 1;
  // Use spare inter-row spacing before reducing readable text or changing source pagination.
  if (gapScale < .35) {
    if (coverSize <= 9) throw new Error('cover_requires_edit');
    return composeDenseCover(input, measureBulletinLayout, composeBulletinBodyLayout, coverSize - .5);
  }
  for (const {entries,gap,heights,height} of measuredRows) {
    cursor += gap*gapScale;
    if (cursor+height > page.height-24+.01) throw new Error('cover_requires_edit');
    entries.forEach(({slot,offset},index) => {
      slot.box.y = (cursor+offset)/page.height;
      slot.box.height = heights[index]/page.height;
      (slot.element ? layout.fixedSlots : layout.slots).push(slot);
    });
    cursor += height;
  }
  const submissionJSON = JSON.stringify(submission);
  return composeBulletinBodyLayout({...input, submissionJSON, expectedContentHash: hash(submissionJSON)});
}


