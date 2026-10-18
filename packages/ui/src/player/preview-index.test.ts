import {afterEach,expect,it,vi} from 'vitest';
import {loadPreviewIndex,parsePreviewIndex} from './preview-index';

afterEach(()=>vi.unstubAllGlobals());

const url='https://media.alive.org.tw/videos/r/packages/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/sessions/s/previews/index.vtt';
const cue=(range='00:00:30.000 --> 00:00:35.000',sprite='seg-000001.jpg#xywh=0,0,160,90')=>`WEBVTT\n\n${range}\n${sprite}\n`;
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
  expect(()=>parsePreviewIndex('WEBVTT\n'+ ' '.repeat(1_048_576),url)).toThrow();
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
  const fetcher=vi.fn().mockResolvedValueOnce(new Response(null,{status:404})).mockResolvedValueOnce(new Response('x'.repeat(1_048_577)));
  vi.stubGlobal('fetch',fetcher);
  const signal=new AbortController().signal;
  expect(await loadPreviewIndex(url.replace('previews/index.vtt','master.m3u8'),signal)).toEqual([]);
  await expect(loadPreviewIndex(url.replace('previews/index.vtt','master.m3u8'),signal)).rejects.toThrow('too large');
});
