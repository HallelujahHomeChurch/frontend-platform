import {useRef} from 'react';
import {act, cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {PlayerChrome} from './PlayerChrome.js';
import type {LivePlayerState} from './live-player.js';

const playbackUrl='https://media.example/videos/r/captures/c/sessions/s/master.m3u8';
const labels={quality:'Quality',auto:'Auto',play:'Play',pause:'Pause',mute:'Mute',unmute:'Unmute',seek:'Position',volume:'Volume',fullscreen:'Fullscreen',exitFullscreen:'Exit fullscreen',fullscreenError:'Error',playbackSpeed:'Speed',settings:'Settings',togglePlayback:'Toggle playback',privateCopy:'Private',buffering:'Loading'};
const live={verifiedEnd:200,canFollow:true,label:'Live',backToLive:'Back to live'};
const index=(start=30,sprite='seg-000001.jpg')=>`WEBVTT\n\n00:00:${String(start).padStart(2,'0')}.000 --> 00:00:${String(start+5).padStart(2,'0')}.000\n${sprite}#xywh=0,0,160,90\n`;
function Harness({url=playbackUrl,state=live}:{url?:string;state?:LivePlayerState|null}){
  const container=useRef<HTMLDivElement>(null),videoRef=useRef<HTMLVideoElement>(null);
  return <div ref={container}><video ref={videoRef}/><PlayerChrome container={container} videoRef={videoRef} playbackUrl={url} labels={labels} quality="auto" qualities={['480p']} loading={false} failed={false} onQualityChange={()=>{}} live={state??undefined}/></div>;
}
function hover(seconds=32){
  const input=screen.getByRole('slider',{name:'Position'});
  vi.spyOn(input,'getBoundingClientRect').mockReturnValue({left:0,width:110} as DOMRect);
  fireEvent(input,new MouseEvent('pointermove',{bubbles:true,clientX:seconds}));
  return input;
}
const tick=async(ms:number)=>act(async()=>{await vi.advanceTimersByTimeAsync(ms);});
beforeEach(()=>{
  vi.useFakeTimers();
  vi.spyOn(HTMLMediaElement.prototype,'duration','get').mockReturnValue(110);
  vi.spyOn(HTMLMediaElement.prototype,'seekable','get').mockReturnValue({length:1,start:()=>0,end:()=>200});
  vi.stubGlobal('URL',class extends URL{static createObjectURL=vi.fn(()=> 'blob:preview');static revokeObjectURL=vi.fn();});
});
afterEach(()=>{cleanup();vi.useRealTimers();vi.restoreAllMocks();vi.unstubAllGlobals();});
function network(){
  const fetcher=vi.fn(async(url:string)=>url.endsWith('.vtt')?new Response(index()):new Response(new Uint8Array([255,216,255,217]),{headers:{'Content-Type':'image/jpeg'}}));
  vi.stubGlobal('fetch',fetcher);return fetcher;
}
it('shows the existing sprite style for live DVR and refreshes only while the timeline preview is active',async()=>{
  const fetcher=network(),view=render(<Harness/>);
  await tick(10000);expect(fetcher).not.toHaveBeenCalled();
  const input=hover();await tick(0);await tick(100);
  expect(view.container.querySelector('img')).toHaveAttribute('src','blob:preview');
  expect(view.container.querySelector('img')).toHaveAttribute('width','960');
  for(let i=0;i<30;i++)hover(31+i/30);
  await tick(4800);expect(fetcher.mock.calls.filter(([url])=>url.endsWith('.vtt'))).toHaveLength(1);
  await tick(200);expect(fetcher.mock.calls.filter(([url])=>url.endsWith('.vtt'))).toHaveLength(2);
  fireEvent.pointerLeave(input.parentElement!);await tick(15000);
  expect(fetcher.mock.calls.filter(([url])=>url.endsWith('.vtt'))).toHaveLength(2);
});
it('uses time only for future or out-of-window cues and for an unavailable live index',async()=>{
  const fetcher=network();fetcher.mockResolvedValueOnce(new Response(index(30)));
  const view=render(<Harness state={{...live,verifiedEnd:122}}/>);
  hover(110);await tick(100);
  expect(view.container.querySelector('img')).toBeNull();
  expect(view.container.querySelector('time')).toHaveTextContent('0:31');
  fetcher.mockResolvedValueOnce(new Response(null,{status:404}));
  await tick(5100);expect(view.container.querySelector('img')).toBeNull();
});
it('aborts and fences the old capture index, then loads the VOD index on transition',async()=>{
  let resolve!: (response:Response)=>void;
  const fetcher=network();fetcher.mockImplementationOnce(()=>new Promise<Response>(done=>{resolve=done;}));
  const view=render(<Harness/>);hover();await tick(0);await tick(100);
  const oldSignal=(fetcher.mock.calls[0] as unknown as [string,RequestInit])[1].signal;
  view.rerender(<Harness url={playbackUrl.replace('/captures/c/','/captures/new/')}/>);
  expect(oldSignal?.aborted).toBe(true);
  await act(async()=>resolve(new Response(index(30,'seg-000099.jpg'))));await tick(100);
  expect(fetcher.mock.calls.some(([url])=>url.endsWith('seg-000099.jpg'))).toBe(false);
  view.rerender(<Harness url={playbackUrl.replace('/captures/c/','/packages/p/')} state={null}/>);
  hover();await tick(0);await tick(100);
  expect(fetcher.mock.calls.some(([url])=>url.includes('/packages/p/')&&url.endsWith('index.vtt'))).toBe(true);
  expect(view.container.querySelector('img')).toHaveAttribute('src','blob:preview');
  const count=fetcher.mock.calls.filter(([url])=>url.endsWith('.vtt')).length;
  await tick(15000);expect(fetcher.mock.calls.filter(([url])=>url.endsWith('.vtt'))).toHaveLength(count);
});

it('retries optional missing live previews and replaces a grown index without overlapping slow requests',async()=>{
  const fetcher=network();fetcher.mockResolvedValueOnce(new Response(null,{status:404}));
  const view=render(<Harness/>);hover();await tick(0);await tick(100);
  expect(view.container.querySelector('img')).toBeNull();
  let resolve!:(response:Response)=>void;
  fetcher.mockImplementationOnce(()=>new Promise<Response>(done=>{resolve=done;}));
  await tick(15000);
  expect(fetcher.mock.calls).toHaveLength(2);
  await act(async()=>resolve(new Response(index())));await tick(100);
  expect(view.container.querySelector('img')).toHaveAttribute('src','blob:preview');
  fetcher.mockResolvedValueOnce(new Response(index(35,'seg-000002.jpg')));
  hover(37);await tick(0);await tick(5000);await tick(100);
  expect(fetcher.mock.calls.some(([url])=>url.endsWith('seg-000002.jpg'))).toBe(true);
  expect(view.container.querySelector('time')).toHaveTextContent('0:37');
});
it.each([401,403])('drops downloaded private previews after the index returns %s',async(status)=>{
  const fetcher=network(),view=render(<Harness/>);hover();await tick(0);await tick(100);
  expect(view.container.querySelector('img')).toBeInTheDocument();
  fetcher.mockResolvedValueOnce(new Response(null,{status}));await tick(5000);
  expect(view.container.querySelector('img')).toBeNull();expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview');
  expect(view.container.querySelector('time')).toHaveTextContent('0:32');
});

it('warms a VOD index and current sprite after canplay without waiting for pointer movement',async()=>{
  const fetcher=network();fetcher.mockResolvedValueOnce(new Response(index(0)));
  const view=render(<Harness state={null}/>);await tick(100);expect(fetcher).not.toHaveBeenCalled();
  fireEvent.canPlay(view.container.querySelector('video')!);await tick(0);await tick(100);
  expect(fetcher.mock.calls.filter(([url])=>url.endsWith('.vtt'))).toHaveLength(1);
  expect(view.container.querySelector('img')).toHaveAttribute('src','blob:preview');
  expect(view.container.querySelector('.hhc-player-preview')).toHaveAttribute('hidden');
  hover(1);await tick(0);
  expect(view.container.querySelector('.hhc-player-preview')).not.toHaveAttribute('hidden');
  expect(view.container.querySelector('time')).toHaveTextContent('0:01');expect(fetcher).toHaveBeenCalledTimes(2);
});
it('respects data saving for optional VOD warming while keeping user-requested previews',async()=>{
  vi.stubGlobal('navigator',{userAgent:navigator.userAgent,connection:{saveData:true}});
  const fetcher=network(),view=render(<Harness state={null}/>);fireEvent.canPlay(view.container.querySelector('video')!);await tick(100);
  expect(fetcher).not.toHaveBeenCalled();hover();await tick(0);await tick(100);
  expect(fetcher).toHaveBeenCalledTimes(2);expect(view.container.querySelector('img')).toHaveAttribute('src','blob:preview');
});
it('retries an optional VOD index missing during warming when the user hovers later',async()=>{
  const fetcher=network();fetcher.mockResolvedValueOnce(new Response(null,{status:404}));
  const view=render(<Harness state={null}/>);fireEvent.canPlay(view.container.querySelector('video')!);await tick(0);await tick(10000);
  expect(fetcher).toHaveBeenCalledTimes(1);hover();await tick(0);await tick(100);
  expect(view.container.querySelector('img')).toHaveAttribute('src','blob:preview');
  expect(fetcher.mock.calls.filter(([url])=>url.endsWith('.vtt'))).toHaveLength(2);
});
