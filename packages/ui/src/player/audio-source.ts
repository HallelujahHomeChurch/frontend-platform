import type Hls from 'hls.js';
import {verifyMediaRequest} from './media-request.js';

// Shared native-first transport. Every HLS request stays within this audio directory.
export function attachAudioSource(audio:HTMLAudioElement,playbackUrl:string,onError:()=>void){
 let disposed=false,engine:Hls|undefined;
 const fail=()=>{if(!disposed)onError();};
 try{
  if(!new URL(playbackUrl).pathname.endsWith('/audio/aac-hls-v1/index.m3u8'))throw new Error('Invalid audio playlist');
  verifyMediaRequest(playbackUrl,playbackUrl,true);
  if(audio.canPlayType('application/vnd.apple.mpegurl')){audio.src=playbackUrl;audio.load();}
  else void import('hls.js').then(({default:Hls})=>{
   if(disposed)return;if(!Hls.isSupported()){fail();return;}
   engine=new Hls({enableWorker:true,maxBufferLength:60,maxMaxBufferLength:120,
    xhrSetup:(xhr,target)=>{verifyMediaRequest(playbackUrl,target,true);xhr.withCredentials=true;},
    fetchSetup:(context,init)=>{verifyMediaRequest(playbackUrl,context.url,true);return new Request(context.url,{...init,credentials:'include',redirect:'error',referrerPolicy:'no-referrer'});},
   });
   engine.on(Hls.Events.ERROR,(_event,data)=>{if(data.fatal)fail();});engine.loadSource(playbackUrl);engine.attachMedia(audio);
  }).catch(fail);
 }catch{fail();}
 return()=>{disposed=true;audio.pause();engine?.destroy();audio.removeAttribute('src');audio.load();};
}
