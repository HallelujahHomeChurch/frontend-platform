import {act,renderHook} from '@testing-library/react';
import {beforeEach,expect,it,vi} from 'vitest';
import {useBackgroundAudio} from './use-background-audio.js';
vi.mock('./audio-source.js',()=>({attachAudioSource:()=>()=>{}}));
const url='https://media.example/videos/r/packages/p/sessions/s/master.m3u8';
function media<K extends 'video'|'audio'>(tag:K){
 const element=document.createElement(tag);let paused=true,seeking=false,ready=4;
 Object.defineProperties(element,{paused:{get:()=>paused},seeking:{get:()=>seeking},readyState:{get:()=>ready},duration:{get:()=>120}});
 const play=vi.spyOn(element,'play').mockImplementation(()=>{paused=false;element.dispatchEvent(new Event('play'));return Promise.resolve();});
 vi.spyOn(element,'pause').mockImplementation(()=>{if(!paused){paused=true;element.dispatchEvent(new Event('pause'));}});
 return {element,play,setPaused:(value:boolean)=>{paused=value;},slow:()=>{seeking=true;ready=1;},ready:()=>{seeking=false;ready=4;element.dispatchEvent(new Event('seeked'));}};
}
let hidden=false;
beforeEach(()=>{hidden=false;vi.spyOn(document,'visibilityState','get').mockImplementation(()=>hidden?'hidden':'visible');});
function setup(){
 const v=media('video'),a=media('audio'),mediaRef={current:v.element as HTMLMediaElement|null},pausedIntent={current:true};
 const options={videoRef:{current:v.element},audioRef:{current:a.element},mediaRef,url:url.replace('master.m3u8','audio/aac-hls-v1/index.m3u8'),videoUrl:url,pausedIntent,onError:vi.fn(),onChange:vi.fn(),onBlocked:vi.fn()};
 const hook=renderHook(()=>useBackgroundAudio(options));
 const visibility=(value:boolean)=>act(()=>{hidden=value;document.dispatchEvent(new Event('visibilitychange'));});
 const play=()=>act(()=>hook.result.current.controls.current!.play());
 return {v,a,hook,mediaRef,pausedIntent,visibility,play,options};
}
it('keeps foreground video authoritative and only positions muted standby on seek completion',()=>{
 const t=setup();t.v.element.currentTime=30;t.play();expect(t.v.element.muted).toBe(false);expect(t.a.element.muted).toBe(true);
 t.a.element.currentTime=2;act(()=>t.a.element.dispatchEvent(new Event('timeupdate')));expect(t.v.element.currentTime).toBe(30);expect(t.v.element.playbackRate).toBe(1);
 t.v.element.currentTime=65;act(()=>t.v.element.dispatchEvent(new Event('seeked')));expect(t.a.element.currentTime).toBe(65);expect(t.mediaRef.current).toBe(t.v.element);
});
it.each([false,true])('freezes return target and preserves explicit paused=%s',paused=>{
 const t=setup();t.play();t.v.element.currentTime=20;t.visibility(true);expect(t.mediaRef.current).toBe(t.a.element);expect(t.v.element.paused).toBe(true);expect(t.v.element.muted).toBe(true);expect(t.a.element.muted).toBe(false);
 if(paused)act(()=>t.hook.result.current.controls.current!.pause());
 t.a.element.currentTime=40;t.v.slow();t.visibility(false);expect(t.mediaRef.current).toBe(t.v.element);expect(t.a.element.paused).toBe(true);expect(t.v.element.currentTime).toBe(40);
 t.a.element.currentTime=41;act(()=>t.a.element.dispatchEvent(new Event('timeupdate')));expect(t.v.element.currentTime).toBe(40);
 act(()=>t.v.ready());expect(t.v.element.paused).toBe(paused);expect(t.a.element.muted).toBe(true);expect(t.v.element.muted).toBe(false);
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
 const t=setup();let finish!:()=>void;t.a.play.mockImplementation(()=>new Promise<void>(resolve=>{finish=()=>{t.a.setPaused(false);resolve();};}));t.play();
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
