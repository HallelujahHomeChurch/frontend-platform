import {createRef} from 'react';
import type {HlsConfig} from 'hls.js';
import {act, cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {HlsPlayer} from './HlsPlayer.js';
import playerStyles from './styles.js';

const router=vi.hoisted(()=>({push:vi.fn()}));

const engine=vi.hoisted(()=>({supported:true,manifestReady:true,instances:[] as {nextLevel:number;loadLevel:number;recoverMediaError:ReturnType<typeof vi.fn>;listeners:Record<string,(...args:unknown[])=>void>;loadSource:ReturnType<typeof vi.fn>;destroy:ReturnType<typeof vi.fn>;config:{latencyController?:HlsConfig['latencyController'];startLevel?:number;xhrSetup:(xhr:XMLHttpRequest,url:string)=>void}}[]}));
const url='https://media.alive.org.tw/videos/r/packages/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/sessions/s/master.m3u8';
vi.mock('hls.js',async()=>{const {default:RealHls}=await vi.importActual<typeof import('hls.js')>('hls.js');return {default:class {
  static DefaultConfig=RealHls.DefaultConfig;
  static isSupported(){return engine.supported;}
  static Events={MANIFEST_PARSED:'manifest',ERROR:'error',LEVEL_SWITCHED:'levelSwitched'};
  nextLevel=-1;loadLevel=-1;
  recoverMediaError=vi.fn();
  listeners:Record<string,(...args:unknown[])=>void>={};
  levels=[{height:720,url:[url.replace('master.m3u8','720p/index.m3u8')]},{height:1080,url:[url.replace('master.m3u8','1080p/index.m3u8')]},{height:480,url:[url.replace('master.m3u8','480p/index.m3u8')]}];
  loadSource=vi.fn();destroy=vi.fn();
  constructor(public config:{latencyController?:HlsConfig['latencyController'];startLevel?:number;xhrSetup:(xhr:XMLHttpRequest,url:string)=>void}) {engine.instances.push(this);}
  on(event:string,callback:(...args:unknown[])=>void){this.listeners[event]=callback;if(event==='manifest'&&engine.manifestReady)queueMicrotask(callback);}
  attachMedia(){}
}}});
const labels={quality:'Quality',auto:'Auto',play:'Play',pause:'Pause',mute:'Mute',unmute:'Unmute',seek:'Playback position',volume:'Volume',fullscreen:'Fullscreen',exitFullscreen:'Exit fullscreen',fullscreenError:'Could not exit fullscreen. Retry.',playbackSpeed:'Speed',theaterMode:'Theater mode',exitTheaterMode:'Exit theater mode',tapToPlay:'Tap to start playback',settings:'Settings',togglePlayback:'Play or pause',privateCopy:'HHC members only',buffering:'Loading video'};
const props=()=>({onNavigate:router.push,playbackUrl:url,availableQualities:['720p','1080p'] as ('720p'|'1080p')[],watermark:'TRACE123',title:'Sunday',labels,videoRef:createRef<HTMLVideoElement>(),onPlayingChange:vi.fn(),onError:vi.fn()});

function openSubmenu(name:string){
 if(screen.getByRole('button',{name:'Settings'}).getAttribute('aria-expanded')!=='true')fireEvent.click(screen.getByRole('button',{name:'Settings'}));
 const back=screen.queryByRole('menuitem',{name:'Back'});if(back)fireEvent.click(back);
 fireEvent.click(screen.getByRole('menuitem',{name}));
}
function chooseQuality(value:string){openSubmenu('Quality');fireEvent.click(screen.getByRole('menuitemradio',{name:value==='auto'?/^Auto/:value}));}
function chooseSpeed(value:string){openSubmenu('Speed');fireEvent.click(screen.getByRole('menuitemradio',{name:`${value}×`}));}

it.each(['vod','live'] as const)('starts %s Auto at the lowest rendition without locking adaptive quality',async(playbackMode)=>{
  const p=props();render(<HlsPlayer {...p} playbackMode={playbackMode} availableQualities={['480p','720p','1080p']}/>);
  await waitFor(()=>expect(engine.instances).toHaveLength(1));
  expect(engine.instances[0].config.startLevel).toBe(0);
  expect(engine.instances[0].loadLevel).toBe(-1);
  expect(engine.instances[0].nextLevel).toBe(-1);
});

it('keeps a restored manual rendition independent of the Auto startup level',async()=>{
  const p=props();render(<HlsPlayer {...p} resume={{time:100,paused:true,rate:1.5,quality:'1080p',intent:'dvr'}}/>);
  await waitFor(()=>expect(engine.instances[0]?.nextLevel).toBe(1));
  expect(engine.instances[0].config.startLevel).toBeUndefined();
});

it('exposes 480p only when provided and keeps its requests inside the authenticated session',async()=>{
  const p=props();render(<HlsPlayer {...p} availableQualities={['480p','720p','1080p']}/>);
  await waitFor(()=>expect(engine.instances).toHaveLength(1));
  fireEvent.click(screen.getByRole('button',{name:'Settings'}));
  openSubmenu('Quality');expect(screen.getByRole('menuitemradio',{name:'480p'})).toBeInTheDocument();
  chooseQuality('480p');
  expect(engine.instances[0].loadLevel).toBe(2);
  expect(engine.instances[0].recoverMediaError).toHaveBeenCalledOnce();
  const xhr=new XMLHttpRequest();
  engine.instances[0].config.xhrSetup(xhr,url.replace('master.m3u8','480p/seg-000000.m4s'));
  expect(xhr.withCredentials).toBe(true);
});
beforeEach(()=>{
  vi.spyOn(window,'scrollTo').mockImplementation(()=>{});
  vi.spyOn(HTMLElement.prototype,'clientWidth','get').mockReturnValue(1000);
  vi.spyOn(HTMLElement.prototype,'clientHeight','get').mockReturnValue(600);
  vi.spyOn(HTMLVideoElement.prototype,'videoWidth','get').mockReturnValue(1920);
  vi.spyOn(HTMLVideoElement.prototype,'videoHeight','get').mockReturnValue(1080);
  vi.spyOn(HTMLMediaElement.prototype,'readyState','get').mockReturnValue(1);
  vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(null);
  Object.defineProperty(HTMLElement.prototype,"setPointerCapture",{configurable:true,value:vi.fn()});
  router.push.mockClear();
  engine.supported=true;engine.manifestReady=true;engine.instances=[];
  vi.spyOn(HTMLMediaElement.prototype,'play').mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype,'pause').mockImplementation(()=>{});
  vi.spyOn(HTMLMediaElement.prototype,'load').mockImplementation(()=>{});
});
afterEach(()=>{cleanup();vi.useRealTimers();vi.unstubAllGlobals();vi.restoreAllMocks();});

it.each([false,true])('ends loading on fatal media failure after manifest=%s', async(manifestReady)=>{
  engine.manifestReady=manifestReady;
  const p=props();render(<HlsPlayer {...p}/>);
  await waitFor(()=>expect(engine.instances).toHaveLength(1));
  if(manifestReady)fireEvent.waiting(p.videoRef.current!);
  expect(screen.getByRole('status')).toHaveTextContent('Loading video');
  act(()=>engine.instances[0].listeners.error('error',{fatal:true}));
  expect(p.onError).toHaveBeenCalledOnce();
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});

it('keeps loading through startup, then follows buffering and pause events',async()=>{
  const p=props();render(<HlsPlayer {...p}/>);
  await waitFor(()=>expect(engine.instances).toHaveLength(1));
  expect(screen.getByRole('status')).toHaveTextContent('Loading video');
  fireEvent.canPlay(p.videoRef.current!);
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  fireEvent.waiting(p.videoRef.current!);
  expect(screen.getByRole('status')).toBeInTheDocument();
  fireEvent.pause(p.videoRef.current!);
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});

it('keeps K working after toolbar focus but leaves button Space activation native', async()=>{
  const p=props();render(<HlsPlayer {...p}/>);
  await waitFor(()=>expect(engine.instances).toHaveLength(1));
  const video=p.videoRef.current!;
  const mute=screen.getByRole('button',{name:'Mute'});
  mute.focus();
  vi.mocked(video.play).mockClear();
  fireEvent.keyDown(mute,{key:'k'});
  expect(video.play).toHaveBeenCalledOnce();
  fireEvent.keyDown(mute,{key:' '});
  expect(video.play).toHaveBeenCalledOnce();
});
it('rebuilds MSE buffers for manual quality and auto without reloading the manifest',async()=>{
  const p=props();render(<HlsPlayer {...p}/>);
  await waitFor(()=>expect(engine.instances).toHaveLength(1));
  const video=p.videoRef.current!;video.currentTime=97;
  fireEvent.click(screen.getByRole('button',{name:'Settings'}));
  chooseQuality('1080p');
  expect(engine.instances[0].loadLevel).toBe(1);expect(video.currentTime).toBe(97);
  expect(engine.instances[0].recoverMediaError).toHaveBeenCalledOnce();
  fireEvent.loadedMetadata(video);
  Object.defineProperty(video,'readyState',{configurable:true,value:2});fireEvent.canPlay(video);
  chooseQuality('auto');
  expect(engine.instances[0].loadLevel).toBe(-1);
  expect(engine.instances[0].recoverMediaError).toHaveBeenCalledTimes(2);
  expect(engine.instances[0].loadSource).toHaveBeenCalledTimes(1);
});

it.each([true,false])('restores MSE quality position, rate and paused=%s after replaying an ended VOD',async(paused)=>{
  const p=props();const onBookmark=vi.fn();render(<HlsPlayer {...p} onBookmark={onBookmark}/>);
  await waitFor(()=>expect(engine.instances).toHaveLength(1));
  const video=p.videoRef.current!;
  Object.defineProperty(video,'duration',{configurable:true,value:2375.936});
  act(()=>{video.currentTime=2375.936;fireEvent.ended(video);video.currentTime=100;video.playbackRate=1.5;});
  Object.defineProperty(video,'paused',{configurable:true,value:paused});
  fireEvent.click(screen.getByRole('button',{name:'Settings'}));
  engine.instances[0].recoverMediaError.mockImplementation(()=>{video.currentTime=0;video.playbackRate=1;fireEvent.timeUpdate(video);});
  onBookmark.mockClear();vi.mocked(video.play).mockClear();vi.mocked(video.pause).mockClear();
  chooseQuality('1080p');
  expect(engine.instances[0].loadLevel).toBe(1);
  expect(engine.instances[0].recoverMediaError).toHaveBeenCalledOnce();
  for(const [bookmark] of onBookmark.mock.calls)expect(bookmark).toEqual(expect.objectContaining({time:100,paused,rate:1.5}));
  fireEvent.loadedMetadata(video);
  expect(video.currentTime).toBe(100);expect(video.playbackRate).toBe(1.5);
  Object.defineProperty(video,'readyState',{configurable:true,value:2});fireEvent.canPlay(video);
  expect(video.paused).toBe(paused);
  expect(onBookmark).toHaveBeenLastCalledWith(expect.objectContaining({time:100,quality:'1080p',rate:1.5,paused}));
});
it('keeps explicit speed, seek and play commands made while MSE quality is reattaching',async()=>{
 const p=props();render(<HlsPlayer {...p}/>);await waitFor(()=>expect(engine.instances).toHaveLength(1));
 const video=p.videoRef.current!;Object.defineProperty(video,'duration',{configurable:true,value:600});fireEvent.durationChange(video);video.currentTime=100;
 fireEvent.click(screen.getByRole('button',{name:'Settings'}));chooseQuality('1080p');
 chooseSpeed('2');
 fireEvent.change(screen.getByRole('slider',{name:'Playback position'}),{target:{value:'180'}});
 fireEvent.click(screen.getByRole('button',{name:'Play'}));vi.mocked(video.play).mockClear();
 fireEvent.loadedMetadata(video);
 expect(video.currentTime).toBe(180);expect(video.playbackRate).toBe(2);expect(video.play).toHaveBeenCalledOnce();
});
it('does not rebuild or reset the engine when the watermark or cover changes',async()=>{
  const p=props();const view=render(<HlsPlayer {...p}/>);
  await waitFor(()=>expect(engine.instances).toHaveLength(1));
  p.videoRef.current!.currentTime=150;
  view.rerender(<HlsPlayer {...p} watermark="RENEWED" poster="blob:private-cover"/>);
  expect(engine.instances).toHaveLength(1);expect(engine.instances[0].destroy).not.toHaveBeenCalled();
  expect(p.videoRef.current!.currentTime).toBe(150);
  expect(p.videoRef.current!).toHaveAttribute('poster','blob:private-cover');
  expect(screen.getAllByText('RENEWED')).toHaveLength(6);
  expect(screen.getAllByText('RENEWED')[0].parentElement).toHaveAttribute('aria-hidden','true');
});
it('repositions the same watermark overlay for resize and portrait media without reloading',async()=>{
  const p=props();render(<HlsPlayer {...p} watermark="01234ABCDE"/>);
  await waitFor(()=>expect(engine.instances).toHaveLength(1));
  expect(screen.getAllByText('01234-ABCDE')).toHaveLength(6);
  vi.spyOn(HTMLElement.prototype,'clientWidth','get').mockReturnValue(390);
  vi.spyOn(HTMLElement.prototype,'clientHeight','get').mockReturnValue(700);
  vi.spyOn(HTMLVideoElement.prototype,'videoWidth','get').mockReturnValue(900);
  vi.spyOn(HTMLVideoElement.prototype,'videoHeight','get').mockReturnValue(1600);
  fireEvent(p.videoRef.current!,new Event('resize'));
  const marks=screen.getAllByText('01234-ABCDE');
  expect(marks).toHaveLength(4);
  expect(marks[0].parentElement).toHaveStyle({left:'0px',width:'390px'});
  expect(engine.instances).toHaveLength(1);expect(engine.instances[0].loadSource).toHaveBeenCalledOnce();
});
it('omits unavailable quality and sends only media cookies on canonical package requests',async()=>{
  const p=props();render(<HlsPlayer {...p} availableQualities={['720p']}/>);
  await waitFor(()=>expect(engine.instances).toHaveLength(1));
  expect(screen.queryByRole('menuitemradio',{name:'1080p'})).not.toBeInTheDocument();
  const xhr={withCredentials:false} as XMLHttpRequest;
  engine.instances[0].config.xhrSetup(xhr,url.replace('master.m3u8','720p/seg-000000.m4s'));
  expect(xhr.withCredentials).toBe(true);
  expect(()=>engine.instances[0].config.xhrSetup(xhr,'https://evil.example/media')).toThrow();
});
it('preserves native playback position and paused state across rendition and Auto changes',async()=>{
  engine.supported=false;
  vi.spyOn(HTMLMediaElement.prototype,'canPlayType').mockReturnValue('probably');
  const p=props();render(<HlsPlayer {...p}/>);
  const video=p.videoRef.current!;
  await waitFor(()=>expect(video.src).toBe(url));
  video.currentTime=81;
  fireEvent.click(screen.getByRole('button',{name:'Settings'}));
  chooseQuality('720p');
  expect(video.src).toBe(url.replace('master.m3u8','720p/index.m3u8'));
  fireEvent.loadedMetadata(video);
  expect(video.currentTime).toBe(81);
  Object.defineProperty(video,'readyState',{configurable:true,value:2});fireEvent.canPlay(video);
  const calls=vi.mocked(video.play).mock.calls.length;
  chooseQuality('auto');
  fireEvent.loadedMetadata(video);
  expect(video.src).toBe(url);expect(video.currentTime).toBe(81);
  expect(video.play).toHaveBeenCalledTimes(calls);
});

