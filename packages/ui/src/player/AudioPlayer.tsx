'use client';

import {useEffect,useRef,useState,type RefObject} from 'react';
import type Hls from 'hls.js';
import type {PlayerBookmark} from './live-player.js';
import {verifyMediaRequest} from './media-request.js';

export type AudioPlayerProps={playbackUrl:string;title:string;artwork?:string;audioRef:RefObject<HTMLAudioElement|null>;resume?:PlayerBookmark;labels:{playbackSpeed:string;tapToPlay:string};onBookmark?:(bookmark:PlayerBookmark)=>void;onError:(bookmark?:PlayerBookmark)=>void};
export function AudioPlayer({playbackUrl,title,artwork,audioRef,resume,labels,onBookmark,onError}:AudioPlayerProps){
 const callbacks=useRef({onBookmark,onError}),initial=useRef(resume);
 const controls=useRef<{play:()=>void;pause:()=>void}|null>(null);
 const [blocked,setBlocked]=useState(false),[rate,setRate]=useState(resume?.rate??1);
 useEffect(()=>{callbacks.current={onBookmark,onError};initial.current=resume;},[onBookmark,onError,resume]);
 useEffect(()=>{
  const audio=audioRef.current;if(!audio)return;
  let disposed=false,failed=false,positioned=false,engine:Hls|undefined;
  const saved=initial.current;
  let pausedIntent=saved?.paused??true,playGeneration=0;
  setBlocked(false);
  const bookmark=():PlayerBookmark=>({time:positioned?audio.currentTime:saved?.time??0,paused:pausedIntent,rate:positioned?audio.playbackRate:saved?.rate??1,quality:saved?.quality??'auto',intent:'dvr'});
  const remember=()=>{if(positioned&&!disposed&&!failed)callbacks.current.onBookmark?.(bookmark());};
  const fail=()=>{if(disposed||failed)return;failed=true;callbacks.current.onError(positioned||saved?bookmark():undefined);};
  const play=()=>{
   if(disposed||failed)return;
   pausedIntent=false;const generation=++playGeneration;setBlocked(false);remember();
   void audio.play().catch(()=>{if(!disposed&&!failed&&generation===playGeneration&&!pausedIntent)setBlocked(true);});
  };
  const paused=()=>{pausedIntent=true;playGeneration++;setBlocked(false);remember();};
  const pause=()=>{if(disposed||failed)return;paused();audio.pause();};
  const currentControls={play,pause};controls.current=currentControls;
  const position=()=>{
   if(positioned||disposed||failed)return;
   if(!Number.isFinite(audio.duration)||audio.duration<=0)return;
   audio.currentTime=Math.max(0,Math.min(audio.duration,saved?.time??0));
   audio.playbackRate=saved?.rate??1;positioned=true;remember();
   if(!pausedIntent)play();
  };
  const speed=()=>{setRate(audio.playbackRate);remember();};
  const playing=()=>{pausedIntent=false;setBlocked(false);remember();};
  const events:[string,()=>void][]=[['loadedmetadata',position],['durationchange',position],['canplay',position],['timeupdate',remember],['seeked',remember],['ratechange',speed],['play',playing],['pause',paused],['ended',paused],['error',fail]];
  for(const [event,handler] of events)audio.addEventListener(event,handler);
  try{
   const url=new URL(playbackUrl);
   if(!url.pathname.endsWith('/audio/aac-hls-v1/index.m3u8'))throw new Error('Invalid audio playlist');
   verifyMediaRequest(playbackUrl,playbackUrl,true);
   if(audio.canPlayType('application/vnd.apple.mpegurl')){audio.src=playbackUrl;audio.load();}
   else void import('hls.js').then(({default:Hls})=>{
    if(disposed||failed)return;if(!Hls.isSupported()){fail();return;}
    engine=new Hls({enableWorker:true,maxBufferLength:60,maxMaxBufferLength:120,
     xhrSetup:(xhr,target)=>{verifyMediaRequest(playbackUrl,target,true);xhr.withCredentials=true;},
     fetchSetup:(context,init)=>{verifyMediaRequest(playbackUrl,context.url,true);return new Request(context.url,{...init,credentials:'include',redirect:'error',referrerPolicy:'no-referrer'});},
    });
    engine.on(Hls.Events.ERROR,(_event,data)=>{if(data.fatal)fail();});engine.loadSource(playbackUrl);engine.attachMedia(audio);
   }).catch(fail);
  }catch{fail();}
  return()=>{remember();disposed=true;playGeneration++;if(controls.current===currentControls)controls.current=null;for(const [event,handler] of events)audio.removeEventListener(event,handler);audio.pause();engine?.destroy();audio.removeAttribute('src');audio.load();};
 },[playbackUrl,audioRef]);
 useEffect(()=>{
  const audio=audioRef.current,session=navigator.mediaSession;
  if(!audio||!session)return;
  const metadata=typeof MediaMetadata==='function'?new MediaMetadata({title,...(artwork?{artwork:[{src:artwork}]}:{})}):null;
  session.metadata=metadata;
  const seek=(time:number)=>{if(Number.isFinite(time)&&Number.isFinite(audio.duration))audio.currentTime=Math.max(0,Math.min(audio.duration,time));};
  const handlers:Partial<Record<MediaSessionAction,MediaSessionActionHandler>>={play:()=>controls.current?.play(),pause:()=>controls.current?.pause(),seekbackward:event=>seek(audio.currentTime-(event.seekOffset??10)),seekforward:event=>seek(audio.currentTime+(event.seekOffset??10)),seekto:event=>{if(event.seekTime!==undefined)seek(event.seekTime);}};
  for(const [action,handler] of Object.entries(handlers))try{session.setActionHandler(action as MediaSessionAction,handler!);}catch{/* Some native surfaces omit seek actions. */}
  const update=()=>{
   session.playbackState=audio.paused?'paused':'playing';
   if(Number.isFinite(audio.duration)&&audio.duration>0&&audio.playbackRate>0)try{session.setPositionState?.({duration:audio.duration,playbackRate:audio.playbackRate,position:Math.max(0,Math.min(audio.currentTime,audio.duration))});}catch{/* Older browsers expose only part of Media Session. */}
  };
  const events=['timeupdate','play','pause','durationchange','ratechange'];for(const event of events)audio.addEventListener(event,update);update();
  return()=>{for(const event of events)audio.removeEventListener(event,update);for(const action of Object.keys(handlers))try{session.setActionHandler(action as MediaSessionAction,null);}catch{}if(session.metadata===metadata){session.metadata=null;session.playbackState='none';try{session.setPositionState?.();}catch{}}};
 },[audioRef,title,artwork,playbackUrl]);
 return <div role="region" aria-label={title}>
  <audio ref={audioRef} controls crossOrigin="use-credentials" preload="metadata" aria-label={title} style={{width:'100%'}}/>
  <label>{labels.playbackSpeed} <select aria-label={labels.playbackSpeed} value={rate} onChange={event=>{if(audioRef.current)audioRef.current.playbackRate=Number(event.target.value);}}>{[.5,.75,1,1.25,1.5,1.75,2].map(value=><option key={value} value={value}>{value}×</option>)}</select></label>
  {blocked?<p role="status">{labels.tapToPlay}</p>:null}
 </div>;
}
