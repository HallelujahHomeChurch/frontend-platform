'use client';

import type {ReactNode} from 'react';
import {bulletinBlocks, type BulletinBlock, type BulletinRenderableDocument, type BulletinSentence, type BulletinSentenceState} from './BulletinDocumentRenderer.js';
import {requireBulletinRenderer} from './versions.js';
import {bulletinFixedText as traditionalFixedText, type BulletinCanonicalMetadata} from './fixed.js';
import {bulletinFixedText as simplifiedFixedText} from './v2/fixed.js';
import {bulletinFixedText as historicalFixedText} from './v6/fixed.js';
import {bulletinV7FontFamily} from './v7/fonts.js';

type Component = BulletinRenderableDocument['components'][number];
export type BulletinChapterId = 'cover' | 'body' | 'worship' | 'back';
const chapterForType: Record<Component['type'], BulletinChapterId> = {cover: 'cover', bodySection: 'body', hymnLyrics: 'worship', backSummary: 'back', announcements: 'back', victoriesAndPrayers: 'back'};
const chapterOrder: BulletinChapterId[] = ['cover', 'body', 'worship', 'back'];

export function bulletinChapters(document: Pick<BulletinRenderableDocument, 'components'>) {
  return chapterOrder.map(id => ({id, componentIds: document.components.filter(component => chapterForType[component.type] === id).map(component => component.id)})).filter(chapter => chapter.componentIds.length > 0);
}

export function bulletinChapterForAnchor(document: BulletinRenderableDocument, anchor: {kind: 'component' | 'sentence'; id: string}): BulletinChapterId | undefined {
  if (anchor.kind === 'sentence' && /^canonical-(title|subtitle|date|issueNumber)$/.test(anchor.id)) return bulletinChapters(document)[0]?.id;
  const componentId = anchor.kind === 'component' ? anchor.id : bulletinBlocks(document).find(entry => entry.block.sentences.some(sentence => sentence.id === anchor.id))?.componentId;
  const component = document.components.find(component => component.id === componentId);
  return component && chapterForType[component.type];
}

/** One presentation policy. Never remove details from canonical data or search indexes. */
export function bulletinMobileDetails(document: Pick<BulletinRenderableDocument, 'components'>) {
  return {
    fixedElements: new Set(['pastor', 'masthead']),
    sentenceIds: new Set(document.components.flatMap(component => {
      const header = component.type === 'bodySection' ? component.bodySection.header : undefined;
      return header ? [header.lectureDate, ...header.contributors.map(person => person.name)].flatMap(block => block.sentences.map(sentence => sentence.id)) : [];
    })),
  };
}

