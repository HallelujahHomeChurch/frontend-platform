import type Hls from 'hls.js';
import {LIVE_HOLDBACK_SECONDS} from './live-player.js';
import {verifyMediaRequest} from './media-request.js';

// WebKit grants audible playback per element. Prime the same element inside the
// Play gesture with 10 ms of local PCM silence (8 kHz mono), without a media request.
export function primeNativeLiveAudio(audio:HTMLAudioElement,onFinished:(played:boolean)=>void):(()=>void)|undefined {
 if(!audio.canPlayType('application/vnd.apple.mpegurl')||!URL.createObjectURL||navigator.userActivation?.isActive===false)return;
 const samples=Uint8Array.from(atob('UklGRnQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YVAAAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA=='),c=>c.charCodeAt(0));
 const url=URL.createObjectURL(new Blob([samples],{type:'audio/wav'}));
 let active=true;
 const release=()=>{
  if(!active)return;
  active=false;URL.revokeObjectURL(url);
  if(audio.getAttribute('src')===url){audio.pause();audio.removeAttribute('src');audio.muted=true;audio.load();}
 };
 audio.src=url;audio.muted=false;
 const finish=(played:boolean)=>{if(active){release();onFinished(played);}};
 void audio.play().then(()=>finish(true),()=>finish(false));
 return release;
}

// VOD stays native first; live matches the video backend for the same timeline.
export function attachAudioSource(audio:HTMLAudioElement,playbackUrl:string,onError:()=>void,liveMaster?:string,startPosition?:number){
 let disposed=false,engine:Hls|undefined;
 const verify=(target:string)=>{if(liveMaster){verifyMediaRequest(liveMaster,target);const url=new URL(target,liveMaster);if(!url.pathname.startsWith(new URL('480p/',liveMaster).pathname))throw new Error('Invalid live companion request');}else verifyMediaRequest(playbackUrl,target,true);};
 const fail=()=>{if(!disposed)onError();};
 try{
  if(liveMaster?playbackUrl!==new URL('480p/index.m3u8',liveMaster).href:!new URL(playbackUrl).pathname.endsWith('/audio/aac-hls-v1/index.m3u8'))throw new Error('Invalid audio playlist');
  verify(playbackUrl);
  const native=audio.canPlayType('application/vnd.apple.mpegurl');
  if(native&&(!liveMaster||'ManagedMediaSource' in window)){audio.src=playbackUrl;audio.load();}
  else void import('hls.js').then(({default:Hls})=>{
   if(disposed)return;if(!Hls.isSupported()){if(native){audio.src=playbackUrl;audio.load();}else fail();return;}
   const LatencyController=liveMaster?Hls.DefaultConfig.latencyController!:null;
   engine=new Hls({enableWorker:true,maxBufferLength:60,maxMaxBufferLength:120,
    ...(liveMaster?{startPosition,backBufferLength:120,lowLatencyMode:false,liveSyncDuration:LIVE_HOLDBACK_SECONDS,liveMaxLatencyDuration:Infinity,maxLiveSyncPlaybackRate:1,latencyController:class extends LatencyController! {override get liveSyncPosition():number|null{return null;}}}:{}),
    xhrSetup:(xhr,target)=>{verify(target);xhr.withCredentials=true;},
    fetchSetup:(context,init)=>{verify(context.url);return new Request(context.url,{...init,credentials:'include',redirect:'error',referrerPolicy:'no-referrer'});},
   });
   engine.on(Hls.Events.ERROR,(_event,data)=>{if(data.fatal)fail();});engine.loadSource(playbackUrl);engine.attachMedia(audio);
  }).catch(fail);
 }catch{fail();}
 return()=>{disposed=true;audio.pause();engine?.destroy();audio.removeAttribute('src');audio.load();};
}
