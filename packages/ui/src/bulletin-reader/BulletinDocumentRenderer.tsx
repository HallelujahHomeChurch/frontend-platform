'use client';

import {useRef, type CSSProperties} from 'react';
import type {components} from './generated.js';
import {BULLETIN_RENDERER_V1_DIGEST} from './artifact.js';
import {bulletinFixedText, bulletinFixedGraphic, bulletinFixedDecoration, type BulletinCanonicalMetadata} from './fixed.js';

export {BULLETIN_RENDERER_V1_DIGEST} from './artifact.js';
export type {BulletinCanonicalMetadata} from './fixed.js';
export type BulletinDocument = components['schemas']['OnlineBulletinDocument'];
export type BulletinRenderableDocument = Omit<BulletinDocument, 'issueId' | 'series' | 'sourceAssetChecksum'>;
export type BulletinBlock = components['schemas']['OnlineBulletinBlock'];
export type BulletinSentence = components['schemas']['OnlineBulletinSentence'];
export type BulletinLayoutManifest = components['schemas']['OnlineBulletinLayoutManifest'];
export type BulletinSentenceState = {selected?: boolean; highlight?: 'yellow' | 'red' | 'blue'};
type Item = components['schemas']['OnlineBulletinItem'];

// Semantic order is shared by mobile reflow, indexing and paper slot lookup.
export function bulletinBlocks(document: Pick<BulletinRenderableDocument, 'components'>): {componentId: string; block: BulletinBlock}[] {
  const result: {componentId: string; block: BulletinBlock}[] = [];
  for (const component of document.components) {
    const add = (blocks: BulletinBlock[]) => result.push(...blocks.map(block => ({componentId: component.id, block})));
    const optional = (block?: BulletinBlock) => { if (block) add([block]); };
    const items = (list: Item[]) => { for (const item of list) { optional(item.title); add(item.blocks); } };
    switch (component.type) {
      case 'cover':
        add(component.cover.welcome);
        items(component.cover.worship);
        items(component.cover.work);
        items(component.cover.wordQuestions);
        add(component.cover.weeklyVerses);
        break;
      case 'bodySection':
        if (component.bodySection.header) {
          add([component.bodySection.header.lectureDate]);
          for (const contributor of component.bodySection.header.contributors) add([contributor.name]);
        }
        add([component.bodySection.title]);
        optional(component.bodySection.subtitle);
        for (const contributor of component.bodySection.contributors ?? []) add([contributor.name]);
        add(component.bodySection.blocks);
        break;
      case 'hymnLyrics':
        for (const hymn of component.hymnLyrics.hymns) {
          optional(hymn.number);
          add([hymn.title]);
          optional(hymn.sourceLabel);
          for (const section of hymn.sections) add(section.lines);
        }
        break;
      default: items(component.items);
    }
  }
  return result;
}

export function requireBulletinRenderer(manifest: BulletinLayoutManifest): void {
  if (manifest.templateVersion !== 'v1' || manifest.rendererVersion !== 'v1' || manifest.rendererArtifactSha256 !== BULLETIN_RENDERER_V1_DIGEST) {
    throw new Error('update_required');
  }
}

function spansBetween(sentence: BulletinSentence, start: number, end: number, fontSize: number) {
  let offset = 0;
  return sentence.spans.map((span, index) => {
    const points = Array.from(span.text);
    const text = points.slice(Math.max(0, start - offset), Math.max(0, end - offset)).join('');
    offset += points.length;
    return text ? <span key={index} data-font-role={span.fontRole} style={span.fontSize == null ? undefined : {fontSize: `${span.fontSize / fontSize}em`}}>{text}</span> : null;
  });
}

export type BulletinDocumentRendererProps = {
  document: BulletinRenderableDocument;
  manifest?: BulletinLayoutManifest;
  mode: 'paper' | 'mobile';
  activePage?: string;
  sentenceState?: Readonly<Record<string, BulletinSentenceState>>;
  onSentenceActivate?: (id: string) => void;
  canonicalMetadata?: BulletinCanonicalMetadata;
};

