import {fireEvent, render} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import * as UI from '../index.js';
import type {components} from './generated.js';

type Document = components['schemas']['OnlineBulletinDocument'];
function fixture(): Document {
  const style = {fontSize: 16, lineHeight: 24, indent: 2, firstLineIndent: 1, spaceBefore: 0, spaceAfter: 0};
  const block = {id: 'b', style, sentences: [{id: 's', spans: [{text: '𠮷你好', fontRole: 'body' as const}, {text: '。', fontRole: 'scripture' as const}]}]};
  return {
    issueId: '00000000-0000-4000-8000-000000000001', series: 'general', contentLocale: 'zh-Hant', schemaVersion: '1', templateVersion: 'v1', sourceAssetChecksum: 'a'.repeat(64), sourcePageCount: 4,
    pages: [{id: 'p1', width: 595.32, height: 841.92}, {id: 'p2', width: 595.32, height: 841.92}],
    layoutManifest: {templateVersion: 'v1', rendererVersion: 'v1', rendererArtifactSha256: UI.BULLETIN_RENDERER_V1_DIGEST, assets: [], pages: [
      {pageId: 'p1', slots: [{id: 'slot1', componentId: 'c', blockId: 'b', box: {x: .1, y: .2, width: .8, height: .1}, fragments: [{sentenceId: 's', start: 0, end: 2}]}]},
      {pageId: 'p2', slots: [{id: 'slot2', continuationOf: 'slot1', componentId: 'c', blockId: 'b', box: {x: .1, y: .1, width: .8, height: .1}, fragments: [{sentenceId: 's', start: 2, end: 4}]}]},
    ]},
    components: [{id: 'c', type: 'backSummary', items: [{id: 'i', blocks: [block]}]}],
  };
}

