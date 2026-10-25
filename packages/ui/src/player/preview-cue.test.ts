import {expect,it} from 'vitest';
import {previewCueAt} from './preview-cue.js';
const cues=Array.from({length:12},(_,i)=>({start:i*5,end:(i+1)*5,url:`sheet-${Math.floor(i/6)}`,x:i%6*160}));
it('holds each image for ten seconds while selecting the correct next sheet',()=>{
  for(const time of [0,4.9,5,9.99])expect(previewCueAt(cues,time)).toBe(cues[0]);
  for(const time of [10,15,19.99])expect(previewCueAt(cues,time)).toBe(cues[2]);
  expect(previewCueAt(cues,35)).toBe(cues[6]);
  expect(previewCueAt(cues,59.99)).toBe(cues[10]);
});
it('selects the first actual sample in each ten-second bucket when fragment PTS drifts',()=>{
  const drifted=Array.from({length:6},(_,i)=>({start:Math.floor(i/2)*10.01+i%2*5,end:Math.floor(i/2)*10.01+(i%2+1)*5,url:`sheet-${Math.floor(i/2)}`,x:0}));
  expect(previewCueAt(drifted,16)).toBe(drifted[2]);
  expect(previewCueAt(drifted,22)).toBe(drifted[4]);
  expect(previewCueAt(drifted,29)).toBe(drifted[4]);
  expect(previewCueAt(drifted,20.015)).toBeUndefined();
  const separated=[{start:10,end:12,url:'before-gap',x:0},{start:15,end:20,url:'after-gap',x:0}];
  expect(previewCueAt(separated,17)).toBe(separated[1]);
});
it('holds continuous short cues for ten seconds without crossing a real gap',()=>{
  const short=Array.from({length:20},(_,i)=>({start:i,end:i+1,url:`sheet-${i}`,x:0}));
  for(const time of [0.5,1.5,5.5,9.9])expect(previewCueAt(short,time)).toBe(short[0]);
  for(const time of [10.5,15.5,19.9])expect(previewCueAt(short,time)).toBe(short[10]);
  expect(previewCueAt(short.filter(cue=>cue.start!==5),8)).toBe(short[8]);
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
