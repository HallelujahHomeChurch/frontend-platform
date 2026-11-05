import {liveWindow,type LivePlayerState} from './live-player.js';
import {useEffect,useRef,type RefObject} from 'react';
export function useAudioSession(audioRef:RefObject<HTMLMediaElement|null>,title:string,artwork:string|undefined,playbackUrl:string|undefined,play:()=>void,pause:()=>void,owner?:number,onSeek?:(time:number)=>void,live?:LivePlayerState){
 const actions=useRef({play,pause,onSeek,live});actions.current={play,pause,onSeek,live};
 useEffect(()=>{
  const audio=audioRef.current,session=navigator.mediaSession;
  if(!audio||!session||!playbackUrl)return;
  const metadata=typeof MediaMetadata==='function'?new MediaMetadata({title,...(artwork?{artwork:[{src:artwork}]}:{})}):null;
  session.metadata=metadata;
  const seek=(time:number)=>{
   const current=audioRef.current;if(!current||!Number.isFinite(time))return;
   const live=actions.current.live,range=live?liveWindow(current.seekable,live.verifiedEnd):null;
   const bounds=live?(range?{start:range.start,end:live.ended?range.end:range.edge}:null):Number.isFinite(current.duration)?{start:0,end:current.duration}:null;
   if(!bounds)return;
   const target=Math.max(bounds.start,Math.min(bounds.end,time));
   if(actions.current.onSeek)actions.current.onSeek(target);else current.currentTime=target;
  };
  const handlers:Partial<Record<MediaSessionAction,MediaSessionActionHandler>>={play:()=>actions.current.play(),pause:()=>actions.current.pause(),seekbackward:event=>seek((audioRef.current?.currentTime??0)-(event.seekOffset??10)),seekforward:event=>seek((audioRef.current?.currentTime??0)+(event.seekOffset??10)),seekto:event=>{if(event.seekTime!==undefined)seek(event.seekTime);}};
  for(const [action,handler] of Object.entries(handlers))try{session.setActionHandler(action as MediaSessionAction,handler!);}catch{/* Some native surfaces omit seek actions. */}
  const update=()=>{
   session.playbackState=audio.paused?'paused':'playing';
   if(Number.isFinite(audio.duration)&&audio.duration>0&&audio.playbackRate>0)try{session.setPositionState?.({duration:audio.duration,playbackRate:audio.playbackRate,position:Math.max(0,Math.min(audio.currentTime,audio.duration))});}catch{/* Older browsers expose only part of Media Session. */}
  };
  const events=['timeupdate','play','pause','durationchange','ratechange'];for(const event of events)audio.addEventListener(event,update);update();
  return()=>{for(const event of events)audio.removeEventListener(event,update);for(const action of Object.keys(handlers))try{session.setActionHandler(action as MediaSessionAction,null);}catch{}if(session.metadata===metadata){session.metadata=null;session.playbackState='none';try{session.setPositionState?.();}catch{}}};
 },[audioRef,title,artwork,playbackUrl,owner]);
}
