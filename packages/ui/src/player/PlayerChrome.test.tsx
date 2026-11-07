import {useRef, type ComponentProps} from 'react';
import {act, cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {PlayerChrome} from './PlayerChrome.js';
import type {LivePlayerState} from './live-player.js';

const playbackUrl='https://media.example/videos/r/captures/c/sessions/s/master.m3u8';
const labels={quality:'Quality',auto:'Auto',play:'Play',pause:'Pause',mute:'Mute',unmute:'Unmute',seek:'Position',volume:'Volume',fullscreen:'Fullscreen',exitFullscreen:'Exit fullscreen',fullscreenError:'Error',playbackSpeed:'Speed',settings:'Settings',togglePlayback:'Toggle playback',privateCopy:'Private',buffering:'Loading'};
const live={verifiedEnd:200,canFollow:true,label:'Live',backToLive:'Back to live'};
const index=(start=30,sprite='seg-000001.jpg')=>`WEBVTT\n\n00:00:${String(start).padStart(2,'0')}.000 --> 00:00:${String(start+5).padStart(2,'0')}.000\n${sprite}#xywh=0,0,160,90\n`;
function Harness({url=playbackUrl,state=live,...props}:{url?:string;state?:LivePlayerState|null}&Pick<ComponentProps<typeof PlayerChrome>,'onMinimize'|'onMinimizeMove'|'mini'>){
  const container=useRef<HTMLDivElement>(null),videoRef=useRef<HTMLVideoElement>(null);
  return <div ref={container}><video ref={videoRef}/><PlayerChrome container={container} videoRef={videoRef} playbackUrl={url} labels={{...labels,minimize:"Minimize player"}} {...props} quality="auto" qualities={['480p']} loading={false} failed={false} onQualityChange={()=>{}} live={state??undefined}/></div>;
}
function hover(seconds=32){
  const input=screen.getByRole('slider',{name:'Position'});
  vi.spyOn(input,'getBoundingClientRect').mockReturnValue({left:0,width:110} as DOMRect);
  fireEvent(input,new MouseEvent('pointermove',{bubbles:true,clientX:seconds}));
  return input;
}
const tick=async(ms:number)=>act(async()=>{await vi.advanceTimersByTimeAsync(ms);});
beforeEach(()=>{
  vi.stubGlobal('Image',class {src='';decoding='';naturalWidth=960;naturalHeight=90;decode=async()=>{}});
  vi.useFakeTimers();
  vi.spyOn(HTMLMediaElement.prototype,'duration','get').mockReturnValue(110);
  vi.spyOn(HTMLMediaElement.prototype,'seekable','get').mockReturnValue({length:1,start:()=>0,end:()=>200});
  vi.stubGlobal('URL',class extends URL{static createObjectURL=vi.fn(()=> 'blob:preview');static revokeObjectURL=vi.fn();});
});
afterEach(()=>{cleanup();vi.useRealTimers();vi.restoreAllMocks();vi.unstubAllGlobals();});
function network(){
  const fetcher=vi.fn(async(url:string)=>url.endsWith('.vtt')?new Response(index()):new Response(new Uint8Array([255,216,255,192,0,11,8,0,90,3,192,1,1,17,0,255,217]),{headers:{'Content-Type':'image/jpeg'}}));
  vi.stubGlobal('fetch',fetcher);return fetcher;
}
it('shows the existing sprite style for live DVR and refreshes only while the timeline preview is active',async()=>{
  const fetcher=network(),view=render(<Harness/>);
  await tick(10000);expect(fetcher).not.toHaveBeenCalled();
  const input=hover();await tick(16);await tick(100);
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
  const view=render(<Harness/>);hover();await tick(16);await tick(100);
  const oldSignal=(fetcher.mock.calls[0] as unknown as [string,RequestInit])[1].signal;
  view.rerender(<Harness url={playbackUrl.replace('/captures/c/','/captures/new/')}/>);
  expect(oldSignal?.aborted).toBe(true);
  await act(async()=>resolve(new Response(index(30,'seg-000099.jpg'))));await tick(100);
  expect(fetcher.mock.calls.some(([url])=>url.endsWith('seg-000099.jpg'))).toBe(false);
  view.rerender(<Harness url={playbackUrl.replace('/captures/c/','/packages/p/')} state={null}/>);
  hover();await tick(16);await tick(100);
  expect(fetcher.mock.calls.some(([url])=>url.includes('/packages/p/')&&url.endsWith('index.vtt'))).toBe(true);
  expect(view.container.querySelector('img')).toHaveAttribute('src','blob:preview');
  const count=fetcher.mock.calls.filter(([url])=>url.endsWith('.vtt')).length;
  await tick(15000);expect(fetcher.mock.calls.filter(([url])=>url.endsWith('.vtt'))).toHaveLength(count);
});

it('retries optional missing live previews and replaces a grown index without overlapping slow requests',async()=>{
  const fetcher=network();fetcher.mockResolvedValueOnce(new Response(null,{status:404}));
  const view=render(<Harness/>);hover();await tick(16);await tick(100);
  expect(view.container.querySelector('img')).toBeNull();
  let resolve!:(response:Response)=>void;
  fetcher.mockImplementationOnce(()=>new Promise<Response>(done=>{resolve=done;}));
  await tick(15000);
  expect(fetcher.mock.calls).toHaveLength(2);
  await act(async()=>resolve(new Response(index())));await tick(100);
  expect(view.container.querySelector('img')).toHaveAttribute('src','blob:preview');
  fetcher.mockResolvedValueOnce(new Response(index(35,'seg-000002.jpg')));
  hover(37);await tick(16);await tick(5000);await tick(100);
  expect(fetcher.mock.calls.some(([url])=>url.endsWith('seg-000002.jpg'))).toBe(true);
  expect(view.container.querySelector('time')).toHaveTextContent('0:37');
});
it.each([401,403])('drops downloaded private previews after the index returns %s',async(status)=>{
  const fetcher=network(),view=render(<Harness/>);hover();await tick(16);await tick(100);
  expect(view.container.querySelector('img')).toBeInTheDocument();
  fetcher.mockResolvedValueOnce(new Response(null,{status}));await tick(5000);
  expect(view.container.querySelector('img')).toBeNull();expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview');
  expect(view.container.querySelector('time')).toHaveTextContent('0:32');
});

it('warms only the VOD index and defers even the current sprite until pointer movement',async()=>{
  const fetcher=network();fetcher.mockResolvedValueOnce(new Response(index(0)));
  const view=render(<Harness state={null}/>);await tick(100);expect(fetcher).not.toHaveBeenCalled();
  fireEvent.canPlay(view.container.querySelector('video')!);await tick(0);await tick(100);
  expect(fetcher.mock.calls.filter(([url])=>url.endsWith('.vtt'))).toHaveLength(1);
  expect(fetcher.mock.calls.filter(([url])=>url.endsWith('.jpg'))).toHaveLength(0);
  expect(view.container.querySelector('.hhc-player-preview')).toHaveAttribute('hidden');
  hover(1);await tick(100);
  expect(view.container.querySelector('.hhc-player-preview')).not.toHaveAttribute('hidden');
  expect(view.container.querySelector('time')).toHaveTextContent('0:01');expect(fetcher).toHaveBeenCalledTimes(2);
});
it('respects data saving for optional VOD warming while keeping user-requested previews',async()=>{
  vi.stubGlobal('navigator',{userAgent:navigator.userAgent,connection:{saveData:true}});
  const fetcher=network(),view=render(<Harness state={null}/>);fireEvent.canPlay(view.container.querySelector('video')!);await tick(100);
  expect(fetcher).not.toHaveBeenCalled();hover();await tick(16);await tick(100);
  expect(fetcher).toHaveBeenCalledTimes(2);expect(view.container.querySelector('img')).toHaveAttribute('src','blob:preview');
});
it('retries an optional VOD index missing during warming when the user hovers later',async()=>{
  const fetcher=network();fetcher.mockResolvedValueOnce(new Response(null,{status:404}));
  const view=render(<Harness state={null}/>);fireEvent.canPlay(view.container.querySelector('video')!);await tick(0);await tick(10000);
  expect(fetcher).toHaveBeenCalledTimes(1);hover();await tick(16);await tick(100);
  expect(view.container.querySelector('img')).toHaveAttribute('src','blob:preview');
  expect(fetcher.mock.calls.filter(([url])=>url.endsWith('.vtt'))).toHaveLength(2);
});
it('aborts the preview index immediately when the document becomes hidden',async()=>{
 let visibility:DocumentVisibilityState='visible';
 vi.spyOn(document,'visibilityState','get').mockImplementation(()=>visibility);
 const fetcher=vi.fn(()=>new Promise<Response>(()=>{}));vi.stubGlobal('fetch',fetcher);
 const view=render(<Harness/>);hover();await tick(16);
 const signal=(fetcher.mock.calls[0] as unknown as [string,RequestInit])[1].signal!;
 expect(signal.aborted).toBe(false);
 visibility='hidden';fireEvent(document,new Event('visibilitychange'));await tick(0);
 expect(signal.aborted).toBe(true);view.unmount();
});
it('loads a distant VOD sprite on demand and aborts it immediately when hidden',async()=>{
 let visibility:DocumentVisibilityState='visible';vi.spyOn(document,'visibilityState','get').mockImplementation(()=>visibility);
 const signals:AbortSignal[]=[];
 const fetcher=vi.fn((url:string,options:RequestInit)=>url.endsWith('.vtt')?Promise.resolve(new Response(index(0)+'\n00:01:00.000 --> 00:01:05.000\nseg-000002.jpg#xywh=0,0,160,90\n')):url.endsWith('seg-000002.jpg')?new Promise<Response>(()=>{signals.push(options.signal!);}):Promise.resolve(new Response(new Uint8Array([255,216,255,192,0,11,8,0,90,3,192,1,1,17,0,255,217]),{headers:{'Content-Type':'image/jpeg'}})));
 vi.stubGlobal('fetch',fetcher);const view=render(<Harness state={null}/>);
 fireEvent.canPlay(view.container.querySelector('video')!);await tick(100);
 expect(signals).toHaveLength(0);hover(62);await tick(100);
 expect(signals).toHaveLength(1);
 visibility='hidden';fireEvent(document,new Event('visibilitychange'));await tick(0);
 expect(signals[0].aborted).toBe(true);view.unmount();
});
it('coalesces timeline movement into the next frame and cancels a pending move on leave',async()=>{
 network();const view=render(<Harness/>);
 hover(10);hover(20);hover(32);
 expect(view.container.querySelector('.hhc-player-preview')).toHaveAttribute('hidden');
 await tick(16);expect(view.container.querySelector('time')).toHaveTextContent('0:32');
 const input=hover(40);fireEvent.pointerLeave(input.parentElement!);await tick(16);
 expect(view.container.querySelector('.hhc-player-preview')).toHaveAttribute('hidden');
});

it.each([
  {end: 0, duration: 0, liveState: live, edgeMarker: true},
  {end: 45, duration: 0, liveState: live, edgeMarker: true},
  {end: 90, duration: 0, liveState: live, edgeMarker: true},
  {end: 91, duration: 1, liveState: live, edgeMarker: false},
  {end: 0, duration: 0, liveState: null, edgeMarker: false},
])('preserves the seek range with end=$end and live=$liveState', ({end, duration, liveState, edgeMarker}) => {
  vi.mocked(Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'seekable')!.get!)
    .mockReturnValue({length: end ? 1 : 0, start: () => 0, end: () => end});
  vi.mocked(Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'duration')!.get!)
    .mockReturnValue(duration);
  const view = render(<Harness state={liveState}/>);
  const slider = screen.getByRole<HTMLInputElement>('slider', {name: 'Position'});

  expect(slider.min).toBe('0');
  expect(slider.max).toBe(String(duration));
  expect(slider.disabled).toBe(duration === 0);
  expect(view.container.querySelector('video')?.currentTime).toBe(0);
  expect(Boolean(view.container.querySelector('.hhc-player-liveEdgeThumb'))).toBe(edgeMarker);
  if (!end && liveState) {
    const liveButton = screen.getByRole('button', {name: 'Back to live'});
    expect(liveButton).toBeDisabled();
    expect(liveButton).toHaveAttribute('data-live-edge', 'false');
  }
});

