import {expect,it} from 'vitest';
import {previewCueAt} from './preview-cue.js';
const cues=Array.from({length:12},(_,i)=>({start:i*5,end:(i+1)*5,url:`sheet-${Math.floor(i/6)}`,x:i%6*160}));
it('holds each image for ten seconds while selecting the correct next sheet',()=>{
  for(const time of [0,4.9,5,9.99])expect(previewCueAt(cues,time)).toBe(cues[0]);
  for(const time of [10,15,19.99])expect(previewCueAt(cues,time)).toBe(cues[2]);
  expect(previewCueAt(cues,35)).toBe(cues[6]);
  expect(previewCueAt(cues,59.99)).toBe(cues[10]);
});
it('respects clipped range starts, unavailable gaps and finite timeline bounds',()=>{
  expect(previewCueAt(cues.slice(7),36)).toBe(cues[7]);
  expect(previewCueAt(cues.slice(7),34)).toBeUndefined();
  const gap=cues.filter(cue=>cue.start!==10);
  expect(previewCueAt(gap,12)).toBeUndefined();
  expect(previewCueAt(gap,17)).toBe(cues[3]);
  for(const time of [-1,60,Infinity,NaN])expect(previewCueAt(cues,time)).toBeUndefined();
  expect(previewCueAt([],0)).toBeUndefined();
});