it('toggles with Space and the video surface without hijacking form controls', async()=>{
  const p=props();render(<HlsPlayer {...p}/>);
  await waitFor(()=>expect(engine.instances).toHaveLength(1));
  const video=p.videoRef.current!;
  vi.mocked(video.play).mockClear();
  const region=screen.getByRole('region');
  fireEvent.keyDown(region,{key:' '});
  expect(video.play).toHaveBeenCalledOnce();
  Object.defineProperty(video,'paused',{configurable:true,value:false});
  fireEvent.play(video);
  fireEvent.click(screen.getByRole('button',{name:'Play or pause'}));
  expect(video.pause).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button',{name:'Settings'}));
  fireEvent.keyDown(screen.getByRole('menuitem',{name:'Speed'}),{key:' '});
  fireEvent.keyDown(screen.getByRole('slider',{name:'Playback position'}),{key:' '});
  expect(video.pause).toHaveBeenCalledTimes(2);
  fireEvent.keyDown(region,{key:' ',repeat:true});
  expect(video.pause).toHaveBeenCalledTimes(2);
});

it('commits a pointer scrub on release and keeps keyboard seek responsive', async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:false}));
  try {
    const p=props();render(<HlsPlayer {...p}/>);
    await waitFor(()=>expect(engine.instances).toHaveLength(1));
    const video=p.videoRef.current!;
    Object.defineProperty(video,'duration',{configurable:true,value:600});
    video.currentTime=30; fireEvent.durationChange(video); fireEvent.timeUpdate(video);
    const seek=screen.getByRole('slider',{name:'Playback position'});
    fireEvent.pointerDown(seek);
    fireEvent.change(seek,{target:{value:'240'}});
    expect(video.currentTime).toBe(30);
    fireEvent.pointerUp(seek);
    expect(video.currentTime).toBe(240);
    fireEvent.keyDown(screen.getByRole('region'),{key:'ArrowRight'});
    expect(video.currentTime).toBe(245);
    fireEvent.keyDown(screen.getByRole('region'),{key:'j'});
    expect(video.currentTime).toBe(235);
    fireEvent.keyDown(seek,{key:'ArrowLeft'});
    expect(video.currentTime).toBe(230);
  } finally {vi.unstubAllGlobals();}
});

it('restores audible volume from a zero-volume slider', async()=>{
  const p=props();render(<HlsPlayer {...p}/>);
  await waitFor(()=>expect(engine.instances).toHaveLength(1));
  const video=p.videoRef.current!; video.volume=0;fireEvent.volumeChange(video);
  fireEvent.click(screen.getByRole('button',{name:'Unmute'}));
  expect(video.volume).toBe(1);expect(video.muted).toBe(false);
});
it('fullscreens the container with watermark, not the native video element',async()=>{
  const request=vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(HTMLElement.prototype,'requestFullscreen',{configurable:true,value:request});
  try {
    const p=props();render(<HlsPlayer {...p}/>);
    await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'Fullscreen'}));});
    expect(request).toHaveBeenCalledOnce();
    expect(request.mock.contexts[0]).toContainElement(screen.getAllByText('TRACE123')[0]);
    expect(p.videoRef.current).not.toHaveAttribute('controls');
  } finally {delete (HTMLElement.prototype as unknown as Record<string,unknown>).requestFullscreen;}
});

it('nativeFullscreenWithoutContainerAPI follows native events without reloading the video', async()=>{
  const p=props(); render(<HlsPlayer {...p}/>);
  await waitFor(()=>expect(engine.instances).toHaveLength(1));
  const video=p.videoRef.current!;
  const enter=vi.fn(()=>video.dispatchEvent(new Event('webkitbeginfullscreen')));
  const exit=vi.fn(()=>video.dispatchEvent(new Event('webkitendfullscreen')));
  Object.assign(video,{webkitSupportsFullscreen:true,webkitEnterFullscreen:enter,webkitExitFullscreen:exit});
  video.currentTime=81;video.playbackRate=1.5;
  await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Fullscreen'})));
  expect(enter).toHaveBeenCalledOnce();
  expect(screen.getByRole('button',{name:'Exit fullscreen'})).toBeInTheDocument();
  fireEvent(video,new Event('webkitendfullscreen'));
  expect(screen.getByRole('button',{name:'Fullscreen'})).toBeInTheDocument();
  expect(p.videoRef.current).toBe(video);expect(video.currentTime).toBe(81);expect(video.playbackRate).toBe(1.5);
  expect(engine.instances[0].loadSource).toHaveBeenCalledOnce();
});

it('viewportRestoresFocusAndScroll and keeps the player mounted for five cycles', async()=>{
  const p=props();const view=render(<><button>Outside</button><HlsPlayer {...p}/></>);
  await waitFor(()=>expect(engine.instances).toHaveLength(1));
  const video=p.videoRef.current!;video.currentTime=150;video.playbackRate=1.5;
  document.body.style.overflow='auto';
  const outside=screen.getByRole('button',{name:'Outside'});
  for(let i=0;i<5;i++) {
    Object.defineProperty(window,'scrollY',{value:640,writable:true,configurable:true});
    const button=screen.getByRole('button',{name:'Fullscreen'});button.focus();
    await act(async()=>fireEvent.click(button));
    expect(screen.getByRole('region')).toHaveAttribute('data-fullscreen','viewport');
    expect(document.body.style.overflow).toBe('hidden');
    expect(outside).toHaveAttribute('inert');
    Object.defineProperty(window,'scrollY',{value:0,writable:true,configurable:true});
    fireEvent.keyDown(screen.getByRole('region'),{key:'Escape'});
    expect(window.scrollTo).toHaveBeenLastCalledWith(0,640);
    expect(document.body.style.overflow).toBe('auto');
    expect(outside).not.toHaveAttribute('inert');expect(button).toHaveFocus();
  }
  expect(p.videoRef.current).toBe(video);expect(video.currentTime).toBe(150);expect(video.playbackRate).toBe(1.5);
  expect(engine.instances).toHaveLength(1);expect(engine.instances[0].loadSource).toHaveBeenCalledOnce();
  await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Fullscreen'})));
  view.unmount();expect(document.body.style.overflow).toBe('auto');document.body.style.overflow='';
});

it('exitFailureDoesNotReenter or claim that native fullscreen ended', async()=>{
  const p=props();render(<HlsPlayer {...p}/>);
  const video=p.videoRef.current!;
  const enter=vi.fn(()=>video.dispatchEvent(new Event('webkitbeginfullscreen')));
  Object.assign(video,{webkitEnterFullscreen:enter,webkitExitFullscreen:()=>{throw new Error('denied');}});
  await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Fullscreen'})));
  await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Exit fullscreen'})));
  expect(enter).toHaveBeenCalledOnce();expect(screen.getByRole('button',{name:'Exit fullscreen'})).toBeInTheDocument();
  expect(screen.getByRole('region')).not.toHaveAttribute('data-fullscreen','viewport');
  expect(screen.getByRole('alert')).toHaveTextContent('Could not exit fullscreen');
});

it('resynchronizes a native exit on foreground and does not steal settings Escape',async()=>{
  const p=props();render(<HlsPlayer {...p}/>);
  const video=p.videoRef.current!;
  Object.assign(video,{webkitDisplayingFullscreen:true,webkitEnterFullscreen:()=>video.dispatchEvent(new Event('webkitbeginfullscreen'))});
  await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Fullscreen'})));
  Object.assign(video,{webkitDisplayingFullscreen:false});
  Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'});
  fireEvent(document,new Event('visibilitychange'));
  expect(screen.getByRole('button',{name:'Fullscreen'})).toBeInTheDocument();
  Object.assign(video,{webkitSupportsFullscreen:false});
  await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Fullscreen'})));
  fireEvent.click(screen.getByRole('button',{name:'Settings'}));
  fireEvent.keyDown(screen.getByRole('menuitem',{name:'Speed'}),{key:'Escape'});
  expect(screen.queryByRole('menuitem',{name:'Speed'})).not.toBeInTheDocument();
  expect(screen.getByRole('region')).toHaveAttribute('data-fullscreen','viewport');
  fireEvent.keyDown(screen.getByRole('region'),{key:'Escape'});
  expect(screen.getByRole('region')).toHaveAttribute('data-fullscreen','inline');
});

it('falls back to viewport if fullscreen entry fails and retains an exit button', async()=>{
  const request=vi.fn().mockRejectedValue(new Error('denied'));
  Object.defineProperty(HTMLElement.prototype,'requestFullscreen',{configurable:true,value:request});
  try {
    const p=props();render(<HlsPlayer {...p}/>);
    await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Fullscreen'})));
    expect(screen.getByRole('region')).toHaveAttribute('data-fullscreen','viewport');
    expect(screen.getByRole('button',{name:'Exit fullscreen'})).toBeInTheDocument();
  } finally {delete (HTMLElement.prototype as unknown as Record<string,unknown>).requestFullscreen;}
});