it('minimizes explicitly with a labeled button', () => {
  const minimize = vi.fn();
  render(<Harness onMinimize={minimize}/>);
  fireEvent.click(screen.getByRole('button', {name: 'Minimize player'}));
  expect(minimize).toHaveBeenCalledOnce();
});

it('only minimizes for a committed downward touch drag', () => {
  const minimize = vi.fn();
  render(<Harness onMinimize={minimize}/>);
  const surface = screen.getByRole('button', {name: labels.togglePlayback});
  Object.defineProperty(surface, 'setPointerCapture', {value: vi.fn()});
  function pointer(type: string, x: number, y: number) {
    const event = new MouseEvent(type, {bubbles: true, clientX: x + 100, clientY: y});
    Object.defineProperties(event, {pointerType: {value: 'touch'}, pointerId: {value: 1}, isPrimary: {value: true}});
    fireEvent(surface, event);
  }
  pointer('pointerdown', 20, 20);
  pointer('pointermove', 20, 100);
  pointer('pointercancel', 20, 100);
  pointer('pointerup', 20, 100);
  pointer('pointerdown', 20, 20);
  pointer('pointerup', 80, 100);
  pointer('pointerdown', 20, 20);
  pointer('pointerup', 20, 83);
  expect(minimize).not.toHaveBeenCalled();
  pointer('pointerdown', 20, 20);
  pointer('pointermove', 50, 84);
  pointer('pointerup', 50, 84);
  expect(minimize).toHaveBeenCalledOnce();
});


