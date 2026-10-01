import {fireEvent, render} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import * as UI from '../index.js';
import type {components} from './generated.js';
import {bulletinFixedText} from './fixed.js';

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
  it('reconstructs the back summary scroll as code-owned vectors behind selectable content', () => {
    const document = fixture();
    document.layoutManifest.pages[0].fixedSlots = [{id: 'native-scroll', element: 'summaryFrame', box: {x: 75.75/595.32, y: 11.25/841.92, width: 486.4/595.32, height: 187.2/841.92}, style: {fontSize: 6, lineHeight: 6, indent: 0, firstLineIndent: 0, spaceBefore: 0, spaceAfter: 0}}];
    const {container} = render(<UI.BulletinDocumentRenderer document={document} mode="paper" />);
    const frame = container.querySelector('[data-slot-id="native-scroll"]')!;
    expect(frame).toHaveAttribute('aria-hidden', 'true');
    expect(frame.querySelector('svg')).toHaveAttribute('viewBox', '0 0 486.4 187.2');
    expect(frame.querySelectorAll('path')).toHaveLength(3);
    expect(container.querySelector('[data-sentence-id="s"]')).toHaveTextContent('𠮷你');
    expect(frame.querySelector('image,use,foreignObject,script')).toBeNull();
  });
  it('repeats canonical body art as selectable native text without transforming the cover', () => {
    const document = fixture();
    const style = {fontSize: 42, lineHeight: 84, indent: 0, firstLineIndent: 0, spaceBefore: 0, spaceAfter: 0};
    for (const page of document.layoutManifest.pages) page.fixedSlots = [{id: `${page.pageId}-title`, element: 'title', box: {x: .12, y: .04, width: .6, height: .1}, style}];
    document.layoutManifest.pages[1].fixedSlots!.push({id: 'body-issue', element: 'bodyIssueSummary', box: {x: .3, y: .3, width: .2, height: .02}, style: {...style, fontSize: 11, lineHeight: 14}});
    // The cover may gain a continuation; body identity is not physical page 2.
    document.pages.splice(1,0,{id: 'cover-continuation',width:595.32,height:841.92});
    document.layoutManifest.pages.splice(1,0,{pageId:'cover-continuation',slots:[]});
    const activate = vi.fn();
    const {container} = render(<UI.BulletinDocumentRenderer document={document} mode="paper" canonicalMetadata={{title: '永恆的命定和呼召', subtitle: '', issueNumber: 1740, date: '2026-09-27'}} sentenceState={{'canonical-title': {highlight: 'yellow'}}} onSentenceActivate={activate} />);
    const cover = container.querySelector<HTMLElement>('[data-slot-id="p1-title"]')!;
    const body = container.querySelector<HTMLElement>('[data-slot-id="p2-title"]')!;
    expect(cover).not.toHaveAttribute('data-body-canonical-art');
    expect(body).toHaveAttribute('data-body-canonical-art', 'true');
    expect(body.style.lineHeight).toBe('42pt');
    expect(body.style.getPropertyValue('--body-art-scale-y')).toBe('2');
    const sentence = body.querySelector('[data-sentence-id="canonical-title"]')!;
    expect(sentence).toHaveTextContent('永恆的命定和呼召');
    expect(sentence).toHaveAttribute('data-highlight', 'yellow');
    fireEvent.click(sentence);
    expect(activate).toHaveBeenCalledWith('canonical-title');
    expect(container.querySelector('canvas,iframe,object,embed,img')).toBeNull();
  });
  it('keeps the paper sidebar fixed while mobile summary retains its own section title', () => {
    expect(bulletinFixedText('summarySidebarTitle', undefined, 0).text).toBe('家教會週報');
    expect(bulletinFixedText('summarySidebarTagline', undefined, 0).text).toBe('一看再看、百看不厭的');
    const {container} = render(<UI.BulletinDocumentRenderer document={fixture()} mode="mobile" />);
    expect(container.querySelector('h2')?.textContent).toBe('信息摘要');
  });
  it('derives the printed body issue summary from canonical issue and immutable source page count', () => {
    const metadata = {title: '信息', subtitle: '', issueNumber: 1739, date: '2026-09-20'};
    expect(bulletinFixedText('bodyIssueSummary', metadata, 1, 12)).toEqual({text: '(1739共10頁)', fontRole: 'emphasis', annotatable: false});
    expect(bulletinFixedText('bodySpeakerLabel', undefined, 1).text).toBe('‧講員：');
    expect(bulletinFixedText('lectureDateMarker', undefined, 1).text).toBe('‧');
    expect(() => bulletinFixedText('bodyIssueSummary', metadata, 1)).toThrow('invalid_source_page_count');
  });
  it('reflows the lecture date and contributor band before the first body title, with fixed role labels', () => {
    const document = fixture();
    const style = {fontSize: 11, lineHeight: 14, indent: 0, firstLineIndent: 0, spaceBefore: 0, spaceAfter: 0};
    const block = (id: string, text: string) => ({id, style, sentences: [{id: `sentence-${id}`, spans: [{text, fontRole: 'emphasis' as const}]}]});
    document.components = [{id: 'body', type: 'bodySection', bodySection: {kind: 'sermon', title: block('title', '信息標題'), header: {lectureDate: block('lecture-date', '2026-09-13'), contributors: [{role: 'speaker', name: block('header-speaker', '講員姓名')}, {role: 'transcriber', name: block('header-transcriber', '謄修姓名')}, {role: 'editor', name: block('header-editor', '完稿姓名')}]}, blocks: [block('body', '正文。')]}}];
    const {container} = render(<UI.BulletinDocumentRenderer document={document} mode="mobile" />);
    expect(Array.from(container.querySelectorAll('[data-block-id]'), node => node.getAttribute('data-block-id'))).toEqual(['lecture-date', 'header-speaker', 'header-transcriber', 'header-editor', 'title', 'body']);
    expect(container.querySelector('[data-block-id="header-speaker"]')).toHaveTextContent('講員：講員姓名');
    expect(container.querySelector('[data-block-id="header-transcriber"]')).toHaveTextContent('謄修：謄修姓名');
    expect(container.querySelector('[data-block-id="header-editor"]')).toHaveTextContent('完稿：完稿姓名');
    expect(container.querySelector('[data-sentence-id="sentence-header-editor"]')).toHaveTextContent('完稿姓名');
    expect(container.querySelector('[data-sentence-id="sentence-header-editor"]')).not.toHaveTextContent('完稿：');
  });
  it('uses the reference church-owned labels rather than demo wording', () => {
    for (const element of ['welcomeLabel', 'worshipLabel', 'workLabel', 'wordLabel'] as const) expect(bulletinFixedText(element, undefined, 0).fontRole).toBe('body');
    for (const element of ['contact', 'websiteQRLabel', 'youtubeQRLabel', 'streamQRLabel'] as const) expect(bulletinFixedText(element, undefined, 0).fontRole).toBe('scripture');
    for (const [element, expected] of [
      ['hymnLabel', '小組詩歌'], ['announcementsLabel', '家教會公佈欄'],
      ['transcriberLabel', '謄修：'], ['streamQRLabel', '神國大樂\n京成兄妹'],
      ['speakerSeparator', '～'],
    ] as const) expect(bulletinFixedText(element, undefined, 1).text).toBe(expected);
    expect(bulletinFixedText('vision', undefined, 1).text).toContain('堅持理想：宣教主導');
  });
  it('exports a single renderer with an exact artifact identity', () => {
    expect(UI.BulletinDocumentRenderer).toBeTypeOf('function');
    expect(UI.BULLETIN_RENDERER_V1_DIGEST).toMatch(/^[a-f0-9]{64}$/);
  });
  it('retains all three separately positioned church vision rows on mobile', () => {
    const document = fixture();
    const style = {fontSize: 10, lineHeight: 10, indent: 0, firstLineIndent: 0, spaceBefore: 0, spaceAfter: 0};
    document.layoutManifest.pages[0].fixedSlots = (['visionMission', 'visionFellowship', 'visionCommitment'] as const).map((element, index) => ({id: element, element, box: {x: .44+index*.034, y: .156+index*.019, width: .4, height: .015}, style}));
    const {container} = render(<UI.BulletinDocumentRenderer document={document} mode="mobile" />);
    expect(container.querySelector('[data-fixed-element="visionMission"]')).toHaveTextContent('異象使命：華人遍地興起、福音傳到地極');
    expect(container.querySelector('[data-fixed-element="visionFellowship"]')).toHaveTextContent('團契行動：共同生活、愛與成全、恩膏傳承');
    expect(container.querySelector('[data-fixed-element="visionCommitment"]')).toHaveTextContent('堅持理想：宣教主導、靈恩神學、團隊事奉、門徒訓練');
  });
  it('frames only a paper body title, not its separately anchored speaker', () => {
    const document = fixture();
    const title = document.components[0].items![0].blocks[0];
    const name = {...title, id: 'name', sentences: [{id: 'speaker', spans: [{text: '講員', fontRole: 'emphasis' as const}]}]};
    document.components = [{id: 'c', type: 'bodySection', bodySection: {kind: 'unknown', title, contributors: [{role: 'speaker', name}], blocks: []}}];
    document.layoutManifest.pages[0].slots.push({id: 'speaker-slot', componentId: 'c', blockId: 'name', box: {x: .4, y: .2, width: .2, height: .1}, fragments: [{sentenceId: 'speaker', start: 0, end: 2}]});
    const {container} = render(<UI.BulletinDocumentRenderer document={document} mode="paper" />);
    expect(container.querySelectorAll('[data-body-title="true"]')).toHaveLength(2);
    expect(container.querySelector('[data-slot-id="speaker-slot"]')).not.toHaveAttribute('data-body-title');
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
    expect(container).toHaveTextContent('第1739期');
    fireEvent.click(container.querySelector('[data-sentence-id="canonical-title"]')!);
    expect(activate).toHaveBeenCalledWith('canonical-title');
    expect(JSON.stringify(document)).not.toContain('信息主題');
  });
  it('does not repeat first-line indentation or paragraph spacing on continuation slots', () => {
    const document = fixture();
    document.components[0].items![0].blocks[0].style.spaceBefore = 1;
    document.components[0].items![0].blocks[0].style.spaceAfter = 1;
    const {container} = render(<UI.BulletinDocumentRenderer document={document} mode="paper" />);
    const first = container.querySelector<HTMLElement>('[data-slot-id="slot1"]')!;
    const continuation = container.querySelector<HTMLElement>('[data-slot-id="slot2"]')!;
    expect(first.style.textIndent).toBe('1em');
    expect(first.style.marginBlockStart).toBe('1em');
    expect(Number.parseFloat(continuation.style.textIndent)).toBe(0);
    expect(Number.parseFloat(continuation.style.marginBlockStart)).toBe(0);
    expect(Number.parseFloat(first.style.marginBlockEnd)).toBe(0);
    expect(continuation.style.marginBlockEnd).toBe('1em');
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
  it('keeps the fixed cover and back section headings in mobile semantic order', () => {
    const document = fixture();
    const block = (id: string) => ({id, style: {fontSize: 14, lineHeight: 18, indent: 0, firstLineIndent: 0, spaceBefore: 0, spaceAfter: 0}, sentences: [{id: `sentence-${id}`, spans: [{text: id, fontRole: 'body' as const}]}]});
    const item = (id: string) => ({id: `item-${id}`, blocks: [block(id)]});
    document.components = [
      {id: 'cover', type: 'cover', cover: {welcome: [block('welcome')], worship: [item('worship')], work: [item('work')], wordQuestions: [item('word')], weeklyVerses: [block('verse')]}},
      {id: 'summary', type: 'backSummary', items: [item('summary')]},
      {id: 'announcements', type: 'announcements', items: [item('announcement')]},
      {id: 'prayers', type: 'victoriesAndPrayers', items: [item('prayer')]},
    ];
    const {container} = render(<UI.BulletinDocumentRenderer document={document} mode="mobile" />);
    expect(Array.from(container.querySelectorAll('h2'), heading => heading.textContent)).toEqual([
      '一、Welcome：', '二、Worship：', '三、Work：', '四、Word：', '本週金句',
      '信息摘要', '家教會公佈欄', '得勝與代求',
    ]);
    expect(Array.from(container.querySelectorAll('[data-block-id]'), node => node.getAttribute('data-block-id'))).toEqual(['welcome', 'worship', 'work', 'word', 'verse', 'summary', 'announcement', 'prayer']);
    expect(container.querySelectorAll('[data-sentence-id]')).toHaveLength(8);
    expect(container.querySelectorAll('h2 [data-sentence-id]')).toHaveLength(0);
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
  it('preserves mixed source font-size proportions in paper and mobile text', () => {
    const document = fixture();
    document.components[0].items![0].blocks[0].sentences[0].spans[1].fontSize = 12;
    for (const mode of ['paper', 'mobile'] as const) {
      const {container} = render(<UI.BulletinDocumentRenderer document={document} mode={mode} />);
      expect(container.querySelector<HTMLElement>('[data-font-role="scripture"]')!.style.fontSize).toBe('0.75em');
    }
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
