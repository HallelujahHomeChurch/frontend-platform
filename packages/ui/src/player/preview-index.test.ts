import {afterEach,expect,it,vi} from 'vitest';
import {act,renderHook} from '@testing-library/react';
import {loadPreviewIndex,parsePreviewIndex} from './preview-index.js';
import {previewCueAt} from './preview-cue.js';
import {usePreviewIndex} from './use-preview-index.js';

afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});

const url='https://media.alive.org.tw/videos/r/packages/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/sessions/s/previews/index.vtt';
const cue=(range='00:00:30.000 --> 00:00:35.000',sprite='seg-000001.jpg#xywh=0,0,160,90')=>`WEBVTT\n\n${range}\n${sprite}\n`;
const mixedIndex='WEBVTT\n\n'+Array.from({length:6},(_,i)=>`00:00:${String(i*5).padStart(2,'0')}.000 --> 00:00:${String((i+1)*5).padStart(2,'0')}.000\nseg-000000.jpg#xywh=${i*160},0,160,90\n\n`).join('')+
  '00:00:30.000 --> 00:00:35.000\nseg-000001.jpg#xywh=0,0,160,90\n\n00:00:35.000 --> 00:00:36.200\nseg-000001.jpg#xywh=0,0,160,90\n';
it('selects mixed legacy and ten-second sprites through the final partial VOD tail',()=>{
  const cues=parsePreviewIndex(mixedIndex,url);
  expect(previewCueAt(cues,17)).toMatchObject({start:10,x:320});
  expect(previewCueAt(cues,29.99)).toMatchObject({start:20,x:640});
  for(const time of [30,35,36.199])expect(previewCueAt(cues,time)).toMatchObject({start:30,x:0,url:url.replace('index.vtt','seg-000001.jpg')});
  expect(previewCueAt(cues,36.2)).toBeUndefined();
});
it('replaces the live index with the completed VOD session without exposing late live metadata',async()=>{
  vi.useFakeTimers();
  const liveURL=url.replace('/packages/','/captures/').replace('previews/index.vtt','master.m3u8');
  const vodURL=url.replace('previews/index.vtt','master.m3u8');
  let finishLive!:(response:Response)=>void;
  const fetcher=vi.fn().mockResolvedValueOnce(new Response(cue('00:00:00.000 --> 00:00:05.000','seg-000000.jpg#xywh=0,0,160,90')))
    .mockImplementationOnce(()=>new Promise<Response>(resolve=>{finishLive=resolve;}))
    .mockResolvedValueOnce(new Response(mixedIndex));
  vi.stubGlobal('fetch',fetcher);
  const view=renderHook(({playback,live})=>usePreviewIndex(playback,live,true),{initialProps:{playback:liveURL,live:true}});
  await act(async()=>{});
  expect(view.result.current).toHaveLength(1);
  await act(async()=>{await vi.advanceTimersByTimeAsync(5000);});
  view.rerender({playback:vodURL,live:false});
  expect(view.result.current).toEqual([]);
  await act(async()=>{});
  expect(view.result.current).toHaveLength(8);
  expect(previewCueAt(view.result.current,36)).toMatchObject({end:35,url:url.replace('index.vtt','seg-000001.jpg')});
  await act(async()=>{finishLive(new Response(cue()));});
  expect(view.result.current).toHaveLength(8);
  expect(view.result.current.every(cue=>cue.url.includes('/packages/'))).toBe(true);
  expect(fetcher.mock.calls[1][1].signal.aborted).toBe(true);
  view.unmount();
});
it('resolves a bounded sprite inside the exact authenticated playback session',()=>{
  expect(parsePreviewIndex(cue(),url)).toEqual([{start:30,end:35,url:url.replace('index.vtt','seg-000001.jpg'),x:0}]);
  expect(parsePreviewIndex(cue('00:00:35.000 --> 00:00:36.200','seg-000001.jpg#xywh=160,0,160,90'),url)[0].end).toBe(36.2);
});
it.each(['https://evil.example/seg-000001.jpg','../seg-000001.jpg','seg-000001.jpg?token=x','seg-000001.jpg#xywh=960,0,160,90','seg-000001.jpg#xywh=0,0,1920,1080'])('rejects unsafe sprite references: %s',sprite=>{
  expect(()=>parsePreviewIndex(cue(undefined,sprite),url)).toThrow();
});
it.each(['00:00:35.000 --> 00:00:30.000','00:00:30.000 --> 00:00:36.000','00:90:00.000 --> 00:90:05.000'])('rejects invalid timelines: %s',range=>{
  expect(()=>parsePreviewIndex(cue(range),url)).toThrow();
});
it('rejects oversized metadata and overlapping cues',()=>{
  expect(()=>parsePreviewIndex('WEBVTT\n'+ ' '.repeat(2_097_152),url)).toThrow();
  expect(()=>parsePreviewIndex(cue()+ '\n00:00:32.000 --> 00:00:37.000\nseg-000001.jpg#xywh=160,0,160,90',url)).toThrow();
});
it('loads only the session preview with credentials, no redirects and abort support',async()=>{
  const fetcher=vi.fn().mockResolvedValue(new Response(cue().replace(/\n/g,'\r\n')));
  vi.stubGlobal('fetch',fetcher);
  const controller=new AbortController();
  expect(await loadPreviewIndex(url.replace('previews/index.vtt','master.m3u8'),controller.signal)).toHaveLength(1);
  expect(fetcher).toHaveBeenCalledWith(url,{credentials:'include',cache:'no-store',redirect:'error',referrerPolicy:'no-referrer',signal:controller.signal});
});
it('treats previews not yet generated as optional and bounds downloaded metadata',async()=>{
  const fetcher=vi.fn().mockResolvedValueOnce(new Response(null,{status:404})).mockResolvedValueOnce(new Response('x'.repeat(2_097_153)));
  vi.stubGlobal('fetch',fetcher);
  const signal=new AbortController().signal;
  expect(await loadPreviewIndex(url.replace('previews/index.vtt','master.m3u8'),signal)).toEqual([]);
  await expect(loadPreviewIndex(url.replace('previews/index.vtt','master.m3u8'),signal)).rejects.toThrow('too large');
});
it('retains bounded twelve-hour capture previews beyond the old six-hour VOD window',()=>{
  expect(parsePreviewIndex(cue('11:59:55.000 --> 12:00:00.000'),url)[0]).toMatchObject({start:43195,end:43200});
  expect(()=>parsePreviewIndex(cue('12:00:00.000 --> 12:00:05.000'),url)).toThrow();
});
it('accepts the bounded capture cue count while rejecting excess metadata',async()=>{
  const stamp=(seconds:number)=>new Date(seconds*1000).toISOString().slice(11,23);
  const text='WEBVTT\n\n'+Array.from({length:25920},(_,i)=>`${stamp(i)} --> ${stamp(i+1)}\nseg-${String(Math.floor(i/6)).padStart(6,'0')}.jpg#xywh=${i%6*160},0,160,90\n`).join('\n');
  expect(text.length).toBeGreaterThan(1_048_576);
  expect(parsePreviewIndex(text,url)).toHaveLength(25920);
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(text)));
  expect(await loadPreviewIndex(url.replace('previews/index.vtt','master.m3u8'),new AbortController().signal)).toHaveLength(25920);
  expect(()=>parsePreviewIndex(text+'\n07:12:00.000 --> 07:12:01.000\nseg-004320.jpg#xywh=0,0,160,90',url)).toThrow();
  expect(()=>parsePreviewIndex('WEBVTT\n'+' '.repeat(2_097_152),url)).toThrow();
});
