'use client';

import {useRef, type CSSProperties} from 'react';
import type {components} from './generated.js';
import {BULLETIN_RENDERER_V1_DIGEST} from './artifact.js';

export {BULLETIN_RENDERER_V1_DIGEST} from './artifact.js';
export type BulletinDocument = components['schemas']['OnlineBulletinDocument'];
export type BulletinBlock = components['schemas']['OnlineBulletinBlock'];
export type BulletinSentence = components['schemas']['OnlineBulletinSentence'];
export type BulletinLayoutManifest = components['schemas']['OnlineBulletinLayoutManifest'];
export type BulletinSentenceState = {selected?: boolean; highlight?: 'yellow' | 'red' | 'blue'};
type Item = components['schemas']['OnlineBulletinItem'];

// Semantic order is shared by mobile reflow, indexing and paper slot lookup.
export function bulletinBlocks(document: BulletinDocument): {componentId: string; block: BulletinBlock}[] {
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

function spansBetween(sentence: BulletinSentence, start: number, end: number) {
  let offset = 0;
  return sentence.spans.map((span, index) => {
    const points = Array.from(span.text);
    const text = points.slice(Math.max(0, start - offset), Math.max(0, end - offset)).join('');
    offset += points.length;
    return text ? <span key={index} data-font-role={span.fontRole}>{text}</span> : null;
  });
}

export type BulletinDocumentRendererProps = {
  document: BulletinDocument;
  manifest?: BulletinLayoutManifest;
  mode: 'paper' | 'mobile';
  activePage?: string;
  sentenceState?: Readonly<Record<string, BulletinSentenceState>>;
  onSentenceActivate?: (id: string) => void;
};

/** Pure paper only: authorization, watermark, toolbar and navigation belong to the host. */
export function BulletinDocumentRenderer({document, manifest = document.layoutManifest, mode, activePage, sentenceState, onSentenceActivate}: BulletinDocumentRendererProps) {
  requireBulletinRenderer(manifest);
  if (document.schemaVersion !== '1' || document.templateVersion !== manifest.templateVersion) throw new Error('update_required');
  const pointer = useRef<{x: number; y: number; id: number; moved: boolean} | null>(null);
  const activePointers = useRef(new Set<number>());
  const blocks = bulletinBlocks(document);
  const blockIndex = new Map(blocks.map(entry => [entry.block.id, entry]));
  const sentence = (value: BulletinSentence, start: number, end: number, key: string) => {
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
      {spansBetween(value, start, end)}
    </span>;
  };
  const paragraphStyle = (block: BulletinBlock): CSSProperties => ({
    fontSize: mode === 'paper' ? `${block.style.fontSize}pt` : undefined,
    lineHeight: mode === 'paper' ? `${block.style.lineHeight}pt` : undefined,
    textAlign: block.style.align,
    paddingInlineStart: `${block.style.indent}em`,
    textIndent: `${block.style.firstLineIndent}em`,
    marginBlockStart: `${block.style.spaceBefore}em`,
    marginBlockEnd: `${block.style.spaceAfter}em`,
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
    {mode === 'mobile' ? blocks.map(({componentId, block}) => <p key={block.id} data-component-id={componentId} data-block-id={block.id} style={paragraphStyle(block)}>
      {block.sentences.map(value => sentence(value, 0, value.spans.reduce((n, span) => n + Array.from(span.text).length, 0), value.id))}
    </p>) : document.pages.filter(page => !activePage || page.id === activePage).map(page => {
      const layout = manifest.pages.find(entry => entry.pageId === page.id);
      if (!layout) throw new Error('invalid_layout');
      return <section key={page.id} data-bulletin-page={page.id} style={{width: `${page.width}pt`, height: `${page.height}pt`}}>
        {layout.slots.map(slot => {
          const entry = blockIndex.get(slot.blockId);
          if (!entry || entry.componentId !== slot.componentId) throw new Error('invalid_layout');
          const {block} = entry;
          const style: CSSProperties = {...paragraphStyle(block), left: `${slot.box.x * 100}%`, top: `${slot.box.y * 100}%`, width: `${slot.box.width * 100}%`, minHeight: `${slot.box.height * page.height}pt`};
          return <p key={slot.id} data-slot-id={slot.id} data-component-id={slot.componentId} data-block-id={block.id} data-continuation-of={slot.continuationOf} style={style}>
            {slot.fragments.map((fragment, index) => {
              const value = block.sentences.find(s => s.id === fragment.sentenceId);
              if (!value || fragment.end > value.spans.reduce((n, span) => n + Array.from(span.text).length, 0) || fragment.start < 0 || fragment.start >= fragment.end) throw new Error('invalid_layout');
              return sentence(value, fragment.start, fragment.end, `${value.id}-${index}`);
            })}
          </p>;
        })}
      </section>;
    })}
  </div>;
}
