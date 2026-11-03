import {useEffect,useRef,type RefObject} from 'react';
import {attachAudioSource} from './audio-source.js';
import type {PlayerBookmark} from './live-player.js';

export function useBackgroundAudio(audioRef:RefObject<HTMLAudioElement|null>,videoRef:RefObject<HTMLVideoElement|null>,url:string|undefined,videoUrl:string,resume:PlayerBookmark|undefined,onError:()=>void,onChange:()=>void){
 const callbacks=useRef({onError,onChange});callbacks.current={onError,onChange};
 const initial=useRef(resume);
 useEffect(()=>{
  const audio=audioRef.current,video=videoRef.current;if(!audio||!video||!url)return;
  let disposed=false,positioned=false,lastSync=-Infinity,lastSeek=-Infinity;
  audio.playbackRate=initial.current?.rate??1;
  const fail=()=>{if(!disposed)callbacks.current.onError();};
  const sync=(force=false)=>{
   if(disposed||document.visibilityState==='hidden')return;
   const now=performance.now();if(!force&&now-lastSync<1000)return;lastSync=now;
   const drift=audio.currentTime-video.currentTime;
   const seek=force?Math.abs(drift)>.05:Math.abs(drift)>2&&now-lastSeek>=5000;
   if(video.readyState&&!video.seeking&&seek){video.currentTime=audio.currentTime;lastSeek=now;}
   // Re-seeking on decoder readiness can prevent native HLS from ever catching the moving audio clock.
   const correction=!force&&!seek&&!audio.paused&&!video.seeking&&Math.abs(drift)>.05?Math.max(-.05,Math.min(.05,drift*.1)):0;
   video.playbackRate=audio.playbackRate*(1+correction);
   if(audio.paused)video.pause();else if(video.paused)void video.play().then(()=>{if(disposed||document.visibilityState==='hidden'||audio.paused)video.pause();}).catch(()=>{});
  };
  const position=()=>{
   if(positioned||!Number.isFinite(audio.duration)||audio.duration<=0)return;
   positioned=true;audio.currentTime=Math.max(0,Math.min(audio.duration,initial.current?.time??0));
   sync(true);callbacks.current.onChange();
  };
  const changed=()=>{sync(true);callbacks.current.onChange();};
  const progress=()=>{sync();callbacks.current.onChange();};
  const visibility=()=>{if(document.visibilityState==='hidden')video.pause();else sync(true);};
  const events:[string,()=>void][]=[['loadedmetadata',position],['durationchange',position],['play',changed],['pause',changed],['ended',changed],['waiting',()=>video.pause()],['playing',changed],['ratechange',changed],['seeked',changed],['seeking',changed],['timeupdate',progress],['error',fail]];
  for(const [event,handler] of events)audio.addEventListener(event,handler);
  const restore=()=>sync(true),ready=()=>sync();video.addEventListener('loadedmetadata',restore);video.addEventListener('canplay',ready);
  document.addEventListener('visibilitychange',visibility);
  let detach=()=>{};
  // A sibling session's otherwise-valid audio directory must never be accepted.
  if(url!==new URL('audio/aac-hls-v1/index.m3u8',videoUrl).href)fail();
  else detach=attachAudioSource(audio,url,fail);
  return()=>{disposed=true;for(const [event,handler] of events)audio.removeEventListener(event,handler);video.removeEventListener('loadedmetadata',restore);video.removeEventListener('canplay',ready);document.removeEventListener('visibilitychange',visibility);detach();video.pause();};
 },[audioRef,videoRef,url,videoUrl]);
}
