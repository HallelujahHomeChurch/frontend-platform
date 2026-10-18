'use client';

import {useCallback, useEffect, useRef, useState, type RefObject} from 'react';
import type Hls from 'hls.js';
import {LIVE_EDGE_TOLERANCE_SECONDS,LIVE_HOLDBACK_SECONDS,liveWindow, type LivePlayerState, type PlayerBookmark, type PlaybackIntent} from './live-player.js';
import {PlayerChrome} from './PlayerChrome.js';
import styles from './styles.js';

type Quality = 'auto' | '480p' | '720p' | '1080p';
export type PlayerLabels = {
  quality:string; auto:string; play:string; pause:string; mute:string; unmute:string;
  seek:string; volume:string; fullscreen:string; exitFullscreen:string; fullscreenError:string; playbackSpeed:string;
  previousVideo?:string; nextVideo?:string; theaterMode?:string; exitTheaterMode?:string; tapToPlay?:string;
  settingsBack?:string; replay?:string; settings:string; togglePlayback:string; privateCopy:string; buffering:string;
};
export type HlsPlayerProps = {
  playbackMode?: 'vod' | 'live'; live?: LivePlayerState; resume?: PlayerBookmark; onBookmark?: (value: PlayerBookmark) => void;
  poster?:string; previousHref?:string; nextHref?:string; onNavigate?:(href:string)=>void;
  playbackUrl:string; availableQualities:Exclude<Quality,'auto'>[]; watermark?:string; muted?:boolean; title:string;
  labels:PlayerLabels; videoRef:RefObject<HTMLVideoElement|null>; onPlayingChange?:(playing:boolean)=>void; onError:(bookmark?:PlayerBookmark)=>void;
};
function verifyMediaRequest(master:string,target:string) {
  const base=new URL(master), url=new URL(target,base);
  const prefix=base.pathname.replace(/master\.m3u8$/,'');
  const path=url.pathname.slice(prefix.length);
  if(url.origin!==base.origin || url.username || url.password || url.search || url.hash || !url.pathname.startsWith(prefix)
    || !/^(master\.m3u8|(480p|720p|1080p)\/(index\.m3u8|init\.mp4|seg-\d{6}\.m4s))$/.test(path)) throw new Error('Invalid media request');
}

