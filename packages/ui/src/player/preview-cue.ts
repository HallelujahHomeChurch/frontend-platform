import type {PreviewCue} from './preview-index.js';

// Match the observed YouTube 10-second image cadence; pointer time stays exact.
export function previewCueAt(cues:PreviewCue[],time:number):PreviewCue|undefined {
  if(!Number.isFinite(time))return;
  const at=(value:number)=>{
    let low=0,high=cues.length;
    while(low<high){const mid=(low+high)>>>1;if(cues[mid].start<=value)low=mid+1;else high=mid;}
    const cue=cues[low-1];return cue&&value<cue.end?cue:undefined;
  };
  const current=at(time);
  // Never cross an unavailable interval or a clipped authorization boundary.
  return current?(at(Math.floor(time/10)*10)??current):undefined;
}
