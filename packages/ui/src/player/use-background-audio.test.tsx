import {act,renderHook} from '@testing-library/react';
import {beforeEach,describe,expect,it,vi} from 'vitest';
import {useBackgroundAudio} from './use-background-audio.js';
const attachSource=vi.hoisted(()=>vi.fn(()=>vi.fn()));
const primeAudio=vi.hoisted(()=>vi.fn<(element:HTMLAudioElement,done:(played:boolean)=>void)=>(()=>void)|undefined>());
vi.mock('./audio-source.js',()=>({attachAudioSource:attachSource,primeNativeLiveAudio:primeAudio}));
const url='https://media.example/videos/r/packages/p/sessions/s/master.m3u8';
function media<K extends 'video'|'audio'>(tag:K,pauseEvents?:Array<()=>void>){
 const element=document.createElement(tag);let paused=true,seeking=false,ready=4;
 Object.defineProperties(element,{paused:{get:()=>paused},seeking:{get:()=>seeking},readyState:{get:()=>ready},duration:{get:()=>120}});
 const play=vi.spyOn(element,'play').mockImplementation(()=>{paused=false;element.dispatchEvent(new Event('play'));return Promise.resolve();});
 vi.spyOn(element,'pause').mockImplementation(()=>{if(!paused){paused=true;const dispatch=()=>element.dispatchEvent(new Event('pause'));if(pauseEvents)pauseEvents.push(dispatch);else dispatch();}});
 return {element,play,setPaused:(value:boolean)=>{paused=value;},cold:()=>{ready=0;},slow:()=>{seeking=true;ready=1;},ready:()=>{seeking=false;ready=4;element.dispatchEvent(new Event('seeked'));}};
}
describe.each(['vod','live'] as const)('%s ownership',mode=>{
let hidden=false;
beforeEach(()=>{hidden=false;vi.spyOn(document,'visibilityState','get').mockImplementation(()=>hidden?'hidden':'visible');});
function setup(pauseEvents?:Array<()=>void>,pauseRef?:{current:(()=>void)|null}){
 const v=media('video',pauseEvents),a=media('audio',pauseEvents),mediaRef={current:v.element as HTMLMediaElement|null},pausedIntent={current:true};
 const options={videoRef:{current:v.element},audioRef:{current:a.element},mediaRef,pauseRef,mode,url:url.replace('master.m3u8',mode==='live'?'480p/index.m3u8':'audio/aac-hls-v1/index.m3u8'),videoUrl:url,pausedIntent,onError:vi.fn(),onReturnFailure:vi.fn(),onChange:vi.fn(),onBlocked:vi.fn()};
 const hook=renderHook(()=>useBackgroundAudio(options));
 const visibility=(value:boolean)=>act(()=>{hidden=value;document.dispatchEvent(new Event('visibilitychange'));});
 const play=()=>act(()=>hook.result.current.controls.current!.play());
 return {v,a,hook,mediaRef,pausedIntent,visibility,play,options};
}
it.skipIf(mode!=='live')('retries native audio activation on a later Play and leaves the pending gesture uninterrupted',async()=>{
 primeAudio.mockReset();
 const t=setup();
 t.play(); // Initial programmatic resume has no active gesture.
 const cancel=vi.fn();let finish!:(played:boolean)=>void;
 primeAudio.mockImplementationOnce((element,done)=>{element.muted=false;void element.play();finish=done;return cancel;});
 t.play();await act(async()=>{});
 expect(t.a.element.paused).toBe(false);expect(t.a.element.muted).toBe(false);
 act(()=>{t.a.setPaused(true);finish(true);});expect(t.a.element.muted).toBe(true);
 t.play();expect(primeAudio).toHaveBeenCalledTimes(2);expect(cancel).not.toHaveBeenCalled();
 t.hook.unmount();primeAudio.mockReset();
});
it.skipIf(mode!=='live')('loads the live companion only for background listening and releases it on return',()=>{
 attachSource.mockClear();
 const t=setup();t.play();expect(attachSource).not.toHaveBeenCalled();
 t.v.element.currentTime=24;t.visibility(true);expect(attachSource).toHaveBeenCalledOnce();
 const detach=attachSource.mock.results[0].value;
 t.a.element.currentTime=28;t.visibility(false);expect(detach).toHaveBeenCalledOnce();
 expect(t.v.element.currentTime).toBe(28);
 act(()=>t.a.element.dispatchEvent(new Event('error')));expect(t.options.onError).not.toHaveBeenCalled();
 t.visibility(true);expect(attachSource).toHaveBeenCalledTimes(2);
 t.hook.unmount();
});
it.skipIf(mode!=='live')('preserves the video bookmark when the phone unlocks before audio metadata arrives',()=>{
 const t=setup();t.a.cold();t.v.element.currentTime=24;t.play();t.visibility(true);expect(t.a.play).not.toHaveBeenCalled();
 expect(t.hook.result.current.controls.current!.snapshot().time).toBe(24);
 t.visibility(false);expect(t.v.element.currentTime).toBe(24);expect(t.v.element.paused).toBe(false);
 act(()=>t.a.element.dispatchEvent(new Event('loadedmetadata')));expect(t.mediaRef.current).toBe(t.v.element);
});
it.skipIf(mode!=='live')('starts cold background audio at the saved position only after metadata arrives',()=>{
 const t=setup();t.v.element.currentTime=48;t.play();t.a.cold();t.visibility(true);
 expect(t.a.play).not.toHaveBeenCalled();
 t.a.ready();act(()=>t.a.element.dispatchEvent(new Event('loadedmetadata')));
 expect(t.a.element.currentTime).toBe(48);expect(t.a.play).toHaveBeenCalledOnce();expect(t.a.element.muted).toBe(false);
 t.visibility(false);act(()=>t.a.element.dispatchEvent(new Event('loadedmetadata')));
 expect(t.a.play).toHaveBeenCalledOnce();
});
it('keeps foreground video authoritative and only positions muted standby on seek completion',()=>{
 const t=setup();t.v.element.currentTime=30;t.play();expect(t.v.element.muted).toBe(false);expect(t.a.element.muted).toBe(true);
 t.a.element.currentTime=2;act(()=>t.a.element.dispatchEvent(new Event('timeupdate')));expect(t.v.element.currentTime).toBe(30);expect(t.v.element.playbackRate).toBe(1);
 t.v.element.currentTime=65;act(()=>t.v.element.dispatchEvent(new Event('seeked')));expect(t.a.element.currentTime).toBe(mode==='live'?2:65);expect(t.mediaRef.current).toBe(t.v.element);
});
it.each([false,true])('freezes return target and preserves explicit paused=%s',paused=>{
 const t=setup();t.play();t.v.element.currentTime=20;t.visibility(true);expect(t.mediaRef.current).toBe(t.a.element);expect(t.v.element.paused).toBe(true);expect(t.v.element.muted).toBe(true);expect(t.a.element.muted).toBe(false);
 if(paused)act(()=>t.hook.result.current.controls.current!.pause());
 t.a.element.currentTime=40;t.v.slow();t.visibility(false);expect(t.mediaRef.current).toBe(t.v.element);expect(t.a.element.paused).toBe(true);expect(t.v.element.currentTime).toBe(40);
 t.a.element.currentTime=41;act(()=>t.a.element.dispatchEvent(new Event('timeupdate')));expect(t.v.element.currentTime).toBe(40);
 act(()=>t.v.ready());expect(t.v.element.paused).toBe(paused);expect(t.a.element.muted).toBe(true);expect(t.v.element.muted).toBe(false);
});
it('accepts a decodable nearby foreground frame without waiting for an exact keyframe',()=>{
 const t=setup();t.play();t.visibility(true);t.a.element.currentTime=40;t.v.slow();t.visibility(false);
 t.v.element.currentTime=39.5;act(()=>t.v.ready());
 expect(t.v.element.paused).toBe(false);expect(t.a.element.muted).toBe(true);
 t.hook.unmount();
});
it('reports a stuck foreground return once and fences it after another hide',()=>{
 vi.useFakeTimers();
 try {
  const t=setup();t.play();t.visibility(true);t.v.slow();t.visibility(false);
  t.visibility(true);act(()=>vi.advanceTimersByTime(15000));expect(t.options.onReturnFailure).not.toHaveBeenCalled();
  t.visibility(false);act(()=>vi.advanceTimersByTime(30000));expect(t.options.onReturnFailure).toHaveBeenCalledTimes(1);
  t.hook.unmount();
 } finally {vi.useRealTimers();}
});
it('reports a restored playing video that never presents a progressing frame',()=>{
 vi.useFakeTimers();
 try {
  const t=setup();t.play();t.visibility(true);t.visibility(false);
  act(()=>vi.advanceTimersByTime(15000));expect(t.options.onReturnFailure).toHaveBeenCalledOnce();
  t.hook.unmount();
 } finally {vi.useRealTimers();}
});
it('retains the frozen target across re-hide before a slow return seek finishes',()=>{
 const t=setup();t.play();t.visibility(true);t.a.element.currentTime=40;t.v.slow();t.visibility(false);t.v.element.currentTime=4;
 t.visibility(true);expect(t.a.element.currentTime).toBe(40);expect(t.mediaRef.current).toBe(t.a.element);
 act(()=>t.v.ready());expect(t.v.element.paused).toBe(true);expect(t.v.element.muted).toBe(true);
});
it('lets user pause and seek replace pending return intent',()=>{
 const t=setup();t.play();t.visibility(true);t.a.element.currentTime=40;t.v.slow();t.visibility(false);
 act(()=>{t.hook.result.current.controls.current!.pause();t.hook.result.current.controls.current!.seek(70);});act(()=>t.v.ready());
 expect(t.v.element.currentTime).toBe(70);expect(t.v.element.paused).toBe(true);expect(t.a.element.paused).toBe(true);expect(t.pausedIntent.current).toBe(true);
});
it('reconciles stale play completion against the newest pause and disposal',async()=>{
 const t=setup();let finish!:()=>void;t.a.play.mockImplementation(()=>new Promise<void>(resolve=>{finish=()=>{t.a.setPaused(false);resolve();};}));t.play();if(mode==='live')t.visibility(true);
 act(()=>t.hook.result.current.controls.current!.pause());await act(async()=>finish());expect(t.a.element.paused).toBe(true);expect(t.v.element.paused).toBe(true);
 t.play();t.hook.unmount();await act(async()=>finish());expect(t.a.element.paused).toBe(true);expect(t.a.element.muted).toBe(true);
});
it('carries user rate volume and mute with ownership and stops standby on external foreground pause',()=>{
 const t=setup();t.play();act(()=>{t.v.element.playbackRate=1.5;t.v.element.dispatchEvent(new Event('ratechange'));t.v.element.volume=.4;t.v.element.muted=true;t.v.element.dispatchEvent(new Event('volumechange'));});
 t.visibility(true);expect(t.a.element.playbackRate).toBe(1.5);expect(t.a.element.volume).toBe(.4);expect(t.a.element.muted).toBe(true);
 act(()=>{t.a.element.muted=false;t.a.element.dispatchEvent(new Event('volumechange'));});t.visibility(false);expect(t.v.element.muted).toBe(false);expect(t.v.element.playbackRate).toBe(1.5);
 act(()=>t.v.element.pause());expect(t.a.element.paused).toBe(true);expect(t.pausedIntent.current).toBe(true);
});
it('does not revive a failed owner after stale promise settlement',async()=>{
 const t=setup();let finish!:()=>void;t.v.play.mockImplementation(()=>new Promise<void>(resolve=>{finish=()=>{t.v.setPaused(false);resolve();};}));t.play();act(()=>t.hook.result.current.controls.current!.stop());await act(async()=>finish());
 expect(t.v.element.paused).toBe(true);expect(t.a.element.paused).toBe(true);expect(t.v.element.muted).toBe(true);expect(t.a.element.muted).toBe(true);
});

it('consumes each queued internal pause without replacing the latest play intent',()=>{
 const queued:Array<()=>void>=[],t=setup(queued);t.play();
 t.visibility(true);t.visibility(false);t.visibility(true);t.visibility(false);
 expect(queued).toHaveLength(4);expect(t.pausedIntent.current).toBe(false);
 act(()=>{while(queued.length)queued.shift()!();});
 expect(t.pausedIntent.current).toBe(false);expect(t.v.element.paused).toBe(false);expect(t.a.element.paused).toBe(mode==='live');expect(t.v.element.muted).toBe(false);expect(t.a.element.muted).toBe(true);
 act(()=>{t.v.element.pause();while(queued.length)queued.shift()!();});
 expect(t.pausedIntent.current).toBe(true);expect(t.a.element.paused).toBe(true);
});

it('hands off after iPhone pauses foreground video before visibility becomes hidden',()=>{
 const t=setup(undefined,{current:null});t.play();t.v.element.currentTime=17.5;
 act(()=>{t.a.setPaused(true);t.v.setPaused(true);t.v.element.dispatchEvent(new Event('pause'));});
 expect(t.hook.result.current.paused).toBe(true);
 expect(t.pausedIntent.current).toBe(false);
 t.visibility(true);
 expect(t.a.element.currentTime).toBe(17.5);expect(t.a.element.paused).toBe(false);expect(t.a.element.muted).toBe(false);
 expect(t.v.element.paused).toBe(true);expect(t.v.element.muted).toBe(true);
 t.a.element.currentTime=30;t.visibility(false);
 expect(t.v.element.currentTime).toBe(30);expect(t.v.element.paused).toBe(false);expect(t.a.element.muted).toBe(true);
});

it('shows an interrupted foreground as paused without clearing handoff intent, and explicit Play recovers',()=>{
 const t=setup(undefined,{current:null});t.play();
 act(()=>{t.v.setPaused(true);t.v.element.dispatchEvent(new Event('pause'));});
 expect(t.hook.result.current.paused).toBe(true);expect(t.a.element.paused).toBe(true);expect(t.pausedIntent.current).toBe(false);
 expect(t.hook.result.current.controls.current!.snapshot().paused).toBe(true);
 t.play();expect(t.hook.result.current.paused).toBe(false);expect(t.v.element.paused).toBe(false);
});

it('an authority stop between native pause and hide fences late play completion',async()=>{
 const pauseRef:{current:(()=>void)|null}={current:null},t=setup(undefined,pauseRef);let finish!:()=>void;
 t.a.play.mockImplementation(()=>new Promise<void>(resolve=>{finish=()=>{t.a.setPaused(false);resolve();};}));t.play();
 act(()=>{t.v.setPaused(true);t.v.element.dispatchEvent(new Event('pause'));});
 expect(pauseRef.current).toBeTypeOf('function');act(()=>pauseRef.current!());t.visibility(true);
 if(mode==='vod')await act(async()=>finish());else expect(t.a.play).not.toHaveBeenCalled();expect(t.pausedIntent.current).toBe(true);expect(t.v.element.paused).toBe(true);expect(t.a.element.paused).toBe(true);
 t.visibility(false);expect(t.v.element.paused).toBe(true);t.hook.unmount();expect(pauseRef.current).toBeNull();
});

it('does not resume a background audio interruption on unlock',()=>{
 const t=setup(undefined,{current:null});t.play();t.visibility(true);
 act(()=>{t.a.setPaused(true);t.a.element.dispatchEvent(new Event('pause'));});t.visibility(false);
 expect(t.pausedIntent.current).toBe(true);expect(t.v.element.paused).toBe(true);expect(t.a.element.paused).toBe(true);
});

});
