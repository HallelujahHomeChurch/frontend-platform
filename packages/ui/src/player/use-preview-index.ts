import {useEffect, useRef, useState} from 'react';
import {loadPreviewIndex, type PreviewCue} from './preview-index.js';

export function usePreviewIndex(playbackUrl:string, live:boolean, active:boolean, warm=false) {
  const scope=`${playbackUrl}\n${live?'live':'vod'}`;
  const attempt=useRef({scope:'',time:-Infinity,complete:false});
  const [index,setIndex]=useState<{scope:string;cues:PreviewCue[]}>({scope:'',cues:[]});
  useEffect(()=>{
    if(attempt.current.scope!==scope)attempt.current={scope,time:-Infinity,complete:false};
    if(!active&&!warm||!live&&attempt.current.complete||!active&&attempt.current.time!==-Infinity)return;
    const controller=new AbortController();
    let timer=0;
    const refresh=async()=>{
      const wait=5000-(Date.now()-attempt.current.time);
      if(live&&wait>0){timer=window.setTimeout(()=>void refresh(),wait);return;}
      attempt.current.time=Date.now();
      try {
        const cues=await loadPreviewIndex(playbackUrl,controller.signal);
        if(!controller.signal.aborted){attempt.current.complete=cues.length>0;setIndex({scope,cues});}
      } catch {
        if(!controller.signal.aborted)setIndex({scope,cues:[]});
      } finally {
        if(live&&!controller.signal.aborted)timer=window.setTimeout(()=>void refresh(),5000);
      }
    };
    void refresh();
    return()=>{controller.abort();window.clearTimeout(timer);};
  },[playbackUrl,scope,live,active,warm]);
  // A replacement capture/session cannot paint even one frame from the old index.
  return index.scope===scope?index.cues:[];
}
