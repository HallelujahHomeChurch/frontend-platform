import {createHash} from 'node:crypto';
import {open, readFile} from 'node:fs/promises';
import {basename, resolve} from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {BulletinDocumentRenderer, bulletinBlocks, requireBulletinRenderer} from '../packages/ui/dist/bulletin-reader/BulletinDocumentRenderer.js';
import {measureRenderedBulletin} from '../packages/ui/dist/bulletin-reader/measure.js';
import {bulletinFixedText, bulletinFixedGraphic} from '../packages/ui/dist/bulletin-reader/fixed.js';

const require = createRequire(new URL('../packages/ui/package.json', import.meta.url));
const {createElement} = require('react');
const {renderToStaticMarkup} = require('react-dom/server');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const assets = JSON.parse(await readFile(new URL('../packages/ui/src/bulletin-reader/template-assets.json', import.meta.url), 'utf8'));
const css = await readFile(new URL('../packages/ui/dist/bulletin-reader/paper.css', import.meta.url), 'utf8');
const coverage = JSON.parse(await readFile(new URL('../packages/ui/src/bulletin-reader/font-coverage.json', import.meta.url), 'utf8'));
const fontPoints = new Map(assets.filter(asset => asset.kind === 'font').map(asset => [asset.sha256, new Set(coverage[asset.sha256].flatMap(([start, end]) => Array.from({length: end - start + 1}, (_, index) => start + index)))]));

/** Exact bytes are the worker submission identity; user-supplied URLs never execute. */
export async function measureBulletinLayout({submissionJSON, expectedContentHash, assetsDirectory, timeoutMs = 10000}) {
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1 || timeoutMs > 60000) throw new Error('invalid_timeout');
  if (typeof submissionJSON !== 'string' || Buffer.byteLength(submissionJSON) > 8 * 1024 * 1024 || hash(submissionJSON) !== expectedContentHash) throw new Error('stale_content');
  const {document, canonicalMetadata} = JSON.parse(submissionJSON);
  requireBulletinRenderer(document.layoutManifest);
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
  layout.fixedSlots = coverLayouts.flatMap(page => page.fixedSlots ?? []).filter(slot => slot.element !== 'pageNumber');
  const fixed = new Map(layout.fixedSlots.map(slot => [slot.element, slot]));
  const blocks = new Map(bulletinBlocks(document).map(({block}) => [block.id, block]));
  const box = (slot, x, y, width) => {
    const style = slot.element ? slot.style : blocks.get(slot.blockId).style;
    style.letterSpacing = 0;
    style.lineHeight = Math.max(style.lineHeight, style.fontSize * 1.25);
    slot.box = {x: x/page.width, y: y/page.height, width: width/page.width, height: style.lineHeight/page.height};
    return slot;
  };
  for (const [element, x, y, width] of [
    ['date',58,156,115], ['issueNumber',180,156,90], ['pastor',58,178,220],
    ['titleLabel',46,210,100], ['title',160,205,page.width-200], ['subtitle',160,233,page.width-200],
  ]) { if (fixed.has(element)) box(fixed.get(element), x, y, width); }
  const masthead = fixed.get('masthead');
  if (masthead) box(masthead,masthead.box.x*page.width,masthead.box.y*page.height,page.width*(1-masthead.box.x)-40);
  const rows = [];
  const flowed = new Set();
  const row = (entries, gap = 5) => {
    if (!entries.length) return;
    rows.push({entries, gap});
    for (const {slot} of entries) if (slot.element) flowed.add(slot.id);
  };
  const slotsFor = block => layout.slots.filter(slot => slot.blockId === block.id);
  const textEntries = (block, x, width) => slotsFor(block).map(slot => ({slot: box(slot, x, 268, width), offset: 0}));
  const label = name => fixed.has(name) ? [{slot: box(fixed.get(name), 40, 268, 105), offset: 0}] : [];
  const items = list => list.flatMap(item => [...(item.title ? [item.title] : []), ...item.blocks]);
  const list = (name, list, x = 150, width = page.width-190) => {
    list.forEach((block, index) => row([...(index === 0 ? label(name) : []), ...textEntries(block, x, width)]));
  };
  const cover = component.cover;
  list('welcomeLabel', cover.welcome);
  const worship = items(cover.worship);
  for (let index = 0; index < worship.length; index += 2) {
    const width = (page.width-202)/2;
    row([...(index === 0 ? label('worshipLabel') : []), ...textEntries(worship[index],150,width), ...(worship[index+1] ? textEntries(worship[index+1],162+width,width) : [])]);
  }
  list('workLabel', items(cover.work));
  if (cover.wordQuestions.length) row(label('wordLabel'), 9);
  for (const block of items(cover.wordQuestions)) row(textEntries(block,58,page.width-98));
  list('verseLabel', cover.weeklyVerses);
  const footer = [];
  for (const [element,x,width,offset] of [
    ['contact',38,205,0], ['websiteQR',260,44,0], ['youtubeQR',322,44,0], ['streamQR',384,44,0],
    ['websiteQRLabel',252,60,50], ['youtubeQRLabel',314,60,50], ['streamQRLabel',376,60,50], ['scanHint',450,page.width-488,0],
  ]) {
    const slot = fixed.get(element);
    if (!slot) continue;
    box(slot,x,268+offset,width);
    if (bulletinFixedGraphic(element)) slot.box.height = 44/page.height;
    footer.push({slot, offset});
  }
  row(footer, 18);
  const stagedJSON = JSON.stringify(submission);
  const staged = await measureBulletinLayout({...input, submissionJSON: stagedJSON, expectedContentHash: hash(stagedJSON)});
  const measured = new Map(staged.pages.find(value => value.pageId === page.id).slots.map(slot => [slot.slotId,slot]));
  const existingIDs = new Set();
  JSON.stringify(document,(key,value) => { if (key === 'id') existingIDs.add(value); return value; });
  layout.slots = [];
  layout.fixedSlots = layout.fixedSlots.filter(slot => !flowed.has(slot.id) && !['footerRule','topRule'].includes(slot.element));
  let target = layout, cursor = 262, serial = 0;
  for (const {entries,gap} of rows) {
    const heights = entries.map(({slot}) => {
      const value = measured.get(slot.id);
      return Math.max(value.box.height,...value.fragments.flatMap(fragment => fragment.lines.map(line => line.y+line.height-value.box.y)));
    });
    const height = Math.max(...entries.map((entry,index) => entry.offset+heights[index]));
    if (height > page.height-100) throw new Error('layout_requires_split');
    cursor += gap;
    if (cursor+height > page.height-40) {
      if (document.pages.length >= 80) throw new Error('layout_page_limit');
      let id; do { id = `layout-cover-${++serial}`; } while (existingIDs.has(id)); existingIDs.add(id);
      const index = document.pages.findIndex(value => value.id === target.pageId)+1;
      document.pages.splice(index,0,{...page,id});
      target = {pageId:id,slots:[],fixedSlots:[]};
      document.layoutManifest.pages.splice(index,0,target);
      cursor = 52;
    }
    entries.forEach(({slot,offset},index) => {
      slot.box.y = (cursor+offset)/page.height;
      slot.box.height = heights[index]/page.height;
      (slot.element ? target.fixedSlots : target.slots).push(slot);
    });
    cursor += height;
  }
  const submissionJSON = JSON.stringify(submission);
  return composeBulletinBodyLayout({...input, submissionJSON, expectedContentHash: hash(submissionJSON)});
}