it('expands touch mini without playing and uses its separate media command', () => {
  vi.stubGlobal('matchMedia', vi.fn(() => ({matches:true,addEventListener:vi.fn(),removeEventListener:vi.fn()})));
  const expand=vi.fn(),play=vi.spyOn(HTMLMediaElement.prototype,'play').mockResolvedValue();
  const view=render(<Harness mini={{onExpand:expand,expandLabel:'Expand player'}}/>);
  const video=view.container.querySelector('video');
  fireEvent.click(screen.getByRole('button',{name:'Expand player'}));
  expect(expand).toHaveBeenCalledOnce();expect(play).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'Play'}));
  expect(play).toHaveBeenCalledOnce();
  view.rerender(<Harness/>);
  expect(view.container.querySelector('video')).toBe(video);
});

it('reports touch minimize movement and resets it on cancellation without minimizing', () => {
  const move=vi.fn(),minimize=vi.fn();render(<Harness onMinimize={minimize} onMinimizeMove={move}/>);
  const surface=screen.getByRole('button',{name:'Toggle playback'});
  surface.setPointerCapture=vi.fn();
  function pointer(type:string,y:number,primary=true) {
    const event=new MouseEvent(type,{bubbles:true,clientX:120,clientY:y});
    Object.defineProperties(event,{pointerType:{value:'touch'},pointerId:{value:1},isPrimary:{value:primary}});
    fireEvent(surface,event);
  }
  pointer('pointerdown',20);pointer('pointermove',60);
  expect(move).toHaveBeenLastCalledWith(40);
  pointer('pointermove',25);expect(move).toHaveBeenLastCalledWith(5);
  pointer('pointermove',15);expect(move).toHaveBeenLastCalledWith(0);
  pointer('pointercancel',60);expect(move).toHaveBeenLastCalledWith(0);
  pointer('pointerup',100);expect(minimize).not.toHaveBeenCalled();
  pointer('pointerdown',20);pointer('pointermove',70);pointer('pointerdown',70,false);
  expect(move).toHaveBeenLastCalledWith(0);pointer('pointerup',100);expect(minimize).not.toHaveBeenCalled();
});


