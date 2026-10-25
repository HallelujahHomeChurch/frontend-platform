import type {PreviewCue} from './preview-index.js';

// Match the observed YouTube 10-second image cadence; pointer time stays exact.
export function previewCueAt(cues:PreviewCue[],time:number):PreviewCue|undefined {
  if(!Number.isFinite(time))return;
  const at=(value:number)=>{
    let low=0,high=cues.length;
    while(low<high){const mid=(low+high)>>>1;if(cues[mid].start<=value)low=mid+1;else high=mid;}
    return low-1;
  };
  const currentIndex=at(time),current=cues[currentIndex];
  if(!current||time>=current.end)return;
  const bucket=Math.floor(time/10)*10,index=at(bucket);
  // Actual fragment starts may drift past the nominal bucket; never select across a gap.
  const sampleIndex=cues[index]?.start===bucket?index:index+1,sample=cues[sampleIndex];
  if(!sample||sample.start>time)return current;
  for(let i=sampleIndex;i<currentIndex;i++)if(cues[i+1].start>cues[i].end+0.002)return current;
  return sample;
}