/** Reflow presentation is independent of the immutable source-paper layout artifact. */
export function BulletinEbook({document, chapter, canonicalMetadata, showDetails = false, sentenceState}: {
  document: BulletinRenderableDocument;
  chapter: BulletinChapterId;
  canonicalMetadata?: BulletinCanonicalMetadata;
  showDetails?: boolean;
  sentenceState?: Readonly<Record<string, BulletinSentenceState>>;
}) {
  requireBulletinRenderer(document.layoutManifest);
  const bulletinFixedText = ['v6', 'v7', 'v8'].includes(document.layoutManifest.rendererVersion)
    ? (element: Parameters<typeof historicalFixedText>[0], metadata: BulletinCanonicalMetadata | undefined, pageNumber: number, sourcePageCount = document.sourcePageCount) => historicalFixedText(element, metadata, pageNumber, sourcePageCount, document.contentLocale === 'zh-Hans' ? 'zh-Hans' : 'zh-Hant')
    : document.contentLocale === 'zh-Hans' ? simplifiedFixedText : traditionalFixedText;
  if (document.schemaVersion !== '1' || document.templateVersion !== document.layoutManifest.templateVersion) throw new Error('update_required');
  const details = bulletinMobileDetails(document);
  const fontStyle = (role: string) => ['v7', 'v8'].includes(document.layoutManifest.rendererVersion) ? {fontFamily: bulletinV7FontFamily(role, document.contentLocale)} : {};
  const sentence = (value: BulletinSentence, fontSize: number, presentation?: 'verse' | 'plain') => <span key={value.id} data-sentence-id={value.id} data-fragment-start={0} data-fragment-end={value.spans.reduce((sum, span) => sum + Array.from(span.text).length, 0)} data-selected={sentenceState?.[value.id]?.selected || undefined} data-highlight={sentenceState?.[value.id]?.highlight}>
    {value.spans.map((span, index) => {
      const role = presentation === 'plain' && span.fontRole !== 'symbol' ? 'body' : presentation === 'verse' && ['body', 'reference'].includes(span.fontRole) ? 'scripture' : span.fontRole;
      return <span key={index} data-font-role={role} style={{...fontStyle(role), ...(span.fontSize == null ? {} : {fontSize: `${span.fontSize / fontSize}em`})}}>{span.text}</span>;
    })}
  </span>;
  const block = (value: BulletinBlock, componentId: string, Tag: 'p' | 'h2' | 'h3' | 'span' = 'p', prefix?: ReactNode, presentation?: 'verse' | 'plain') => <Tag key={value.id} data-component-id={componentId} data-block-id={value.id} style={Tag === 'p' ? {textAlign: value.style.align, paddingInlineStart: `${Math.min(2, value.style.indent)}em`, textIndent: `${Math.min(2, value.style.firstLineIndent)}em`, marginBlockStart: `${Math.min(2, value.style.spaceBefore)}em`, marginBlockEnd: `${Math.min(2, Math.max(.6, value.style.spaceAfter))}em`} : undefined}>
    {prefix}{value.sentences.map(entry => sentence(entry, value.style.fontSize, presentation))}
  </Tag>;
  type Fixed = Parameters<typeof bulletinFixedText>[0];
  const label = (element: Fixed) => bulletinFixedText(element, canonicalMetadata, 0).text;
  const items = (list: Extract<Component, {type: 'backSummary' | 'announcements' | 'victoriesAndPrayers'}>['items'], id: string, plain = false) => list.flatMap(item => [...(item.title ? [block(item.title, id, plain ? 'p' : 'h3', undefined, plain ? 'plain' : undefined)] : []), ...item.blocks.map(value => block(value, id, 'p', undefined, plain ? 'plain' : undefined))]);
  const headerElements = ['title', 'subtitle', 'date', 'issueNumber', 'vision', 'visionMission', 'visionFellowship', 'visionCommitment', 'historicalVision', 'historicalGoals', 'historicalGospelGoals', 'historicalActions', 'historicalCommitment', 'pastor', 'masthead'];
  const header = (document.layoutManifest.pages[0]?.fixedSlots ?? []).filter(slot => headerElements.includes(slot.element) && (showDetails || !details.fixedElements.has(slot.element)));
  return <div className={`hhc-bulletin-v1 hhc-bulletin-ebook${document.templateVersion === 'v2' ? ' hhc-bulletin-v2' : ''}`} data-bulletin-renderer={document.layoutManifest.rendererVersion} data-bulletin-mode="mobile" data-chapter={chapter} lang={document.contentLocale}>
    {chapter === bulletinChapters(document)[0]?.id && header.length > 0 ? <header className="hhc-bulletin-mobile-header">{header.map(slot => {
      const value = bulletinFixedText(slot.element, canonicalMetadata, 0, document.sourcePageCount);
      return <p key={slot.id} data-fixed-element={slot.element}>{value.annotatable ? sentence({id: `canonical-${slot.element}`, spans: [{text: value.text, fontRole: value.fontRole}]}, slot.style.fontSize) : <span data-font-role={value.fontRole} style={fontStyle(value.fontRole)}>{value.text}</span>}</p>;
    })}</header> : null}
    {document.components.filter(component => chapterForType[component.type] === chapter).map(component => {
      const id = component.id;
      switch (component.type) {
        case 'cover': return <div key={id} data-component-id={id}>{([
          ['welcomeLabel', component.cover.welcome.map(value => block(value, id))], ['worshipLabel', items(component.cover.worship, id)], ['workLabel', items(component.cover.work, id)], ['wordLabel', items(component.cover.wordQuestions, id)], ['verseLabel', component.cover.weeklyVerses.map(value => block(value, id, 'p', undefined, 'verse'))],
        ] as [Fixed, ReactNode][]).map(([element, content]) => <section key={element}><h2 data-fixed-element={element}>{label(element).replace(/[：:]\s*$/, '')}</h2>{content}</section>)}</div>;
        case 'bodySection': {
          const body = component.bodySection;
          return <section key={id} data-component-id={id}>
            {showDetails && body.header ? <div className="hhc-ebook-production">{block(body.header.lectureDate, id)}{body.header.contributors.map(person => block(person.name, id, 'p', label(({speaker: 'speakerLabel', transcriber: 'transcriberLabel', editor: 'editorLabel'} as const)[person.role])))}</div> : null}
            <div className="hhc-ebook-body-heading">{block(body.title, id, 'h2')}{body.contributors?.map(person => block(person.name, id, 'span', `${label('speakerSeparator')} `))}</div>
            {body.subtitle && block(body.subtitle, id)}
            {body.blocks.map(value => block(value, id))}
          </section>;
        }
        case 'hymnLyrics': return <section key={id} data-component-id={id}><h2>{label('hymnLabel')}</h2>{component.hymnLyrics.hymns.map(hymn => <section className="hhc-ebook-song" key={hymn.id}>
          <div className="hhc-ebook-song-heading">{hymn.number && block(hymn.number, id, 'span')}{block(hymn.title, id, 'h3')}{hymn.sourceLabel && block(hymn.sourceLabel, id, 'span')}</div>
          {hymn.sections.map(section => <div key={section.id}>{section.lines.map(value => block(value, id))}</div>)}
        </section>)}</section>;
        default: return <section key={id} data-component-id={id}><h2>{label(({backSummary: 'summaryLabel', announcements: 'announcementsLabel', victoriesAndPrayers: 'prayersLabel'} as const)[component.type])}</h2>{items(component.items, id, component.type !== 'backSummary')}</section>;
      }
    })}
  </div>;
}
