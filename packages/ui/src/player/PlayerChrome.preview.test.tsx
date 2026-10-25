import {createRef,Profiler,StrictMode} from 'react';
import {act,fireEvent,render} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {PlayerChrome} from './PlayerChrome.js';

afterEach(()=>{vi.useRealTimers();vi.restoreAllMocks();vi.unstubAllGlobals();});

it.each([false,true])('keeps cached previews present on the first hover commit after leaving, saveData=%s',async(saveData)=>{
  vi.useFakeTimers();
  vi.stubGlobal('PointerEvent',MouseEvent);
  vi.stubGlobal('navigator',{connection:{saveData}});
  vi.spyOn(document,'visibilityState','get').mockReturnValue('visible');
  let count=0;
  vi.stubGlobal('URL',class extends URL{static createObjectURL(){return `blob:${++count}`;}static revokeObjectURL=vi.fn();});
  const decode=vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal('Image',class {src='';decoding='';decode=decode;});
  const playbackUrl='https://media.example/videos/r/packages/p/sessions/s/master.m3u8';
  const index='WEBVTT\n\n00:00:00.000 --> 00:00:05.000\nseg-000000.jpg#xywh=0,0,160,90\n\n00:00:30.000 --> 00:00:35.000\nseg-000001.jpg#xywh=0,0,160,90\n';
  const fetcher=vi.fn(async(url:string)=>url.endsWith('.vtt')?new Response(index):new Response(new Uint8Array([255,216,255,217]),{headers:{'Content-Type':'image/jpeg'}}));
  vi.stubGlobal('fetch',fetcher);
  const videoRef=createRef<HTMLVideoElement>();videoRef.current=document.createElement('video');
  Object.defineProperty(videoRef.current,'duration',{value:90});
  const container=createRef<HTMLDivElement>(),commits:(string|null)[]=[];
  const labels={quality:'Quality',auto:'Auto',play:'Play',pause:'Pause',mute:'Mute',unmute:'Unmute',seek:'Seek',volume:'Volume',fullscreen:'Fullscreen',exitFullscreen:'Exit fullscreen',playbackSpeed:'Speed',settings:'Settings',togglePlayback:'Play or pause',privateCopy:'Private',buffering:'Loading'};
  const view=render(<StrictMode><div ref={container}><Profiler id="preview" onRender={()=>{
    const preview=container.current?.querySelector('.hhc-player-preview');
    if(preview&&!preview.hasAttribute('hidden'))commits.push(preview.querySelector('img')?.getAttribute('src')??null);
  }}><PlayerChrome container={container} videoRef={videoRef} playbackUrl={playbackUrl} labels={labels} quality="auto" qualities={['480p']} loading={false} failed={false} onQualityChange={()=>{}}/></Profiler></div></StrictMode>);
  fireEvent.canPlay(videoRef.current);
  const input=view.getByRole('slider',{name:'Seek'});
  vi.spyOn(input,'getBoundingClientRect').mockReturnValue({left:0,width:1000} as DOMRect);
  // Warm both sheets through the real pointer/index/cache path, even with saveData.
  for(const clientX of [0,350]){
    await act(async()=>{fireEvent.pointerMove(input,{clientX});});
    await act(async()=>{await vi.advanceTimersByTimeAsync(60);});
  }
  expect(view.container.querySelector('.hhc-player-preview img')).toHaveAttribute('src','blob:2');
  const downloads=fetcher.mock.calls.length,decodes=decode.mock.calls.length;
  commits.length=0;
  for(let n=0;n<3;n++){
    const image=view.container.querySelector('.hhc-player-preview img');
    await act(async()=>{fireEvent.pointerLeave(input.parentElement!);await vi.advanceTimersByTimeAsync(100);});
    expect(view.container.querySelector('.hhc-player-preview')).toHaveAttribute('hidden');
    expect(view.container.querySelector('.hhc-player-preview img')).toBe(image);
    await act(async()=>{fireEvent.pointerMove(input,{clientX:350});});
    expect(view.container.querySelector('.hhc-player-preview img')).toHaveAttribute('src','blob:2');
    expect(view.container.querySelector('.hhc-player-preview img')).toBe(image);
  }
  expect(commits.length).toBeGreaterThanOrEqual(3);
  expect(commits).not.toContain(null);
  expect(fetcher).toHaveBeenCalledTimes(downloads);
  expect(decode).toHaveBeenCalledTimes(decodes);
  expect(videoRef.current.currentTime).toBe(0);
  view.unmount();
});