it('starts live behind the verified edge and preserves DVR until an explicit return',async()=>{
 const p=props();render(<HlsPlayer {...p} playbackMode="live" live={{verifiedEnd:5400,canFollow:true,label:'Live',backToLive:'Back to live'}}/>);
 await waitFor(()=>expect(engine.instances).toHaveLength(1));
 const video=p.videoRef.current!;
 Object.defineProperty(video,'seekable',{configurable:true,value:{length:1,start:()=>0,end:()=>5400}});
 Object.defineProperty(video,'duration',{configurable:true,value:Infinity});
 fireEvent.progress(video);
 expect(video.currentTime).toBe(5310);
 const seek=screen.getByRole('slider',{name:'Playback position'});
 expect(seek).toHaveAttribute('max','5310');
 expect(screen.queryByText(/\d+:\d+ \/ \d+:\d+/)).toBeNull();
 expect(screen.getByRole('button',{name:'Back to live'})).toHaveTextContent('Live');
 Object.defineProperty(video,'paused',{configurable:true,value:false});
 fireEvent.timeUpdate(video);fireEvent.play(video);fireEvent.playing(video);
 expect(screen.getByRole('button',{name:'Back to live'})).toHaveAttribute('data-live-edge','true');
 fireEvent.change(seek,{target:{value:'60'}});
 expect(screen.getByRole('button',{name:'Back to live'})).toHaveAttribute('data-live-edge','false');
 fireEvent.progress(video);
 fireEvent(window,new Event('online'));
 expect(video.currentTime).toBe(60);
 fireEvent.click(screen.getByRole('button',{name:'Back to live'}));
 expect(video.currentTime).toBe(5310);
 expect(engine.instances[0].config).toMatchObject({backBufferLength:120,maxBufferLength:60,maxMaxBufferLength:120,liveMaxLatencyDuration:Infinity,maxLiveSyncPlaybackRate:1});
});

it.each([false,true])('native=%s resumes follow-live after upstream recovery without a browser online event',async(native)=>{
 engine.supported=!native;if(native)vi.spyOn(HTMLMediaElement.prototype,'canPlayType').mockReturnValue('probably');
 const p=props(),onBookmark=vi.fn();
 const live={verifiedEnd:1200,canFollow:true,label:'Live',backToLive:'Back to live'};
 const view=render(<HlsPlayer {...p} playbackMode="live" live={live} onBookmark={onBookmark}/>);
 await waitFor(()=>expect(native?p.videoRef.current?.src:engine.instances.length).toBe(native?url:1));
 const video=p.videoRef.current!;let end=1200;
 Object.defineProperty(video,'seekable',{configurable:true,get:()=>({length:1,start:()=>0,end:()=>end})});
 Object.defineProperty(video,'paused',{configurable:true,value:false});
 fireEvent.progress(video);fireEvent.seeking(video);fireEvent.seeked(video);
 expect(video.currentTime).toBe(1110);
 view.rerender(<HlsPlayer {...p} playbackMode="live" live={{...live,canFollow:false}} onBookmark={onBookmark}/>);
 video.currentTime=1200;fireEvent.timeUpdate(video);
 // The backend recovers before this rendition's seekable timeline catches up.
 view.rerender(<HlsPlayer {...p} playbackMode="live" live={{...live,verifiedEnd:1500}} onBookmark={onBookmark}/>);
 expect(video.currentTime).toBe(1200);
 end=1500;fireEvent.progress(video);
 expect(video.currentTime).toBe(1410);
 // Browsers may dispatch seeking after playback has advanced past the assigned target.
 video.currentTime=1410.5;fireEvent.seeking(video);fireEvent.timeUpdate(video);
 expect(onBookmark).toHaveBeenLastCalledWith(expect.objectContaining({time:1410.5,intent:'followLive'}));
 fireEvent.seeked(video);
 video.currentTime=1480;fireEvent.timeUpdate(video);fireEvent.progress(video);
 expect(video.currentTime).toBe(1480);
 video.currentTime=1100;fireEvent.seeking(video);fireEvent.progress(video);
 expect(video.currentTime).toBe(1100);
 expect(onBookmark).toHaveBeenLastCalledWith(expect.objectContaining({time:1100,intent:'dvr'}));
});

it.each(['seek','pause','rate'] as const)('preserves explicit %s during upstream recovery',async(command)=>{
 const p=props(),onBookmark=vi.fn(),live={verifiedEnd:1200,canFollow:true,label:'Live',backToLive:'Back to live'};
 const view=render(<HlsPlayer {...p} playbackMode="live" live={live} onBookmark={onBookmark}/>);
 await waitFor(()=>expect(engine.instances).toHaveLength(1));
 const video=p.videoRef.current!;Object.defineProperty(video,'seekable',{configurable:true,value:{length:1,start:()=>0,end:()=>1500}});
 Object.defineProperty(video,'paused',{configurable:true,value:false});fireEvent.progress(video);fireEvent.seeking(video);
 view.rerender(<HlsPlayer {...p} playbackMode="live" live={{...live,canFollow:false}} onBookmark={onBookmark}/>);
 if(command==='seek')fireEvent.change(screen.getByRole('slider',{name:'Playback position'}),{target:{value:'600'}});
 if(command==='pause')fireEvent.pause(video);
 if(command==='rate')chooseSpeed('1.5');
 const time=video.currentTime;
 view.rerender(<HlsPlayer {...p} playbackMode="live" live={{...live,verifiedEnd:1500}} onBookmark={onBookmark}/>);
 fireEvent.progress(video);fireEvent.timeUpdate(video);fireEvent(window,new Event('online'));
 expect(video.currentTime).toBe(time);expect(video.playbackRate).toBe(command==='rate'?1.5:1);
 expect(onBookmark).toHaveBeenLastCalledWith(expect.objectContaining({intent:'dvr'}));
});

it('disables return when live stops and bounds DVR seeking to the available timeline',async()=>{
 const p=props();render(<HlsPlayer {...p} playbackMode="live" live={{verifiedEnd:5400,canFollow:false,label:'Live ended',backToLive:'Back to live'}}/>);
 await waitFor(()=>expect(engine.instances).toHaveLength(1));
 const video=p.videoRef.current!;
 Object.defineProperty(video,'seekable',{configurable:true,value:{length:1,start:()=>3600,end:()=>5400}});
 fireEvent.progress(video);
 expect(screen.getByRole('button',{name:'Live ended'})).toBeDisabled();
 expect(screen.getByRole('button',{name:'Live ended'})).toHaveAttribute('data-live-edge','false');
 const slider=screen.getByRole('slider',{name:'Playback position'});
 expect(slider).toHaveAttribute('min','3600');
 video.currentTime=3601;fireEvent.timeUpdate(video);
 fireEvent.keyDown(screen.getByRole('region'),{key:'ArrowLeft'});
 expect(video.currentTime).toBe(3600);
});

it('restores a paused DVR bookmark without first-entry live seeking or autoplay',async()=>{
 const p=props();const remembered=vi.fn();
 const live={verifiedEnd:5400,canFollow:true,label:'Live',backToLive:'Back to live'};
 const {rerender}=render(<HlsPlayer {...p} playbackMode="live" live={live} resume={{time:60,paused:true,rate:1.5,quality:'720p',intent:'dvr'}} onBookmark={remembered}/>);
 await waitFor(()=>expect(engine.instances).toHaveLength(1));
 const video=p.videoRef.current!;
 Object.defineProperty(video,'seekable',{configurable:true,value:{length:1,start:()=>0,end:()=>6300}});
 fireEvent.loadedMetadata(video);
 expect(video.currentTime).toBe(60);expect(video.playbackRate).toBe(1.5);expect(video.play).not.toHaveBeenCalled();expect(engine.instances[0].nextLevel).toBe(0);
 rerender(<HlsPlayer {...p} playbackMode="live" live={{...live,verifiedEnd:6300}} onBookmark={remembered}/>);
 fireEvent.progress(video);fireEvent(window,new Event('online'));
 expect(video.currentTime).toBe(60);expect(engine.instances).toHaveLength(1);
 expect(remembered).toHaveBeenLastCalledWith(expect.objectContaining({time:60,rate:1.5,intent:'dvr'}));
});
it('native live quality switching retains a paused DVR position and intent',async()=>{
 engine.supported=false;
 vi.spyOn(HTMLMediaElement.prototype,'canPlayType').mockReturnValue('probably');
 const p=props(),remembered=vi.fn();render(<HlsPlayer {...p} playbackMode="live" live={{verifiedEnd:5400,canFollow:true,label:'Live',backToLive:'Back to live'}} onBookmark={remembered}/>);
 await waitFor(()=>expect(p.videoRef.current?.src).toBe(url));
 const video=p.videoRef.current!;Object.defineProperty(video,'seekable',{configurable:true,value:{length:1,start:()=>0,end:()=>5400}});fireEvent.loadedMetadata(video);
 fireEvent.change(screen.getByRole('slider',{name:'Playback position'}),{target:{value:'60'}});fireEvent.pause(video);video.playbackRate=1.5;
 fireEvent.click(screen.getByRole('button',{name:'Settings'}));chooseQuality('1080p');
 fireEvent.loadedMetadata(video);Object.defineProperty(video,'readyState',{configurable:true,value:2});fireEvent.canPlay(video);fireEvent.progress(video);fireEvent(window,new Event('online'));
 expect(video.currentTime).toBe(60);expect(video.playbackRate).toBe(1.5);expect(remembered).toHaveBeenLastCalledWith(expect.objectContaining({intent:'dvr',quality:'1080p'}));
});
it.each([false,true])('native=%s live quality switching waits for later seekable progress before restoring DVR',async(native)=>{
 engine.supported=!native;if(native)vi.spyOn(HTMLMediaElement.prototype,'canPlayType').mockReturnValue('probably');
 const p=props(),remembered=vi.fn();render(<HlsPlayer {...p} playbackMode="live" live={{verifiedEnd:5400,canFollow:true,label:'Live',backToLive:'Back to live'}} onBookmark={remembered}/>);
 await waitFor(()=>expect(native?p.videoRef.current?.src:engine.instances.length).toBe(native?url:1));
 const video=p.videoRef.current!;let end=5400;
 Object.defineProperty(video,'seekable',{configurable:true,get:()=>({length:end?1:0,start:()=>0,end:()=>end})});
 await act(async()=>{fireEvent.loadedMetadata(video);});
 fireEvent.change(screen.getByRole('slider',{name:'Playback position'}),{target:{value:'60'}});fireEvent.pause(video);video.playbackRate=1.5;
 fireEvent.click(screen.getByRole('button',{name:'Settings'}));chooseQuality('1080p');
 end=0;video.currentTime=0;fireEvent.loadedMetadata(video);
 expect(video.currentTime).toBe(0);
 // Another quality selection before seekable arrives must keep the original bookmark.
 chooseQuality('720p');
 end=5400;Object.defineProperty(video,'readyState',{configurable:true,value:2});fireEvent.progress(video);fireEvent.loadedMetadata(video);fireEvent.canPlay(video);
 expect(video.currentTime).toBe(60);expect(video.playbackRate).toBe(1.5);expect(video.play).toHaveBeenCalledTimes(1);
 fireEvent(window,new Event('online'));
 expect(remembered).toHaveBeenLastCalledWith(expect.objectContaining({time:60,intent:'dvr',quality:'720p'}));
 video.currentTime=75;fireEvent.canPlay(video);fireEvent.progress(video);
 expect(video.currentTime).toBe(75);
});