/** Saved-layout composition, not a second browser-side renderer. Source evidence stays unchanged. */
export async function composeBulletinBodyLayout(input) {
  let measured = await measureBulletinLayout(input);
  const submission = JSON.parse(input.submissionJSON);
  const {document} = submission;
  const componentTypes = new Map(document.components.map(component => [component.id,component.type]));
  const panelTypes = {summaryFrame:'backSummary',announcementsFrame:'announcements',prayersFrame:'victoriesAndPrayers'};
  const panelLabels = {summaryLabel:'backSummary',announcementsLabel:'announcements',prayersLabel:'victoriesAndPrayers'};
  const bodyIDs = new Set(document.components.filter(component => component.type === 'bodySection' || Object.values(panelTypes).includes(component.type)).map(component => component.id));
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
  if (changed) {
    const submissionJSON = JSON.stringify(submission);
    measured = await measureBulletinLayout({...input,submissionJSON,expectedContentHash:hash(submissionJSON)});
  }
  const ids = new Set();
  JSON.stringify(document, (key, value) => { if (key === 'id') ids.add(value); return value; });
  let serial = 0;
  const nextID = () => { let id; do { id = `layout-continuation-${++serial}`; } while (ids.has(id)); ids.add(id); return id; };
  const pages = [], layouts = [];
  for (const page of document.pages) {
    const layout = document.layoutManifest.pages.find(layout => layout.pageId === page.id);
    pages.push(page);
    layouts.push(layout);
    // Cover and hymn columns have separate template regions.
    if (!layout.slots.length || layout.slots.some(slot => !bodyIDs.has(slot.componentId))) continue;
    const isBack = layout.slots.every(slot => componentTypes.get(slot.componentId) !== 'bodySection');
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
      let row = rows.at(-1);
      if (!row || Math.abs(row.top - top) > 1) { row = {top, bottom: top, height: 0, group: slot.element ? panelLabels[slot.element] : componentTypes.get(slot.componentId), slots: []}; rows.push(row); }
      row.bottom = Math.max(row.bottom, top + slot.box.height * page.height);
      row.height = Math.max(row.height, height + top - row.top);
      row.slots.push({slot, offset: top - row.top, height});
    }
    layout.slots = [];
    layout.fixedSlots = (layout.fixedSlots ?? []).filter(slot => !headers.includes(slot));
    let target = layout, cursor = 0, sourceBottom = 0, pageOffset = 0, previousGroup;
    for (const row of rows) {
      const gap = Math.max(isBack && previousGroup && row.group !== previousGroup ? 18 : 3, row.top - sourceBottom);
      let top = Math.max(row.top + pageOffset, cursor + gap);
      // ponytail: move whole paragraphs; a paragraph taller than a page stays
      // review-blocked until Unicode-fragment splitting is implemented.
      if (row.height > page.height - 100) throw new Error('layout_requires_split');
      if (top + row.height > page.height - 48) {
        if (pages.length >= 80) throw new Error('layout_page_limit');
        const id = nextID();
        pages.push({...page, id});
        target = {pageId: id, slots: [], fixedSlots: (layout.fixedSlots ?? []).filter(slot => slot.element === 'pageNumber').map(slot => ({...structuredClone(slot), id: nextID()}))};
        layouts.push(target);
        top = Math.max(52, ...target.fixedSlots.map(slot => (slot.box.y+slot.box.height)*page.height+8));
        if (top+row.height > page.height-48) throw new Error('layout_requires_split');
        pageOffset = top - row.top;
      }
      for (const {slot, offset, height} of row.slots) {
        slot.box = {...slot.box, y: (top + offset) / page.height, height: height / page.height};
        (slot.element ? target.fixedSlots : target.slots).push(slot);
      }
      cursor = top + row.height;
      sourceBottom = row.bottom;
      previousGroup = row.group;
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
