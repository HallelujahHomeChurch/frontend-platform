'use client';

import {useEffect,useRef,useState,type RefObject} from 'react';
import {useAudioSession} from './use-audio-session.js';
import {attachAudioSource} from './audio-source.js';
import type {PlayerBookmark} from './live-player.js';

export type AudioPlayerProps={playbackUrl:string;title:string;artwork?:string;audioRef:RefObject<HTMLAudioElement|null>;resume?:PlayerBookmark;labels:{playbackSpeed:string;tapToPlay:string};onBookmark?:(bookmark:PlayerBookmark)=>void;onError:(bookmark?:PlayerBookmark)=>void};
export function AudioPlayer({playbackUrl,title,artwork,audioRef,resume,labels,onBookmark,onError}:AudioPlayerProps){
 const callbacks=useRef({onBookmark,onError}),initial=useRef(resume);
 const controls=useRef<{play:()=>void;pause:()=>void}|null>(null);
 const [blocked,setBlocked]=useState(false),[rate,setRate]=useState(resume?.rate??1);
 useEffect(()=>{callbacks.current={onBookmark,onError};initial.current=resume;},[onBookmark,onError,resume]);
 useEffect(()=>{
  const audio=audioRef.current;if(!audio)return;
  let disposed=false,failed=false,positioned=false;
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
  const detach=attachAudioSource(audio,playbackUrl,fail);
  return()=>{remember();disposed=true;playGeneration++;if(controls.current===currentControls)controls.current=null;for(const [event,handler] of events)audio.removeEventListener(event,handler);detach();};
 },[playbackUrl,audioRef]);
 useAudioSession(audioRef,title,artwork,playbackUrl,()=>controls.current?.play(),()=>controls.current?.pause());
 return <div role="region" aria-label={title}>
  <audio ref={audioRef} controls crossOrigin="use-credentials" preload="metadata" aria-label={title} style={{width:'100%'}}/>
  <label>{labels.playbackSpeed} <select aria-label={labels.playbackSpeed} value={rate} onChange={event=>{if(audioRef.current)audioRef.current.playbackRate=Number(event.target.value);}}>{[.5,.75,1,1.25,1.5,1.75,2].map(value=><option key={value} value={value}>{value}×</option>)}</select></label>
  {blocked?<p role="status">{labels.tapToPlay}</p>:null}
 </div>;
}