function touchSurface() {
  vi.stubGlobal('matchMedia',vi.fn().mockReturnValue({matches:true,addEventListener:vi.fn(),removeEventListener:vi.fn()}));
}
function touch(element:HTMLElement,type:string,x=300,y=100) {
  fireEvent(element,new PointerEvent(type,{bubbles:true,pointerId:1,pointerType:'touch',isPrimary:true,clientX:x,clientY:y}));
}
it.each([false,true])('shows transient play/pause feedback only on desktop, touch=%s',async(touchUI)=>{
  vi.stubGlobal('matchMedia',vi.fn().mockReturnValue({matches:touchUI,addEventListener:vi.fn(),removeEventListener:vi.fn()}));
  const p=props();const view=render(<HlsPlayer {...p}/>);
  await waitFor(()=>expect(engine.instances).toHaveLength(1));
  const video=p.videoRef.current!;fireEvent.canPlay(video);
  fireEvent.click(screen.getByRole('button',{name:'Play'}));
  expect(video.play).toHaveBeenCalledTimes(2);
  expect(Boolean(view.container.querySelector(`.${playerStyles.feedback}`))).toBe(!touchUI);
  Object.defineProperty(video,'paused',{configurable:true,value:false});fireEvent.play(video);
  fireEvent.click(screen.getByRole('button',{name:'Pause'}));
  expect(video.pause).toHaveBeenCalledOnce();
  expect(Boolean(view.container.querySelector(`.${playerStyles.feedback}`))).toBe(!touchUI);
});
it('touch taps toggle controls without pausing; double taps seek and clamp at the video ends',async()=>{
  touchSurface();const p=props();render(<HlsPlayer {...p}/>);
  await waitFor(()=>expect(engine.instances).toHaveLength(1));
  const video=p.videoRef.current!;
  Object.defineProperty(video,'paused',{configurable:true,value:false});
  Object.defineProperty(video,'duration',{configurable:true,value:100});
  fireEvent.play(video);fireEvent.canPlay(video);fireEvent.durationChange(video);
  const surface=screen.getByRole('button',{name:'Play or pause'});
  vi.spyOn(surface,'getBoundingClientRect').mockReturnValue({left:0,width:600} as DOMRect);
  vi.useFakeTimers();
  touch(surface,'pointerdown');touch(surface,'pointerup');
  act(()=>vi.advanceTimersByTime(300));
  expect(video.pause).not.toHaveBeenCalled();
  expect(screen.getByRole('region')).toHaveAttribute('data-controls-visible','false');
  video.currentTime=95;
  touch(surface,'pointerdown',500);touch(surface,'pointerup',500);
  touch(surface,'pointerdown',500);touch(surface,'pointerup',500);
  expect(video.currentTime).toBe(100);
  expect(screen.getByText('+10')).toBeInTheDocument();
  touch(surface,'pointerdown',500);touch(surface,'pointerup',500);
  expect(video.currentTime).toBe(100);expect(screen.getByText('+20')).toBeInTheDocument();
  act(()=>vi.advanceTimersByTime(1000));
  video.currentTime=5;
  touch(surface,'pointerdown',100);touch(surface,'pointerup',100);
  touch(surface,'pointerdown',100);touch(surface,'pointerup',100);
  expect(video.currentTime).toBe(0);expect(video.pause).not.toHaveBeenCalled();
  expect(screen.getByText('−10')).toBeInTheDocument();
});
it('restores the original speed after a held touch is released or cancelled',async()=>{
  touchSurface();const p=props();render(<HlsPlayer {...p}/>);
  await waitFor(()=>expect(engine.instances).toHaveLength(1));
  const video=p.videoRef.current!;Object.defineProperty(video,'paused',{configurable:true,value:false});video.playbackRate=1.5;fireEvent.play(video);
  const surface=screen.getByRole('button',{name:'Play or pause'});vi.useFakeTimers();
  touch(surface,'pointerdown');act(()=>vi.advanceTimersByTime(500));expect(video.playbackRate).toBe(2);
  touch(surface,'pointerup');expect(video.playbackRate).toBe(1.5);
  touch(surface,'pointerdown');act(()=>vi.advanceTimersByTime(500));touch(surface,'pointercancel');expect(video.playbackRate).toBe(1.5);
});
it('swipes into and out of a full viewport while retaining the same video and watermark',async()=>{
  touchSurface();const p=props();render(<HlsPlayer {...p}/>);
  await waitFor(()=>expect(engine.instances).toHaveLength(1));
  const video=p.videoRef.current!;video.currentTime=81;
  const enter=vi.fn();Object.assign(video,{webkitEnterFullscreen:enter,webkitSupportsFullscreen:true});
  const surface=screen.getByRole('button',{name:'Play or pause'});
  await act(async()=>{touch(surface,'pointerdown',300,180);touch(surface,'pointermove',300,50);touch(surface,'pointerup',300,50);});
  expect(screen.getByRole('region')).toHaveAttribute('data-fullscreen','viewport');
  expect(enter).not.toHaveBeenCalled();
  await act(async()=>{touch(surface,'pointerdown',300,50);touch(surface,'pointermove',300,180);touch(surface,'pointerup',300,180);});
  expect(screen.getByRole('region')).toHaveAttribute('data-fullscreen','inline');expect(p.videoRef.current).toBe(video);expect(video.currentTime).toBe(81);
});

it('offers a central play control when audible autoplay is blocked, without claiming a media failure',async()=>{
  touchSurface();vi.mocked(HTMLMediaElement.prototype.play).mockRejectedValueOnce(new DOMException('Autoplay blocked','NotAllowedError'));
  const p=props();render(<HlsPlayer {...p}/>);
  await waitFor(()=>expect(engine.instances).toHaveLength(1));fireEvent.canPlay(p.videoRef.current!);
  fireEvent.click(screen.getByRole('button',{name:'Play'}));
  expect(p.videoRef.current!.play).toHaveBeenCalledTimes(2);expect(p.onError).not.toHaveBeenCalled();
});

it('touch skip controls link to adjacent recordings and omit missing neighbors',async()=>{
  touchSurface();const p=props();const view=render(<HlsPlayer {...p} labels={{...labels,previousVideo:'Previous video',nextVideo:'Next video'}} previousHref="/en/member-videos/first" nextHref="/en/member-videos/third"/>);
  await waitFor(()=>expect(engine.instances).toHaveLength(1));
  expect(screen.getByRole('link',{name:'Previous video'})).toHaveAttribute('href','/en/member-videos/first');
  expect(screen.getByRole('link',{name:'Next video'})).toHaveAttribute('href','/en/member-videos/third');
  view.rerender(<HlsPlayer {...p} labels={{...labels,previousVideo:'Previous video',nextVideo:'Next video'}} nextHref="/en/member-videos/third"/>);
  expect(screen.queryByRole('link',{name:'Previous video'})).toBeNull();
});

it('includes adjacent video links in the viewport fullscreen keyboard focus loop',async()=>{
  touchSurface();const p=props();render(<HlsPlayer {...p} labels={{...labels,previousVideo:'Previous video',nextVideo:'Next video'}} previousHref="/en/member-videos/first" nextHref="/en/member-videos/third"/>);
  await waitFor(()=>expect(engine.instances).toHaveLength(1));fireEvent.canPlay(p.videoRef.current!);
  await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Fullscreen'})));
  const previous=screen.getByRole('link',{name:'Previous video'}),play=screen.getByRole('button',{name:'Play'});
  play.focus();expect(fireEvent.keyDown(play,{key:'Tab',shiftKey:true})).toBe(true);
  previous.focus();fireEvent.keyDown(previous,{key:'Tab',shiftKey:true});
  expect(screen.getAllByRole('button',{name:'Exit fullscreen'}).at(-1)).toHaveFocus();
});


it.each([false,true])('exposes play after policy rejection before canplay on native=%s without muting',async(native)=>{
  touchSurface();engine.supported=!native;
  if(native)vi.spyOn(HTMLMediaElement.prototype,'canPlayType').mockReturnValue('probably');
  vi.mocked(HTMLMediaElement.prototype.play).mockRejectedValueOnce(new DOMException('Requires gesture','NotAllowedError'));
  const p=props();render(<HlsPlayer {...p}/>);const video=p.videoRef.current!;
  if(native){await waitFor(()=>expect(video.src).toBe(url));fireEvent.loadedMetadata(video);}
  expect(await screen.findByText('Tap to start playback')).toBeInTheDocument();
  expect(screen.queryByText('Loading video')).not.toBeInTheDocument();
  expect(video.muted).toBe(false);
  fireEvent.click(screen.getByRole('button',{name:'Play'}));
  expect(video.play).toHaveBeenCalledTimes(2);
  fireEvent.play(video);fireEvent.playing(video);
  expect(screen.queryByText('Tap to start playback')).not.toBeInTheDocument();
  expect(p.onError).not.toHaveBeenCalled();
});

it('desktop controls link adjacent recordings and toggle theater without rebuilding playback',async()=>{
 const p=props();render(<HlsPlayer {...p} labels={{...labels,previousVideo:'Previous video',nextVideo:'Next video'}} previousHref="/en/member-videos/first" nextHref="/en/member-videos/third"/>);
 await waitFor(()=>expect(engine.instances).toHaveLength(1));
 const video=p.videoRef.current!;video.currentTime=45;
 expect(screen.getByRole('link',{name:'Previous video'})).toHaveAttribute('href','/en/member-videos/first');
 expect(screen.getByRole('link',{name:'Next video'})).toHaveAttribute('href','/en/member-videos/third');
 fireEvent.click(screen.getByRole('button',{name:'Theater mode'}));
 expect(screen.getByRole('region')).toHaveAttribute('data-theater','true');
 expect(screen.getByRole('button',{name:'Exit theater mode'})).toHaveAttribute('aria-pressed','true');
 expect(video.currentTime).toBe(45);expect(p.videoRef.current).toBe(video);expect(engine.instances).toHaveLength(1);
 fireEvent.click(screen.getByRole('button',{name:'Exit theater mode'}));
 expect(screen.getByRole('region')).toHaveAttribute('data-theater','false');
});

it('provides seek feedback and the remaining player keyboard shortcuts without resuming a paused video',async()=>{
  const p=props();render(<HlsPlayer {...p} previousHref="/en/member-videos/first" nextHref="/en/member-videos/third"/>);
  await waitFor(()=>expect(engine.instances).toHaveLength(1));
  const video=p.videoRef.current!,region=screen.getByRole('region');
  Object.defineProperty(video,'duration',{configurable:true,value:600});fireEvent.durationChange(video);fireEvent.canPlay(video);
  video.currentTime=100;vi.mocked(video.play).mockClear();
  fireEvent.keyDown(region,{key:'ArrowRight'});expect(video.currentTime).toBe(105);expect(screen.getByText('+5')).toBeInTheDocument();
  fireEvent.keyDown(region,{key:'ArrowRight',repeat:true});expect(video.currentTime).toBe(110);expect(screen.getByText('+10')).toBeInTheDocument();
  fireEvent.keyDown(region,{key:'j'});expect(video.currentTime).toBe(100);expect(screen.getByText('−10')).toBeInTheDocument();
  fireEvent.keyDown(region,{key:'5'});expect(video.currentTime).toBe(300);
  fireEvent.keyDown(region,{key:'Home'});expect(video.currentTime).toBe(0);
  fireEvent.keyDown(region,{key:'End'});expect(video.currentTime).toBe(600);
  video.volume=.98;fireEvent.keyDown(region,{key:'ArrowUp'});expect(video.volume).toBe(1);
  video.volume=.02;fireEvent.keyDown(region,{key:'ArrowDown'});expect(video.volume).toBe(0);
  fireEvent.keyDown(region,{key:'>',shiftKey:true});expect(video.playbackRate).toBe(1.25);
  fireEvent.keyDown(region,{key:'<',shiftKey:true});expect(video.playbackRate).toBe(1);
  fireEvent.keyDown(region,{key:'t'});expect(region).toHaveAttribute('data-theater','true');
  fireEvent.keyDown(region,{key:'N',shiftKey:true});expect(router.push).toHaveBeenLastCalledWith('/en/member-videos/third');
  fireEvent.keyDown(region,{key:'P',shiftKey:true});expect(router.push).toHaveBeenLastCalledWith('/en/member-videos/first');
  expect(video.play).not.toHaveBeenCalled();
});
it.each([false,true])('hides idle paused controls while keeping settings accessible, touch=%s',async(touchUI)=>{
  vi.stubGlobal('matchMedia',vi.fn().mockReturnValue({matches:touchUI,addEventListener:vi.fn(),removeEventListener:vi.fn()}));
  const p=props();render(<HlsPlayer {...p}/>);await waitFor(()=>expect(engine.instances).toHaveLength(1));
  vi.useFakeTimers();fireEvent.canPlay(p.videoRef.current!);fireEvent.pause(p.videoRef.current!);
  act(()=>vi.advanceTimersByTime(3000));expect(screen.getByRole('region')).toHaveAttribute('data-controls-visible','false');
  fireEvent.focusIn(screen.getByRole('region'));fireEvent.click(screen.getByRole('button',{name:'Settings'}));
  act(()=>vi.advanceTimersByTime(3000));expect(screen.getByRole('region')).toHaveAttribute('data-controls-visible','true');
  fireEvent.click(screen.getByRole('button',{name:'Settings'}));
  fireEvent.mouseOut(screen.getByRole('button',{name:'Settings'}));
  fireEvent.mouseOver(screen.getByRole('button',{name:'Play or pause'}));
  fireEvent.pointerMove(screen.getByRole('button',{name:'Play or pause'}),{pointerType:'mouse'});
  act(()=>vi.advanceTimersByTime(3000));expect(screen.getByRole('region')).toHaveAttribute('data-controls-visible','false');
});

it('keeps a blocked-autoplay play entry visible beyond the idle timeout',async()=>{
  touchSurface();vi.mocked(HTMLMediaElement.prototype.play).mockRejectedValueOnce(new DOMException('Autoplay blocked','NotAllowedError'));
  const p=props();render(<HlsPlayer {...p}/>);await screen.findByText('Tap to start playback');
  vi.useFakeTimers();fireEvent.canPlay(p.videoRef.current!);act(()=>vi.advanceTimersByTime(3000));
  expect(screen.getByRole('region')).toHaveAttribute('data-controls-visible','true');
  expect(screen.getByRole('button',{name:'Play'})).toBeVisible();
});

