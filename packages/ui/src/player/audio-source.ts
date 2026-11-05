import type Hls from 'hls.js';
import {LIVE_HOLDBACK_SECONDS} from './live-player.js';
import {verifyMediaRequest} from './media-request.js';

// Native first; live uses only the existing protected 480p rendition.
export function attachAudioSource(audio:HTMLAudioElement,playbackUrl:string,onError:()=>void,liveMaster?:string){
 let disposed=false,engine:Hls|undefined;
 const verify=(target:string)=>{if(liveMaster){verifyMediaRequest(liveMaster,target);const url=new URL(target,liveMaster);if(!url.pathname.startsWith(new URL('480p/',liveMaster).pathname))throw new Error('Invalid live companion request');}else verifyMediaRequest(playbackUrl,target,true);};
 const fail=()=>{if(!disposed)onError();};
 try{
  if(liveMaster?playbackUrl!==new URL('480p/index.m3u8',liveMaster).href:!new URL(playbackUrl).pathname.endsWith('/audio/aac-hls-v1/index.m3u8'))throw new Error('Invalid audio playlist');
  verify(playbackUrl);
  if(audio.canPlayType('application/vnd.apple.mpegurl')){audio.src=playbackUrl;audio.load();}
  else void import('hls.js').then(({default:Hls})=>{
   if(disposed)return;if(!Hls.isSupported()){fail();return;}
   const LatencyController=liveMaster?Hls.DefaultConfig.latencyController!:null;
   engine=new Hls({enableWorker:true,maxBufferLength:60,maxMaxBufferLength:120,
    ...(liveMaster?{backBufferLength:120,lowLatencyMode:false,liveSyncDuration:LIVE_HOLDBACK_SECONDS,liveMaxLatencyDuration:Infinity,maxLiveSyncPlaybackRate:1,latencyController:class extends LatencyController! {override get liveSyncPosition():number|null{return null;}}}:{}),
    xhrSetup:(xhr,target)=>{verify(target);xhr.withCredentials=true;},
    fetchSetup:(context,init)=>{verify(context.url);return new Request(context.url,{...init,credentials:'include',redirect:'error',referrerPolicy:'no-referrer'});},
   });
   engine.on(Hls.Events.ERROR,(_event,data)=>{if(data.fatal)fail();});engine.loadSource(playbackUrl);engine.attachMedia(audio);
  }).catch(fail);
 }catch{fail();}
 return()=>{disposed=true;audio.pause();engine?.destroy();audio.removeAttribute('src');audio.load();};
}
