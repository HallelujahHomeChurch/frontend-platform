import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {createPlayerDiagnostics} from './player-diagnostics.js';

beforeEach(()=>vi.useFakeTimers());
afterEach(()=>vi.useRealTimers());
function setup(){
  const video=document.createElement('video'), report=vi.fn();
  Object.defineProperties(video,{
    currentTime:{get:()=>120,set:()=>{throw new Error('diagnostics must not seek');}},
    playbackRate:{get:()=>1.25,set:()=>{throw new Error('diagnostics must not change rate');}},
  });
  return {video,report};
}
it('bounds rapid seeks to one fixed window and caps reports over the player lifetime',()=>{
  const {video,report}=setup(), observer=createPlayerDiagnostics(video,'live',report);
  observer.setBackend('hls');
  for(let window=0;window<5;window++){
    video.dispatchEvent(new Event('seeking'));
    vi.advanceTimersByTime(7000);
    for(let i=0;i<40;i++)video.dispatchEvent(new Event(i%2?'seeking':'waiting'));
    vi.advanceTimersByTime(1000);
  }
  expect(report).toHaveBeenCalledTimes(3);
  for(const [batch] of report.mock.calls){
    expect(batch).toMatchObject({version:1,backend:'hls',mode:'live',videoFrameSupport:'unsupported'});
    expect(batch.events).toHaveLength(24);
    expect(batch.events.every((event:{elapsedMs:number})=>event.elapsedMs<=8000)).toBe(true);
  }
  observer.dispose();
});
it('projects allowlisted HLS fields and a bounded number of frame samples without private data',()=>{
  const {video,report}=setup();
  let next=0;
  const frames=new Map<number,VideoFrameRequestCallback>();
  video.requestVideoFrameCallback=vi.fn(callback=>{frames.set(++next,callback);return next;});
  video.cancelVideoFrameCallback=vi.fn();
  const observer=createPlayerDiagnostics(video,'vod',report);observer.setBackend('hls');
  video.dispatchEvent(new Event('seeking'));
  observer.hlsError({type:'mediaError',details:'bufferStalledError',fatal:false,url:'private?token=secret',error:new Error('secret'),recordingId:'private'});
  observer.hlsError({type:'secret',details:'private?token=secret',fatal:false});
  for(let i=0;i<8;i++){
    frames.get(next)?.(0,{mediaTime:119.9,presentedFrames:i+1,private:'secret'} as unknown as VideoFrameCallbackMetadata);
    frames.delete(next);vi.advanceTimersByTime(1500);
  }
  vi.advanceTimersByTime(8000);
  expect(report).toHaveBeenCalledOnce();
  const batch=report.mock.calls[0][0];
  expect(batch.events.filter((event:{event:string})=>event.event==='frame')).toHaveLength(4);
  expect(batch.events).toContainEqual(expect.objectContaining({event:'hls-error',type:'mediaError',details:'bufferStalledError',fatal:false}));
  expect(batch.events).toContainEqual(expect.objectContaining({event:'hls-error',type:'unknown',details:'unknown'}));
  expect(JSON.stringify(batch)).not.toMatch(/secret|private|url|recordingId|stack/);
  observer.dispose();
});
it('cleans up listeners, timers and pending frame callbacks, and isolates reporter failures',()=>{
  const {video,report}=setup();video.requestVideoFrameCallback=vi.fn(()=>42);video.cancelVideoFrameCallback=vi.fn();
  report.mockImplementation(()=>{throw new Error('reporter unavailable');});
  const observer=createPlayerDiagnostics(video,'vod',report);
  video.dispatchEvent(new Event('seeking'));
  expect(()=>observer.dispose()).not.toThrow();
  expect(video.cancelVideoFrameCallback).toHaveBeenCalledWith(42);
  expect(report).toHaveBeenCalledOnce();
  video.dispatchEvent(new Event('seeking'));vi.runAllTimers();
  expect(report).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(0);
});
it('retains the latest recovery evidence when rapid events fill the bounded ring',()=>{
  const {video,report}=setup(), observer=createPlayerDiagnostics(video,'vod',report);
  video.dispatchEvent(new Event('seeking'));
  for(let i=0;i<40;i++)video.dispatchEvent(new Event('waiting'));
  observer.hlsError({type:'mediaError',details:'bufferSeekOverHole',fatal:false});
  video.dispatchEvent(new Event('playing'));vi.advanceTimersByTime(8000);
  const events=report.mock.calls[0][0].events;
  expect(events).toHaveLength(24);
  expect(events.at(-2)).toMatchObject({event:'hls-error',details:'bufferSeekOverHole'});
  expect(events.at(-1)).toMatchObject({event:'playing'});observer.dispose();
});
it('does not extend observation when background throttling delays the expiry timer',()=>{
  const {video,report}=setup();let now=0;vi.spyOn(performance,'now').mockImplementation(()=>now);
  const observer=createPlayerDiagnostics(video,'vod',report);video.dispatchEvent(new Event('seeking'));
  now=9000;observer.hlsError({type:'mediaError',details:'bufferStalledError'});
  expect(report).toHaveBeenCalledOnce();expect(report.mock.calls[0][0].events).toHaveLength(1);
  observer.dispose();expect(vi.getTimerCount()).toBe(0);vi.restoreAllMocks();
});
