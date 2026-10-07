import {createHash} from 'node:crypto';
import {open, readFile} from 'node:fs/promises';
import {basename, resolve} from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {BulletinDocumentRenderer, bulletinBlocks, requireBulletinRenderer} from '../packages/ui/dist/bulletin-reader/v3/BulletinDocumentRenderer.js';
import {measureRenderedBulletin} from '../packages/ui/dist/bulletin-reader/v3/measure.js';
import * as traditional from '../packages/ui/dist/bulletin-reader/fixed.js';
import * as simplified from '../packages/ui/dist/bulletin-reader/v2/fixed.js';

const require = createRequire(new URL('../packages/ui/package.json', import.meta.url));
const {createElement} = require('react');
const {renderToStaticMarkup} = require('react-dom/server');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const profiles = await Promise.all(['','v2/'].map(async path=>{
  const assets=JSON.parse(await readFile(new URL(`../packages/ui/src/bulletin-reader/${path}template-assets.json`,import.meta.url),'utf8'));
  const coverage=JSON.parse(await readFile(new URL(`../packages/ui/src/bulletin-reader/${path}font-coverage.json`,import.meta.url),'utf8'));
  return {assets,css:await readFile(new URL(`../packages/ui/dist/bulletin-reader/${path}paper.css`,import.meta.url),'utf8'),fontPoints:new Map(assets.filter(asset=>asset.kind==='font').map(asset=>[asset.sha256,new Set(coverage[asset.sha256].flatMap(([start,end])=>Array.from({length:end-start+1},(_,index)=>start+index)))]))};
}));

/** Exact bytes are the worker submission identity; user-supplied URLs never execute. */
export async function measureBulletinLayout({submissionJSON, expectedContentHash, assetsDirectory, timeoutMs = 10000}) {
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1 || timeoutMs > 60000) throw new Error('invalid_timeout');
  if (typeof submissionJSON !== 'string' || Buffer.byteLength(submissionJSON) > 8 * 1024 * 1024 || hash(submissionJSON) !== expectedContentHash) throw new Error('stale_content');
  const {document, canonicalMetadata} = JSON.parse(submissionJSON);
  requireBulletinRenderer(document.layoutManifest);
  const {assets,css,fontPoints}=profiles[document.templateVersion==='v2'?1:0];
  const {bulletinFixedText,bulletinFixedGraphic}=document.templateVersion==='v2'?simplified:traditional;
  const fonts = assets.filter(asset => asset.kind === 'font');
  for (const font of fonts) {
    // Alias roles share a file; the domain requires unique immutable asset URLs.
    if (!document.layoutManifest.assets.some(asset => asset.fontRole === font.roles[0] && asset.url === font.url && asset.sha256 === font.sha256 && asset.kind === 'font')) throw new Error('missing_font');
  }
  if (document.layoutManifest.assets.some(asset => !assets.some(trusted => trusted.url === asset.url && trusted.sha256 === asset.sha256 && trusted.kind === asset.kind))) throw new Error('untrusted_asset');
  const spans = bulletinBlocks(document).flatMap(({block}) => block.sentences.flatMap(sentence => sentence.spans));
  const usedAssets = new Map(fonts.map(asset => [asset.url, asset]));
  for (const [index, page] of document.layoutManifest.pages.entries()) {
    for (const slot of page.fixedSlots ?? []) {
      spans.push(bulletinFixedText(slot.element, canonicalMetadata, index, document.sourcePageCount));
      const graphic = bulletinFixedGraphic(slot.element);
      if (graphic) {
        if (!document.layoutManifest.assets.some(asset => asset.url === graphic.url && asset.sha256 === graphic.sha256 && asset.kind === 'decoration')) throw new Error('missing_decoration');
        usedAssets.set(graphic.url, graphic);
      }
    }
  }
  for (const span of spans) {
        const font = fonts.find(font => font.roles.includes(span.fontRole));
        const points = font && fontPoints.get(font.sha256);
        if (!points || Array.from(span.text).some(character => !['\n', '\r', '\t'].includes(character) && !points.has(character.codePointAt(0)))) throw new Error('missing_glyph');
  }
  const bytes = new Map();
  for (const asset of usedAssets.values()) {
    let data;
    try { data = await readFile(resolve(assetsDirectory ?? '', basename(asset.url))); } catch { throw new Error('missing_asset'); }
    if (hash(data) !== asset.sha256) throw new Error('asset_checksum');
    bytes.set(asset.url, {data, mime: asset.mime});
  }
  const html = renderToStaticMarkup(createElement(BulletinDocumentRenderer, {document, canonicalMetadata, mode: 'paper'}));
  const browser = await chromium.launch({headless: true, timeout: timeoutMs});
  let timer;
  try {
    if (browser.version() !== '153.0.8010.12') throw new Error('chromium_version_mismatch');
    const context = await browser.newContext({viewport: {width: 1600, height: 1200}, deviceScaleFactor: 1, locale: 'zh-TW', timezoneId: 'UTC', serviceWorkers: 'block'});
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin !== 'http://bulletin.invalid') return route.abort();
      if (bytes.has(url.pathname)) return route.fulfill({body: bytes.get(url.pathname).data, contentType: bytes.get(url.pathname).mime});
      if (url.pathname === '/') return route.fulfill({contentType: 'text/html', body: `<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; font-src 'self'; img-src 'self'"><style>html,body{margin:0;padding:0}${css}</style>${html}`});
      return route.abort();
    });
    const page = await context.newPage();
    await page.goto('http://bulletin.invalid/', {waitUntil: 'load', timeout: timeoutMs});
    // Function source is compiled code-owned code, never document text.
    const measurement = await Promise.race([
      page.evaluate(`(${measureRenderedBulletin.toString()})(document.querySelector('.hhc-bulletin-v1'),${JSON.stringify(fonts.map(({family, weight}) => ({family, weight})))},${Math.min(timeoutMs, 5000)})`),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('measurement_timeout')), timeoutMs); }),
    ]);
    const result = {contentHash: expectedContentHash, rendererArtifactSha256: document.layoutManifest.rendererArtifactSha256, chromiumVersion: browser.version(), fontHashes: fonts.map(font => font.sha256), ...measurement};
    return {...result, layoutValidationHash: hash(JSON.stringify(result))};
  } finally { clearTimeout(timer); await browser.close(); }
}

