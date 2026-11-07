'use client';

import {useEffect, useRef, useState, useMemo, useSyncExternalStore, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type RefObject} from 'react';
import {flushSync} from 'react-dom';
import {Check, ChevronDown, ChevronLeft, ChevronRight, SkipBack, SkipForward, LoaderCircle, RectangleHorizontal, ArrowUpRight, Maximize, Minimize, RotateCcw, Pause, Play, Settings, Volume2, VolumeX} from 'lucide-react';
import {LIVE_EDGE_TOLERANCE_SECONDS,liveWindow,type LivePlayerState,type PlayerBookmark} from './live-player.js';
import type {PlayerLabels} from './HlsPlayer.js';
import {usePreviewIndex} from './use-preview-index.js';
import styles from './styles.js';
import {usePlayerFullscreen} from './use-player-fullscreen.js';
import {RecordingWatermark} from './RecordingWatermark.js';
import {PreviewSprite} from './PreviewSprite.js';
import {previewCueAt} from './preview-cue.js';

type Quality = 'auto' | '480p' | '720p' | '1080p';
type Props = {
  onMinimize?:()=>void;
  onMinimizeMove?:(offset:number)=>void;
  mini?:{onExpand:()=>void;expandLabel:string};
  onPlayIntent?:(kind:"resume"|"restart")=>void;
  previousHref?:string; nextHref?:string; onNavigate?:(href:string)=>void;
  live?: LivePlayerState; followLive?:boolean; onDvr?:()=>void; onReturnToLive?:()=>void;
  container: RefObject<HTMLDivElement | null>; videoRef: RefObject<HTMLVideoElement | null>;
  playbackMediaRef?:RefObject<HTMLMediaElement|null>; onMediaPlay?:()=>void; onMediaPause?:()=>void; mediaOwner?:number; playbackPaused?:boolean; playbackVolume?:{muted:boolean;volume:number}; onMediaVolume?:(value:{muted?:boolean;volume?:number})=>void;
  playbackUrl: string; watermark?: string; labels: PlayerLabels;
  quality: Quality; activeHeight?:number|null; qualities: Exclude<Quality, 'auto'>[]; autoplayBlocked?:boolean; loading: boolean; buffering?:boolean; failed: boolean;
  onPlaybackChange?: (value:Partial<Pick<PlayerBookmark,'time'|'paused'|'rate'|'intent'>>)=>void;
  onQualityChange: (quality: Quality) => void; onPlayingChange?: (playing: boolean) => void;
};

const visibleSnapshot=()=>document.visibilityState==='visible';
const subscribeVisibility=(notify:()=>void)=>{document.addEventListener('visibilitychange',notify);return()=>document.removeEventListener('visibilitychange',notify);};

const touchQuery = '(pointer: coarse)';
const touchSnapshot = () => typeof window.matchMedia === 'function' && window.matchMedia(touchQuery).matches;
const subscribeTouch = (notify:()=>void) => {
  const query = window.matchMedia?.(touchQuery);
  query?.addEventListener?.('change', notify);
  return () => query?.removeEventListener?.('change', notify);
};