it('keeps mini commands on the background media owner and desktop expand separate', () => {
  const play=vi.fn(),pause=vi.fn(),expand=vi.fn();
  function Owner({paused}:{paused:boolean}) {
    const container=useRef<HTMLDivElement>(null),videoRef=useRef<HTMLVideoElement>(null);
    return <div ref={container}><video ref={videoRef}/><PlayerChrome container={container} videoRef={videoRef} playbackUrl={playbackUrl} labels={labels} mini={{onExpand:expand,expandLabel:'Expand'}} playbackPaused={paused} onMediaPlay={play} onMediaPause={pause} quality="auto" qualities={['480p']} loading={false} failed={false} onQualityChange={()=>{}}/></div>;
  }
  const view=render(<Owner paused={true}/>);
  fireEvent.click(screen.getByRole('button',{name:'Expand'}));
  expect(expand).toHaveBeenCalledOnce();expect(play).not.toHaveBeenCalled();expect(pause).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'Toggle playback'}));expect(play).toHaveBeenCalledOnce();
  view.rerender(<Owner paused={false}/>);
  fireEvent.click(screen.getByRole('button',{name:'Toggle playback'}));expect(pause).toHaveBeenCalledOnce();
});

it('does not minimize from the system back edge or after a long hold', async () => {
  const move=vi.fn(),minimize=vi.fn();const view=render(<Harness onMinimize={minimize} onMinimizeMove={move}/>);
  const surface=screen.getByRole('button',{name:'Toggle playback'});surface.setPointerCapture=vi.fn();
  function pointer(type:string,x:number,y:number) {
    const event=new MouseEvent(type,{bubbles:true,clientX:x,clientY:y});
    Object.defineProperties(event,{pointerType:{value:'touch'},pointerId:{value:1},isPrimary:{value:true}});fireEvent(surface,event);
  }
  pointer('pointerdown',10,20);pointer('pointermove',10,100);pointer('pointerup',10,100);
  expect(minimize).not.toHaveBeenCalled();expect(move).not.toHaveBeenCalledWith(80);
  vi.spyOn(view.container.querySelector('video')!,'paused','get').mockReturnValue(false);
  pointer('pointerdown',120,20);await tick(450);pointer('pointermove',120,100);pointer('pointerup',120,100);
  expect(minimize).not.toHaveBeenCalled();expect(view.container.querySelector('video')!.playbackRate).toBe(1);
});