describe('immutable shared bulletin renderer', () => {
  it('exports a single renderer with an exact artifact identity', () => {
    expect(UI.BulletinDocumentRenderer).toBeTypeOf('function');
    expect(UI.BULLETIN_RENDERER_V1_DIGEST).toMatch(/^[a-f0-9]{64}$/);
  });
  it('renders point-sized paper and Unicode continuations without duplicate or lost text', () => {
    const document = fixture();
    const {container} = render(<UI.BulletinDocumentRenderer document={document} mode="paper" />);
    const pages = container.querySelectorAll<HTMLElement>('[data-bulletin-page]');
    expect(pages[0].style.width).toBe('595.32pt');
    expect(pages[0].style.height).toBe('841.92pt');
    expect(pages[0].textContent).toBe('𠮷你');
    expect(pages[1].textContent).toBe('好。');
    expect(container.querySelectorAll('[data-sentence-id="s"]')).toHaveLength(2);
    expect(container.querySelector('[data-font-role="scripture"]')).toHaveTextContent('。');
    expect(container.querySelector('canvas,iframe,object,embed,img')).toBeNull();
  });
  it('composes fixed labels with the canonical metadata snapshot without duplicating editable text', () => {
    const document = fixture();
    const style = {fontSize: 18, lineHeight: 24, indent: 0, firstLineIndent: 0, spaceBefore: 0, spaceAfter: 0};
    document.layoutManifest.pages[0].fixedSlots = [
      {id: 'masthead', element: 'masthead', box: {x: .1, y: .01, width: .8, height: .04}, style},
      {id: 'canonical-title', element: 'title', box: {x: .1, y: .06, width: .8, height: .04}, style},
      {id: 'issue-label', element: 'issueNumber', box: {x: .1, y: .11, width: .4, height: .04}, style},
    ];
    const activate = vi.fn();
    const {container} = render(<UI.BulletinDocumentRenderer document={document} mode="paper" canonicalMetadata={{title: '信息主題', subtitle: '', issueNumber: 1739, date: '2026-09-20'}} onSentenceActivate={activate} />);
    expect(container).toHaveTextContent('哈利路亞家教會 週報');
    expect(container).toHaveTextContent('信息主題');
    expect(container).toHaveTextContent('第 1739 期');
    fireEvent.click(container.querySelector('[data-sentence-id="canonical-title"]')!);
    expect(activate).toHaveBeenCalledWith('canonical-title');
    expect(JSON.stringify(document)).not.toContain('信息主題');
  });
  it('reflows whole sentences once on mobile, retaining selection and highlight identity', () => {
    const document = fixture();
    const activate = vi.fn();
    const {container} = render(<UI.BulletinDocumentRenderer document={document} mode="mobile" sentenceState={{s: {selected: true, highlight: 'yellow'}}} onSentenceActivate={activate} />);
    const sentence = container.querySelector<HTMLElement>('[data-sentence-id="s"]')!;
    expect(container.querySelectorAll('[data-sentence-id="s"]')).toHaveLength(1);
    expect(sentence).toHaveTextContent('𠮷你好。');
    expect(sentence).toHaveAttribute('aria-pressed', 'true');
    expect(sentence).toHaveAttribute('data-highlight', 'yellow');
    fireEvent.click(sentence);
    expect(activate).toHaveBeenCalledWith('s');
    fireEvent.keyDown(sentence, {key: 'Enter'});
    expect(activate).toHaveBeenCalledTimes(2);
    const selection = window.getSelection()!;
    const range = window.document.createRange();
    range.selectNodeContents(sentence);
    selection.addRange(range);
    fireEvent.click(sentence);
    expect(activate).toHaveBeenCalledTimes(2);
    selection.removeAllRanges();
  });
  it('renders only registry-owned graphics and native rules, never document asset URLs', () => {
    const document = fixture();
    const style = {fontSize: 16, lineHeight: 20, indent: 0, firstLineIndent: 0, spaceBefore: 0, spaceAfter: 0};
    document.layoutManifest.pages[0].fixedSlots = ['logo', 'websiteQR', 'topRule', 'summaryFrame'].map((element, index) => ({id: `fixed-${index}`, element: element as components['schemas']['OnlineBulletinFixedSlot']['element'], box: {x: .1, y: index * .1, width: .2, height: .08}, style}));
    const {container} = render(<UI.BulletinDocumentRenderer document={document} mode="paper" />);
    expect(container.querySelectorAll('img')).toHaveLength(2);
    expect(container.querySelector('[data-fixed-element="websiteQR"] img')).toHaveAttribute('src', expect.stringMatching(/^\/assets\/weekly\/v1\/qr-website-[a-f0-9]{64}\.svg$/));
    expect(container.querySelector('[data-fixed-element="logo"] img')).toHaveAttribute('alt', '');
    expect(container.querySelector('[data-fixed-element="topRule"]')).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelector('[data-fixed-element="summaryFrame"]')).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelector('[data-fixed-element="websiteQR"] [data-sentence-id]')).toBeNull();
  });
  it('preserves explicit PDF tracking instead of shrinking the glyph size', () => {
    const document = fixture();
    Object.assign(document.components[0].items![0].blocks[0].style, {letterSpacing: -.2});
    const {container} = render(<UI.BulletinDocumentRenderer document={document} mode="paper" />);
    const slot = container.querySelector<HTMLElement>('[data-slot-id="slot1"]')!;
    expect(slot.style.fontSize).toBe('16pt');
    expect(slot.style.letterSpacing).toBe('-0.2em');
  });
  it('shares canonical sentence identity across repeated paper titles and mobile reflow', () => {
    const document = fixture();
    const style = {fontSize: 18, lineHeight: 24, indent: 0, firstLineIndent: 0, spaceBefore: 0, spaceAfter: 0};
    for (const [index, page] of document.layoutManifest.pages.entries()) page.fixedSlots = [{id: `title-placement-${index}`, element: 'title', box: {x: .1, y: .01, width: .8, height: .04}, style}];
    const props = {document, canonicalMetadata: {title: '信息主題', subtitle: '', issueNumber: 1739, date: '2026-09-20'}, sentenceState: {'canonical-title': {selected: true, highlight: 'yellow' as const}}};
    const paper = render(<UI.BulletinDocumentRenderer {...props} mode="paper" />);
    expect(paper.container.querySelectorAll('[data-sentence-id="canonical-title"][data-highlight="yellow"]')).toHaveLength(2);
    const mobile = render(<UI.BulletinDocumentRenderer {...props} mode="mobile" />);
    expect(mobile.container.querySelectorAll('[data-sentence-id="canonical-title"][data-highlight="yellow"]')).toHaveLength(1);
  });
  it('keeps canonical cover headings in the mobile composition', () => {
    const document = fixture();
    document.layoutManifest.pages[0].fixedSlots = [{id: 'mobile-title', element: 'title', box: {x: .1, y: .1, width: .8, height: .1}, style: {fontSize: 24, lineHeight: 28, indent: 0, firstLineIndent: 0, spaceBefore: 0, spaceAfter: 0}}];
    const {container} = render(<UI.BulletinDocumentRenderer document={document} mode="mobile" canonicalMetadata={{title: '信息主題', subtitle: '', issueNumber: 1739, date: '2026-09-20'}} />);
    expect(container.querySelector('[data-sentence-id="canonical-title"]')).toHaveTextContent('信息主題');
  });
  it('refuses unsupported or mismatched renderers rather than silently using latest', () => {
    for (const patch of [{rendererVersion: 'v2'}, {rendererArtifactSha256: '0'.repeat(64)}]) {
      const document = fixture();
      Object.assign(document.layoutManifest, patch);
      expect(() => render(<UI.BulletinDocumentRenderer document={document} mode="paper" />)).toThrow('update_required');
    }
  });
  it('allows successive touch taps with different pointer IDs but suppresses dragging', () => {
    const activate = vi.fn();
    const {container} = render(<UI.BulletinDocumentRenderer document={fixture()} mode="mobile" onSentenceActivate={activate} />);
    const sentence = container.querySelector('[data-sentence-id="s"]')!;
    const pointer = (type: string, pointerId: number, x = 0) => {
      const event = new Event(type, {bubbles: true});
      Object.assign(event, {pointerId, clientX: x, clientY: 0});
      fireEvent(sentence, event);
    };
    for (const id of [1, 2]) { pointer('pointerdown', id); pointer('pointerup', id); fireEvent.click(sentence); }
    expect(activate).toHaveBeenCalledTimes(2);
    pointer('pointerdown', 3);
    pointer('pointermove', 3, 9);
    pointer('pointerup', 3, 9);
    fireEvent.click(sentence);
    expect(activate).toHaveBeenCalledTimes(2);
  });
  it('keeps identical paper HTML for Admin and Website consumers and escapes content', () => {
    const document = fixture();
    const sentence = document.components[0];
    if (sentence.type !== 'backSummary') throw new Error('fixture');
    sentence.items[0].blocks[0].sentences[0].spans[0].text = '<script>';
    document.layoutManifest.pages[0].slots[0].fragments[0].end = 2;
    document.layoutManifest.pages[1].slots[0].fragments[0] = {sentenceId: 's', start: 2, end: 9};
    const admin = render(<UI.BulletinDocumentRenderer document={document} mode="paper" />);
    const website = render(<UI.BulletinDocumentRenderer document={document} mode="paper" />);
    expect(admin.container.innerHTML).toBe(website.container.innerHTML);
    expect(admin.container.querySelector('script')).toBeNull();
  });
});
