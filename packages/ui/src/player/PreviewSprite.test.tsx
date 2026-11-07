import {act,render} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {PreviewSprite} from './PreviewSprite.js';

beforeEach(()=>vi.stubGlobal('Image',class {src='';decoding='';naturalWidth=960;naturalHeight=90;decode=async()=>{}}));
afterEach(()=>{vi.useRealTimers();vi.restoreAllMocks();vi.unstubAllGlobals();});
it('coalesces pointer movement, reuses loaded sprites and releases them on session change',async()=>{
  vi.useFakeTimers();
  const revoke=vi.fn();
  vi.stubGlobal('URL',class extends URL{static createObjectURL(){return 'blob:preview';}static revokeObjectURL=revoke;});
  const fetcher=vi.fn(async()=>new Response(new Uint8Array([255,216,255,192,0,11,8,0,90,3,192,1,1,17,0,255,217]),{headers:{'Content-Type':'image/jpeg'}}));
  vi.stubGlobal('fetch',fetcher);
  const playbackUrl='https://media.example/videos/r/packages/p/sessions/s/master.m3u8';
  const cue={start:0,end:5,url:new URL('previews/seg-000000.jpg',playbackUrl).href,x:0};
  const view=render(<PreviewSprite playbackUrl={playbackUrl} cue={cue}/>);
  view.rerender(<PreviewSprite playbackUrl={playbackUrl} cue={{...cue,x:160}}/>);
  await act(async()=>{await vi.advanceTimersByTimeAsync(60);});
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(view.container.querySelector('img')).toHaveStyle({left:'-100%'});
  view.rerender(<PreviewSprite playbackUrl={playbackUrl}/>);
  view.rerender(<PreviewSprite playbackUrl={playbackUrl} cue={cue}/>);
  await act(async()=>{await vi.advanceTimersByTimeAsync(60);});
  expect(fetcher).toHaveBeenCalledTimes(1);
  view.rerender(<PreviewSprite playbackUrl={playbackUrl.replace('/sessions/s/','/sessions/new/')}/>);
  expect(revoke).toHaveBeenCalledWith('blob:preview');
  expect(view.container.querySelector('img')).toBeNull();
  view.unmount();
});

it('shows a decoded neighbor from cache without waiting for the 60ms network timer',async()=>{
  vi.useFakeTimers();let count=0;
  vi.stubGlobal('URL',class extends URL{static createObjectURL(){return `blob:${++count}`;}static revokeObjectURL=vi.fn();});
  const fetcher=vi.fn(async()=>new Response(new Uint8Array([255,216,255,192,0,11,8,0,90,3,192,1,1,17,0,255,217]),{headers:{'Content-Type':'image/jpeg'}}));vi.stubGlobal('fetch',fetcher);
  const playbackUrl='https://media.example/videos/r/packages/p/sessions/s/master.m3u8';
  const cue={start:0,end:5,url:new URL('previews/seg-000000.jpg',playbackUrl).href,x:0};
  const neighbor=new URL('previews/seg-000001.jpg',playbackUrl).href;
  const view=render(<PreviewSprite playbackUrl={playbackUrl} cue={cue} neighbor={neighbor}/>);
  await act(async()=>{await vi.advanceTimersByTimeAsync(60);});expect(fetcher).toHaveBeenCalledTimes(2);
  await act(async()=>{view.rerender(<PreviewSprite playbackUrl={playbackUrl} cue={{...cue,start:30,end:35,url:neighbor}}/>);});
  expect(view.container.querySelector('img')).toHaveAttribute('src','blob:2');expect(fetcher).toHaveBeenCalledTimes(2);
  view.unmount();
});

it('retries a failed sheet only after cooldown and a later interaction on that same sheet',async()=>{
  vi.useFakeTimers();
  vi.stubGlobal('URL',class extends URL{static createObjectURL(){return 'blob:retry';}static revokeObjectURL=vi.fn();});
  const fetcher=vi.fn().mockResolvedValueOnce(new Response(null,{status:503})).mockImplementation(async()=>new Response(new Uint8Array([255,216,255,192,0,11,8,0,90,3,192,1,1,17,0,255,217]),{headers:{'Content-Type':'image/jpeg'}}));
  vi.stubGlobal('fetch',fetcher);
  const playbackUrl='https://media.example/videos/r/packages/p/sessions/s/master.m3u8';
  const cue={start:0,end:5,url:new URL('previews/seg-000000.jpg',playbackUrl).href,x:0};
  const view=render(<PreviewSprite playbackUrl={playbackUrl} cue={cue} position={1}/>);
  await act(async()=>{await vi.advanceTimersByTimeAsync(60);});
  view.rerender(<PreviewSprite playbackUrl={playbackUrl} cue={cue} position={2}/>);
  await act(async()=>{await vi.advanceTimersByTimeAsync(6000);});
  expect(fetcher).toHaveBeenCalledTimes(1);
  view.rerender(<PreviewSprite playbackUrl={playbackUrl} cue={cue} position={3}/>);
  await act(async()=>{await vi.advanceTimersByTimeAsync(60);});
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(view.container.querySelector('img')).toHaveAttribute('src','blob:retry');
  view.unmount();
});

it('starts an uncached sheet during continuous movement within it',async()=>{
  vi.useFakeTimers();
  const fetcher=vi.fn(()=>new Promise<Response>(()=>{}));vi.stubGlobal('fetch',fetcher);
  const playbackUrl='https://media.example/videos/r/packages/p/sessions/s/master.m3u8';
  const cue={start:0,end:5,url:new URL('previews/seg-000000.jpg',playbackUrl).href,x:0};
  const view=render(<PreviewSprite playbackUrl={playbackUrl} cue={cue} position={0}/>);
  for(let position=1;position<=5;position++){
    await act(async()=>{await vi.advanceTimersByTimeAsync(16);});
    view.rerender(<PreviewSprite playbackUrl={playbackUrl} cue={cue} position={position/10}/>);
  }
  expect(fetcher).toHaveBeenCalledTimes(1);
  view.unmount();
});