it('preserves committed drag offset through late pointer capture loss', () => {
  const events: Array<number|string> = [];
  render(<Harness onMinimize={()=>events.push('commit')} onMinimizeMove={offset=>events.push(offset)}/>);
  const surface=screen.getByRole('button',{name:labels.togglePlayback});
  surface.setPointerCapture=vi.fn();
  const pointer=(type:string,y:number)=>{
    const event=new MouseEvent(type,{bubbles:true,clientX:120,clientY:y});
    Object.defineProperties(event,{pointerType:{value:'touch'},pointerId:{value:1},isPrimary:{value:true}});
    fireEvent(surface,event);
  };
  pointer('pointerdown',20);pointer('pointermove',100);pointer('pointerup',100);pointer('lostpointercapture',100);
  expect(events).toEqual([0,80,80,'commit']);
});

it('requires a bounded quarter-height drag and can cancel by pulling back', () => {
  const minimize=vi.fn();const move=vi.fn();
  const view=render(<Harness onMinimize={minimize} onMinimizeMove={move}/>);
  vi.spyOn(view.container.firstElementChild!,'getBoundingClientRect').mockReturnValue({height:400} as DOMRect);
  const surface=screen.getByRole('button',{name:labels.togglePlayback});surface.setPointerCapture=vi.fn();
  const pointer=(type:string,y:number)=>{
    const event=new MouseEvent(type,{bubbles:true,clientX:120,clientY:y});
    Object.defineProperties(event,{pointerType:{value:'touch'},pointerId:{value:1},isPrimary:{value:true}});
    fireEvent(surface,event);
  };
  pointer('pointerdown',20);pointer('pointermove',110);pointer('pointerup',110);
  expect(minimize).not.toHaveBeenCalled();expect(move).toHaveBeenLastCalledWith(0);
  pointer('pointerdown',20);pointer('pointermove',150);pointer('pointermove',60);pointer('pointerup',60);
  expect(minimize).not.toHaveBeenCalled();
  pointer('pointerdown',20);pointer('pointermove',120);pointer('pointerup',120);
  expect(minimize).toHaveBeenCalledOnce();
});