export function HlsPlayer({playbackUrl,availableQualities,watermark,muted=false,title,labels,videoRef,onPlayingChange,onError,poster,previousHref,nextHref,playbackMode='vod',live,resume,onBookmark,onNavigate}:HlsPlayerProps) {
  const container=useRef<HTMLDivElement>(null), engine=useRef<Hls|null>(null);
  const qualitySwitch=useRef<AbortController|null>(null);
  const pendingQuality=useRef<{quality:Quality;run:()=>void}|null>(null);
  const heldFrame=useRef<HTMLCanvasElement|null>(null);
  const [holdingFrame,setHoldingFrame]=useState(false);
  const rebuilding=useRef(false),rebuildTimeout=useRef<number|null>(null);
  const [qualityLoading,setQualityLoading]=useState(false);
  const finishRebuild=useCallback(()=>{
    rebuilding.current=false;setQualityLoading(false);
    if(rebuildTimeout.current!==null)window.clearTimeout(rebuildTimeout.current);
    rebuildTimeout.current=null;
  },[]);
  const clearHeldFrame=useCallback(()=>{
    const canvas=heldFrame.current;if(canvas){canvas.width=0;canvas.height=0;}
    setHoldingFrame(false);
  },[]);
  const qualityPosition=useRef<Pick<PlayerBookmark,'time'|'paused'|'rate'>|null>(null);
  const [autoplayBlocked,setAutoplayBlocked]=useState(false);
  const [mode,setMode]=useState<'loading'|'mse'|'native'|'error'>('loading');
  const [activeHeight,setActiveHeight]=useState<number|null>(null);
  const [quality,setQuality]=useState<Quality>(resume?.quality ?? 'auto');
  const [followLive,setFollowLive]=useState(resume?.intent!=='dvr');
  const intent=useRef<PlaybackIntent>(resume?.intent ?? 'followLive'), positioned=useRef(false), closing=useRef(false);
  const failed=useRef(false), pausedIntent=useRef(resume?.paused??true);
  const automaticSeek=useRef<number|null>(null);
  const pendingAutoplay=useRef<(()=>void)|null>(null);
  const errorCallback=useRef(onError);
  const currentLive=useRef(live), bookmarkCallback=useRef(onBookmark), qualityRef=useRef(quality), initialBookmark=useRef(resume);
  useEffect(()=>{currentLive.current=live;bookmarkCallback.current=onBookmark;qualityRef.current=quality;errorCallback.current=onError;},[live,onBookmark,quality,onError]);
  // Fresh automatic entry must accumulate its reserve; explicit playback and restored intent win.
  const waitingForLiveReserve=useCallback((window:ReturnType<typeof liveWindow>)=>playbackMode==='live'&&!initialBookmark.current&&!positioned.current&&intent.current==='followLive'&&!currentLive.current?.ended&&(!window||window.end-window.start<LIVE_HOLDBACK_SECONDS),[playbackMode]);
  const remember=useCallback(()=>{
    const video=videoRef.current;
    if(video&&!closing.current&&!failed.current&&(playbackMode!=='live'||positioned.current||initialBookmark.current)){
      const position=qualityPosition.current??{time:video.currentTime,paused:video.paused,rate:video.playbackRate};
      bookmarkCallback.current?.({...position,quality:qualityRef.current,intent:intent.current});
    }
  },[videoRef,playbackMode]);
  const dvr=useCallback(()=>{pendingAutoplay.current=null;automaticSeek.current=null;intent.current='dvr';setFollowLive(false);if(playbackMode==='live'&&!initialBookmark.current)positioned.current=true;remember();},[remember,playbackMode]);
  const returnToLive=()=>{
    const video=videoRef.current, state=currentLive.current;
    if(!video||!state?.canFollow)return;
    const window=liveWindow(video.seekable,state.verifiedEnd);if(!window)return;
    if(qualityPosition.current){qualityPosition.current.time=window.edge;qualityPosition.current.paused=false;qualityPosition.current.rate=1;}
    pendingAutoplay.current=null;intent.current='followLive';setFollowLive(true);video.playbackRate=1;automaticSeek.current=window.edge;video.currentTime=window.edge;positioned.current=true;
    void video.play().catch(()=>{});remember();
  };
  const qualities=(['480p','720p','1080p'] as const).filter(name=>availableQualities.includes(name));
  const handleError=useCallback(()=>{
    if(failed.current)return;
    const video=videoRef.current;
    const position=qualityPosition.current??{time:video?.currentTime??0,paused:pausedIntent.current,rate:video?.playbackRate??1};
    const bookmark=positioned.current||playbackMode!=='live'&&qualityPosition.current?{...position,quality:qualityRef.current,intent:intent.current}:initialBookmark.current;
    failed.current=true;pendingQuality.current=null;qualitySwitch.current?.abort();finishRebuild();clearHeldFrame();setMode('error');errorCallback.current(bookmark);
  },[videoRef,clearHeldFrame,finishRebuild,playbackMode]);
  const handleMediaError=useCallback(()=>{
    if(!rebuilding.current){handleError();return;}
    // Only an observed decode error gets a grace period; slow buffering alone is not failure.
    rebuildTimeout.current??=window.setTimeout(handleError,30000);
  },[handleError]);

  useEffect(()=>{
    const video=videoRef.current;
    if(!video)return;
    let cancelled=false,ready=false,attempted=false;closing.current=false;failed.current=false;positioned.current=false;
    pendingAutoplay.current=()=>{
      if(cancelled||failed.current||!ready||attempted||initialBookmark.current?.paused||playbackMode==='live'&&!positioned.current)return;
      attempted=true;
      void video.play().catch((error:unknown)=>{
        if(!cancelled && error instanceof DOMException && error.name==='NotAllowedError')setAutoplayBlocked(true);
      });
    };
    const autoplay=()=>{if(cancelled)return;ready=true;pendingAutoplay.current?.();};
    void import('hls.js').then(({default:Hls})=>{
      if(cancelled)return;
      setActiveHeight(null);
      if(Hls.isSupported()) {
        const LatencyController=Hls.DefaultConfig.latencyController!;
        const hls=new Hls({
          enableWorker:true, debug:false, maxBufferLength:60, maxMaxBufferLength:120,
          // HLS levels are sorted by resolution; start low without disabling ABR.
          startLevel:qualityRef.current==='auto'?0:undefined,
          ...(playbackMode==='live'?{
            backBufferLength:120,lowLatencyMode:false,liveSyncDuration:LIVE_HOLDBACK_SECONDS,liveMaxLatencyDuration:Infinity,maxLiveSyncPlaybackRate:1,
            // This player owns positioning; hls.js outside-window sync can rewind an audio-tail overrun.
            latencyController:class extends LatencyController {override get liveSyncPosition():number|null{return null;}},
          }:{}),
          xhrSetup:(xhr,url)=>{verifyMediaRequest(playbackUrl,url);xhr.withCredentials=true;},
          fetchSetup:(context,init)=>{verifyMediaRequest(playbackUrl,context.url);return new Request(context.url,{...init,credentials:'include',redirect:'error',referrerPolicy:'no-referrer'});},
        });
        engine.current=hls;
        // LEVEL_SWITCHED follows the fragment currently playing, not the next ABR choice.
        hls.on(Hls.Events.LEVEL_SWITCHED,(_event,data)=>{if(!cancelled&&!failed.current){const height=hls.levels[data.level]?.height;setActiveHeight(height>0?height:null);}});
        hls.on(Hls.Events.MANIFEST_PARSED,()=>{if(!cancelled){
          const selected=qualityRef.current;
          if(selected!=='auto'){const target=new URL(`${selected}/index.m3u8`,playbackUrl).href;hls.nextLevel=hls.levels.findIndex(level=>level.url.includes(target));}
          setMode('mse');autoplay();
        }});
        hls.on(Hls.Events.ERROR,(_event,data)=>{if(data.fatal&&!cancelled){if(data.type==='mediaError')handleMediaError();else handleError();}});
        hls.loadSource(playbackUrl);hls.attachMedia(video);
      } else if(video.canPlayType('application/vnd.apple.mpegurl')) {
        setMode('native');video.src=qualityRef.current==='auto'?playbackUrl:new URL(`${qualityRef.current}/index.m3u8`,playbackUrl).href;video.addEventListener('loadedmetadata',autoplay,{once:true});video.load();
      } else handleError();
    }).catch(()=>{if(!cancelled)handleError();});
    return ()=>{
      cancelled=true;pendingAutoplay.current=null;closing.current=true;pendingQuality.current=null;finishRebuild();qualitySwitch.current?.abort();qualityPosition.current=null;clearHeldFrame();video.removeEventListener('loadedmetadata',autoplay);
      engine.current?.destroy();engine.current=null;video.pause();video.removeAttribute('src');video.load();
    };
  },[playbackUrl,videoRef,handleError,handleMediaError,playbackMode,clearHeldFrame,finishRebuild]);

  useEffect(()=>{
    const video=videoRef.current;if(!video)return;
    const position=()=>{
      const state=currentLive.current;
      if(qualityPosition.current||closing.current||failed.current)return;
      const window=playbackMode==='live'&&state?liveWindow(video.seekable,state.verifiedEnd):null;
      if(playbackMode==='live'&&!window||waitingForLiveReserve(window))return;
      if(!positioned.current){
        const saved=initialBookmark.current;
        if(saved){
          const end=window?.end??(Number.isFinite(video.duration)?video.duration:saved.time);
          automaticSeek.current=Math.max(window?.start??0,Math.min(end,saved.time));video.currentTime=automaticSeek.current;
          video.playbackRate=saved.rate;if(saved.paused)video.pause();
        }else if(window){automaticSeek.current=window.edge;video.currentTime=window.edge;}
        positioned.current=true;remember();pendingAutoplay.current?.();
      }else if(window&&state?.canFollow&&intent.current==='followLive'&&!video.paused&&video.playbackRate===1&&window.edge-video.currentTime>LIVE_EDGE_TOLERANCE_SECONDS){
        // Upstream recovery does not fire the viewer's browser online event.
        automaticSeek.current=window.edge;video.currentTime=window.edge;remember();
      }
    };
    const seeking=()=>{if(!positioned.current||closing.current||qualityPosition.current||automaticSeek.current!==null)return;dvr();};
    const revealFrame=()=>{
      if(!qualityPosition.current&&!video.seeking&&video.readyState>=2&&!video.error){finishRebuild();clearHeldFrame();}
    };
    const seeked=()=>{automaticSeek.current=null;revealFrame();};
    const resolution=()=>{if(!engine.current)setActiveHeight(video.videoHeight>0?video.videoHeight:null);};
    const paused=()=>{if(!closing.current&&!failed.current&&!video.error&&positioned.current&&!qualityPosition.current){pausedIntent.current=true;dvr();}};
    const online=()=>position();
    const events:[string,()=>void][]=[['loadedmetadata',position],['progress',position],['durationchange',position],['canplay',position],['seeking',seeking],['seeked',seeked],['loadeddata',revealFrame],['canplay',revealFrame],['playing',revealFrame],['pause',paused],['timeupdate',position],['timeupdate',remember],['ratechange',remember],['play',remember],['loadedmetadata',resolution],['resize',resolution]];
    for(const [event,handler] of events)video.addEventListener(event,handler);
    window.addEventListener('online',online);
    if(playbackMode==='live')position();
    return()=>{for(const [event,handler] of events)video.removeEventListener(event,handler);window.removeEventListener('online',online);};
  },[playbackUrl,playbackMode,videoRef,remember,dvr,live?.verifiedEnd,live?.canFollow,live?.ended,clearHeldFrame,finishRebuild,waitingForLiveReserve]);

  const changeQuality=(next:Quality)=>{
    const video=videoRef.current;
    if(!video || (next!=='auto'&&!qualities.includes(next)) || (!engine.current&&mode!=='native'))return;
    qualityRef.current=next;setQuality(next);
    if(rebuilding.current){pendingQuality.current={quality:next,run:()=>changeQuality(next)};remember();return;}
    const preservePosition=()=>{
      // Keep pixels in memory while the rendition reload would expose the poster.
      const canvas=heldFrame.current;
      if(canvas&&!holdingFrame&&video.readyState>=2&&video.videoWidth&&video.videoHeight){
        try{
          const context=canvas.getContext('2d');
          if(context){canvas.width=video.videoWidth;canvas.height=video.videoHeight;context.drawImage(video,0,0,canvas.width,canvas.height);setHoldingFrame(true);}
        }catch{clearHeldFrame();}
      }
      qualitySwitch.current?.abort();finishRebuild();
      rebuilding.current=true;setQualityLoading(true);
      const controller=new AbortController();qualitySwitch.current=controller;
      const previous=qualityPosition.current ?? {time:video.currentTime,paused:video.paused,rate:video.playbackRate};
      qualityPosition.current=previous;
      let appliedTime:number|null=null;
      const restore=()=>{
        if(controller.signal.aborted||qualitySwitch.current!==controller||closing.current||failed.current||video.readyState<1)return;
        const window=playbackMode==='live'&&currentLive.current?liveWindow(video.seekable,currentLive.current.verifiedEnd):null;
        if(playbackMode==='live'&&!window||waitingForLiveReserve(window))return;
        const time=!positioned.current&&!initialBookmark.current&&window&&intent.current==='followLive'?window.edge:previous.time;
        const target=window?Math.max(window.start,Math.min(time,window.end)):Number.isFinite(video.duration)?Math.min(previous.time,video.duration):previous.time;
        if(appliedTime!==target||!video.seeking&&(video.currentTime<target-.1||previous.paused&&Math.abs(video.currentTime-target)>.1)){appliedTime=target;automaticSeek.current=target;video.currentTime=target;}
        if(video.playbackRate!==previous.rate)video.playbackRate=previous.rate;
        if(!previous.paused&&video.paused)void video.play().catch(()=>{});else if(previous.paused&&!video.paused)video.pause();
        // Metadata alone is not a restored frame; retain intent across detach/reset events.
        if(video.readyState<2||video.seeking||video.error||video.currentTime<target-.1||previous.paused&&Math.abs(video.currentTime-target)>.1)return;
        controller.abort();qualitySwitch.current=null;
        const pending=pendingQuality.current;pendingQuality.current=null;
        if(pending&&pending.quality!==next){finishRebuild();pending.run();return;}
        positioned.current=true;qualityPosition.current=null;finishRebuild();clearHeldFrame();remember();pendingAutoplay.current?.();
      };
      for(const event of ['loadedmetadata','progress','canplay','loadeddata','seeked'])video.addEventListener(event,restore,{signal:controller.signal});
    };
    if(engine.current) {
      const target=new URL(`${next}/index.m3u8`,playbackUrl).href;
      const index=next==='auto'?-1:engine.current.levels.findIndex(level=>level.url.includes(target));
      if(next!=='auto'&&index<0){handleError();return;}
      preservePosition();
      // Recreate MediaSource to discard cached rendition frames and queued EOS callbacks.
      engine.current.loadLevel=index;
      engine.current.recoverMediaError();
    } else if(mode==='native') {
      preservePosition();
      video.src=next==='auto'?playbackUrl:new URL(`${next}/index.m3u8`,playbackUrl).href;video.load();
    } else return;
    remember();
  };
  return <div ref={container} tabIndex={0} role="region" aria-label={`${title} — ${labels.togglePlayback}`} className={styles.player}>
    <video muted={muted} ref={videoRef} poster={poster} playsInline preload="metadata" controlsList="nodownload noremoteplayback" disablePictureInPicture disableRemotePlayback crossOrigin="use-credentials" aria-label={title} className={styles.video}
      onPlay={()=>{pausedIntent.current=false;setAutoplayBlocked(false);}} onError={event=>{const error=event.currentTarget.error;if(error&&!closing.current){if(error.code===3)handleMediaError();else handleError();}}}/>
    <canvas ref={heldFrame} hidden={!holdingFrame} aria-hidden="true" className={styles.heldFrame}/>
    <PlayerChrome followLive={followLive} onNavigate={onNavigate} container={container} videoRef={videoRef} playbackUrl={playbackUrl} watermark={watermark} labels={labels} quality={quality} activeHeight={activeHeight} qualities={qualities} previousHref={previousHref} nextHref={nextHref} autoplayBlocked={autoplayBlocked} loading={mode==='loading'} buffering={qualityLoading} failed={mode==='error'} onQualityChange={changeQuality} onPlaybackChange={value=>{if(value.paused!==undefined){pendingAutoplay.current=null;if(value.paused===false&&!positioned.current&&playbackMode==='live')dvr();pausedIntent.current=value.paused;}if(qualityPosition.current)Object.assign(qualityPosition.current,value);remember();}} onPlayingChange={onPlayingChange} live={playbackMode==='live'?live:undefined} onDvr={dvr} onReturnToLive={returnToLive}/>
  </div>;
}