it.each([false,true])('does not seek when theater mode is unavailable, touch=%s',async(touchUI)=>{
  vi.stubGlobal('matchMedia',vi.fn().mockReturnValue({matches:touchUI,addEventListener:vi.fn(),removeEventListener:vi.fn()}));
  const p=props();render(<HlsPlayer {...p} labels={touchUI?labels:{...labels,theaterMode:undefined,exitTheaterMode:undefined}}/>);
  await waitFor(()=>expect(engine.instances).toHaveLength(1));
  const video=p.videoRef.current!;Object.defineProperty(video,'duration',{configurable:true,value:600});fireEvent.durationChange(video);video.currentTime=100;
  fireEvent.keyDown(screen.getByRole('region'),{key:'t'});expect(video.currentTime).toBe(100);
  expect(screen.getByRole('region')).toHaveAttribute('data-theater','false');
});

it('freezes latest in-flight quality commands before a fatal error can erase playback intent',async()=>{
 const p=props(),onBookmark=vi.fn();render(<HlsPlayer {...p} onBookmark={onBookmark}/>);await waitFor(()=>expect(engine.instances).toHaveLength(1));
 const video=p.videoRef.current!;Object.defineProperty(video,'duration',{configurable:true,value:7200});fireEvent.loadedMetadata(video);fireEvent.durationChange(video);
 video.currentTime=2820;video.playbackRate=1.5;Object.defineProperty(video,'paused',{configurable:true,value:false});fireEvent.play(video);fireEvent.timeUpdate(video);
 fireEvent.click(screen.getByRole('button',{name:'Settings'}));chooseQuality('1080p');
 chooseSpeed('2');fireEvent.change(screen.getByRole('slider',{name:'Playback position'}),{target:{value:'3000'}});
 act(()=>{video.currentTime=0;Object.defineProperty(video,'paused',{configurable:true,value:true});engine.instances[0].listeners.error('error',{fatal:true});});
 expect(p.onError).toHaveBeenCalledWith({time:3000,paused:false,rate:2,quality:'1080p',intent:'dvr'});
 const calls=onBookmark.mock.calls.length;fireEvent.pause(video);fireEvent.timeUpdate(video);fireEvent.loadedMetadata(video);
 expect(onBookmark).toHaveBeenCalledTimes(calls);expect(p.onError).toHaveBeenCalledTimes(1);
});
it('preserves an explicit pause after the last timeupdate in the fatal snapshot',async()=>{
 const p=props();render(<HlsPlayer {...p}/>);await waitFor(()=>expect(engine.instances).toHaveLength(1));
 const video=p.videoRef.current!;video.currentTime=75;fireEvent.loadedMetadata(video);Object.defineProperty(video,'paused',{configurable:true,value:false});fireEvent.play(video);
 fireEvent.click(screen.getByRole('button',{name:'Pause'}));Object.defineProperty(video,'error',{configurable:true,value:{code:3,message:'Decode failed'}});fireEvent.error(video);
 expect(p.onError).toHaveBeenCalledWith(expect.objectContaining({time:75,paused:true}));
});

it('arbitrates desktop double click without changing live playback intent',async()=>{
 const p=props(),onBookmark=vi.fn();render(<HlsPlayer {...p} onBookmark={onBookmark} live={{verifiedEnd:100,canFollow:true,label:'Live',backToLive:'Back to live'}} playbackMode="live"/>);
 await waitFor(()=>expect(engine.instances).toHaveLength(1));
 const root=screen.getByRole('region'),surface=screen.getByRole('button',{name:'Play or pause'}),video=p.videoRef.current!;
 const request=vi.fn().mockResolvedValue(undefined);Object.defineProperty(root,'requestFullscreen',{value:request,configurable:true});
 Object.defineProperty(video,'paused',{value:false,configurable:true});fireEvent.play(video);vi.mocked(video.pause).mockClear();onBookmark.mockClear();
 vi.useFakeTimers();fireEvent.click(surface,{detail:1});fireEvent.click(surface,{detail:2});fireEvent.doubleClick(surface);await act(()=>vi.advanceTimersByTimeAsync(350));
 expect(request).toHaveBeenCalledOnce();expect(video.pause).not.toHaveBeenCalled();expect(onBookmark).not.toHaveBeenCalled();
 fireEvent.click(surface,{detail:0});expect(video.pause).toHaveBeenCalledOnce();
});

it('reports Auto only from a rendered HLS level without rebuilding the session',async()=>{
 const p=props();render(<HlsPlayer {...p}/>);await waitFor(()=>expect(engine.instances).toHaveLength(1));
 fireEvent.click(screen.getByRole('button',{name:'Settings'}));
 openSubmenu('Quality');expect(screen.getByRole('menuitemradio',{name:'Auto'})).toBeInTheDocument();
 act(()=>engine.instances[0].listeners.levelSwitched('levelSwitched',{level:0}));
 expect(screen.getByRole('menuitemradio',{name:'Auto (720p)'})).toBeInTheDocument();
 act(()=>engine.instances[0].listeners.levelSwitched('levelSwitched',{level:1}));
 expect(screen.getByRole('menuitemradio',{name:'Auto (1080p)'})).toBeInTheDocument();expect(engine.instances).toHaveLength(1);expect(engine.instances[0].recoverMediaError).not.toHaveBeenCalled();
});

it('navigates settings submenus by keyboard and returns focus on Escape',async()=>{
 const p=props();render(<HlsPlayer {...p}/>);await waitFor(()=>expect(engine.instances).toHaveLength(1));
 const settings=screen.getByRole('button',{name:'Settings'});fireEvent.click(settings);
 const speed=screen.getByRole('menuitem',{name:'Speed'});speed.focus();fireEvent.keyDown(speed,{key:'ArrowDown'});
 expect(screen.getByRole('menuitem',{name:'Quality'})).toHaveFocus();
 fireEvent.click(speed);expect(screen.getByRole('menuitemradio',{name:'1×'})).toHaveAttribute('aria-checked','true');
 fireEvent.keyDown(document.activeElement!,{key:'ArrowLeft'});expect(screen.getByRole('menuitem',{name:'Speed'})).toHaveFocus();
 fireEvent.keyDown(document.activeElement!,{key:'Escape'});expect(settings).toHaveFocus();expect(screen.queryByRole('menu')).not.toBeInTheDocument();
});

it('keeps VOD Replay discoverable after idle and restarts the same video with its settings',async()=>{
 const p=props();render(<HlsPlayer {...p}/>);await waitFor(()=>expect(engine.instances).toHaveLength(1));
 const video=p.videoRef.current!;Object.defineProperty(video,'duration',{value:120,configurable:true});video.currentTime=120;video.playbackRate=1.5;Object.defineProperty(video,'ended',{value:true,configurable:true});fireEvent.durationChange(video);fireEvent.ended(video);
 vi.useFakeTimers();fireEvent.pointerLeave(screen.getByRole('region'));await act(()=>vi.advanceTimersByTimeAsync(2600));
 const replay=screen.getAllByRole('button',{name:'Replay'})[0];expect(replay).toBeVisible();vi.mocked(video.play).mockClear();fireEvent.click(replay);
 expect(p.videoRef.current).toBe(video);expect(video.currentTime).toBe(0);expect(video.playbackRate).toBe(1.5);expect(video.play).toHaveBeenCalledOnce();expect(engine.instances).toHaveLength(1);
});
it('keeps live ENDLIST as DVR without a VOD replay overlay',async()=>{
 const p=props();render(<HlsPlayer {...p} playbackMode="live" live={{verifiedEnd:100,canFollow:false,label:'Live ended',backToLive:'Back to live'}}/>);await waitFor(()=>expect(engine.instances).toHaveLength(1));Object.defineProperty(p.videoRef.current!,'ended',{value:true,configurable:true});fireEvent.ended(p.videoRef.current!);expect(screen.queryByRole('button',{name:'Replay'})).not.toBeInTheDocument();
});

it('offers a neutral Play fallback if Replay is rejected without muting',async()=>{
 const p=props();render(<HlsPlayer {...p}/>);await waitFor(()=>expect(engine.instances).toHaveLength(1));const video=p.videoRef.current!;fireEvent.canPlay(video);Object.defineProperty(video,'ended',{value:true,configurable:true});fireEvent.ended(video);vi.mocked(video.play).mockRejectedValueOnce(new DOMException('Blocked','NotAllowedError'));
 await act(async()=>fireEvent.click(screen.getAllByRole('button',{name:'Replay'})[0]));expect(screen.getByRole('status')).toHaveTextContent('Tap to start playback');expect(video.muted).toBe(false);expect(screen.getAllByRole('button',{name:'Play'}).length).toBeGreaterThan(0);
});

it('does not fabricate a paused retry bookmark before initial positioning',async()=>{
 engine.manifestReady=false;const p=props();render(<HlsPlayer {...p}/>);await waitFor(()=>expect(engine.instances).toHaveLength(1));act(()=>engine.instances[0].listeners.error('error',{fatal:true}));expect(p.onError).toHaveBeenCalledWith(undefined);
});
it('allows seeking away from ended VOD without Replay resetting the selected position',async()=>{
 const p=props();render(<HlsPlayer {...p}/>);await waitFor(()=>expect(engine.instances).toHaveLength(1));const video=p.videoRef.current!;Object.defineProperty(video,'duration',{value:120,configurable:true});Object.defineProperty(video,'ended',{value:true,configurable:true});video.currentTime=120;fireEvent.durationChange(video);fireEvent.ended(video);
 fireEvent.change(screen.getByRole('slider',{name:'Playback position'}),{target:{value:'60'}});Object.defineProperty(video,'ended',{value:false,configurable:true});fireEvent.seeked(video);expect(screen.queryByRole('button',{name:'Replay'})).not.toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:'Play'}));expect(video.currentTime).toBe(60);
});
it('waits for a slower native desktop double click before issuing live pause commands',async()=>{
 const p=props();render(<HlsPlayer {...p} playbackMode="live" live={{verifiedEnd:100,canFollow:true,label:'Live',backToLive:'Back to live'}}/>);await waitFor(()=>expect(engine.instances).toHaveLength(1));const surface=screen.getByRole('button',{name:'Play or pause'}),video=p.videoRef.current!;Object.defineProperty(video,'paused',{value:false,configurable:true});fireEvent.play(video);vi.mocked(video.pause).mockClear();vi.useFakeTimers();fireEvent.click(surface,{detail:1});await act(()=>vi.advanceTimersByTimeAsync(350));fireEvent.click(surface,{detail:2});fireEvent.doubleClick(surface);await act(()=>vi.advanceTimersByTimeAsync(300));expect(video.pause).not.toHaveBeenCalled();
});

it('cancels a scrub when pointer capture is lost without committing a seek',async()=>{
 const p=props();render(<HlsPlayer {...p}/>);await waitFor(()=>expect(engine.instances).toHaveLength(1));const video=p.videoRef.current!;Object.defineProperty(video,'duration',{value:200,configurable:true});video.currentTime=30;fireEvent.durationChange(video);fireEvent.timeUpdate(video);const input=screen.getByRole('slider',{name:'Playback position'});fireEvent.pointerDown(input);fireEvent.change(input,{target:{value:'150'}});fireEvent.lostPointerCapture(input);fireEvent.pointerUp(input);expect(video.currentTime).toBe(30);
});

it('disables quality choices if media fails while the submenu is open',async()=>{
 const p=props();render(<HlsPlayer {...p}/>);await waitFor(()=>expect(engine.instances).toHaveLength(1));openSubmenu('Quality');act(()=>engine.instances[0].listeners.error('error',{fatal:true}));for(const option of screen.getAllByRole('menuitemradio'))expect(option).toBeDisabled();expect(engine.instances[0].recoverMediaError).not.toHaveBeenCalled();
});

it('cancels a pending desktop surface click when its pointer is cancelled',async()=>{
 const p=props();render(<HlsPlayer {...p}/>);await waitFor(()=>expect(engine.instances).toHaveLength(1));const video=p.videoRef.current!,surface=screen.getByRole('button',{name:'Play or pause'});vi.mocked(video.play).mockClear();vi.useFakeTimers();fireEvent.click(surface,{detail:1});fireEvent.pointerCancel(surface);await act(()=>vi.advanceTimersByTimeAsync(550));expect(video.play).not.toHaveBeenCalled();
});

