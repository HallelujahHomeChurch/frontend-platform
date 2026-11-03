import {createRef} from 'react';
import {act,cleanup,fireEvent,render,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {AudioPlayer} from './AudioPlayer.js';
const state=vi.hoisted(()=>({instances:[] as any[]}));
vi.mock('hls.js',()=>({default:class {
 static isSupported(){return true;}static Events={ERROR:'error'};
 listeners:Record<string,Function>={};destroy=vi.fn();loadSource=vi.fn();attachMedia=vi.fn();
 constructor(public config:any){state.instances.push(this);}on(event:string,fn:Function){this.listeners[event]=fn;}
}}));
const url='https://media.example/videos/r/packages/p/sessions/s/audio/aac-hls-v1/index.m3u8';
const resume={time:42,paused:false,rate:1.5,quality:'720p' as const,intent:'dvr' as const};
const props=()=>({playbackUrl:url,title:'Service',audioRef:createRef<HTMLAudioElement>(),resume,onBookmark:vi.fn(),onError:vi.fn(),labels:{playbackSpeed:'Speed',tapToPlay:'Tap to play'}});
beforeEach(()=>{state.instances=[];vi.spyOn(HTMLMediaElement.prototype,'canPlayType').mockReturnValue('probably');vi.spyOn(HTMLMediaElement.prototype,'play').mockResolvedValue(undefined);vi.spyOn(HTMLMediaElement.prototype,'pause').mockImplementation(()=>{});vi.spyOn(HTMLMediaElement.prototype,'load').mockImplementation(()=>{});vi.spyOn(HTMLMediaElement.prototype,'duration','get').mockReturnValue(120);});
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();});
it('uses native audio, restores position and rate, and keeps listening while hidden',async()=>{
 const p=props();const view=render(<AudioPlayer {...p}/>);const audio=p.audioRef.current!;
 expect(view.container.querySelector('video')).toBeNull();expect(audio.crossOrigin).toBe('use-credentials');expect(audio.src).toBe(url);
 fireEvent.loadedMetadata(audio);expect(audio.currentTime).toBe(42);expect(audio.playbackRate).toBe(1.5);expect(audio.play).toHaveBeenCalledOnce();
 fireEvent(document,new Event('visibilitychange'));expect(audio.pause).not.toHaveBeenCalled();
 view.unmount();expect(audio.pause).toHaveBeenCalledOnce();expect(audio.getAttribute('src')).toBeNull();
});
it('preserves explicit pause and reports the active media bookmark on failure once',()=>{
 const p=props();render(<AudioPlayer {...p} resume={{...resume,paused:true}}/>);const audio=p.audioRef.current!;fireEvent.loadedMetadata(audio);expect(audio.play).not.toHaveBeenCalled();
 audio.currentTime=57;audio.playbackRate=2;fireEvent.timeUpdate(audio);fireEvent.error(audio);fireEvent.error(audio);
 expect(p.onError).toHaveBeenCalledOnce();expect(p.onError).toHaveBeenCalledWith(expect.objectContaining({time:57,paused:true,rate:2,quality:'720p'}));
});
it('confines HLS requests to the same versioned audio directory and destroys the engine',async()=>{
 vi.mocked(HTMLMediaElement.prototype.canPlayType).mockReturnValue('');const p=props(),view=render(<AudioPlayer {...p}/>);await waitFor(()=>expect(state.instances).toHaveLength(1));
 const engine=state.instances[0],xhr=new XMLHttpRequest();engine.config.xhrSetup(xhr,url.replace('index.m3u8','seg-000001.ts'));expect(xhr.withCredentials).toBe(true);
 for(const bad of [url.replace('media.example','evil.example'),url+'?token=x',url.replace('aac-hls-v1','aac-hls-v2'),url.replace('index.m3u8','../../master.m3u8')])expect(()=>engine.config.xhrSetup(xhr,bad)).toThrow();
 view.unmount();expect(engine.destroy).toHaveBeenCalledOnce();
});
it('owns Media Session controls only while mounted and clamps lock-screen seeks',async()=>{
 const handlers=new Map<string,Function|null>();const session={setActionHandler:vi.fn((name:string,fn:Function|null)=>handlers.set(name,fn)),setPositionState:vi.fn(),metadata:null,playbackState:'none'};
 vi.stubGlobal('navigator',{mediaSession:session});vi.stubGlobal('MediaMetadata',class{constructor(public value:unknown){}});
 const p=props(),view=render(<AudioPlayer {...p}/>);const audio=p.audioRef.current!;fireEvent.loadedMetadata(audio);
 await act(async()=>handlers.get('seekto')!({seekTime:999}));expect(audio.currentTime).toBe(120);
 await act(async()=>handlers.get('seekbackward')!({seekOffset:10}));expect(audio.currentTime).toBe(110);
 view.unmount();expect([...handlers.values()].every(value=>value===null)).toBe(true);expect(session.metadata).toBeNull();
});
it('retains resume play intent when initialization fails before play succeeds',async()=>{
 let reject!:(reason:Error)=>void;vi.mocked(HTMLMediaElement.prototype.play).mockReturnValue(new Promise<void>((_resolve,no)=>{reject=no;}));
 const p=props();render(<AudioPlayer {...p}/>);const audio=p.audioRef.current!;fireEvent.loadedMetadata(audio);
 expect(p.onBookmark).toHaveBeenLastCalledWith(expect.objectContaining({time:42,paused:false,rate:1.5}));
 fireEvent.error(audio);expect(p.onError).toHaveBeenCalledWith(expect.objectContaining({time:42,paused:false,rate:1.5}));
 await act(async()=>reject(new Error('initial play failed')));
});
it('honors explicit pause before metadata instead of replaying the saved play intent',()=>{
 const p=props();render(<AudioPlayer {...p}/>);const audio=p.audioRef.current!;fireEvent.pause(audio);fireEvent.loadedMetadata(audio);
 expect(audio.play).not.toHaveBeenCalled();fireEvent.error(audio);
 expect(p.onError).toHaveBeenCalledWith(expect.objectContaining({time:42,paused:true}));
});
it.each(['source','pause'] as const)('ignores an old Media Session play rejection after %s change',async change=>{
 const handlers=new Map<string,Function|null>();vi.stubGlobal('navigator',{mediaSession:{setActionHandler:(name:string,handler:Function|null)=>handlers.set(name,handler),setPositionState:vi.fn(),metadata:null,playbackState:'none'}});
 let reject!:(reason:Error)=>void;vi.mocked(HTMLMediaElement.prototype.play).mockReturnValue(new Promise<void>((_resolve,no)=>{reject=no;}));
 const p=props(),view=render(<AudioPlayer {...p}/>);act(()=>handlers.get('play')!({}));
 if(change==='source')view.rerender(<AudioPlayer {...p} playbackUrl={url.replace('/sessions/s/','/sessions/new/')}/>);
 else act(()=>handlers.get('pause')!({}));
 await act(async()=>reject(new Error('stale play failed')));
 expect(view.queryByRole('status')).toBeNull();
});
it('keeps a pre-metadata pause in the fallback bookmark',()=>{
 const p=props();render(<AudioPlayer {...p}/>);const audio=p.audioRef.current!;fireEvent.pause(audio);fireEvent.error(audio);
 expect(p.onError).toHaveBeenCalledWith(expect.objectContaining({time:42,paused:true,rate:1.5}));
});
