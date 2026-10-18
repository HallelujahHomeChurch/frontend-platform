import {act,render} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {PreviewSprite} from './PreviewSprite';

afterEach(()=>{vi.useRealTimers();vi.restoreAllMocks();vi.unstubAllGlobals();});
it('coalesces pointer movement, reuses loaded sprites and releases them on session change',async()=>{
  vi.useFakeTimers();
  const revoke=vi.fn();
  vi.stubGlobal('URL',class extends URL{static createObjectURL(){return 'blob:preview';}static revokeObjectURL=revoke;});
  const fetcher=vi.fn(async()=>new Response(new Uint8Array([255,216,255,217]),{headers:{'Content-Type':'image/jpeg'}}));
  vi.stubGlobal('fetch',fetcher);
  const playbackUrl='https://media.example/videos/r/packages/p/sessions/s/master.m3u8';
  const cue={start:0,end:5,url:new URL('previews/seg-000000.jpg',playbackUrl).href,x:0};
  const view=render(<PreviewSprite playbackUrl={playbackUrl} cue={cue}/>);
  view.rerender(<PreviewSprite playbackUrl={playbackUrl} cue={{...cue,x:160}}/>);
  await act(async()=>{await vi.advanceTimersByTimeAsync(60);});
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(view.container.querySelector('img')).toHaveStyle({left:'-160px'});
  view.rerender(<PreviewSprite playbackUrl={playbackUrl}/>);
  view.rerender(<PreviewSprite playbackUrl={playbackUrl} cue={cue}/>);
  await act(async()=>{await vi.advanceTimersByTimeAsync(60);});
  expect(fetcher).toHaveBeenCalledTimes(1);
  view.rerender(<PreviewSprite playbackUrl={playbackUrl.replace('/sessions/s/','/sessions/new/')}/>);
  expect(revoke).toHaveBeenCalledWith('blob:preview');
  expect(view.container.querySelector('img')).toBeNull();
  view.unmount();
});