it.each([false,true])('holds the decoded frame through quality reload until the restored frame is ready (native=%s)',async(native)=>{
 engine.supported=!native;
 if(native)vi.spyOn(HTMLMediaElement.prototype,'canPlayType').mockReturnValue('probably');
 const drawImage=vi.fn();vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue({drawImage} as unknown as CanvasRenderingContext2D);
 const ready=vi.spyOn(HTMLMediaElement.prototype,'readyState','get').mockReturnValue(2);
 const p=props(),view=render(<HlsPlayer {...p} poster="blob:cover"/>);
 if(native)await waitFor(()=>expect(p.videoRef.current!.src).toBe(url));else await waitFor(()=>expect(engine.instances).toHaveLength(1));
 const video=p.videoRef.current!;video.currentTime=81;video.playbackRate=1.5;
 chooseQuality('1080p');
 const frame=view.container.querySelector('canvas')!;
 expect(frame).toBeVisible();expect(drawImage).toHaveBeenCalledWith(video,0,0,1920,1080);
 ready.mockReturnValue(1);fireEvent.loadedMetadata(video);
 expect(video.currentTime).toBe(81);expect(video.playbackRate).toBe(1.5);expect(frame).toBeVisible();
 ready.mockReturnValue(2);fireEvent.seeked(video);
 expect(frame).not.toBeVisible();expect(frame.width).toBe(0);
});
it('keeps the same held frame during rapid quality changes, but clears it on failure',async()=>{
 const drawImage=vi.fn();vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue({drawImage} as unknown as CanvasRenderingContext2D);
 const ready=vi.spyOn(HTMLMediaElement.prototype,'readyState','get').mockReturnValue(2);
 const p=props(),view=render(<HlsPlayer {...p}/>);await waitFor(()=>expect(engine.instances).toHaveLength(1));
 chooseQuality('1080p');ready.mockReturnValue(0);chooseQuality('720p');
 const frame=view.container.querySelector('canvas')!;expect(frame).toBeVisible();expect(drawImage).toHaveBeenCalledOnce();
 act(()=>engine.instances[0].listeners.error('error',{fatal:true}));expect(frame).not.toBeVisible();expect(frame.width).toBe(0);
});
it('still switches quality if the browser cannot capture a frame',async()=>{
 vi.spyOn(HTMLMediaElement.prototype,'readyState','get').mockReturnValue(2);
 vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockImplementation(()=>{throw new Error('Unavailable')});
 const p=props(),view=render(<HlsPlayer {...p}/>);await waitFor(()=>expect(engine.instances).toHaveLength(1));
 chooseQuality('1080p');expect(engine.instances[0].recoverMediaError).toHaveBeenCalledOnce();expect(view.container.querySelector('canvas')).not.toBeVisible();expect(p.onError).not.toHaveBeenCalled();
});
it('discards the held frame when the media source changes',async()=>{
 vi.spyOn(HTMLMediaElement.prototype,'readyState','get').mockReturnValue(2);
 vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue({drawImage:vi.fn()} as unknown as CanvasRenderingContext2D);
 const p=props(),view=render(<HlsPlayer {...p}/>);await waitFor(()=>expect(engine.instances).toHaveLength(1));
 chooseQuality('1080p');expect(view.container.querySelector('canvas')).toBeVisible();
 view.rerender(<HlsPlayer {...p} playbackUrl={url.replace('/sessions/s/','/sessions/next/')}/>);
 expect(view.container.querySelector('canvas')).not.toBeVisible();expect(view.container.querySelector('canvas')!.width).toBe(0);
});

it.each([
 {name:'active DVR',paused:false,rate:1,intent:'dvr' as const,time:7497.465},
 {name:'paused DVR',paused:true,rate:1,intent:'dvr' as const,time:6000},
 {name:'non-1x DVR',paused:false,rate:1.5,intent:'dvr' as const,time:7000},
 {name:'follower',paused:false,rate:1,intent:'followLive' as const,time:9369.45},
])('keeps $name across End metadata callback updates',async({paused,rate,intent,time})=>{
 const p=props(),onBookmark=vi.fn(),live={verifiedEnd:9459.45,canFollow:true,label:'Live',backToLive:'Back to live'};
 const view=render(<HlsPlayer {...p} playbackMode="live" live={live} onBookmark={onBookmark}/>);
 await waitFor(()=>expect(engine.instances).toHaveLength(1));
 const video=p.videoRef.current!;
 Object.defineProperty(video,'seekable',{configurable:true,value:{length:1,start:()=>0,end:()=>9519.51}});
 Object.defineProperty(video,'paused',{configurable:true,value:paused});
 fireEvent.progress(video);fireEvent.seeked(video);
 if(intent==='dvr')fireEvent.change(screen.getByRole('slider',{name:'Playback position'}),{target:{value:String(time)}});
 act(()=>{video.playbackRate=rate;fireEvent.timeUpdate(video);});
 const latestError=vi.fn();
 // End can temporarily remove the projection origin, changing the parent's error callback.
 view.rerender(<HlsPlayer {...p} onError={latestError} playbackMode="live" live={{...live,canFollow:false,label:'Ending'}} onBookmark={onBookmark}/>);
 await act(async()=>{});fireEvent.progress(video);
 expect(video.currentTime).toBe(time);expect(video.paused).toBe(paused);expect(video.playbackRate).toBe(rate);
 expect(engine.instances).toHaveLength(1);expect(engine.instances[0].destroy).not.toHaveBeenCalled();
 expect(onBookmark).toHaveBeenLastCalledWith(expect.objectContaining({time,paused,rate,intent}));
 act(()=>engine.instances[0].listeners.error('error',{fatal:true}));
 expect(p.onError).not.toHaveBeenCalled();expect(latestError).toHaveBeenCalledOnce();
});

it.each([false,true])('ignores a stale native error during quality reconstruction but reports a current failure (native=%s)',async(native)=>{
 engine.supported=!native;if(native)vi.spyOn(HTMLMediaElement.prototype,'canPlayType').mockReturnValue('probably');
 vi.spyOn(HTMLMediaElement.prototype,'readyState','get').mockReturnValue(2);
 vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue({drawImage:vi.fn()} as unknown as CanvasRenderingContext2D);
 const p=props(),view=render(<HlsPlayer {...p}/>);
 await waitFor(()=>expect(native?p.videoRef.current?.src:engine.instances.length).toBe(native?url:1));
 const video=p.videoRef.current!;act(()=>{video.currentTime=81;video.playbackRate=1.5;});
 Object.defineProperty(video,'error',{configurable:true,value:null});
 chooseQuality('1080p');fireEvent.error(video);
 expect(video.error).toBeNull();expect(p.onError).not.toHaveBeenCalled();expect(view.container.querySelector('canvas')).toBeVisible();
 fireEvent.loadedMetadata(video);fireEvent.seeked(video);
 expect(video.currentTime).toBe(81);expect(video.playbackRate).toBe(1.5);
 Object.defineProperty(video,'error',{configurable:true,value:{code:3,message:'Decode failed'}});fireEvent.error(video);
 expect(p.onError).toHaveBeenCalledOnce();
});

it.each(['native','hls'] as const)('keeps ended-live %s reconstruction loading until decoded media returns',async(kind)=>{
 const ready=vi.spyOn(HTMLMediaElement.prototype,'readyState','get').mockReturnValue(2);
 const p=props();render(<HlsPlayer {...p} resume={{time:81,paused:true,rate:1.5,quality:'auto',intent:'dvr'}} playbackMode="live" live={{verifiedEnd:210.21,canFollow:false,label:'Ended',backToLive:'Live'}}/>);
 await waitFor(()=>expect(engine.instances).toHaveLength(1));
 const video=p.videoRef.current!;
 Object.defineProperty(video,'seekable',{configurable:true,value:{length:1,start:()=>0,end:()=>210.21}});
 Object.defineProperty(video,'paused',{configurable:true,value:true});
 act(()=>{video.currentTime=81;video.playbackRate=1.5;fireEvent.progress(video);});
 chooseQuality('1080p');ready.mockReturnValue(0);
 if(kind==='native'){Object.defineProperty(video,'error',{configurable:true,value:{code:3}});fireEvent.error(video);}
 else act(()=>engine.instances[0].listeners.error('error',{fatal:true,type:'mediaError'}));
 expect(p.onError).not.toHaveBeenCalled();expect(screen.getByRole('status')).toHaveTextContent('Loading video');
 Object.defineProperty(video,'error',{configurable:true,value:null});ready.mockReturnValue(2);fireEvent.loadedMetadata(video);fireEvent.canPlay(video);
 expect(p.onError).not.toHaveBeenCalled();expect(video.currentTime).toBe(81);expect(video.playbackRate).toBe(1.5);expect(video.paused).toBe(true);
});

it('reports a persistent reconstruction failure after the bounded loading window',async()=>{
 const p=props();render(<HlsPlayer {...p}/>);await waitFor(()=>expect(engine.instances).toHaveLength(1));
 vi.useFakeTimers();chooseQuality('1080p');
 act(()=>engine.instances[0].listeners.error('error',{fatal:true,type:'mediaError'}));
 expect(p.onError).not.toHaveBeenCalled();act(()=>vi.advanceTimersByTime(30000));expect(p.onError).toHaveBeenCalledOnce();
});
it('reports fatal network failures immediately during reconstruction',async()=>{
 const p=props();render(<HlsPlayer {...p}/>);await waitFor(()=>expect(engine.instances).toHaveLength(1));chooseQuality('1080p');
 act(()=>engine.instances[0].listeners.error('error',{fatal:true,type:'networkError'}));expect(p.onError).toHaveBeenCalledOnce();
});
it('does not turn slow quality buffering without a decode error into a media failure',async()=>{
 const p=props();render(<HlsPlayer {...p}/>);await waitFor(()=>expect(engine.instances).toHaveLength(1));vi.useFakeTimers();chooseQuality('1080p');act(()=>vi.advanceTimersByTime(60000));expect(p.onError).not.toHaveBeenCalled();
});


it.each([false,true])('native=%s coalesces overlapping ended-live quality changes until a decoded frame restores the saved intent',async(native)=>{
 engine.supported=!native;if(native)vi.spyOn(HTMLMediaElement.prototype,'canPlayType').mockReturnValue('probably');
 const ready=vi.spyOn(HTMLMediaElement.prototype,'readyState','get').mockReturnValue(2);
 const drawImage=vi.fn();vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue({drawImage} as unknown as CanvasRenderingContext2D);
 const p=props(),onBookmark=vi.fn(),view=render(<HlsPlayer {...p} availableQualities={['480p','720p','1080p']} onBookmark={onBookmark} playbackMode="live" live={{verifiedEnd:480.48,canFollow:false,label:'Ended',backToLive:'Live'}}/>);
 await waitFor(()=>expect(native?p.videoRef.current?.src:engine.instances.length).toBe(native?url:1));
 const video=p.videoRef.current!;Object.defineProperty(video,'seekable',{configurable:true,value:{length:1,start:()=>0,end:()=>480.48}});
 fireEvent.progress(video);fireEvent.seeked(video);fireEvent.change(screen.getByRole('slider',{name:'Playback position'}),{target:{value:'120'}});chooseSpeed('1.5');
 const reset=()=>{ready.mockReturnValue(0);video.currentTime=0;video.playbackRate=1;};
 if(!native)engine.instances[0].recoverMediaError.mockImplementation(reset);else vi.mocked(video.load).mockImplementation(reset);
 chooseQuality('480p');
 ready.mockReturnValue(1);fireEvent.loadedMetadata(video);
 // Metadata is not a rendered frame: a late detach/reset must not replace the saved intent.
 act(reset);onBookmark.mockClear();chooseQuality('1080p');chooseQuality('auto');
 if(native)expect(video.src).toContain('480p/index.m3u8');else expect(engine.instances[0].recoverMediaError).toHaveBeenCalledOnce();
 expect(drawImage).toHaveBeenCalledOnce();expect(view.container.querySelector('canvas')).toBeVisible();for(const [bookmark] of onBookmark.mock.calls)expect(bookmark).toEqual(expect.objectContaining({time:120,paused:true,rate:1.5}));
 ready.mockReturnValue(2);fireEvent.loadedMetadata(video);fireEvent.seeked(video);
 if(!native)expect(engine.instances[0].recoverMediaError).toHaveBeenCalledTimes(2);
 expect(view.container.querySelector('canvas')).toBeVisible();
 ready.mockReturnValue(2);fireEvent.loadedMetadata(video);fireEvent.seeked(video);fireEvent.canPlay(video);
 expect(video.currentTime).toBe(120);expect(video.playbackRate).toBe(1.5);expect(video.paused).toBe(true);
 expect(onBookmark).toHaveBeenLastCalledWith(expect.objectContaining({time:120,paused:true,rate:1.5,quality:'auto',intent:'dvr'}));
 expect(view.container.querySelector('canvas')).not.toBeVisible();expect(screen.queryByRole('status')).not.toBeInTheDocument();expect(p.onError).not.toHaveBeenCalled();
});