/** The cover uses a fixed semantic grid; only measured text determines row height. */
export async function composeBulletinLayout(input) {
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
  singleLine(['title','subtitle'].flatMap(name=>fixed.has(name)?[fixed.get(name)]:[]),145,207,page.width-185,12);
  const list = (name, list) => list.forEach((block,index)=>row([...(index===0?label(name):[]),...singleLine(slotsFor(block),126,239,page.width-166)]));
  list('welcomeLabel',cover.welcome);
  row([...label('worshipLabel'),...singleLine(items(cover.worship).flatMap(slotsFor),126,239,page.width-166)]);
  const workRowsStart = singleLines.length;
  list('workLabel',items(cover.work));
  const workRows = singleLines.slice(workRowsStart);
  if (cover.wordQuestions.length) row(label('wordLabel'), 7);
  for (const block of items(cover.wordQuestions)) {
    block.style.fontSize = Math.min(block.style.fontSize,12);
    row(textEntries(block,40,page.width-80),3);
  }
  if (cover.weeklyVerses.length) row(label('verseLabel'),10);
  for (const block of cover.weeklyVerses) row(textEntries(block,40,page.width-80),7);
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
      for (const sentence of block?.sentences ?? []) for (const span of sentence.spans) if (span.fontSize != null) span.fontSize *= size/style.fontSize;
      style.fontSize = size;
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
  let cursor = 234;
  const contentHeight = measuredRows.reduce((sum,row)=>sum+row.height,0);
  const gapHeight = measuredRows.reduce((sum,row)=>sum+row.gap,0);
  const gapScale = gapHeight ? Math.min(1,(page.height-40-cursor-contentHeight)/gapHeight) : 1;
  // Use spare inter-row spacing before reducing readable text or changing source pagination.
  if (gapScale < .35) throw new Error('cover_requires_edit');
  for (const {entries,gap,heights,height} of measuredRows) {
    cursor += gap*gapScale;
    if (cursor+height > page.height-40+.01) throw new Error('cover_requires_edit');
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

/** Saved-layout composition, not a second browser-side renderer. Source evidence stays unchanged. */
export async function composeBulletinBodyLayout(input, attempt = 0) {
  let measured = await measureBulletinLayout(input);
  const submission = JSON.parse(input.submissionJSON);
  const {document} = submission;
  const {bulletinFixedText} = document.templateVersion === 'v2' ? simplified : traditional;
  const componentTypes = new Map(document.components.map(component => [component.id,component.type]));
  const panelTypes = {summaryFrame:'backSummary',announcementsFrame:'announcements',prayersFrame:'victoriesAndPrayers'};
  const panelLabels = {summaryLabel:'backSummary',announcementsLabel:'announcements',prayersLabel:'victoriesAndPrayers'};
  const bodyIDs = new Set(document.components.filter(component => component.type === 'bodySection' || component.type === 'hymnLyrics' || Object.values(panelTypes).includes(component.type)).map(component => component.id));
  const blocks = new Map(bulletinBlocks(document).map(({block}) => [block.id, block]));
  const sourceBoxes = new Map(document.layoutManifest.pages.flatMap(layout => layout.slots.map(slot => [slot.id, {...slot.box}])));
  let changed = false;
  for (const {componentId,block} of bulletinBlocks(document)) {
    if (!bodyIDs.has(componentId)) continue;
    const height = Math.max(block.style.lineHeight, 1.25*Math.max(block.style.fontSize,...block.sentences.flatMap(sentence=>sentence.spans.map(span=>span.fontSize ?? block.style.fontSize))));
    if ((block.style.letterSpacing ?? 0) < 0) { block.style.letterSpacing = 0; changed = true; }
    if (height !== block.style.lineHeight) { block.style.lineHeight = height; changed = true; }
  }
  const contributorLabels = {speaker:'bodySpeakerLabel',transcriber:'transcriberLabel',editor:'editorLabel'};
  for (const component of document.components) {
    for (const contributor of component.bodySection?.header?.contributors ?? []) {
      for (const layout of document.layoutManifest.pages) {
        const name = layout.slots.find(slot => slot.blockId === contributor.name.id);
        const label = layout.fixedSlots?.find(slot => slot.element === contributorLabels[contributor.role]);
        if (!name || !label) continue;
        const page = document.pages.find(page => page.id === layout.pageId);
        const text = bulletinFixedText(label.element,submission.canonicalMetadata,0).text;
        label.style.letterSpacing = 0;
        label.box.width = Math.max(label.box.width,(Array.from(text).length*label.style.fontSize+1)/page.width);
        const right = name.box.x+name.box.width;
        name.box.x = Math.max(name.box.x,label.box.x+label.box.width+2/page.width);
        name.box.width = right-name.box.x;
        if (name.box.width <= 0) throw new Error('layout_requires_split');
        changed = true;
      }
    }
  }
  for (const [index,layout] of document.layoutManifest.pages.entries()) for (const slot of layout.slots) {
    if (!bodyIDs.has(slot.componentId)) continue;
    slot.box.height = blocks.get(slot.blockId).style.lineHeight/document.pages[index].height;
    changed = true;
  }
  if (changed) {
    const submissionJSON = JSON.stringify(submission);
    measured = await measureBulletinLayout({...input,submissionJSON,expectedContentHash:hash(submissionJSON)});
  }
  const pages = [], layouts = [];
  for (const page of document.pages) {
    const layout = document.layoutManifest.pages.find(layout => layout.pageId === page.id);
    pages.push(page);
    layouts.push(layout);
    // Cover has its own semantic grid; the remaining regions retain source columns.
    if (!layout.slots.length || layout.slots.some(slot => !bodyIDs.has(slot.componentId))) continue;
    const isBack = layout.slots.every(slot => Object.values(panelTypes).includes(componentTypes.get(slot.componentId)));
    const firstRow = Math.min(...layout.slots.map(slot => slot.box.y)) - 1/page.height;
    const headers = (layout.fixedSlots ?? []).filter(slot => isBack
      ? slot.element in panelLabels
      : slot.element !== 'pageNumber' && slot.box.y >= firstRow);
    for (const slot of layout.fixedSlots ?? []) {
      if (slot.element !== 'pageNumber') continue;
      const width = Math.max(slot.box.width, 2 * slot.style.fontSize / page.width);
      slot.box = {...slot.box, x: slot.box.x + slot.box.width - width, width};
      slot.style.align = 'right';
    }
    const marker = layout.fixedSlots?.find(slot => slot.element === 'lectureDateMarker');
    if (marker) {
      const dates = new Set(document.components.flatMap(component => component.bodySection?.header ? [component.bodySection.header.lectureDate.id] : []));
      for (const slot of layout.slots) if (dates.has(slot.blockId)) slot.box.x = Math.max(slot.box.x, marker.box.x + marker.box.width + 2/page.width);
    }
    const bounds = new Map(measured.pages.find(value => value.pageId === page.id).slots.map(slot => [slot.slotId, slot]));
    const rows = [];
    for (const slot of [...layout.slots,...headers].sort((a, b) => a.box.y - b.box.y || a.box.x - b.box.x)) {
      const top = slot.box.y * page.height;
      const measuredSlot = bounds.get(slot.id);
      const height = Math.max(slot.box.height * page.height, measuredSlot.box.height,
        ...measuredSlot.fragments.flatMap(fragment => fragment.lines.map(line => line.y + line.height - top)));
      const row = {top, bottom: top, height: 0, group: slot.element ? panelLabels[slot.element] : componentTypes.get(slot.componentId), slots: []};
      rows.push(row);
      row.bottom = Math.max(row.bottom, top + (sourceBoxes.get(slot.id)?.height ?? slot.box.height) * page.height);
      row.height = Math.max(row.height, height + top - row.top);
      row.slots.push({slot, offset: top - row.top, height});
    }
    layout.slots = [];
    layout.fixedSlots = (layout.fixedSlots ?? []).filter(slot => !headers.includes(slot));
    const placed = [];
    for (const row of rows) {
      // Columns flow independently. Only horizontally overlapping rows constrain
      // one another; a full-width heading naturally constrains both columns.
      const predecessors = placed.filter(previous => previous.slots.some(a => row.slots.some(b =>
        Math.min(a.slot.box.x+a.slot.box.width,b.slot.box.x+b.slot.box.width)-Math.max(a.slot.box.x,b.slot.box.x)>1/page.width)));
      const top = predecessors.length ? Math.max(...predecessors.map(previous =>
        previous.placedTop + previous.height + Math.max(isBack && row.group !== previous.group ? 18 : row.group === 'hymnLyrics' ? 0 : 3,
          Math.min(12, row.top-previous.bottom-(row.group === 'hymnLyrics' ? Math.max(0,previous.height-(previous.bottom-previous.top)) : 0))))) : row.top;
      if (top + row.height > page.height - 40) {
        if (attempt >= 4) throw new Error('page_requires_edit', {cause:{pageId:page.id,bottom:top+row.height}});
        // Retry from source geometry, never from a partially moved layout. A
        // block shared by source pages keeps one consistent presentation size.
        const retry = JSON.parse(input.submissionJSON);
        const ids = new Set(retry.document.layoutManifest.pages.find(value => value.pageId === page.id).slots.map(slot => slot.blockId));
        let reduced = false;
        for (const {componentId,block} of bulletinBlocks(retry.document)) {
          if (!bodyIDs.has(componentId) || !ids.has(block.id)) continue;
          const size = Math.max(12, block.style.fontSize*.95);
          if (size >= block.style.fontSize) continue;
          const scale = size/block.style.fontSize;
          block.style.fontSize = size;
          block.style.lineHeight = Math.max(1.25*size,block.style.lineHeight*scale);
          for (const sentence of block.sentences) for (const span of sentence.spans) if (span.fontSize != null) span.fontSize *= scale;
          reduced = true;
        }
        if (!reduced) throw new Error('page_requires_edit', {cause:{pageId:page.id,bottom:top+row.height}});
        const submissionJSON = JSON.stringify(retry);
        return composeBulletinBodyLayout({...input,submissionJSON,expectedContentHash:hash(submissionJSON)},attempt+1);
      }
      for (const {slot, offset, height} of row.slots) {
        slot.box = {...slot.box, y: (top + offset) / page.height, height: height / page.height};
        (slot.element ? layout.fixedSlots : layout.slots).push(slot);
      }
      placed.push({...row,placedTop:top});
    }
    if (isBack) {
      for (const frame of layout.fixedSlots.filter(slot => slot.element in panelTypes)) {
        const type = panelTypes[frame.element];
        const contents = [...layout.slots.filter(slot => componentTypes.get(slot.componentId) === type), ...layout.fixedSlots.filter(slot => panelLabels[slot.element] === type)];
        if (!contents.length) continue;
        const top = Math.min(...contents.map(slot=>slot.box.y))-8/page.height;
        const bottom = Math.max(...contents.map(slot=>slot.box.y+slot.box.height))+8/page.height;
        frame.box = {...frame.box,y:Math.max(0,top),height:bottom-Math.max(0,top)};
      }
    }
  }
  if (pages.length > 80) throw new Error('layout_page_limit');
  document.pages = pages;
  document.layoutManifest.pages = layouts;
  const submissionJSON = JSON.stringify(submission);
  const expectedContentHash = hash(submissionJSON);
  const measurement = await measureBulletinLayout({...input, submissionJSON, expectedContentHash});
  if (measurement.overflow.length) throw new Error('page_requires_edit');
  return {submissionJSON, expectedContentHash, measurement};
}


if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    const compose = args[0] === '--compose';
    if (compose) args.shift();
    if (args.length !== 2) throw new Error('invalid_arguments');
    const [inputPath, assetsDirectory] = args;
    const file = await open(inputPath, 'r');
    let input;
    try {
      if (!(await file.stat()).isFile()) throw new Error('invalid_input');
      const bytes = Buffer.alloc(16 * 1024 * 1024 + 1);
      const {bytesRead} = await file.read(bytes, 0, bytes.length, 0);
      if (bytesRead === bytes.length) throw new Error('input_too_large');
      input = JSON.parse(bytes.subarray(0, bytesRead).toString('utf8'));
    } finally {await file.close();}
    const run = compose ? composeBulletinLayout : measureBulletinLayout;
    process.stdout.write(JSON.stringify(await run({...input, assetsDirectory})) + '\n');
  } catch {
    // Document text, filesystem paths and Chromium diagnostics are private.
    process.stderr.write('layout_runner_failed\n');
    process.exitCode = 1;
  }
}
