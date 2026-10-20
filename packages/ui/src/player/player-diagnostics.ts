const mediaEvents=['seeking','waiting','seeked','playing','ratechange'] as const;
const errorTypes=['networkError','mediaError','muxError','keySystemError','otherError'];
const errorDetails=['bufferStalledError','bufferSeekOverHole','bufferNudgeOnStall','bufferAppendError','bufferAppendingError','fragLoadError','fragLoadTimeOut','fragParsingError'];
export type PlayerDiagnosticEvent={
  event:typeof mediaEvents[number]|'frame'|'hls-error';elapsedMs:number;
  currentTime?:number;rate?:number;readyState?:number;seeking:boolean;paused:boolean;
  videoTime?:number;presentedFrames?:number;type?:string;details?:string;fatal?:boolean;
};
export type PlayerDiagnostic={version:1;backend:'unknown'|'hls'|'native';mediaSource:'unknown'|'media-source'|'managed-media-source'|'none';mode:'live'|'vod';videoFrameSupport:'supported'|'unsupported';events:PlayerDiagnosticEvent[]};
const finite=(value:unknown,max:number)=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=max?value:undefined;

/** Observe at most three fixed seek windows; never control the media element. */
export function createPlayerDiagnostics(video:HTMLVideoElement,mode:'live'|'vod',report:(batch:PlayerDiagnostic)=>void){
  let backend:PlayerDiagnostic['backend']='unknown', disposed=false,active=false,windows=0,started=0;
  let mediaSource:PlayerDiagnostic['mediaSource']='unknown';
  let events:PlayerDiagnosticEvent[]=[],frames=0,frameId:number|undefined;
  let endTimer:ReturnType<typeof setTimeout>|undefined,frameTimer:ReturnType<typeof setTimeout>|undefined;
  let frameSupport:PlayerDiagnostic['videoFrameSupport']=typeof video.requestVideoFrameCallback==='function'&&typeof video.cancelVideoFrameCallback==='function'?'supported':'unsupported';
  const record=(event:PlayerDiagnosticEvent['event'],extra:Partial<PlayerDiagnosticEvent>={})=>{
    if(disposed||!active)return;
    if(performance.now()-started>=8000){close();return;}
    if(events.length===24)events.shift();
    events.push({event,elapsedMs:Math.min(8000,Math.max(0,performance.now()-started)),
      currentTime:finite(video.currentTime,604800),rate:finite(video.playbackRate,16),readyState:finite(video.readyState,4),
      seeking:video.seeking,paused:video.paused,...extra});
  };
  const close=()=>{
    active=false;clearTimeout(endTimer);clearTimeout(frameTimer);
    if(frameId!==undefined){try{video.cancelVideoFrameCallback(frameId);}catch{/* An unavailable decoder must not block cleanup. */}frameId=undefined;}
    const batch=events;events=[];
    if(batch.length){try{report({version:1,backend,mediaSource,mode,videoFrameSupport:frameSupport,events:batch});}catch{/* Diagnostics must not interrupt playback. */}}
  };
  const sampleFrame=()=>{
    if(!active||disposed||frames>=4||frameSupport==='unsupported')return;
    try{
      frameId=video.requestVideoFrameCallback((_now,metadata)=>{
        frameId=undefined;if(!active||disposed)return;
        frames++;record('frame',{videoTime:finite(metadata.mediaTime,604800),presentedFrames:finite(metadata.presentedFrames,1e9)});
        if(frames<4&&active&&!disposed)frameTimer=setTimeout(sampleFrame,1500);
      });
    }catch{frameSupport='unsupported';}
  };
  const handlers=mediaEvents.map(event=>{
    const handler=()=>{
      if(disposed)return;
      if(active&&performance.now()-started>=8000)close();
      if(event==='seeking'&&!active&&windows<3){active=true;windows++;frames=0;started=performance.now();endTimer=setTimeout(close,8000);sampleFrame();}
      record(event);
    };
    video.addEventListener(event,handler);return {event,handler};
  });
  return {
    setBackend(value:'hls'|'native',sourceName?:string){backend=value;mediaSource=value==='native'?'none':sourceName==='ManagedMediaSource'?'managed-media-source':sourceName==='MediaSource'?'media-source':'unknown';},
    hlsError(data:unknown){
      if(!data||typeof data!=='object')return;
      const {type,details,fatal}=data as Record<string,unknown>;
      record('hls-error',{type:typeof type==='string'&&errorTypes.includes(type)?type:'unknown',details:typeof details==='string'&&errorDetails.includes(details)?details:'unknown',fatal:fatal===true});
    },
    dispose(){if(disposed)return;disposed=true;close();for(const {event,handler} of handlers)video.removeEventListener(event,handler);},
  };
}
