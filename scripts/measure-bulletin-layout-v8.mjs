import {createHash} from 'node:crypto';
import {open} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {composeBulletinLayout as composeV7, composeBulletinBodyLayout as composeBodyV7, measureBulletinLayout as measureV7} from './measure-bulletin-layout-v7.mjs';
import {BULLETIN_RENDERER_V7_DIGEST} from '../packages/ui/dist/bulletin-reader/v7/artifact.js';
import {BULLETIN_RENDERER_V8_DIGEST} from '../packages/ui/dist/bulletin-reader/v8/artifact.js';
import {bulletinBlocks, requireBulletinRenderer} from '../packages/ui/dist/bulletin-reader/v8/BulletinDocumentRenderer.js';

const hash = value => createHash('sha256').update(value).digest('hex');
const encode = (input, submission) => {
  const submissionJSON = JSON.stringify(submission);
  return {...input, submissionJSON, expectedContentHash: hash(submissionJSON)};
};
function legacyInput(input) {
  if (typeof input.submissionJSON !== 'string' || Buffer.byteLength(input.submissionJSON) > 8 * 1024 * 1024 || hash(input.submissionJSON) !== input.expectedContentHash) throw new Error('stale_content');
  const submission = JSON.parse(input.submissionJSON);
  requireBulletinRenderer(submission.document.layoutManifest);
  Object.assign(submission.document.layoutManifest, {rendererVersion: 'v7', rendererArtifactSha256: BULLETIN_RENDERER_V7_DIGEST});
  return encode(input, submission);
}
export async function measureBulletinLayout(input) {
  const {layoutValidationHash: _, ...measured} = await measureV7(legacyInput(input));
  const result = {...measured, contentHash: input.expectedContentHash, rendererArtifactSha256: BULLETIN_RENDERER_V8_DIGEST};
  return {...result, layoutValidationHash: hash(JSON.stringify(result))};
}

async function compose(input, runner) {
  const legacy = legacyInput(input);
  await measureV7(legacy);
  const submission = JSON.parse(legacy.submissionJSON);
  const {document} = submission;
  const blocks = new Map(bulletinBlocks(document).map(({block}) => [block.id, block]));
  const groups = [];
  for (const [index, layout] of document.layoutManifest.pages.entries()) {
    const page = document.pages.find(p => p.id === layout.pageId);
    if (index > 0) for (const slot of layout.fixedSlots ?? []) {
      if (['title', 'subtitle'].includes(slot.element)) groups.push({page, slots: [slot], x: slot.box.x, y: slot.box.y, width: slot.box.width, art: true});
    }
    for (const component of document.components) {
      if (component.type !== 'bodySection') continue;
      const titles = layout.slots.filter(s => s.blockId === component.bodySection.title.id);
      if (titles.length !== 1) continue;
      const title = titles[0];
      const speakerIDs = new Set((component.bodySection.contributors ?? []).filter(c => c.role === 'speaker').map(c => c.name.id));
      const names = layout.slots.filter(s => speakerIDs.has(s.blockId) && Math.abs(s.box.y - title.box.y) * page.height < blocks.get(title.blockId).style.lineHeight);
      const separators = (layout.fixedSlots ?? []).filter(s => s.element === 'speakerSeparator' && Math.abs(s.box.y - title.box.y) * page.height < blocks.get(title.blockId).style.lineHeight && s.box.x >= title.box.x && names.length === 1 && s.box.x < names[0].box.x);
      const slots = [title, ...(names.length === 1 && separators.length === 1 ? [separators[0]] : []), ...names];
      const right = Math.min(1 - 24 / page.width, Math.max(...layout.slots.filter(s => s.componentId === component.id).map(s => s.box.x + s.box.width)));
      groups.push({page, slots, x: title.box.x, y: title.box.y, width: right - title.box.x, art: false});
    }
  }
  for (const group of groups) for (const slot of group.slots) {
    const block = blocks.get(slot.blockId);
    const text = slot.element ? submission.canonicalMetadata[slot.element] : block.sentences.flatMap(s => s.spans.map(span => span.text)).join('');
    if (/[\r\n]/.test(text ?? '')) throw new Error('page_requires_edit', {cause: {pageId: group.page.id, slotId: slot.id}});
    const style = slot.element ? slot.style : block.style;
    for (const key of ['letterSpacing', 'indent', 'firstLineIndent', 'spaceBefore', 'spaceAfter']) if (style[key]) style[key] = 0;
    if (style.align && style.align !== 'left') style.align = 'left';
    slot.box.width = 10000 / group.page.width;
  }
  // Measure real pinned-font advances before fitting; negative tracking is not a fit strategy.
  const natural = await measureV7(encode(input, submission));
  const measurements = new Map(natural.pages.flatMap(p => p.slots.map(s => [s.slotId, s])));
  for (const group of groups) {
    const widths = group.slots.map(slot => {
      const measured = measurements.get(slot.id);
      return Math.max(0, ...measured.fragments.flatMap(f => f.lines.map(line => line.x + line.width - measured.box.x)));
    });
    const gap = 4;
    const scale = Math.min(1, (group.width * group.page.width - gap * (group.slots.length - 1) - 2 * group.slots.length) / widths.reduce((sum, width) => sum + width, 0));
    let x = group.x;
    for (const [index, slot] of group.slots.entries()) {
      const block = blocks.get(slot.blockId);
      const style = slot.element ? slot.style : block.style;
      const size = Math.floor(style.fontSize * scale * 100) / 100;
      if (size < 12) throw new Error('page_requires_edit', {cause: {pageId: group.page.id, slotId: slot.id}});
      const ratio = size / style.fontSize;
      for (const sentence of block?.sentences ?? []) for (const span of sentence.spans) if (span.fontSize != null) span.fontSize *= ratio;
      style.lineHeight = group.art ? style.lineHeight * ratio : Math.max(style.lineHeight * ratio, size * 1.25);
      style.fontSize = size;
      const width = (widths[index] * scale + 2) / group.page.width;
      slot.box = {x, y: group.y, width, height: style.lineHeight / group.page.height};
      x += width + gap / group.page.width;
    }
  }
  const composed = await runner(encode(input, submission));
  const saved = JSON.parse(composed.submissionJSON);
  const cover = saved.document.layoutManifest.pages[0];
  const date = composed.measurement.pages[0]?.slots.find(s => s.fixedElement === 'date');
  const issue = cover.fixedSlots?.find(s => s.element === 'issueNumber');
  if (date && issue) {
    const page = saved.document.pages[0];
    const right = Math.max(...date.fragments.flatMap(f => f.lines.map(line => line.x + line.width)));
    issue.box.x = (right + issue.style.fontSize * .25) / page.width;
  }
  Object.assign(saved.document.layoutManifest, {rendererVersion: 'v8', rendererArtifactSha256: BULLETIN_RENDERER_V8_DIGEST});
  const next = encode(input, saved);
  const measurement = await measureBulletinLayout(next);
  if (measurement.overflow.length) throw new Error('page_requires_edit');
  return {submissionJSON: next.submissionJSON, expectedContentHash: next.expectedContentHash, measurement};
}
export const composeBulletinLayout = input => compose(input, composeV7);
export const composeBulletinBodyLayout = input => compose(input, composeBodyV7);

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
    } finally { await file.close(); }
    process.stdout.write(JSON.stringify(await (compose ? composeBulletinLayout : measureBulletinLayout)({...input, assetsDirectory})) + '\n');
  } catch {
    process.stderr.write('layout_runner_failed\n');
    process.exitCode = 1;
  }
}