it('does not expand the new mini from the click generated by its committed drag', () => {
  vi.stubGlobal('matchMedia',vi.fn(()=>({matches:true,addEventListener:vi.fn(),removeEventListener:vi.fn()})));
  const expand=vi.fn();const minimize=vi.fn();
  const view=render(<Harness onMinimize={minimize}/>);
  const surface=screen.getByRole('button',{name:labels.togglePlayback});surface.setPointerCapture=vi.fn();
  const pointer=(type:string,y:number)=>{
    const event=new MouseEvent(type,{bubbles:true,clientX:120,clientY:y});
    Object.defineProperties(event,{pointerType:{value:'touch'},pointerId:{value:1},isPrimary:{value:true}});
    fireEvent(surface,event);
  };
  pointer('pointerdown',20);pointer('pointermove',100);pointer('pointerup',100);
  view.rerender(<Harness mini={{onExpand:expand,expandLabel:'Return to watch'}}/>);
  fireEvent.click(screen.getByRole('button',{name:'Return to watch'}),{detail:1});
  expect(expand).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'Return to watch'}),{detail:0});
  expect(expand).toHaveBeenCalledOnce();
});

it('does not commit a release before a directional drag was recognized', () => {
  const minimize=vi.fn();render(<Harness onMinimize={minimize}/>);
  const surface=screen.getByRole('button',{name:labels.togglePlayback});surface.setPointerCapture=vi.fn();
  for(const [type,y] of [['pointerdown',20],['pointermove',25],['pointerup',100]] as const){
    const event=new MouseEvent(type,{bubbles:true,clientX:120,clientY:y});
    Object.defineProperties(event,{pointerType:{value:'touch'},pointerId:{value:1},isPrimary:{value:true}});
    fireEvent(surface,event);
  }
  expect(minimize).not.toHaveBeenCalled();
});

it('cancels a resized drag even after sideways motion, then accepts a fresh gesture',()=>{
 const move=vi.fn(),minimize=vi.fn();render(<Harness onMinimize={minimize} onMinimizeMove={move}/>);
 const surface=screen.getByRole('button',{name:labels.togglePlayback});surface.setPointerCapture=vi.fn();
 const pointer=(type:string,x:number,y:number)=>{const event=new MouseEvent(type,{bubbles:true,clientX:x,clientY:y});Object.defineProperties(event,{pointerType:{value:'touch'},pointerId:{value:1},isPrimary:{value:true}});fireEvent(surface,event);};
 const width=window.innerWidth;
 try{
  pointer('pointerdown',120,20);pointer('pointermove',120,100);
  Object.defineProperty(window,'innerWidth',{configurable:true,value:width+100});fireEvent(window,new Event('resize'));
  expect(move).toHaveBeenLastCalledWith(0);
  pointer('pointermove',240,40);pointer('pointermove',120,160);pointer('pointerup',120,160);
  expect(minimize).not.toHaveBeenCalled();
  pointer('pointerdown',120,20);pointer('pointermove',120,160);pointer('pointerup',120,160);
  expect(minimize).toHaveBeenCalledOnce();
 }finally{Object.defineProperty(window,'innerWidth',{configurable:true,value:width});}
});

it('cancels a pending pull through small toolbar resizing',()=>{
 const minimize=vi.fn();render(<Harness onMinimize={minimize}/>);
 const surface=screen.getByRole('button',{name:labels.togglePlayback});surface.setPointerCapture=vi.fn();
 const pointer=(type:string,y:number)=>{const event=new MouseEvent(type,{bubbles:true,clientX:120,clientY:y});Object.defineProperties(event,{pointerType:{value:'touch'},pointerId:{value:1},isPrimary:{value:true}});fireEvent(surface,event);};
 const height=window.innerHeight;
 try{
  pointer('pointerdown',20);pointer('pointermove',100);
  Object.defineProperty(window,'innerHeight',{configurable:true,value:height-24});fireEvent(window,new Event('resize'));
  pointer('pointerup',100);expect(minimize).not.toHaveBeenCalled();
 }finally{Object.defineProperty(window,'innerHeight',{configurable:true,value:height});}
});

