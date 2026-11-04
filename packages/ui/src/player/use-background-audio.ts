import {useEffect,useRef,useState,type RefObject} from 'react';
import {attachAudioSource} from './audio-source.js';

export type BackgroundControls={play:()=>void;pause:()=>void;seek:(time:number)=>void;hold:(time:number)=>void;stop:()=>void;snapshot:()=>{time:number;paused:boolean;rate:number};settings:(value:{muted?:boolean;volume?:number;rate?:number})=>void};
type Options={audioRef:RefObject<HTMLAudioElement|null>;videoRef:RefObject<HTMLVideoElement|null>;mediaRef:RefObject<HTMLMediaElement|null>;externalRef?:RefObject<HTMLMediaElement|null>;url:string|undefined;videoUrl:string;pausedIntent:RefObject<boolean>;onError:()=>void;onChange:()=>void;onBlocked:()=>void};
export function useBackgroundAudio(options:Options){
 const callbacks=useRef(options);callbacks.current=options;
 const controls=useRef<BackgroundControls|null>(null);
 const [state,setState]=useState({owner:0,paused:true,muted:false,volume:1});
 const {audioRef,videoRef,mediaRef,externalRef,url,videoUrl,pausedIntent}=options;
 useEffect(()=>{
  const audio=audioRef.current,video=videoRef.current;if(!audio||!video||!url)return;
  let phase:'foreground'|'background'|'returning'='foreground',disposed=false,stopped=false,armed=false,generation=0;
  let pending:{token:number;target:number}|null=null;
  let userMuted=video.muted,volume=video.volume,rate=video.playbackRate;
  const expectedPause=new WeakSet<HTMLMediaElement>();
  const owner=()=>phase==='background'?audio:video;
  const pause=(element:HTMLMediaElement)=>{if(!element.paused){expectedPause.add(element);element.pause();}};
  const publish=()=>{
   mediaRef.current=owner();if(externalRef)externalRef.current=owner();
   setState(previous=>{const next={owner:phase==='background'?1:0,paused:pausedIntent.current||!armed,muted:userMuted,volume};return previous.owner===next.owner&&previous.paused===next.paused&&previous.muted===next.muted&&previous.volume===next.volume?previous:next;});
   callbacks.current.onChange();
  };
  const wanted=(element:HTMLMediaElement)=>!disposed&&!stopped&&armed&&!pausedIntent.current&&phase!=='returning'&&(element===audio||phase==='foreground');
  const reconcile=()=>{
   const videoMuted=disposed||stopped||phase!=='foreground'||userMuted,audioMuted=disposed||stopped||phase!=='background'||userMuted;
   if(video.muted!==videoMuted)video.muted=videoMuted;if(audio.muted!==audioMuted)audio.muted=audioMuted;
   for(const element of [video,audio]){if(element.volume!==volume)element.volume=volume;if(element.playbackRate!==rate)element.playbackRate=rate;if(!wanted(element))pause(element);}
  };
  const play=(element:HTMLMediaElement)=>{
   const token=generation;
   void element.play().then(reconcile).catch(()=>{if(!disposed&&!stopped&&token===generation&&wanted(element)&&element===owner()){pausedIntent.current=true;reconcile();publish();callbacks.current.onBlocked();}});
  };
  const run=()=>{reconcile();if(wanted(audio))play(audio);if(wanted(video))play(video);};
  const position=(element:HTMLMediaElement,time:number)=>{if(element.readyState&&Number.isFinite(time))element.currentTime=Math.max(0,Number.isFinite(element.duration)?Math.min(element.duration,time):time);};
  const ready=()=>{
   const target=pending;
   if(disposed||stopped||phase!=='returning'||!target||target.token!==generation||document.visibilityState==='hidden'||video.seeking||video.readyState<2||Math.abs(video.currentTime-target.target)>.1)return;
   pending=null;phase='foreground';position(audio,video.currentTime);run();publish();
  };
  const api:BackgroundControls={
   play:()=>{if(disposed||stopped)return;++generation;if(pending)pending.token=generation;pausedIntent.current=false;armed=true;if(phase==='foreground')position(audio,video.currentTime);run();publish();ready();},
   pause:()=>{++generation;if(pending)pending.token=generation;pausedIntent.current=true;reconcile();publish();},
   seek:time=>{++generation;if(pending)pending={token:generation,target:time};position(owner(),time);if(phase==='foreground')position(audio,time);publish();ready();},
   hold:time=>{if(phase==='background')return;++generation;phase='returning';pending={token:generation,target:time};reconcile();publish();},
   settings:value=>{if(value.muted!==undefined)userMuted=value.muted;if(value.volume!==undefined)volume=value.volume;if(value.rate!==undefined)rate=value.rate;reconcile();publish();},
   snapshot:()=>({time:pending?.target??owner().currentTime,paused:pausedIntent.current,rate}),
   stop:()=>{stopped=true;++generation;pending=null;reconcile();},
  };
  controls.current=api;
  const visibility=()=>{
   if(stopped||disposed)return;
   ++generation;
   if(document.visibilityState==='hidden'){
    if(phase==='background')return;
    const target=pending?.target??video.currentTime;
    userMuted=phase==='foreground'?video.muted:userMuted;volume=video.volume;rate=video.playbackRate;
    phase='background';pending=null;reconcile();position(audio,target);publish();if(armed&&wanted(audio))play(audio);
   }else if(phase==='background'){
    // An OS interruption is not a new play command.
    if(armed&&audio.paused)pausedIntent.current=true;
    userMuted=audio.muted;volume=audio.volume;rate=audio.playbackRate;
    phase='returning';pending={token:generation,target:audio.currentTime};reconcile();position(video,pending.target);publish();ready();
   }
  };
  const listeners:Array<[HTMLMediaElement,string,()=>void]>=[];
  const listen=(element:HTMLMediaElement,event:string,handler:()=>void)=>{element.addEventListener(event,handler);listeners.push([element,event,handler]);};
  for(const element of [video,audio]){
   listen(element,'pause',()=>{if(expectedPause.delete(element)||disposed||stopped||element!==owner()||phase==='returning')return;api.pause();});
   listen(element,'ended',()=>{if(element===owner())api.pause();});
   listen(element,'volumechange',()=>{if(element!==owner()||phase==='returning'||disposed)return;userMuted=element.muted;volume=element.volume;reconcile();publish();});
   listen(element,'ratechange',()=>{if(element!==owner()||disposed)return;rate=element.playbackRate;reconcile();publish();});
   listen(element,'timeupdate',()=>{if(element===owner())publish();});
  }
  listen(video,'seeked',()=>{if(phase==='foreground')position(audio,video.currentTime);ready();});
  for(const event of ['loadedmetadata','canplay','loadeddata'])listen(video,event,()=>{if(pending&&video.readyState&&Math.abs(video.currentTime-pending.target)>.1)position(video,pending.target);ready();});
  listen(audio,'loadedmetadata',()=>{if(phase==='foreground')position(audio,video.currentTime);});
  const fail=()=>{if(!disposed&&!stopped){callbacks.current.onError();api.stop();}};
  listen(audio,'error',fail);
  document.addEventListener('visibilitychange',visibility);
  reconcile();publish();if(document.visibilityState==='hidden')visibility();
  let detach=()=>{};
  if(url!==new URL('audio/aac-hls-v1/index.m3u8',videoUrl).href)fail();else detach=attachAudioSource(audio,url,fail);
  return()=>{disposed=true;++generation;for(const [element,event,handler]of listeners)element.removeEventListener(event,handler);document.removeEventListener('visibilitychange',visibility);if(controls.current===api)controls.current=null;reconcile();detach();};
 },[audioRef,videoRef,mediaRef,externalRef,url,videoUrl,pausedIntent]);
 return {controls,...state};
}
