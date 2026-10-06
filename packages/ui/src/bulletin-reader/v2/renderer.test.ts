import {expect, it} from 'vitest';
import {bulletinFixedText} from './fixed.js';
import assets from './template-assets.json';
import coverage from './font-coverage.json';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {BulletinDocumentRenderer,BULLETIN_RENDERER_V2_DIGEST,type BulletinDocument} from './BulletinDocumentRenderer.js';

it('renders cover weekly scripture with the same scripture font role as body scripture',()=>{
  const block={id:'verse',style:{fontSize:16,lineHeight:24,indent:0,firstLineIndent:0,spaceBefore:0,spaceAfter:0},sentences:[{id:'verse-sentence',spans:[{text:'神爱世人。',fontRole:'scripture' as const}]}]};
  const document:BulletinDocument={issueId:'i',series:'general',contentLocale:'zh-Hans',schemaVersion:'1',templateVersion:'v2',sourceAssetChecksum:'a'.repeat(64),sourcePageCount:4,pages:[{id:'p',width:600,height:800}],components:[{id:'cover',type:'cover',cover:{welcome:[],worship:[],work:[],wordQuestions:[],weeklyVerses:[block]}}],layoutManifest:{templateVersion:'v2',rendererVersion:'v2',rendererArtifactSha256:BULLETIN_RENDERER_V2_DIGEST,assets:[],pages:[{pageId:'p',slots:[{id:'v',componentId:'cover',blockId:'verse',box:{x:.1,y:.7,width:.8,height:.1},fragments:[{sentenceId:'verse-sentence',start:0,end:5}]}]}]}};
  expect(renderToStaticMarkup(createElement(BulletinDocumentRenderer,{document,mode:'paper'}))).toContain('data-font-role="scripture">神爱世人。');
});

it('uses Simplified fixed labels and real body-bold emphasis without altering V1', () => {
  expect(bulletinFixedText('verseLabel', undefined, 0).text).toBe('本周金句');
  expect(bulletinFixedText('announcementsLabel', undefined, 0).text).toBe('家教会公布栏');
  expect(bulletinFixedText('bodyIssueSummary', {title: '信息', subtitle: '', issueNumber: 1740, date: '2026-09-27'}, 0, 16).text).toBe('(1740共14页)');
  const body = assets.find(asset => asset.kind === 'font' && asset.roles?.includes('body'));
  const emphasis = assets.find(asset => asset.kind === 'font' && asset.roles?.includes('emphasis'));
  expect(emphasis?.family).toBe(body?.family);
  expect(emphasis?.weight).toBe(700);
  expect(emphasis?.sha256).not.toBe(body?.sha256);
});

it('covers Simplified scripture, body and emphasis with verified font cmaps', () => {
  for (const role of ['body', 'scripture', 'emphasis']) {
    const font = assets.find(asset => asset.roles?.includes(role))!;
    const ranges = (coverage as Record<string, number[][]>)[font.sha256]!;
    for (const character of '创造天地的神说：我们要照着我们的形像，永恒的命定和呼召。') {
      const point = character.codePointAt(0)!;
      expect(ranges.some(([start, end]) => point >= start! && point <= end!), `${role}: ${character}`).toBe(true);
    }
  }
});
