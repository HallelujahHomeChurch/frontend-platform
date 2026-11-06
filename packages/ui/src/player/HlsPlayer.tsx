'use client';

import {useAudioSession} from './use-audio-session.js';
import {useBackgroundAudio} from './use-background-audio.js';
import {verifyMediaRequest} from './media-request.js';

import {useCallback, useEffect, useRef, useState, type RefObject} from 'react';
import type Hls from 'hls.js';
import {LIVE_EDGE_TOLERANCE_SECONDS,LIVE_HOLDBACK_SECONDS,liveWindow, type LivePlayerState, type PlayerBookmark, type PlaybackIntent} from './live-player.js';
import {PlayerChrome} from './PlayerChrome.js';
import {RecordingWatermark} from './RecordingWatermark.js';
import styles from './styles.js';
import {createPlayerDiagnostics,type PlayerDiagnostic} from './player-diagnostics.js';

type Quality = 'auto' | '480p' | '720p' | '1080p';
export type PlayerLabels = {
  quality:string; auto:string; play:string; pause:string; mute:string; unmute:string;
  seek:string; volume:string; fullscreen:string; exitFullscreen:string; fullscreenError:string; playbackSpeed:string;
  previousVideo?:string; nextVideo?:string; theaterMode?:string; exitTheaterMode?:string; tapToPlay?:string;
  settingsBack?:string; replay?:string; minimize?:string; settings:string; togglePlayback:string; privateCopy:string; buffering:string;
};
export type HlsPlayerProps = {
  backgroundAudioUrl?:string; playbackMediaRef?:RefObject<HTMLMediaElement|null>; playbackPauseRef?:RefObject<(()=>void)|null>;
  onDiagnostic?:(value:PlayerDiagnostic)=>void;
  onMinimize?:()=>void;
  controls?:boolean; initialQuality?:Quality;
  playbackMode?: 'vod' | 'live'; live?: LivePlayerState; resume?: PlayerBookmark; onBookmark?: (value: PlayerBookmark) => void;
  poster?:string; previousHref?:string; nextHref?:string; onNavigate?:(href:string)=>void;
  playbackUrl:string; availableQualities:Exclude<Quality,'auto'>[]; watermark?:string; muted?:boolean; title:string;
  labels:PlayerLabels; videoRef:RefObject<HTMLVideoElement|null>; onPlayingChange?:(playing:boolean)=>void; onError:(bookmark?:PlayerBookmark)=>void;
};