/** Pure paper only: authorization, watermark, toolbar and navigation belong to the host. */
export function BulletinDocumentRenderer({document, manifest = document.layoutManifest, mode, activePage, sentenceState, onSentenceActivate, canonicalMetadata}: BulletinDocumentRendererProps) {
  requireBulletinRenderer(manifest);
  if (document.schemaVersion !== '1' || document.templateVersion !== manifest.templateVersion) throw new Error('update_required');
  const pointer = useRef<{x: number; y: number; id: number; moved: boolean} | null>(null);
  const activePointers = useRef(new Set<number>());
  const blocks = bulletinBlocks(document);
  const blockIndex = new Map(blocks.map(entry => [entry.block.id, entry]));
  const continuedSlotIDs = new Set(manifest.pages.flatMap(page => page.slots.flatMap(slot => slot.continuationOf ? [slot.continuationOf] : [])));
  const headingIDs = new Set(document.components.flatMap(component => {
    switch (component.type) {
      case 'bodySection': return [component.bodySection.title.id];
      case 'hymnLyrics': return component.hymnLyrics.hymns.map(hymn => hymn.title.id);
      case 'backSummary': case 'announcements': case 'victoriesAndPrayers': return component.items.flatMap(item => item.title ? [item.title.id] : []);
      default: return [];
    }
  }));
  const bodyTitleIDs = new Set(document.components.flatMap(component => component.type === 'bodySection' ? [component.bodySection.title.id] : []));
  const coverWorkIDs = new Set(document.components.flatMap(component => component.type === 'cover' ? component.cover.work.flatMap(item => item.blocks.map(block => block.id)) : []));
  const headerLabels = new Map(document.components.flatMap(component => component.type === 'bodySection' ? (component.bodySection.header?.contributors ?? []).map(contributor => [contributor.name.id, ({speaker: 'speakerLabel', transcriber: 'transcriberLabel', editor: 'editorLabel'} as const)[contributor.role]] as const) : []));
  const sentence = (value: BulletinSentence, start: number, end: number, key: string, fontSize: number) => {
    const state = sentenceState?.[value.id];
    return <span key={key} data-sentence-id={value.id} data-fragment-start={start} data-fragment-end={end}
      data-selected={state?.selected || undefined} data-highlight={state?.highlight}
      role={onSentenceActivate ? 'button' : undefined} tabIndex={onSentenceActivate ? 0 : undefined}
      aria-pressed={onSentenceActivate ? !!state?.selected : undefined}
      onClick={onSentenceActivate ? (event) => {
        if (!pointer.current?.moved && !event.currentTarget.ownerDocument.getSelection()?.toString()) onSentenceActivate(value.id);
      } : undefined}
      onKeyDown={onSentenceActivate ? event => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSentenceActivate(value.id); }
      } : undefined}>
      {spansBetween(value, start, end, fontSize)}
    </span>;
  };
  const paragraphStyle = (style: BulletinBlock['style']): CSSProperties => ({
    fontSize: mode === 'paper' ? `${style.fontSize}pt` : undefined,
    lineHeight: mode === 'paper' ? `${style.lineHeight}pt` : undefined,
    letterSpacing: mode === 'paper' ? `${style.letterSpacing ?? 0}em` : '0',
    textAlign: style.align,
    paddingInlineStart: `${style.indent}em`,
    textIndent: `${style.firstLineIndent}em`,
    marginBlockStart: `${style.spaceBefore}em`,
    marginBlockEnd: `${mode === 'mobile' ? Math.max(.6, style.spaceAfter) : style.spaceAfter}em`,
  });
  const fixedContent = (slot: components['schemas']['OnlineBulletinFixedSlot'], pageNumber: number) => {
    const graphic = bulletinFixedGraphic(slot.element);
    if (graphic) return <img src={graphic.url} alt="" draggable={false} />;
    if (bulletinFixedDecoration(slot.element)) return null;
    const value = bulletinFixedText(slot.element, canonicalMetadata, pageNumber, document.sourcePageCount);
    return value.annotatable ? sentence({id: `canonical-${slot.element}`, spans: [{text: value.text, fontRole: value.fontRole}]}, 0, Array.from(value.text).length, slot.id, slot.style.fontSize) : <span data-font-role={value.fontRole}>{value.text}</span>;
  };
  const mobileHeader = (manifest.pages[0]?.fixedSlots ?? []).filter(slot => ['masthead', 'date', 'issueNumber', 'title', 'subtitle', 'vision', 'visionMission', 'visionFellowship', 'visionCommitment', 'pastor'].includes(slot.element));
  const mobileGroups = document.components.flatMap(component => {
    const entries = blocks.filter(entry => entry.componentId === component.id);
    if (component.type === 'cover') {
      const cover = component.cover;
      const itemBlocks = (items: Item[]) => items.flatMap(item => [...(item.title ? [item.title] : []), ...item.blocks]);
      return [
        {label: 'welcomeLabel' as const, blocks: cover.welcome},
        {label: 'worshipLabel' as const, blocks: itemBlocks(cover.worship)},
        {label: 'workLabel' as const, blocks: itemBlocks(cover.work)},
        {label: 'wordLabel' as const, blocks: itemBlocks(cover.wordQuestions)},
        {label: 'verseLabel' as const, blocks: cover.weeklyVerses},
      ].map(group => ({...group, componentId: component.id}));
    }
    const label = {hymnLyrics: 'hymnLabel', backSummary: 'summaryLabel', announcements: 'announcementsLabel', victoriesAndPrayers: 'prayersLabel'}[component.type as 'hymnLyrics' | 'backSummary' | 'announcements' | 'victoriesAndPrayers'];
    return [{componentId: component.id, label: label as components['schemas']['OnlineBulletinFixedSlot']['element'] | undefined, blocks: entries.map(entry => entry.block)}];
  });
  return <div className="hhc-bulletin-v1" data-bulletin-mode={mode} lang={document.contentLocale}
    onPointerDown={event => {
      activePointers.current.add(event.pointerId);
      if (activePointers.current.size > 1 && pointer.current) pointer.current.moved = true;
      else pointer.current = {x: event.clientX, y: event.clientY, id: event.pointerId, moved: false};
    }}
    onPointerUp={event => { activePointers.current.delete(event.pointerId); }}
    onPointerMove={event => {
      if (pointer.current && Math.hypot(event.clientX - pointer.current.x, event.clientY - pointer.current.y) > 8) pointer.current.moved = true;
    }}
    onPointerCancel={event => { activePointers.current.delete(event.pointerId); if (pointer.current) pointer.current.moved = true; }}>
    {mode === 'mobile' ? <>
      {mobileHeader.length > 0 && <header className="hhc-bulletin-mobile-header">{mobileHeader.map(slot => <p key={slot.id} data-fixed-element={slot.element}>{fixedContent(slot, 0)}</p>)}</header>}
      {mobileGroups.map(group => <section key={`${group.componentId}-${group.label ?? 'body'}`} data-component-id={group.componentId}>
        {group.label && <h2 data-fixed-element={group.label}>{bulletinFixedText(group.label, canonicalMetadata, 0).text}</h2>}
        {group.blocks.map(block => {
          const Tag = headingIDs.has(block.id) ? group.label ? 'h3' : 'h2' : 'p';
          const headerLabel = headerLabels.get(block.id);
          return <Tag key={block.id} data-component-id={group.componentId} data-block-id={block.id} style={paragraphStyle(block.style)}>
            {headerLabel && <span data-fixed-element={headerLabel}>{bulletinFixedText(headerLabel, canonicalMetadata, 0).text}</span>}
            {block.sentences.map(value => sentence(value, 0, value.spans.reduce((n, span) => n + Array.from(span.text).length, 0), value.id, block.style.fontSize))}
          </Tag>;
        })}
      </section>)}
    </> : document.pages.filter(page => !activePage || page.id === activePage).map(page => {
      const layout = manifest.pages.find(entry => entry.pageId === page.id);
      if (!layout) throw new Error('invalid_layout');
      return <section key={page.id} data-bulletin-page={page.id} style={{width: `${page.width}pt`, height: `${page.height}pt`}}>
        {(layout.fixedSlots ?? []).map(slot => {
          const style: CSSProperties = {...paragraphStyle(slot.style), left: `${slot.box.x * 100}%`, top: `${slot.box.y * 100}%`, width: `${slot.box.width * 100}%`, minHeight: `${slot.box.height * page.height}pt`};
          const bodyArt = layout.fixedSlots?.some(fixed => fixed.element === 'bodyIssueSummary') && ['title', 'subtitle'].includes(slot.element);
          if (bodyArt) {
            style.lineHeight = `${slot.style.fontSize}pt`;
            Object.assign(style, {'--body-art-scale-y': slot.style.lineHeight / slot.style.fontSize, '--body-art-shadow-y': `${8 * slot.style.fontSize / slot.style.lineHeight}pt`});
          }
          if (bulletinFixedGraphic(slot.element) || bulletinFixedDecoration(slot.element)) style.height = style.minHeight;
          return <p key={slot.id} data-slot-id={slot.id} data-fixed-element={slot.element} data-body-canonical-art={bodyArt || undefined} aria-hidden={bulletinFixedDecoration(slot.element) || slot.element === 'backgroundLogo' || undefined} style={style}>
            {fixedContent(slot, document.pages.indexOf(page))}
          </p>;
        })}
        {layout.slots.map(slot => {
          const entry = blockIndex.get(slot.blockId);
          if (!entry || entry.componentId !== slot.componentId) throw new Error('invalid_layout');
          const {block} = entry;
          const style: CSSProperties = {...paragraphStyle(block.style), left: `${slot.box.x * 100}%`, top: `${slot.box.y * 100}%`, width: `${slot.box.width * 100}%`, minHeight: `${slot.box.height * page.height}pt`};
          if (coverWorkIDs.has(block.id) && block.style.align === 'justify') style.textAlignLast = 'justify';
          if (slot.continuationOf) { style.textIndent = '0'; style.marginBlockStart = '0'; }
          if (continuedSlotIDs.has(slot.id)) style.marginBlockEnd = '0';
          return <p key={slot.id} data-slot-id={slot.id} data-component-id={slot.componentId} data-block-id={block.id} data-body-title={bodyTitleIDs.has(block.id) || undefined} data-continuation-of={slot.continuationOf} style={style}>
            {slot.fragments.map((fragment, index) => {
              const value = block.sentences.find(s => s.id === fragment.sentenceId);
              if (!value || fragment.end > value.spans.reduce((n, span) => n + Array.from(span.text).length, 0) || fragment.start < 0 || fragment.start >= fragment.end) throw new Error('invalid_layout');
              return sentence(value, fragment.start, fragment.end, `${value.id}-${index}`, block.style.fontSize);
            })}
          </p>;
        })}
      </section>;
    })}
  </div>;
}