it.each([{paused:false,rate:1,intent:'followLive' as const},{paused:true,rate:1,intent:'dvr' as const},{paused:false,rate:1.5,intent:'dvr' as const}])('prevents hls.js outside-playlist rewinds for paused=$paused rate=$rate intent=$intent',async({paused,rate,intent})=>{
 const p=props();render(<HlsPlayer {...p} playbackMode="live" resume={{time:3753.759063,paused,rate,quality:'auto',intent}} live={{verifiedEnd:3753.75,canFollow:true,label:'Live',backToLive:'Live'}}/>);
 await waitFor(()=>expect(engine.instances).toHaveLength(1));
 const {default:RealHls}=await vi.importActual<typeof import('hls.js')>('hls.js');
 const video=p.videoRef.current!;Object.defineProperty(video,'duration',{configurable:true,value:3753.791999});Object.defineProperty(video,'readyState',{configurable:true,value:2});Object.defineProperty(video,'paused',{configurable:true,value:paused});act(()=>{video.currentTime=3753.759063;video.playbackRate=rate;});
 const details={fragmentStart:0,edge:3753.75,totalduration:3753.75,targetduration:31,age:0,holdBack:0,partHoldBack:0};
 const verify=(config:Partial<HlsConfig>)=>{const real=new RealHls(config);Object.defineProperty(real,'latestLevelDetails',{get:()=>details});Object.defineProperty(real,'hasEnoughToStart',{get:()=>true});const stream=(real as unknown as {streamController:{media:HTMLVideoElement|null;synchronizeToLiveEdge:(details:unknown)=>void}}).streamController;stream.media=video;stream.synchronizeToLiveEdge(details);stream.media=null;real.destroy();};
 // Actual hls.js 1.7.3 seeks backward despite an infinite maximum latency.
 act(()=>verify({liveSyncDuration:30,liveMaxLatencyDuration:Infinity}));expect(video.currentTime).toBeCloseTo(3722.75,5);
 act(()=>{video.currentTime=3753.759063;verify({...engine.instances[0].config,liveSyncDuration:30,liveMaxLatencyDuration:Infinity});});
 expect(video.currentTime).toBe(3753.759063);expect(video.paused).toBe(paused);expect(video.playbackRate).toBe(rate);
});

it('does not catch up a non-1x follower even when the rate changed outside the toolbar',async()=>{
 const p=props(),live={verifiedEnd:1200,canFollow:true,label:'Live',backToLive:'Live'},view=render(<HlsPlayer {...p} playbackMode="live" live={live}/>);
 await waitFor(()=>expect(engine.instances).toHaveLength(1));const video=p.videoRef.current!;let end=1200;
 Object.defineProperty(video,'seekable',{configurable:true,get:()=>({length:1,start:()=>0,end:()=>end})});Object.defineProperty(video,'paused',{configurable:true,value:false});
 fireEvent.progress(video);fireEvent.seeked(video);video.playbackRate=1.5;fireEvent.rateChange(video);end=1500;
 view.rerender(<HlsPlayer {...p} playbackMode="live" live={{...live,verifiedEnd:1500}}/>);fireEvent.progress(video);
 expect(video.currentTime).toBe(1110);expect(video.playbackRate).toBe(1.5);
});


it.each([false,true])('native=%s keeps first-entry live positioning when quality is chosen before metadata',async(native)=>{
 engine.supported=!native;if(native)vi.spyOn(HTMLMediaElement.prototype,'canPlayType').mockReturnValue('probably');
 const ready=vi.spyOn(HTMLMediaElement.prototype,'readyState','get').mockReturnValue(0),p=props(),onBookmark=vi.fn();
 render(<HlsPlayer {...p} onBookmark={onBookmark} playbackMode="live" live={{verifiedEnd:90.09,canFollow:true,label:'Live',backToLive:'Live'}}/>);
 await waitFor(()=>expect(native?p.videoRef.current?.src:engine.instances.length).toBe(native?url:1));
 chooseQuality('720p');const video=p.videoRef.current!;
 Object.defineProperty(video,'seekable',{configurable:true,value:{length:1,start:()=>0,end:()=>90.112}});ready.mockReturnValue(2);fireEvent.loadedMetadata(video);fireEvent.seeked(video);
 expect(video.currentTime).toBeCloseTo(0.09,5);expect(onBookmark).toHaveBeenLastCalledWith(expect.objectContaining({intent:'followLive',quality:'720p',time:expect.closeTo(0.09,5)}));
});

it('drops queued source changes when the playback scope is replaced',async()=>{
 const p=props(),view=render(<HlsPlayer {...p} availableQualities={['480p','720p','1080p']}/>);await waitFor(()=>expect(engine.instances).toHaveLength(1));
 const video=p.videoRef.current!;video.currentTime=120;chooseQuality('480p');chooseQuality('1080p');chooseQuality('auto');
 view.rerender(<HlsPlayer {...p} availableQualities={['480p','720p','1080p']} playbackUrl={url.replace('/sessions/s/','/sessions/new/')}/>);
 await waitFor(()=>expect(engine.instances).toHaveLength(2));Object.defineProperty(video,'readyState',{configurable:true,value:2});video.currentTime=15;fireEvent.loadedMetadata(video);fireEvent.canPlay(video);
 expect(engine.instances[0].destroy).toHaveBeenCalledOnce();expect(engine.instances[1].recoverMediaError).not.toHaveBeenCalled();expect(video.currentTime).toBe(15);
});

it('keeps the latest commanded bookmark available for a VOD handoff during a queued rebuild',async()=>{
 const p=props(),onBookmark=vi.fn();render(<HlsPlayer {...p} onBookmark={onBookmark}/>);await waitFor(()=>expect(engine.instances).toHaveLength(1));
 const video=p.videoRef.current!;Object.defineProperty(video,'duration',{configurable:true,value:600});video.currentTime=120;fireEvent.durationChange(video);fireEvent.timeUpdate(video);
 chooseQuality('1080p');chooseSpeed('1.5');fireEvent.change(screen.getByRole('slider',{name:'Playback position'}),{target:{value:'180'}});chooseQuality('auto');
 expect(onBookmark).toHaveBeenLastCalledWith(expect.objectContaining({time:180,paused:true,rate:1.5,quality:'auto',intent:'dvr'}));
});

it.each([false,true])('native=%s keeps the live indicator stable across 10.01-second segment steps and aligns the slider with the target',async(native)=>{
 engine.supported=!native;if(native)vi.spyOn(HTMLMediaElement.prototype,'canPlayType').mockReturnValue('probably');
 const p=props(),live={verifiedEnd:1200,canFollow:true,label:'Live',backToLive:'Back to live'};
 const view=render(<HlsPlayer {...p} playbackMode="live" live={live}/>);
 await waitFor(()=>expect(native?p.videoRef.current?.src:engine.instances.length).toBe(native?url:1));
 const video=p.videoRef.current!;let end=1200;
 Object.defineProperty(video,'seekable',{configurable:true,get:()=>({length:1,start:()=>0,end:()=>end})});
 Object.defineProperty(video,'paused',{configurable:true,value:false});
 fireEvent.progress(video);fireEvent.seeked(video);fireEvent.playing(video);fireEvent.play(video);fireEvent.timeUpdate(video);
 expect(video.currentTime).toBe(1110);
 const button=()=>screen.getByRole('button',{name:'Back to live'}),slider=screen.getByRole('slider',{name:'Playback position'});
 expect(slider).toHaveAttribute('max','1110');expect(button()).toHaveAttribute('data-live-edge','true');
 for(let index=1;index<=6;index++){
  video.currentTime=1110+(index-1)*10.01;end=1200+index*10.01;
  view.rerender(<HlsPlayer {...p} playbackMode="live" live={{...live,verifiedEnd:end}}/>);
  fireEvent.progress(video);fireEvent.timeUpdate(video);
  expect(button()).toHaveAttribute('data-live-edge','true');
  expect(Number(slider.getAttribute('max'))).toBeCloseTo(end-90);
  expect(Number((slider as HTMLInputElement).value)).toBeCloseTo(end-90);
 }
 fireEvent.waiting(video);expect(button()).toHaveAttribute('data-live-edge','false');
 fireEvent.playing(video);expect(button()).toHaveAttribute('data-live-edge','true');
 fireEvent.change(slider,{target:{value:String(end-95)}});expect(button()).toHaveAttribute('data-live-edge','false');
 fireEvent.change(slider,{target:{value:String(end-90)}});fireEvent.seeked(video);fireEvent.timeUpdate(video);
 expect(video.currentTime).toBeCloseTo(end-90);expect(button()).toHaveAttribute('data-live-edge','true');
 chooseSpeed('1.5');fireEvent.rateChange(video);expect(button()).toHaveAttribute('data-live-edge','false');
 fireEvent.click(button());fireEvent.seeked(video);fireEvent.rateChange(video);fireEvent.timeUpdate(video);
 expect(video.playbackRate).toBe(1);expect(button()).toHaveAttribute('data-live-edge','true');
 fireEvent.pause(video);expect(button()).toHaveAttribute('data-live-edge','false');
});

it('exposes the final verified tail for ended recordings but keeps the target while interrupted',async()=>{
 const p=props(),live={verifiedEnd:1200,canFollow:false,label:'Interrupted',backToLive:'Back to live'};
 const view=render(<HlsPlayer {...p} playbackMode="live" live={live}/>);
 await waitFor(()=>expect(engine.instances).toHaveLength(1));
 const video=p.videoRef.current!;Object.defineProperty(video,'seekable',{configurable:true,value:{length:1,start:()=>0,end:()=>1250}});fireEvent.progress(video);
 const slider=screen.getByRole('slider',{name:'Playback position'});expect(slider).toHaveAttribute('max','1110');
 view.rerender(<HlsPlayer {...p} playbackMode="live" live={{...live,ended:true}}/>);
 expect(slider).toHaveAttribute('max','1200');fireEvent.change(slider,{target:{value:'1200'}});expect(video.currentTime).toBe(1200);
});

it('supports a muted staff preview without a member watermark',async()=>{
 const p=props();render(<HlsPlayer {...p} muted watermark={undefined}/>);
 await waitFor(()=>expect(engine.instances).toHaveLength(1));
 expect(p.videoRef.current!.muted).toBe(true);expect(screen.queryByText('TRACE123')).not.toBeInTheDocument();
});

it('keeps a paused DVR seek to the right endpoint paused until explicit Live',async()=>{
 const p=props(),onBookmark=vi.fn();render(<HlsPlayer {...p} onBookmark={onBookmark} playbackMode="live" live={{verifiedEnd:1200,canFollow:true,label:'Live',backToLive:'Back to live'}} resume={{time:300,paused:true,rate:1.5,quality:'auto',intent:'dvr'}}/>);
 await waitFor(()=>expect(engine.instances).toHaveLength(1));
 const video=p.videoRef.current!;Object.defineProperty(video,'seekable',{configurable:true,value:{length:1,start:()=>0,end:()=>1200}});fireEvent.progress(video);
 vi.mocked(video.play).mockClear();fireEvent.change(screen.getByRole('slider',{name:'Playback position'}),{target:{value:'1110'}});
 expect(video.currentTime).toBe(1110);expect(video.play).not.toHaveBeenCalled();expect(video.playbackRate).toBe(1.5);
 expect(onBookmark).toHaveBeenLastCalledWith(expect.objectContaining({intent:'dvr',paused:true,time:1110}));
});

it('delegates ordinary navigation while retaining native modified links',async()=>{
 const p=props();render(<HlsPlayer {...p} nextHref="/next" labels={{...labels,nextVideo:'Next'}}/>);
 await waitFor(()=>expect(engine.instances).toHaveLength(1));
 const link=screen.getByRole('link',{name:'Next'});expect(link).toHaveAttribute('href','/next');
 fireEvent.click(link);expect(router.push).toHaveBeenCalledExactlyOnceWith('/next');
 const click=new MouseEvent('click',{bubbles:true,cancelable:true,ctrlKey:true});
 link.addEventListener('click',event=>{expect(event.defaultPrevented).toBe(false);event.preventDefault();},{once:true});
 fireEvent(link,click);expect(router.push).toHaveBeenCalledOnce();
});