export function playerClock(seconds: number) {
  const total = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  return total >= 3600 ? `${Math.floor(total / 3600)}:${String(Math.floor(total / 60) % 60).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}` : `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export function PlayerChrome({container, videoRef, playbackMediaRef, onMediaPlay, onMediaPause, mediaOwner, playbackPaused, playbackVolume, onMediaVolume, playbackUrl, watermark, labels, quality, activeHeight, qualities, autoplayBlocked=false, loading, buffering=false, failed, onQualityChange, onPlaybackChange,onPlayingChange,live,followLive=true,onDvr,onReturnToLive,previousHref,nextHref,onNavigate,onMinimize,onMinimizeMove,mini:miniPresentation,onPlayIntent}: Props) {
  const mediaRef=playbackMediaRef??videoRef;
  const pageVisible=useSyncExternalStore(subscribeVisibility,visibleSnapshot,()=>true);
  const touchUI = useSyncExternalStore(subscribeTouch, touchSnapshot, () => false);
  const fullscreenState = usePlayerFullscreen(container, videoRef, touchUI||Boolean(playbackMediaRef));
  const fullscreen = fullscreenState.mode !== 'inline';
  const mini = fullscreen ? undefined : miniPresentation;
  const minimize = fullscreen || mini ? undefined : onMinimize;
  const [ended,setEnded]=useState(false), [playBlocked,setPlayBlocked]=useState(false);
  const [playing, setPlaying] = useState(false), [waiting, setWaiting] = useState(true);
  const [muted, setMuted] = useState(false), [volume, setVolume] = useState(1), [rate, setRate] = useState(1);
  const [liveRange,setLiveRange]=useState<ReturnType<typeof liveWindow>>(null);
  const [time, setTime] = useState(0), [duration, setDuration] = useState(0), [buffered, setBuffered] = useState(0);
  const [theater,setTheater]=useState(false);
  const [settingsView,setSettingsView]=useState<'root'|'speed'|'quality'>('root');
  const [settings, setSettings] = useState(false), [visible, setVisible] = useState(true);
  const [feedback, setFeedback] = useState<{kind: 'play' | 'pause' | 'back' | 'forward'; id: number; seconds?:number} | null>(null);
  const [preview, setPreview] = useState<number | null>(null), [scrub, setScrub] = useState<number | null>(null);
  const saveData=typeof navigator!=='undefined'&&(navigator as Navigator&{connection?:{saveData?:boolean}}).connection?.saveData===true;
  const warmPreviews=!live&&!failed&&!loading&&!waiting&&!buffering&&duration>0&&!saveData&&pageVisible;
  const cues = usePreviewIndex(playbackUrl, Boolean(live), !failed && pageVisible && (preview !== null || scrub !== null), warmPreviews);
  const preloadSprites=useMemo(()=>Array.from(new Set(cues.map(cue=>cue.url))),[cues]);
  const [holding, setHolding] = useState(false);
  const suppressGestureClick = useRef(false);
  const gesture = useRef<{id:number;x:number;y:number;moved:boolean;held:boolean;canMinimize:boolean;minimizing:boolean;threshold:number;rate:number|null}|null>(null);
  const holdTimer = useRef(0), tapTimer = useRef(0), playCommand=useRef(0);
  const desktopClick=useRef<Pick<PlayerBookmark,'time'|'paused'|'rate'|'intent'>|null>(null);
  useEffect(()=>()=>{desktopClick.current=null;++playCommand.current;},[playbackUrl]);
  const lastTap = useRef<{time:number;side:'back'|'forward'|'center'}|null>(null);
  const hideTimer = useRef(0), feedbackTimer = useRef(0), dragging = useRef(false), previewFrame=useRef(0);
  useEffect(()=>()=>window.cancelAnimationFrame(previewFrame.current),[playbackUrl]);
  const menu = useRef<HTMLDivElement>(null), settingsButton = useRef<HTMLButtonElement>(null);
  const playingCallback = useRef(onPlayingChange);
  useEffect(() => { playingCallback.current = onPlayingChange; }, [onPlayingChange]);

  useEffect(() => {
    const video = mediaRef.current;
    if (!video) return;
    const updatePlay = () => {setEnded(!live&&video.ended);if(!video.paused)setPlayBlocked(false); setPlaying(!(playbackPaused??video.paused) && !video.ended); playingCallback.current?.(!video.paused && !video.ended); };
    const updateTime = () => {setTime(video.currentTime);setEnded(!live&&video.ended);};
    const updateDuration = () => {const range=live ? liveWindow(video.seekable,live.verifiedEnd):null;setLiveRange(range);setDuration(live ? (live.ended?range?.end:range?.edge)??0 : Number.isFinite(video.duration) ? video.duration : 0);};
    const updateVolume = () => { setMuted(playbackVolume?.muted??video.muted); setVolume(playbackVolume?.volume??video.volume); };
    const updateRate = () => setRate(video.playbackRate);
    const updateBuffer = () => {
      let end = video.currentTime;
      for (let i = 0; i < video.buffered.length; i++) if (video.buffered.start(i) <= video.currentTime + 1) end = Math.max(end, video.buffered.end(i));
      setBuffered(end);
    };
    const startWait = () => setWaiting(true), endWait = () => setWaiting(false);
    const events: [string, () => void][] = [['play', updatePlay], ['pause', updatePlay], ['ended', updatePlay], ['timeupdate', updateTime], ['seeked',updatePlay], ['durationchange', updateDuration], ['loadedmetadata',updateDuration], ['volumechange', updateVolume], ['ratechange', updateRate], ['progress', updateBuffer], ['progress', updateDuration], ['canplay',updateDuration], ['loadstart', startWait], ['seeking', startWait], ['waiting', startWait], ['playing', endWait], ['canplay', endWait], ['seeked', endWait], ['pause', endWait], ['ended', endWait], ['error', endWait]];
    for (const [event, handler] of events) video.addEventListener(event, handler);
    updatePlay(); updateTime(); updateDuration(); updateVolume(); updateRate();
    return () => { for (const [event, handler] of events) video.removeEventListener(event, handler); };
  }, [container, mediaRef,live,mediaOwner,playbackPaused,playbackVolume?.muted,playbackVolume?.volume]);

  useEffect(()=>{container.current?.focus({preventScroll:true});},[container]);

  useEffect(() => {
    const video=mediaRef.current;
    return () => { window.clearTimeout(hideTimer.current); window.clearTimeout(feedbackTimer.current); window.clearTimeout(holdTimer.current); window.clearTimeout(tapTimer.current);
      if (gesture.current?.rate != null && video) video.playbackRate = gesture.current.rate;
    };
  }, [mediaRef,mediaOwner]);

  const showControls = () => {
    setVisible(true);
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => {
      if (!dragging.current && !menu.current && !container.current?.querySelector('[data-controls] :focus-visible') && (touchUI || !container.current?.querySelector('[data-controls]:hover'))) setVisible(false);
    }, 2500);
  };
  useEffect(() => {
    if (!settings) return;
    const close = (event: PointerEvent) => { if (event.target instanceof Node && !menu.current?.contains(event.target) && !settingsButton.current?.contains(event.target)) {setSettings(false); showControls();} };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  });

  useEffect(()=>{
    const selected=menu.current?.querySelector<HTMLElement>('[aria-checked="true"]');
    if(settings&&selected&&menu.current)menu.current.scrollTop=Math.max(0,selected.offsetTop-menu.current.clientHeight/2);
    if(settings)(menu.current?.querySelector<HTMLElement>('[aria-checked="true"]')??menu.current?.querySelector('button'))?.focus({preventScroll:true});
  },[settings,settingsView]);
  const closeSettings=()=>{setSettings(false);settingsButton.current?.focus();showControls();};
  const openSettings=()=>{setSettingsView('root');setSettings(value=>!value);showControls();};
  const chooseSetting=(event:ReactMouseEvent<HTMLButtonElement>)=>{const value=event.currentTarget.value;if(settingsView==='speed')changeRate(Number(value));else onQualityChange(value as Quality);closeSettings();};
  const menuKeys=(event:ReactKeyboardEvent<HTMLDivElement>)=>{
    const buttons=Array.from(menu.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')??[]);
    const index=buttons.indexOf(document.activeElement as HTMLButtonElement);
    if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){
      event.preventDefault();event.stopPropagation();
      buttons[event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(event.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length]?.focus();
    }else if(event.key==='Escape'||event.key==='ArrowLeft'){
      event.preventDefault();event.stopPropagation();if(event.key==='ArrowLeft'&&settingsView!=='root')setSettingsView('root');else closeSettings();
    }
  };
  const play = (video:HTMLMediaElement) => {
    const command=++playCommand.current;
    if(onMediaPlay){onMediaPlay();return;}
    void video.play().catch(()=>{if(command===playCommand.current)setPlayBlocked(true);});
  };
  const toggle = () => {
    const video = mediaRef.current;
    if (!video) return;
    if(ended&&video.ended&&!live){onPlayIntent?.("restart");video.currentTime=0;setTime(0);setEnded(false);onPlaybackChange?.({time:0,paused:false});play(video);showControls();return;}
    const paused=playbackPaused??video.paused;
    const kind = paused ? 'play' : 'pause';
    onPlaybackChange?.({paused:!paused});
    if (paused) {onPlayIntent?.("resume");play(video);} else {++playCommand.current;onDvr?.();if(onMediaPause)onMediaPause();else video.pause();}
    if (!touchUI) {
      setFeedback({kind, id: Date.now()});
      window.clearTimeout(feedbackTimer.current);
      feedbackTimer.current = window.setTimeout(() => setFeedback(null), 1000);
    }
    showControls();
  };
  const navigate=(event:ReactMouseEvent<HTMLAnchorElement>,href:string)=>{
    if(onNavigate&&!event.metaKey&&!event.ctrlKey&&!event.shiftKey&&!event.altKey&&event.button===0){event.preventDefault();onNavigate(href);}
  };
  const toggleFullscreen = fullscreenState.toggle;
  const seekStart = liveRange?.start ?? 0;
  const seek = (value: number) => {
    const video=mediaRef.current;
    if(!video || duration<=seekStart)return;
    if(live?.canFollow&&!video.paused&&value>=duration-.1){onReturnToLive?.();setTime(duration);return;}
    onDvr?.();video.currentTime=Math.min(duration,Math.max(seekStart,value));setTime(video.currentTime);
    if(!live)setEnded(false);
    onPlaybackChange?.({time:video.currentTime});
  };
  const seekBy = (seconds:number) => {
    const video=mediaRef.current;
    if (!video || duration <= seekStart || live&&seconds>0&&video.currentTime>=duration) return;
    seek(video.currentTime + seconds);
    const kind=seconds<0?'back':'forward';
    setFeedback(previous=>({kind,id:(previous?.id??0)+1,seconds:(previous?.kind===kind?previous.seconds??0:0)+Math.abs(seconds)}));
    window.clearTimeout(feedbackTimer.current);
    feedbackTimer.current=window.setTimeout(()=>setFeedback(null),900);
  };
  const changeVolume=(value:{muted?:boolean;volume?:number})=>{if(onMediaVolume){onMediaVolume(value);return;}const media=mediaRef.current;if(media){if(value.muted!==undefined)media.muted=value.muted;if(value.volume!==undefined)media.volume=value.volume;}};
  const changeRate=(rate:number)=>{if(mediaRef.current){if(live)onDvr?.();mediaRef.current.playbackRate=rate;onPlaybackChange?.({rate});}};
  const finishGesture = (resetOffset: boolean) => {
    const active = gesture.current;
    desktopClick.current=null;
    window.clearTimeout(holdTimer.current);
    if (gesture.current?.rate != null) changeRate(gesture.current.rate);
    gesture.current = null; setHolding(false);
    if (active?.moved || active?.held) suppressGestureClick.current = true;
    if (active && resetOffset) onMinimizeMove?.(0);
  };
  const cancelGesture = () => finishGesture(true);
  const pointerDown = (event:ReactPointerEvent<HTMLButtonElement>) => {
    suppressGestureClick.current = false;
    if (event.pointerType !== 'touch' || mini) return;
    if (!event.isPrimary) {cancelGesture();window.clearTimeout(tapTimer.current);lastTap.current=null;return;}
    gesture.current = {id:event.pointerId,x:event.clientX,y:event.clientY,moved:false,held:false,minimizing:false,canMinimize:event.clientX>=24&&event.clientX<=window.innerWidth-24,threshold:Math.min(120,Math.max(64,(container.current?.getBoundingClientRect().height??0)*0.25)),rate:null};
    event.currentTarget.setPointerCapture(event.pointerId);
    holdTimer.current = window.setTimeout(() => {
      const video = mediaRef.current, active = gesture.current;
      if (video && active && !active.moved && !video.paused && !failed && !loading) {
        window.clearTimeout(tapTimer.current);lastTap.current=null;
        active.held = true;active.rate = video.playbackRate;changeRate(2);setHolding(true);
      }
    }, 450);
  };
  const pointerMove = (event:ReactPointerEvent<HTMLButtonElement>) => {
    const active = gesture.current;
    if (!active || active.id !== event.pointerId) return;
    if (active.moved || Math.hypot(event.clientX-active.x,event.clientY-active.y)>12) {
      active.moved=true;window.clearTimeout(holdTimer.current);
      if (minimize && active.canMinimize && !active.held && event.clientY-active.y >= Math.abs(event.clientX-active.x)*1.5) {
        active.minimizing = true;
        onMinimizeMove?.(event.clientY-active.y);
        window.clearTimeout(tapTimer.current);lastTap.current=null;
      } else onMinimizeMove?.(0);
      if (active.rate != null && mediaRef.current) {changeRate(active.rate);active.rate=null;setHolding(false);}
    }
  };
  const pointerUp = (event:ReactPointerEvent<HTMLButtonElement>) => {
    const active = gesture.current;
    if (!active || active.id !== event.pointerId) return;
    const dx=event.clientX-active.x,dy=event.clientY-active.y,held=active.rate!=null;
    const committed = Boolean(minimize && active.canMinimize && active.minimizing && !active.held && dy >= active.threshold && dy >= Math.abs(dx)*1.5);
    finishGesture(!committed);
    if (held) return;
    if (committed) {
      window.clearTimeout(tapTimer.current);lastTap.current=null;
      minimize?.();
      return;
    }
    if (Math.abs(dy)>60 && Math.abs(dy)>Math.abs(dx)*1.5) {
      window.clearTimeout(tapTimer.current);lastTap.current=null;
      if (dy<0 && !fullscreen) void toggleFullscreen();
      else if (dy>0 && fullscreen) void fullscreenState.exit();
      return;
    }
    if (active.moved) return;
    const bounds=event.currentTarget.getBoundingClientRect();
    const fraction=bounds.width>0?(event.clientX-bounds.left)/bounds.width:0.5;
    const side=fraction<0.35?'back':fraction>0.65?'forward':'center';
    const previous=lastTap.current,now=Date.now();
    window.clearTimeout(tapTimer.current);
    if (previous && now-previous.time<280 && previous.side===side && side!=='center') {
      lastTap.current={time:now,side};seekBy(side==='back'?-10:10);showControls();
    } else {
      lastTap.current={time:now,side};
      tapTimer.current=window.setTimeout(()=>{lastTap.current=null;if(visible){window.clearTimeout(hideTimer.current);setVisible(false);}else showControls();},280);
    }
  };
  const keyDown = (event: KeyboardEvent) => {
    if(event.defaultPrevented||event.target instanceof HTMLElement&&event.target.closest('[role=menu]'))return;
    if (event.key === 'Escape' && settings) { event.preventDefault(); event.stopPropagation(); setSettings(false); settingsButton.current?.focus(); showControls(); return; }
    const key = event.key.toLowerCase();
    const seekInput=event.target instanceof HTMLInputElement && event.target.getAttribute('aria-label')===labels.seek;
    if (event.altKey || event.ctrlKey || event.metaKey || event.target instanceof HTMLElement && (event.target.closest('input,select,textarea,[contenteditable=true]') && !seekInput || event.key === ' ' && event.target.closest('button'))) return;
    if (![' ', 'k', 'arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'j', 'l', 'm', 'f', 't', '<', '>', 'home', 'end'].includes(key) && !/^[0-9]$/.test(key) && !(event.shiftKey && ['p','n'].includes(key))) return;
    event.preventDefault();
    if (event.repeat && [' ', 'k', 'm', 'f', 't', 'p', 'n'].includes(key)) return;
    if (key === ' ' || key === 'k') toggle();
    else if (key === 'f') void toggleFullscreen();
    else if (key === 'm' && mediaRef.current) changeVolume({muted:!(playbackVolume?.muted??mediaRef.current.muted)});
    else if (key === 't') {if(!touchUI && labels.theaterMode && labels.exitTheaterMode)setTheater(value=>!value);}
    else if (key === 'p' || key === 'n') { const href=key==='p'?previousHref:nextHref;if(href)onNavigate ? onNavigate(href) : window.location.assign(href); }
    else if (key === 'arrowup' || key === 'arrowdown') { const video=mediaRef.current;if(video){changeVolume({volume:Math.min(1,Math.max(0,(playbackVolume?.volume??video.volume)+(key==='arrowup' ? 0.05 : -0.05))),muted:false});} }
    else if (key === '<' || key === '>') { const video=mediaRef.current;if(video)changeRate(Math.min(2,Math.max(.5,video.playbackRate+(key==='>' ? 0.25 : -0.25)))); }
    else if (key === 'home' || key === 'end' || /^[0-9]$/.test(key)) seek(key==='end'?duration:key==='home'?seekStart:seekStart+(duration-seekStart)*Number(key)/10);
    else seekBy(key === 'arrowleft' ? -5 : key === 'arrowright' ? 5 : key === 'j' ? -10 : 10);
    showControls();
  };
  // Bind shortcuts to this focused player; editable fields retain their keys.
  useEffect(() => {
    const root = container.current;
    if (!root) return;
    const keyboard = (event: KeyboardEvent) => keyDown(event);
    root.addEventListener('keydown', keyboard);
    const mouseMove = (event:PointerEvent) => {if(event.pointerType!=='touch')showControls();};
    root.addEventListener('pointermove', mouseMove);
    root.addEventListener('focusin', showControls);
    root.addEventListener('focusout', showControls);
    root.addEventListener('pointerleave', showControls);
    const video = mediaRef.current;
    video?.addEventListener('play', showControls);
    video?.addEventListener('pause', showControls);
    video?.addEventListener('canplay', showControls);
    return () => { root.removeEventListener('keydown', keyboard); root.removeEventListener('pointermove', mouseMove); root.removeEventListener('focusin', showControls); root.removeEventListener('focusout', showControls); root.removeEventListener('pointerleave', showControls); video?.removeEventListener('play', showControls); video?.removeEventListener('pause', showControls); video?.removeEventListener('canplay', showControls); };
  });

  const cancelScrub=()=>{window.cancelAnimationFrame(previewFrame.current);dragging.current=false;setScrub(null);setPreview(null);};
  const current = scrub ?? time;
  const updatePreview = (event:ReactPointerEvent<HTMLInputElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    if (duration > 0 && bounds.width > 0) {
      const next=Math.min(duration - 0.001, Math.max(seekStart, seekStart + (event.clientX - bounds.left) / bounds.width * (duration - seekStart)));
      window.cancelAnimationFrame(previewFrame.current);
      if(event.type==='pointerenter')flushSync(()=>setPreview(next));
      else previewFrame.current=window.requestAnimationFrame(()=>flushSync(()=>setPreview(next)));
    }
  };
  const previewTime = scrub ?? preview;
  const visibleCues = live ? cues.filter(cue => cue.start >= seekStart && cue.end <= duration) : cues;
  const targetTime=previewTime??(warmPreviews?time:null);
  const cue = targetTime === null ? undefined : previewCueAt(visibleCues,targetTime);
  const neighbor = cue&&!saveData ? visibleCues.find(item => item.start >= cue.end && item.url !== cue.url)?.url : undefined;
  const controlsVisible = visible || autoplayBlocked || playBlocked || settings || scrub !== null;
  useEffect(() => {
    const root=container.current;if(!root)return;
    root.setAttribute('data-mini',String(Boolean(mini)));root.setAttribute('data-theater',String(theater&&!touchUI&&!mini));root.setAttribute('data-touch',String(touchUI));root.setAttribute('data-controls-visible',String(controlsVisible));
    return()=>{root.removeAttribute('data-mini');root.removeAttribute('data-theater');root.removeAttribute('data-touch');root.removeAttribute('data-controls-visible');};
  }, [container,touchUI,controlsVisible,theater,mini]);
  const atLive = Boolean(live?.canFollow && followLive && liveRange && playing && rate===1 && !loading && !buffering && !waiting && !failed && scrub===null && current >= liveRange.edge - LIVE_EDGE_TOLERANCE_SECONDS);
  const seekDisabled = duration <= seekStart;
  const showLiveEdgeThumb = Boolean(live && !live.ended && seekDisabled);
  const displayedTime = atLive ? duration : current;
  const percentage = (value: number) => duration > seekStart ? `${Math.min(100, Math.max(0, (value - seekStart) / (duration - seekStart) * 100))}%` : '0%';
  return <>
    <button type="button" className={styles.surface} data-player-surface aria-label={mini&&touchUI?mini.expandLabel:labels.togglePlayback} tabIndex={mini&&touchUI?0:-1} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={cancelGesture} onLostPointerCapture={cancelGesture} onContextMenu={event=>{if(touchUI)event.preventDefault();}} onClick={event=>{
      const suppress = suppressGestureClick.current;
      suppressGestureClick.current = false;
      if (suppress && event.detail > 0) {event.preventDefault(); return;}
      if(mini&&touchUI){mini.onExpand();return;}
      if(event.detail===0){desktopClick.current=null;toggle();return;}
      if(touchUI)return;container.current?.focus({preventScroll:true});
      const video=mediaRef.current;
      if(event.detail===1&&video){desktopClick.current={paused:playbackPaused??video.paused,time:video.currentTime,rate:video.playbackRate,intent:followLive?'followLive':'dvr'};toggle();}
    }} onDoubleClick={()=>{
      if(touchUI)return;
      const saved=desktopClick.current,video=mediaRef.current;desktopClick.current=null;
      if(saved&&video){
        ++playCommand.current;
        const restoreTime=saved.paused&&video.currentTime!==saved.time?saved.time:undefined;
        video.playbackRate=saved.rate;if(restoreTime!==undefined)video.currentTime=restoreTime;
        onPlaybackChange?.({paused:saved.paused,rate:saved.rate,intent:saved.intent,...(restoreTime===undefined?{}:{time:restoreTime})});
        if(saved.paused){if(onMediaPause)onMediaPause();else video.pause();}else play(video);
        setFeedback(null);setPlayBlocked(false);showControls();
      }
      void toggleFullscreen();
    }} />
    {mini ? <button type="button" data-controls className="hhc-player-miniAction" aria-label={touchUI ? (playing ? labels.pause : labels.play) : mini.expandLabel} onClick={touchUI ? toggle : mini.onExpand}>{touchUI ? (playing ? <Pause/> : <Play/>) : <ArrowUpRight/>}</button> : null}
    {watermark ? <RecordingWatermark container={container} videoRef={videoRef} code={watermark}/> : null}
    {fullscreenState.error ? <div className={styles.fullscreenError} role="alert">{labels.fullscreenError}</div> : null}
    {holding ? <div className={styles.speedFeedback} aria-hidden="true">2×</div> : null}
    {feedback ? <div className={`${styles.feedback} ${feedback.kind==='back'?styles.seekBack:feedback.kind==='forward'?styles.seekForward:styles.playbackFeedback}`} aria-hidden="true"><span key={feedback.id}>{feedback.kind === 'play' ? <Play size={36} fill="currentColor"/> : feedback.kind === 'pause' ? <Pause size={36} fill="currentColor"/> : <><span className={styles.seekArrows}>{touchUI ? <><i/><i/><i/></> : feedback.kind==='back' ? <ChevronLeft/> : <ChevronRight/>}</span><span>{feedback.kind==='back'?'−':'+'}{feedback.seconds}</span><span className={styles.srOnly}>{labels.seek}</span></>}</span></div> : null}
    {(loading || buffering || waiting) && !autoplayBlocked && !playBlocked && !failed && !feedback ? <div className={styles.loading} role="status"><LoaderCircle aria-hidden="true"/><span className={styles.srOnly}>{labels.buffering}</span></div> : null}
    {!ended&&!(mini&&touchUI)&&(touchUI || mini || (autoplayBlocked||playBlocked) && !failed) ? <div data-controls className={`${styles.centerControls} ${controlsVisible ? '' : styles.hidden}`}>
      {!mini && touchUI && previousHref && labels.previousVideo ? <a href={previousHref} onClick={event=>navigate(event,previousHref)} className={styles.skip} aria-label={labels.previousVideo}><SkipBack fill="currentColor"/></a> : <span/>}
      {(!loading && !buffering && !waiting || autoplayBlocked||playBlocked) && !failed ? <button type="button" className={styles.centerPlay} aria-label={playing ? labels.pause : labels.play} onClick={toggle}>{playing ? <Pause fill="currentColor"/> : <Play fill="currentColor"/>}</button> : <span/>}
      {!mini && touchUI && nextHref && labels.nextVideo ? <a href={nextHref} onClick={event=>navigate(event,nextHref)} className={styles.skip} aria-label={labels.nextVideo}><SkipForward fill="currentColor"/></a> : <span/>}
    </div> : null}
    {touchUI ? <div data-controls className={`${styles.topControls} ${controlsVisible ? '' : styles.hidden}`}>
      {fullscreen ? <button type="button" className={styles.button} aria-label={labels.exitFullscreen} onClick={()=>void fullscreenState.exit()}><ChevronDown/></button> : minimize && labels.minimize ? <button type="button" className={styles.button} aria-label={labels.minimize} onClick={minimize}><ChevronDown/></button> : <span/>}
      <button ref={settingsButton} type="button" className={styles.button} aria-label={labels.settings} aria-expanded={settings} onClick={openSettings}><Settings/></button>
    </div> : null}
    {(autoplayBlocked||playBlocked) && !failed && labels.tapToPlay ? <p className={styles.playPrompt} role="status">{labels.tapToPlay}</p> : null}
    {ended&&!failed?<div className={styles.replay}><button type="button" className={styles.centerPlay} aria-label={labels.replay??'Replay'} onClick={toggle}><RotateCcw/></button><span>{labels.replay??'Replay'}</span></div>:null}
    {settings ? <div ref={menu} data-controls className={styles.settings} role="menu" aria-label={settingsView==='root'?labels.settings:settingsView==='speed'?labels.playbackSpeed:labels.quality} onKeyDown={menuKeys}>
      {settingsView==='root'?<>
        <button type="button" role="menuitem" aria-label={labels.playbackSpeed} onClick={()=>setSettingsView('speed')}><span>{labels.playbackSpeed}</span><span>{rate}× <ChevronRight size={18}/></span></button>
        <button type="button" role="menuitem" aria-label={labels.quality} disabled={loading||failed} onClick={()=>setSettingsView('quality')}><span>{labels.quality}</span><span>{quality==='auto'?`${labels.auto}${activeHeight?` (${activeHeight}p)`:''}`:quality} <ChevronRight size={18}/></span></button>
      </>:<>
        <button type="button" className={styles.settingsBack} role="menuitem" aria-label={labels.settingsBack??'Back'} onClick={()=>setSettingsView('root')}><ChevronLeft size={18}/><span>{settingsView==='speed'?labels.playbackSpeed:labels.quality}</span></button>
        {settingsView==='speed'?[0.5,0.75,1,1.25,1.5,1.75,2].map(value=><button key={value} type="button" role="menuitemradio" aria-checked={rate===value} value={value} onClick={chooseSetting}><span className={styles.check}>{rate===value?<Check size={18}/>:null}</span>{value}×</button>):(['auto',...qualities] as Quality[]).map(value=><button key={value} type="button" role="menuitemradio" aria-checked={quality===value} disabled={loading||failed} value={value} onClick={chooseSetting}><span className={styles.check}>{quality===value?<Check size={18}/>:null}</span>{value==='auto'?`${labels.auto}${activeHeight?` (${activeHeight}p)`:''}`:value}</button>)}
      </>}
    </div> : null}
    <div data-controls className={`${styles.controls} ${controlsVisible ? '' : styles.hidden}`}>
      <div className={styles.seek} data-live-edge-thumb={showLiveEdgeThumb || undefined} onPointerLeave={() => { if (!dragging.current) {window.cancelAnimationFrame(previewFrame.current);setPreview(null);} }}>
        <div className={styles.track} aria-hidden="true"><span className={styles.buffered} style={{width:percentage(buffered)}}/><span className={styles.played} style={{width:percentage(displayedTime)}}/></div>
        <input type="range" aria-label={labels.seek} aria-valuetext={`${playerClock(current)} / ${playerClock(duration)}`} min={seekStart} max={duration} step={0.1} value={Math.max(seekStart, Math.min(duration, displayedTime))} disabled={seekDisabled}
          onPointerEnter={updatePreview} onPointerMove={updatePreview}
          onPointerDown={event => { dragging.current = true; setScrub(Number(event.currentTarget.value)); event.currentTarget.setPointerCapture?.(event.pointerId); }}
          onChange={event => { const value = Number(event.target.value); if (dragging.current) setScrub(value); else seek(value); }}
          onPointerUp={event => { if(dragging.current)seek(Number(event.currentTarget.value));cancelScrub(); }}
          onPointerCancel={cancelScrub} onLostPointerCapture={cancelScrub} />
        {showLiveEdgeThumb ? <span className={styles.liveEdgeThumb} aria-hidden="true"/> : null}
        <div className={styles.preview} hidden={previewTime===null||duration<=0} aria-hidden="true" style={{left:`clamp(calc(var(--preview-width) / 2), ${percentage(previewTime??0)}, calc(100% - var(--preview-width) / 2))`}}>
          {!failed && cues.length > 0 ? <PreviewSprite key={`${playbackUrl}:${live?'live':'vod'}`} playbackUrl={playbackUrl} cue={cue} neighbor={neighbor} enabled={pageVisible&&!failed} preload={preloadSprites} preloadEnabled={warmPreviews}/> : null}
          <time>{playerClock(previewTime??0)}</time>
        </div>
      </div>
      <div className={styles.row}>
        {!touchUI ? <><button type="button" className={styles.button} aria-label={ended?labels.replay??'Replay':playing ? labels.pause : labels.play} title={`${playing ? labels.pause : labels.play} (k)}`} onClick={toggle}>{playing ? <Pause size={22} fill="currentColor"/> : <Play size={22} fill="currentColor"/>}</button>
        {previousHref && labels.previousVideo || nextHref && labels.nextVideo ? <div className={styles.skipGroup}>
          {previousHref && labels.previousVideo ? <a href={previousHref} onClick={event=>navigate(event,previousHref)} className={styles.button} aria-label={labels.previousVideo}><SkipBack size={20} fill="currentColor"/></a> : null}
          {nextHref && labels.nextVideo ? <a href={nextHref} onClick={event=>navigate(event,nextHref)} className={styles.button} aria-label={labels.nextVideo}><SkipForward size={20} fill="currentColor"/></a> : null}
        </div> : null}
        <div className={styles.volumeControl}><button type="button" className={styles.button} aria-label={muted || volume === 0 ? labels.unmute : labels.mute} title={`${muted || volume === 0 ? labels.unmute : labels.mute} (m)}`} onClick={() => { const video = mediaRef.current; if (video) { changeVolume((playbackVolume?.volume??video.volume)===0?{volume:1,muted:false}:{muted:!(playbackVolume?.muted??video.muted)}); } }}>{muted || volume === 0 ? <VolumeX size={22}/> : <Volume2 size={22}/>}</button>
        <input type="range" className={styles.volume} aria-label={labels.volume} min={0} max={1} step={0.05} value={muted ? 0 : volume} onChange={event => { if (mediaRef.current) { changeVolume({volume:Number(event.target.value),muted:false}); } }}/></div></> : null}
        {live ? <button type="button" className={`${styles.button} ${styles.liveButton}`} data-live-edge={atLive} disabled={!live.canFollow || !liveRange} aria-label={live.canFollow ? live.backToLive : live.label} title={live.canFollow ? live.backToLive : live.label} onClick={onReturnToLive}><span className={styles.liveDot} aria-hidden="true"/><span className={styles.liveText}>{live.canFollow ? live.liveLabel ?? live.label : live.label}</span></button> : <span className={styles.time} title={`${playerClock(current)} / ${playerClock(duration)}`}>{playerClock(current)} / {playerClock(duration)}</span>}<span className={styles.spacer}/>
        <div className={styles.rightControls}>
        {!touchUI && minimize && labels.minimize ? <button type="button" className={styles.button} aria-label={labels.minimize} onClick={minimize}><ChevronDown size={22}/></button> : null}
        {!touchUI ? <button ref={settingsButton} type="button" className={styles.button} aria-label={labels.settings} title={labels.settings} aria-expanded={settings} onClick={openSettings}><Settings size={22}/></button> : null}
        {!touchUI && labels.theaterMode && labels.exitTheaterMode ? <button type="button" className={`${styles.button} ${styles.theaterButton}`} aria-label={theater ? labels.exitTheaterMode : labels.theaterMode} title={`${theater ? labels.exitTheaterMode : labels.theaterMode} (t)}`} aria-pressed={theater} onClick={()=>setTheater(value=>!value)}><RectangleHorizontal size={22}/></button> : null}
        <button type="button" className={styles.button} aria-label={fullscreen ? labels.exitFullscreen : labels.fullscreen} title={`${fullscreen ? labels.exitFullscreen : labels.fullscreen} (f)}`} onClick={() => void toggleFullscreen()}>{fullscreen ? <Minimize size={22}/> : <Maximize size={22}/>}</button>
        </div>
      </div>
    </div>
  </>;
}