it('restores a held playback rate when the visual viewport changes',async()=>{
 const viewport=new EventTarget();Object.assign(viewport,{width:400,height:800});vi.stubGlobal('visualViewport',viewport);
 const view=render(<Harness/>);const video=view.container.querySelector('video')!;
 vi.spyOn(video,'paused','get').mockReturnValue(false);video.playbackRate=1.5;
 const surface=screen.getByRole('button',{name:labels.togglePlayback});surface.setPointerCapture=vi.fn();
 const event=new MouseEvent('pointerdown',{bubbles:true,clientX:120,clientY:20});Object.defineProperties(event,{pointerType:{value:'touch'},pointerId:{value:1},isPrimary:{value:true}});fireEvent(surface,event);
 await tick(450);expect(video.playbackRate).toBe(2);
 Object.assign(viewport,{width:800,height:400});act(()=>viewport.dispatchEvent(new Event('resize')));
 expect(video.playbackRate).toBe(1.5);
});

it('keeps mini fullscreen and theater unavailable through buttons, keys and double click',()=>{
 const view=render(<Harness state={null} mini={{onExpand:vi.fn(),expandLabel:'Expand'}}/>);
 const root=view.container.firstElementChild!;
 const request=vi.fn();Object.assign(root,{requestFullscreen:request});
 expect(screen.queryByRole('button',{name:labels.fullscreen})).toBeNull();
 for(const key of ['f','t','j','ArrowRight']){
  const event=new KeyboardEvent('keydown',{key,bubbles:true,cancelable:true});
  fireEvent(root,event);expect(event.defaultPrevented).toBe(false);
 }
 fireEvent.doubleClick(screen.getByRole('button',{name:labels.togglePlayback}));
 expect(request).not.toHaveBeenCalled();
});

it('keeps mini playback and mute shortcuts while preserving editable fields',()=>{
 const view=render(<Harness state={null} mini={{onExpand:vi.fn(),expandLabel:'Expand'}}/>);
 const root=view.container.firstElementChild!;const video=view.container.querySelector('video')!;
 const play=vi.spyOn(video,'play').mockResolvedValue();
 fireEvent.keyDown(root,{key:'k'});expect(play).toHaveBeenCalledOnce();
 fireEvent.keyDown(root,{key:'m'});expect(video.muted).toBe(true);
 const input=document.createElement('input');root.append(input);
 fireEvent.keyDown(input,{key:'k'});expect(play).toHaveBeenCalledOnce();
});

it('toggles the mini center only once for a real double-click sequence',()=>{
 const view=render(<Harness state={null} mini={{onExpand:vi.fn(),expandLabel:'Expand'}}/>);
 const video=view.container.querySelector('video')!;
 let paused=true;
 vi.spyOn(video,'paused','get').mockImplementation(()=>paused);
 vi.spyOn(video,'play').mockImplementation(async()=>{paused=false;});
 const pause=vi.spyOn(video,'pause').mockImplementation(()=>{paused=true;});
 fireEvent.canPlay(video);
 const button=screen.getByRole('button',{name:'Play'});
 fireEvent.click(button,{detail:1});fireEvent.click(button,{detail:2});fireEvent.doubleClick(button);
 expect(paused).toBe(false);expect(pause).not.toHaveBeenCalled();
});

it('discards an open watch settings menu when entering mini presentation',()=>{
 const view=render(<Harness state={null}/>);
 fireEvent.click(screen.getByRole('button',{name:'Settings'}));expect(screen.getByRole('menu')).toBeInTheDocument();
 view.rerender(<Harness state={null} mini={{onExpand:vi.fn(),expandLabel:'Expand'}}/>);
 expect(screen.queryByRole('menu')).toBeNull();
 view.rerender(<Harness state={null}/>);expect(screen.queryByRole('menu')).toBeNull();
});

it('uses an explicit compact mini layout independently of primary pointer capability',()=>{
 network();const view=render(<Harness state={null} mini={{onExpand:vi.fn(),expandLabel:'Expand',compact:true}}/>);
 expect(screen.getByRole('button',{name:'Expand'})).toHaveAttribute('data-player-surface');
 view.rerender(<Harness state={null} mini={{onExpand:vi.fn(),expandLabel:'Expand',compact:false}}/>);
 expect(screen.getByRole('button',{name:'Expand'})).not.toHaveAttribute('data-player-surface');
});