it.each([false,true])('native=%s catches a resumed follower beyond indicator tolerance once, without seeking on ordinary segment steps',async(native)=>{
 engine.supported=!native;if(native)vi.spyOn(HTMLMediaElement.prototype,'canPlayType').mockReturnValue('probably');
 const p=props(),onBookmark=vi.fn(),live={verifiedEnd:1200,canFollow:true,label:'Live',backToLive:'Back to live'};
 const view=render(<HlsPlayer {...p} playbackMode="live" live={live} onBookmark={onBookmark}/>);
 await waitFor(()=>expect(native?p.videoRef.current?.src:engine.instances.length).toBe(native?url:1));
 const video=p.videoRef.current!;let end=1200;
 Object.defineProperty(video,'seekable',{configurable:true,get:()=>({length:1,start:()=>0,end:()=>end})});
 Object.defineProperty(video,'paused',{configurable:true,value:false});
 fireEvent.progress(video);fireEvent.seeked(video);fireEvent.playing(video);fireEvent.play(video);fireEvent.timeUpdate(video);
 expect(video.currentTime).toBe(1110);
 const seek=vi.spyOn(video,'currentTime','set');
 end=1210.01;view.rerender(<HlsPlayer {...p} playbackMode="live" live={{...live,verifiedEnd:end}} onBookmark={onBookmark}/>);
 fireEvent.progress(video);fireEvent.timeUpdate(video);
 expect(seek).not.toHaveBeenCalled();expect(video.currentTime).toBe(1110);
 end=1225;view.rerender(<HlsPlayer {...p} playbackMode="live" live={{...live,verifiedEnd:end}} onBookmark={onBookmark}/>);
 fireEvent.progress(video);fireEvent.timeUpdate(video);fireEvent.seeked(video);fireEvent.progress(video);
 expect(seek).toHaveBeenCalledExactlyOnceWith(1135);
 expect(onBookmark).toHaveBeenLastCalledWith(expect.objectContaining({intent:'followLive',time:1135}));
 expect(screen.getByRole('button',{name:'Back to live'})).toHaveAttribute('data-live-edge','true');
});

it.each(['keyboard','touch'] as const)('does not rewind a follower ahead of the viewer target when seeking forward by %s',async(input)=>{
 if(input==='touch')touchSurface();
 const p=props();render(<HlsPlayer {...p} playbackMode="live" live={{verifiedEnd:1200,canFollow:true,label:'Live',backToLive:'Back to live'}}/>);
 await waitFor(()=>expect(engine.instances).toHaveLength(1));
 const video=p.videoRef.current!;
 Object.defineProperty(video,'seekable',{configurable:true,value:{length:1,start:()=>0,end:()=>1200}});
 Object.defineProperty(video,'paused',{configurable:true,value:false});
 fireEvent.progress(video);fireEvent.seeked(video);fireEvent.playing(video);fireEvent.play(video);
 video.currentTime=1115;fireEvent.timeUpdate(video);
 const seek=vi.spyOn(video,'currentTime','set');
 if(input==='keyboard')fireEvent.keyDown(screen.getByRole('region'),{key:'ArrowRight'});
 else{
  const surface=screen.getByRole('button',{name:'Play or pause'});
  vi.spyOn(surface,'getBoundingClientRect').mockReturnValue({left:0,width:600} as DOMRect);
  touch(surface,'pointerdown',550);touch(surface,'pointerup',550);
  touch(surface,'pointerdown',550);touch(surface,'pointerup',550);
 }
 expect(seek).not.toHaveBeenCalled();expect(video.currentTime).toBe(1115);
 fireEvent.click(screen.getByRole('button',{name:'Back to live'}));
 expect(seek).toHaveBeenCalledExactlyOnceWith(1110);
});

it.each([false,true])('native=%s waits for ninety verified seconds before fresh live positioning and a single autoplay',async(native)=>{
 engine.supported=!native;if(native)vi.spyOn(HTMLMediaElement.prototype,'canPlayType').mockReturnValue('probably');
 const p=props(),onBookmark=vi.fn(),live={verifiedEnd:60.06,canFollow:true,label:'Live',backToLive:'Back to live'};
 const view=render(<HlsPlayer {...p} playbackMode="live" live={live} onBookmark={onBookmark}/>);
 await waitFor(()=>expect(native?p.videoRef.current?.src:engine.instances.length).toBe(native?url:1));
 const video=p.videoRef.current!;let end=100.1;
 Object.defineProperty(video,'seekable',{configurable:true,get:()=>({length:1,start:()=>0,end:()=>end})});
 fireEvent.loadedMetadata(video);fireEvent.canPlay(video);fireEvent.progress(video);fireEvent.timeUpdate(video);
 expect(video.play).not.toHaveBeenCalled();expect(onBookmark).not.toHaveBeenCalled();expect(video.currentTime).toBe(0);
 end=80.08;view.rerender(<HlsPlayer {...p} playbackMode="live" live={{...live,verifiedEnd:100.1}} onBookmark={onBookmark}/>);fireEvent.progress(video);
 expect(video.play).not.toHaveBeenCalled();
 end=100.1;fireEvent.progress(video);fireEvent.canPlay(video);fireEvent.loadedMetadata(video);fireEvent.progress(video);
 expect(video.currentTime).toBeCloseTo(10.1);expect(video.play).toHaveBeenCalledOnce();
 expect(onBookmark).toHaveBeenLastCalledWith(expect.objectContaining({intent:'followLive',time:expect.closeTo(10.1)}));
});

it.each([false,true])('native=%s plays an ended short live recording without waiting for the reserve',async(native)=>{
 engine.supported=!native;if(native)vi.spyOn(HTMLMediaElement.prototype,'canPlayType').mockReturnValue('probably');
 const p=props();render(<HlsPlayer {...p} playbackMode="live" live={{verifiedEnd:30.03,ended:true,canFollow:false,label:'Ended',backToLive:'Back to live'}}/>);
 await waitFor(()=>expect(native?p.videoRef.current?.src:engine.instances.length).toBe(native?url:1));
 const video=p.videoRef.current!;Object.defineProperty(video,'seekable',{configurable:true,value:{length:1,start:()=>0,end:()=>30.03}});
 fireEvent.loadedMetadata(video);fireEvent.progress(video);
 expect(video.currentTime).toBe(0);expect(video.play).toHaveBeenCalledOnce();
});

it('keeps a paused short-window DVR bookmark paused when the reserve later becomes available',async()=>{
 const p=props(),live={verifiedEnd:30.03,canFollow:true,label:'Live',backToLive:'Back to live'},view=render(<HlsPlayer {...p} playbackMode="live" live={live} resume={{time:15,paused:true,rate:1.5,quality:'auto',intent:'dvr'}}/>);
 await waitFor(()=>expect(engine.instances).toHaveLength(1));
 const video=p.videoRef.current!;Object.defineProperty(video,'seekable',{configurable:true,value:{length:1,start:()=>0,end:()=>120}});
 fireEvent.loadedMetadata(video);expect(video.currentTime).toBe(15);expect(video.playbackRate).toBe(1.5);expect(video.play).not.toHaveBeenCalled();
 view.rerender(<HlsPlayer {...p} playbackMode="live" live={{...live,verifiedEnd:120}}/>);fireEvent.progress(video);
 expect(video.currentTime).toBe(15);expect(video.play).not.toHaveBeenCalled();
});

it('preserves explicit play during initial reserve waiting as DVR without a later autoplay or reposition',async()=>{
 const p=props(),onBookmark=vi.fn(),live={verifiedEnd:30.03,canFollow:true,label:'Live',backToLive:'Back to live'},view=render(<HlsPlayer {...p} playbackMode="live" live={live} onBookmark={onBookmark}/>);
 await waitFor(()=>expect(engine.instances).toHaveLength(1));
 const video=p.videoRef.current!;Object.defineProperty(video,'seekable',{configurable:true,value:{length:1,start:()=>0,end:()=>120}});fireEvent.loadedMetadata(video);
 expect(video.play).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Play'}));
 expect(video.play).toHaveBeenCalledOnce();video.currentTime=12;fireEvent.timeUpdate(video);
 view.rerender(<HlsPlayer {...p} playbackMode="live" live={{...live,verifiedEnd:120}} onBookmark={onBookmark}/>);fireEvent.progress(video);
 expect(video.currentTime).toBe(12);expect(video.play).toHaveBeenCalledOnce();
 expect(onBookmark).toHaveBeenLastCalledWith(expect.objectContaining({intent:'dvr',time:12}));
});

it('releases the startup reserve when the same short stream ends',async()=>{
 const p=props(),live={verifiedEnd:30.03,canFollow:true,label:'Live',backToLive:'Back to live'},view=render(<HlsPlayer {...p} playbackMode="live" live={live}/>);
 await waitFor(()=>expect(engine.instances).toHaveLength(1));
 const video=p.videoRef.current!;Object.defineProperty(video,'seekable',{configurable:true,value:{length:1,start:()=>0,end:()=>30.03}});fireEvent.loadedMetadata(video);
 expect(video.play).not.toHaveBeenCalled();
 view.rerender(<HlsPlayer {...p} playbackMode="live" live={{...live,ended:true,canFollow:false}}/>);fireEvent.progress(video);
 expect(video.play).toHaveBeenCalledOnce();expect(screen.getByRole('slider',{name:'Playback position'})).toHaveAttribute('max','30.03');
});

it.each([false,true])('native=%s waits for the reserve through a pre-metadata quality change',async(native)=>{
 engine.supported=!native;if(native)vi.spyOn(HTMLMediaElement.prototype,'canPlayType').mockReturnValue('probably');
 const ready=vi.spyOn(HTMLMediaElement.prototype,'readyState','get').mockReturnValue(0),p=props(),onBookmark=vi.fn(),live={verifiedEnd:60.06,canFollow:true,label:'Live',backToLive:'Back to live'};
 const view=render(<HlsPlayer {...p} playbackMode="live" live={live} onBookmark={onBookmark}/>);
 await waitFor(()=>expect(native?p.videoRef.current?.src:engine.instances.length).toBe(native?url:1));chooseQuality('720p');
 const video=p.videoRef.current!;Object.defineProperty(video,'seekable',{configurable:true,value:{length:1,start:()=>0,end:()=>100.1}});ready.mockReturnValue(2);
 fireEvent.loadedMetadata(video);fireEvent.canPlay(video);fireEvent.progress(video);
 expect(video.play).not.toHaveBeenCalled();expect(onBookmark).not.toHaveBeenCalled();
 view.rerender(<HlsPlayer {...p} playbackMode="live" live={{...live,verifiedEnd:100.1}} onBookmark={onBookmark}/>);fireEvent.progress(video);fireEvent.canPlay(video);fireEvent.seeked(video);
 expect(video.currentTime).toBeCloseTo(10.1);expect(video.play).toHaveBeenCalledOnce();
 expect(onBookmark).toHaveBeenLastCalledWith(expect.objectContaining({intent:'followLive',quality:'720p',time:expect.closeTo(10.1)}));
});

it('requires the current source manifest before releasing its deferred autoplay',async()=>{
 engine.manifestReady=false;
 const p=props(),live={verifiedEnd:30.03,canFollow:true,label:'Live',backToLive:'Back to live'},view=render(<HlsPlayer {...p} playbackMode="live" live={live}/>);
 await waitFor(()=>expect(engine.instances).toHaveLength(1));const stale=engine.instances[0].listeners.manifest;
 const video=p.videoRef.current!;Object.defineProperty(video,'seekable',{configurable:true,value:{length:1,start:()=>0,end:()=>120}});fireEvent.loadedMetadata(video);
 view.rerender(<HlsPlayer {...p} playbackUrl={url.replace('/sessions/s/','/sessions/new/')} playbackMode="live" live={{...live,verifiedEnd:120}}/>);
 await waitFor(()=>expect(engine.instances).toHaveLength(2));fireEvent.progress(video);act(()=>stale());
 expect(video.play).not.toHaveBeenCalled();expect(engine.instances[0].destroy).toHaveBeenCalledOnce();
 act(()=>engine.instances[1].listeners.manifest());fireEvent.progress(video);act(()=>stale());
 expect(video.currentTime).toBe(30);expect(video.play).toHaveBeenCalledOnce();
});

it('does not turn a failed pre-start quality change into a zero-time resume bookmark',async()=>{
 const p=props(),onBookmark=vi.fn();render(<HlsPlayer {...p} playbackMode="live" live={{verifiedEnd:30.03,canFollow:true,label:'Live',backToLive:'Back to live'}} onBookmark={onBookmark}/>);
 await waitFor(()=>expect(engine.instances).toHaveLength(1));chooseQuality('720p');
 act(()=>engine.instances[0].listeners.error('error',{fatal:true,type:'networkError'}));
 expect(onBookmark).not.toHaveBeenCalled();expect(p.onError).toHaveBeenCalledExactlyOnceWith(undefined);
});
