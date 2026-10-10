'use client';

import {useRef, type CSSProperties} from 'react';
import type {components} from '../generated.js';
import {BULLETIN_RENDERER_V9_DIGEST} from './artifact.js';
import {bulletinBlocks, type BulletinBlock, type BulletinSentence, type BulletinLayoutManifest, type BulletinDocumentRendererProps} from '../BulletinDocumentRenderer.js';
import {bulletinFixedText as snapshotText, readBulletinTemplateSnapshot, bulletinFixedGraphic, bulletinFixedDecoration} from './fixed.js';
import type {BulletinCanonicalMetadata} from '../v6/fixed.js';

export {BULLETIN_RENDERER_V9_DIGEST} from './artifact.js';
export type {BulletinCanonicalMetadata} from '../v6/fixed.js';
export {bulletinBlocks} from '../BulletinDocumentRenderer.js';
import {bulletinV7FontFamily} from '../v7/fonts.js';

type Item = components['schemas']['OnlineBulletinItem'];

export function requireBulletinRenderer(manifest: BulletinLayoutManifest): void {
  if ((manifest.templateVersion !== 'v1' && manifest.templateVersion !== 'v2') || manifest.rendererVersion !== 'v9' || manifest.rendererArtifactSha256 !== BULLETIN_RENDERER_V9_DIGEST) {
    throw new Error('update_required');
  }
}

function spansBetween(sentence: BulletinSentence, start: number, end: number, fontSize: number, locale: string) {
  let offset = 0;
  return sentence.spans.map((span, index) => {
    const points = Array.from(span.text);
    const text = points.slice(Math.max(0, start - offset), Math.max(0, end - offset)).join('');
    offset += points.length;
    return text ? <span key={index} data-font-role={span.fontRole} style={{fontFamily: bulletinV7FontFamily(span.fontRole, locale), ...(span.fontSize == null ? {} : {fontSize: `${span.fontSize / fontSize}em`})}}>{text}</span> : null;
  });
}

/** Pure paper only: authorization, watermark, toolbar and navigation belong to the host. */
export function BulletinDocumentRenderer({document, manifest = document.layoutManifest, mode, activePage, sentenceState, onSentenceActivate, canonicalMetadata}: BulletinDocumentRendererProps) {
  requireBulletinRenderer(manifest);
  if (document.schemaVersion !== '1' || document.templateVersion !== manifest.templateVersion) throw new Error('update_required');
  const snapshot = readBulletinTemplateSnapshot(document.templateSnapshot);
  const bulletinFixedText = (element: components['schemas']['OnlineBulletinFixedSlot']['element'], metadata: BulletinCanonicalMetadata | undefined, pageNumber: number, sourcePageCount?: number, locale: 'zh-Hant' | 'zh-Hans' = 'zh-Hant') => snapshotText(element, metadata, pageNumber, snapshot, sourcePageCount, locale);
  const locale = document.templateVersion === 'v2' ? 'zh-Hans' : 'zh-Hant';
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
      {spansBetween(value, start, end, fontSize, locale)}
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
    const graphic = bulletinFixedGraphic(slot.element, locale);
    if (graphic) return <img src={graphic.url} alt="" draggable={false} />;
    if (bulletinFixedDecoration(slot.element)) return null;
    const value = bulletinFixedText(slot.element, canonicalMetadata, pageNumber, document.sourcePageCount, locale);
    return value.annotatable ? sentence({id: `canonical-${slot.element}`, spans: [{text: value.text, fontRole: value.fontRole}]}, 0, Array.from(value.text).length, slot.id, slot.style.fontSize) : <span data-font-role={value.fontRole} style={{fontFamily: bulletinV7FontFamily(value.fontRole, locale)}}>{value.text}</span>;
  };
  const mobileHeader = (manifest.pages[0]?.fixedSlots ?? []).filter(slot => ['masthead', 'date', 'issueNumber', 'title', 'subtitle', 'vision', 'visionMission', 'visionFellowship', 'visionCommitment', 'historicalVision', 'historicalGoals', 'historicalGospelGoals', 'historicalActions', 'historicalCommitment', 'pastor'].includes(slot.element));
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
  return <div className={locale === 'zh-Hans' ? 'hhc-bulletin-v1 hhc-bulletin-v2' : 'hhc-bulletin-v1'} data-bulletin-renderer="v9" data-bulletin-mode={mode} lang={document.contentLocale}
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
        {group.label && <h2 data-fixed-element={group.label}>{bulletinFixedText(group.label, canonicalMetadata, 0, document.sourcePageCount, locale).text}</h2>}
        {group.blocks.map(block => {
          const Tag = headingIDs.has(block.id) ? group.label ? 'h3' : 'h2' : 'p';
          const headerLabel = headerLabels.get(block.id);
          return <Tag key={block.id} data-component-id={group.componentId} data-block-id={block.id} style={paragraphStyle(block.style)}>
            {headerLabel && <span data-fixed-element={headerLabel}>{bulletinFixedText(headerLabel, canonicalMetadata, 0, document.sourcePageCount, locale).text}</span>}
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
          const bodyArt = page.id !== document.pages[0]?.id && ['title', 'subtitle'].includes(slot.element);
          if (bodyArt) {
            style.lineHeight = `${slot.style.fontSize}pt`;
            Object.assign(style, {'--body-art-scale-y': slot.style.lineHeight / slot.style.fontSize, '--body-art-shadow-y': `${8 * slot.style.fontSize / slot.style.lineHeight}pt`});
          }
          if (bulletinFixedGraphic(slot.element, locale) || bulletinFixedDecoration(slot.element)) style.height = style.minHeight;
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