it('cancels pull minimization when native PiP starts and removes its gesture hit area',()=>{
 const move=vi.fn(),minimize=vi.fn();const view=render(<Harness onMinimize={minimize} onMinimizeMove={move}/>);
 const surface=screen.getByRole('button',{name:labels.togglePlayback});surface.setPointerCapture=vi.fn();
 const pointer=(type:string,y:number)=>{const event=new MouseEvent(type,{bubbles:true,clientX:120,clientY:y});Object.defineProperties(event,{pointerType:{value:'touch'},pointerId:{value:1},isPrimary:{value:true}});fireEvent(surface,event);};
 pointer('pointerdown',20);pointer('pointermove',100);
 const previous=Object.getOwnPropertyDescriptor(document,'pictureInPictureElement');
 try{
  Object.defineProperty(document,'pictureInPictureElement',{configurable:true,value:view.container.querySelector('video')});
  fireEvent(view.container.querySelector('video')!,new Event('enterpictureinpicture'));
  expect(move).toHaveBeenLastCalledWith(0);expect(view.container.querySelector('[data-player-pull-surface]')).toBeNull();
  pointer('pointerup',100);expect(minimize).not.toHaveBeenCalled();
 }finally{if(previous)Object.defineProperty(document,'pictureInPictureElement',previous);else delete (document as Document&{pictureInPictureElement?:Element}).pictureInPictureElement;}
});

it('uses a sibling pull hit area without covering the full watch edge surface',()=>{
 const view=render(<Harness onMinimize={vi.fn()}/>);
 const base=screen.getByRole('button',{name:labels.togglePlayback});
 const pull=view.container.querySelector('[data-player-pull-surface]')!;
 expect(base).toHaveAttribute('data-pull-watch','true');expect(pull.parentElement).toBe(base.parentElement);
 expect(pull.contains(screen.getByRole('slider',{name:labels.seek}))).toBe(false);
});


it.each(['second-touch','viewport-scroll'])('cancels a pending pull after %s outside the surface',kind=>{
 const viewport=new EventTarget();Object.assign(viewport,{width:400,height:800,offsetLeft:0,offsetTop:0});vi.stubGlobal('visualViewport',viewport);
 const minimize=vi.fn(),move=vi.fn();render(<Harness onMinimize={minimize} onMinimizeMove={move}/>);
 const surface=screen.getByRole('button',{name:labels.togglePlayback});surface.setPointerCapture=vi.fn();
 const pointer=(target:EventTarget,type:string,y:number,primary=true)=>{const event=new MouseEvent(type,{bubbles:true,clientX:120,clientY:y});Object.defineProperties(event,{pointerType:{value:'touch'},pointerId:{value:primary?1:2},isPrimary:{value:primary}});fireEvent(target,event);};
 pointer(surface,'pointerdown',20);pointer(surface,'pointermove',100);
 if(kind==='second-touch')pointer(document.body,'pointerdown',20,false);
 else{Object.assign(viewport,{offsetTop:24});act(()=>viewport.dispatchEvent(new Event('scroll')));}
 expect(move).toHaveBeenLastCalledWith(0);pointer(surface,'pointerup',100);expect(minimize).not.toHaveBeenCalled();
});


it('lets the host reject invalid geometry before a pull commits',()=>{
 let reject=false;const minimize=vi.fn(),move=vi.fn((offset:number)=>offset>0&&reject?false:undefined);
 render(<Harness onMinimize={minimize} onMinimizeMove={move}/>);
 const surface=screen.getByRole('button',{name:labels.togglePlayback});surface.setPointerCapture=vi.fn();
 const pointer=(type:string,y:number)=>{const event=new MouseEvent(type,{bubbles:true,clientX:120,clientY:y});Object.defineProperties(event,{pointerType:{value:'touch'},pointerId:{value:1},isPrimary:{value:true}});fireEvent(surface,event);};
 pointer('pointerdown',20);pointer('pointermove',100);reject=true;pointer('pointerup',100);
 expect(minimize).not.toHaveBeenCalled();expect(move).toHaveBeenLastCalledWith(0);
 reject=false;pointer('pointerdown',20);pointer('pointermove',100);pointer('pointerup',100);expect(minimize).toHaveBeenCalledOnce();
});