export function HlsPlayer({backgroundAudioUrl,playbackMediaRef,playbackPauseRef,controls=true,initialQuality='auto',playbackUrl,availableQualities,watermark,muted=false,title,labels,videoRef,onPlayingChange,onError,poster,previousHref,nextHref,playbackMode='vod',live,resume,onBookmark,onNavigate,onDiagnostic,onMinimize}:HlsPlayerProps) {
  const container=useRef<HTMLDivElement>(null), engine=useRef<Hls|null>(null);
  // Latch the source for this playback lifecycle: renewal must not silently introduce a new audible owner.
  const [audioUrl]=useState(()=>backgroundAudioUrl);
  const audioRef=useRef<HTMLAudioElement|null>(null),mediaRef=useRef<HTMLMediaElement|null>(null);
  const bindVideo=useCallback((node:HTMLVideoElement|null)=>{videoRef.current=node;mediaRef.current=node;if(playbackMediaRef)playbackMediaRef.current=node;},[videoRef,playbackMediaRef]);
  const bindAudio=useCallback((node:HTMLAudioElement|null)=>{audioRef.current=node;},[]);

  const diagnostics=useRef<ReturnType<typeof createPlayerDiagnostics>|null>(null),diagnosticCallback=useRef(onDiagnostic);
  const diagnosticBackend=useRef<{url:string;backend:'hls'|'native';sourceName?:string}|null>(null),diagnosticEnabled=Boolean(onDiagnostic);
  useEffect(()=>{diagnosticCallback.current=onDiagnostic;},[onDiagnostic]);
  useEffect(()=>{
    const video=videoRef.current;if(!video||!diagnosticEnabled)return;
    const observer=createPlayerDiagnostics(video,playbackMode,value=>diagnosticCallback.current?.(value));
    if(diagnosticBackend.current?.url===playbackUrl)observer.setBackend(diagnosticBackend.current.backend,diagnosticBackend.current.sourceName);
    diagnostics.current=observer;
    return()=>{observer.dispose();if(diagnostics.current===observer)diagnostics.current=null;};
  },[diagnosticEnabled,playbackUrl,playbackMode,videoRef]);
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
  const [quality,setQuality]=useState<Quality>(resume?.quality ?? initialQuality);
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
    const video=mediaRef.current;
    if(audioUrl&&(!positioned.current||video?.readyState===0))return;
    if(video&&!closing.current&&!failed.current&&(playbackMode!=='live'||positioned.current||initialBookmark.current)){
      const position=audioUrl?(handoff.controls.current?.snapshot()??{time:video.currentTime,paused:pausedIntent.current,rate:video.playbackRate}):qualityPosition.current??{time:video.currentTime,paused:video.paused,rate:video.playbackRate};
      bookmarkCallback.current?.({...position,quality:qualityRef.current,intent:intent.current});
    }
  },[videoRef,playbackMode,audioUrl]);
  const dvr=useCallback(()=>{pendingAutoplay.current=null;automaticSeek.current=null;intent.current='dvr';setFollowLive(false);if(playbackMode==='live'&&!initialBookmark.current)positioned.current=true;remember();},[remember,playbackMode]);
  const returnToLive=()=>{
    const video=mediaRef.current, state=currentLive.current;
    if(!video||!state?.canFollow)return;
    const window=liveWindow(video.seekable,state.verifiedEnd);if(!window)return;
    if(qualityPosition.current){qualityPosition.current.time=window.edge;qualityPosition.current.paused=false;qualityPosition.current.rate=1;}
    pendingAutoplay.current=null;intent.current='followLive';setFollowLive(true);video.playbackRate=1;automaticSeek.current=window.edge;video.currentTime=window.edge;positioned.current=true;
    if(audioUrl){handoff.controls.current?.settings({rate:1});handoff.controls.current?.seek(window.edge);handoff.controls.current?.play();}else void video.play().catch(()=>{});remember();
  };
  const qualities=(['480p','720p','1080p'] as const).filter(name=>availableQualities.includes(name));
  const handleError=useCallback(()=>{
    if(failed.current)return;
    const video=mediaRef.current;
    const position=audioUrl?(handoff.controls.current?.snapshot()??{time:video?.currentTime??0,paused:pausedIntent.current,rate:video?.playbackRate??1}):qualityPosition.current??{time:video?.currentTime??0,paused:pausedIntent.current,rate:video?.playbackRate??1};
    const bookmark=Boolean(audioUrl&&mediaRef.current?.readyState)||positioned.current||playbackMode!=='live'&&qualityPosition.current?{...position,quality:qualityRef.current,intent:intent.current}:initialBookmark.current;
    failed.current=true;handoff.controls.current?.stop();audioRef.current?.pause();videoRef.current?.pause();pendingQuality.current=null;qualitySwitch.current?.abort();finishRebuild();clearHeldFrame();setMode('error');errorCallback.current(bookmark);
  },[videoRef,clearHeldFrame,finishRebuild,playbackMode,audioUrl]);
  const handleMediaError=useCallback(()=>{
    if(!rebuilding.current){handleError();return;}
    // Only an observed decode error gets a grace period; slow buffering alone is not failure.
    rebuildTimeout.current??=window.setTimeout(handleError,30000);
  },[handleError]);

  const handoff=useBackgroundAudio({audioRef,videoRef,mediaRef,externalRef:playbackMediaRef,pauseRef:playbackPauseRef,url:audioUrl,videoUrl:playbackUrl,mode:playbackMode,onPosition:time=>{if(playbackMode==='live')automaticSeek.current=time;},pausedIntent,onError:handleError,onChange:remember,onBlocked:()=>setAutoplayBlocked(true)});
  useEffect(()=>{
    if(audioUrl||!playbackPauseRef)return;
    const pause=()=>videoRef.current?.pause();playbackPauseRef.current=pause;
    return()=>{if(playbackPauseRef.current===pause)playbackPauseRef.current=null;};
  },[audioUrl,playbackPauseRef,videoRef]);
  useAudioSession(mediaRef,title,poster,audioUrl,()=>handoff.controls.current?.play(),()=>{if(playbackMode==='live')dvr();handoff.controls.current?.pause();},handoff.owner, time=>{if(playbackMode==='live')dvr();handoff.controls.current?.seek(time);},playbackMode==='live'?live:undefined);

  useEffect(()=>{
    const video=videoRef.current;
    if(!video)return;
    let cancelled=false,ready=false,attempted=false;
    let updateLoading=()=>{};
    const visibility=()=>updateLoading();
    if(audioUrl)document.addEventListener('visibilitychange',visibility);
    closing.current=false;failed.current=false;positioned.current=false;
    pendingAutoplay.current=()=>{
      if(audioUrl||cancelled||failed.current||!ready||attempted||initialBookmark.current?.paused||playbackMode==='live'&&!positioned.current)return;
      attempted=true;
      void video.play().catch((error:unknown)=>{
        if(!cancelled && error instanceof DOMException && error.name==='NotAllowedError')setAutoplayBlocked(true);
      });
    };
    const autoplay=()=>{if(cancelled)return;ready=true;pendingAutoplay.current?.();};
    void import('hls.js').then(({default:Hls})=>{
      if(cancelled||failed.current)return;
      setActiveHeight(null);
      // Keep companion video on the same native HLS path as audio on ManagedMediaSource browsers.
      const nativeCompanion=audioUrl&&'ManagedMediaSource' in window&&video.canPlayType('application/vnd.apple.mpegurl');
      if(Hls.isSupported()&&!nativeCompanion) {
        diagnosticBackend.current={url:playbackUrl,backend:'hls'};diagnostics.current?.setBackend('hls');
        const LatencyController=Hls.DefaultConfig.latencyController!;
        const hls=new Hls({
          enableWorker:true, debug:false, maxBufferLength:60, maxMaxBufferLength:120,
          ...(audioUrl?{autoStartLoad:false}:{}),
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
        let sourceLoaded=false;
        updateLoading=()=>{
          if(cancelled||failed.current)return;
          if(audioUrl&&document.visibilityState==='hidden'){hls.stopLoad();video.pause();return;}
          if(!sourceLoaded){sourceLoaded=true;hls.loadSource(playbackUrl);}
          if(audioUrl)hls.startLoad(mediaRef.current?.currentTime??initialBookmark.current?.time??0);
        };
        hls.on(Hls.Events.MEDIA_ATTACHED,(_event,data)=>{if(!cancelled){if(audioUrl)updateLoading();const sourceName=data.mediaSource?.constructor.name;diagnosticBackend.current={url:playbackUrl,backend:'hls',sourceName};diagnostics.current?.setBackend('hls',sourceName);}});
        // LEVEL_SWITCHED follows the fragment currently playing, not the next ABR choice.
        hls.on(Hls.Events.LEVEL_SWITCHED,(_event,data)=>{if(!cancelled&&!failed.current){const height=hls.levels[data.level]?.height;setActiveHeight(height>0?height:null);}});
        hls.on(Hls.Events.MANIFEST_PARSED,()=>{if(!cancelled&&!failed.current){
          const selected=qualityRef.current;
          if(selected!=='auto'){const target=new URL(`${selected}/index.m3u8`,playbackUrl).href;hls.nextLevel=hls.levels.findIndex(level=>level.url.includes(target));}
          setMode('mse');autoplay();
        }});
        hls.on(Hls.Events.ERROR,(_event,data)=>{if(!cancelled)diagnostics.current?.hlsError(data);if(data.fatal&&!cancelled){if(data.type==='mediaError')handleMediaError();else handleError();}});
        updateLoading();hls.attachMedia(video);
      } else if(video.canPlayType('application/vnd.apple.mpegurl')) {
        diagnosticBackend.current={url:playbackUrl,backend:'native'};diagnostics.current?.setBackend('native');
        setMode('native');video.src=qualityRef.current==='auto'?playbackUrl:new URL(`${qualityRef.current}/index.m3u8`,playbackUrl).href;video.addEventListener('loadedmetadata',autoplay,{once:true});video.load();
      } else handleError();
    }).catch(()=>{if(!cancelled)handleError();});
    return ()=>{
      cancelled=true;document.removeEventListener('visibilitychange',visibility);pendingAutoplay.current=null;closing.current=true;pendingQuality.current=null;finishRebuild();qualitySwitch.current?.abort();qualityPosition.current=null;clearHeldFrame();video.removeEventListener('loadedmetadata',autoplay);
      engine.current?.destroy();engine.current=null;video.pause();video.removeAttribute('src');video.load();
    };
  },[playbackUrl,videoRef,handleError,handleMediaError,playbackMode,clearHeldFrame,finishRebuild,audioUrl]);

  useEffect(()=>{
    const video=playbackMode==='live'?mediaRef.current:videoRef.current;if(!video)return;
    const position=()=>{
      const state=currentLive.current;
      if(video!==mediaRef.current||qualityPosition.current&&video===videoRef.current||closing.current||failed.current)return;
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
    const seeking=()=>{if(video!==mediaRef.current||!positioned.current||closing.current||qualityPosition.current||automaticSeek.current!==null)return;dvr();};
    const revealFrame=()=>{
      if(!qualityPosition.current&&!video.seeking&&video.readyState>=2&&!video.error){finishRebuild();clearHeldFrame();}
    };
    const seeked=()=>{if(video!==mediaRef.current)return;automaticSeek.current=null;revealFrame();};
    const resolution=()=>{if(video===videoRef.current&&!engine.current)setActiveHeight(videoRef.current.videoHeight>0?videoRef.current.videoHeight:null);};
    const paused=()=>{if(!audioUrl&&video.paused&&!closing.current&&!failed.current&&!video.error&&positioned.current&&!qualityPosition.current){pausedIntent.current=true;dvr();}};
    const online=()=>position();
    const events:[string,()=>void][]=[['loadedmetadata',position],['progress',position],['durationchange',position],['canplay',position],['seeking',seeking],['seeked',seeked],['loadeddata',revealFrame],['canplay',revealFrame],['playing',revealFrame],['pause',paused],['timeupdate',position],['timeupdate',remember],['ratechange',remember],['play',remember],['loadedmetadata',resolution],['resize',resolution]];
    for(const [event,handler] of events)video.addEventListener(event,handler);
    window.addEventListener('online',online);
    if(playbackMode==='live')position();
    return()=>{for(const [event,handler] of events)video.removeEventListener(event,handler);window.removeEventListener('online',online);};
  },[playbackUrl,playbackMode,videoRef,remember,dvr,live?.verifiedEnd,live?.canFollow,live?.ended,clearHeldFrame,finishRebuild,waitingForLiveReserve,playbackMode==='live'?handoff.owner:0]);

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
      const owner=mediaRef.current??video;
      const previous=qualityPosition.current ?? {time:owner.currentTime,paused:audioUrl?pausedIntent.current:owner.paused,rate:owner.playbackRate};
      qualityPosition.current=previous;
      handoff.controls.current?.hold(previous.time);
      let appliedTime:number|null=null;
      const restore=()=>{
        if(controller.signal.aborted||qualitySwitch.current!==controller||closing.current||failed.current||video.readyState<1)return;
        const window=playbackMode==='live'&&currentLive.current?liveWindow(video.seekable,currentLive.current.verifiedEnd):null;
        if(playbackMode==='live'&&!window||waitingForLiveReserve(window))return;
        if(audioUrl&&document.visibilityState==='hidden')return;
        if(audioUrl)Object.assign(previous,handoff.controls.current?.snapshot());
        const time=!positioned.current&&!initialBookmark.current&&window&&intent.current==='followLive'?window.edge:previous.time;
        const target=window?Math.max(window.start,Math.min(time,window.end)):Number.isFinite(video.duration)?Math.min(previous.time,video.duration):previous.time;
        if(appliedTime!==target||!video.seeking&&(video.currentTime<target-.1||previous.paused&&Math.abs(video.currentTime-target)>.1)){appliedTime=target;automaticSeek.current=target;video.currentTime=target;}
        if(video.playbackRate!==previous.rate)video.playbackRate=previous.rate;
        if(!audioUrl&&!previous.paused&&video.paused)void video.play().catch(()=>{});else if(!audioUrl&&previous.paused&&!video.paused)video.pause();
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
      if(audioUrl&&document.visibilityState==='hidden')engine.current.stopLoad();
    } else if(mode==='native') {
      preservePosition();
      video.src=next==='auto'?playbackUrl:new URL(`${next}/index.m3u8`,playbackUrl).href;video.load();
    } else return;
    remember();
  };
  return <div ref={container} tabIndex={controls?0:undefined} role="region" aria-label={`${title} — ${labels.togglePlayback}`} className={styles.player}>
    <video muted={muted} ref={bindVideo} poster={poster} playsInline preload="metadata" controlsList="nodownload noremoteplayback" disablePictureInPicture disableRemotePlayback crossOrigin="use-credentials" aria-label={title} className={styles.video}
      onPlay={()=>{if(!audioUrl)pausedIntent.current=false;setAutoplayBlocked(false);}} onPlaying={event=>{if(!controls&&event.currentTarget.videoWidth>0)onPlayingChange?.(true);}} onPause={()=>{if(!controls)onPlayingChange?.(false);}} onEnded={()=>{if(!controls)onPlayingChange?.(false);}} onError={event=>{const error=event.currentTarget.error;if(error&&!closing.current){if(error.code===3)handleMediaError();else handleError();}}}/>
    {audioUrl?<audio ref={bindAudio} crossOrigin="use-credentials" preload="metadata" aria-hidden="true"/>:null}
    <canvas ref={heldFrame} hidden={!holdingFrame} aria-hidden="true" className={styles.heldFrame}/>
    {controls ? <PlayerChrome onMinimize={onMinimize} followLive={followLive} onNavigate={onNavigate} container={container} videoRef={videoRef} playbackMediaRef={audioUrl?mediaRef:undefined} mediaOwner={handoff.owner} playbackVolume={audioUrl?handoff:undefined} onMediaVolume={audioUrl?value=>handoff.controls.current?.settings(value):undefined} playbackPaused={audioUrl?handoff.paused:undefined} onMediaPlay={audioUrl?()=>handoff.controls.current?.play():undefined} onMediaPause={audioUrl?()=>handoff.controls.current?.pause():undefined} playbackUrl={playbackUrl} watermark={watermark} labels={labels} quality={quality} activeHeight={activeHeight} qualities={qualities} previousHref={previousHref} nextHref={nextHref} autoplayBlocked={autoplayBlocked} loading={mode==='loading'} buffering={qualityLoading} failed={mode==='error'} onQualityChange={changeQuality} onPlaybackChange={value=>{if(value.intent){intent.current=value.intent;setFollowLive(value.intent==='followLive');automaticSeek.current=value.time??null;}if(value.paused!==undefined){pendingAutoplay.current=null;if(value.paused===false&&!positioned.current&&playbackMode==='live')dvr();pausedIntent.current=value.paused;}if(qualityPosition.current)Object.assign(qualityPosition.current,value);if(audioUrl&&value.rate!==undefined)handoff.controls.current?.settings({rate:value.rate});if(audioUrl&&value.time!==undefined)handoff.controls.current?.seek(value.time);remember();}} onPlayingChange={onPlayingChange} live={playbackMode==='live'?live:undefined} onDvr={dvr} onReturnToLive={returnToLive}/> : watermark ? <RecordingWatermark container={container} videoRef={videoRef} code={watermark}/> : null}
  </div>;
}
